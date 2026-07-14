/**
 * Remote mode: Streamable HTTP MCP at /mcp + terminal-styled customer portal.
 *
 * Auth model:
 *  - Portal: email magic links (Resend) → signed session cookie. Signup is
 *    email-verified; login links double as key recovery; keys are rotatable.
 *    Key-based login remains as a fallback for API-first users.
 *  - MCP: bearer key = operator key (SUPERPOWER_API_KEYS) or account key;
 *    canceled accounts are refused.
 *  - Billing: Stripe checkout + portal + signature-verified webhooks.
 * Stateless throughout (2026-07-28 MCP spec direction); sessions are signed
 * cookies, not server state.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./server.js";
import { createStore, type Store } from "../db/database.js";
import {
  landingPage,
  keyIssuedPage,
  checkEmailPage,
  dashboardLoginPage,
  dashboardPage,
} from "../web/pages.js";
import { makeSessionCookie, clearSessionCookie, readSession } from "../web/session.js";
import { emailEnabled, sendEmail, magicLinkEmail } from "../email/resend.js";
import {
  stripeConfig,
  createCheckoutSession,
  createPortalSession,
  verifyWebhookSignature,
  interpretEvent,
} from "../billing/stripe.js";

const HITS_PER_HOUR = 6;
const hits = new Map<string, number[]>();

function rateLimited(bucket: string): boolean {
  const now = Date.now();
  const arr = (hits.get(bucket) ?? []).filter((t) => now - t < 3_600_000);
  if (arr.length >= HITS_PER_HOUR) return true;
  arr.push(now);
  hits.set(bucket, arr);
  return false;
}

function html(res: ServerResponse, body: string, status = 200, extraHeaders: Record<string, string> = {}): void {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    ...extraHeaders,
  });
  res.end(body);
}

async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000) break;
  }
  return new URLSearchParams(body);
}

function baseUrl(req: IncomingMessage): string {
  const proto = (req.headers["x-forwarded-proto"] as string) ?? "http";
  const host = (req.headers["x-forwarded-host"] as string) ?? req.headers.host ?? "localhost";
  return `${proto}://${host}`;
}

function isSecure(req: IncomingMessage): boolean {
  return ((req.headers["x-forwarded-proto"] as string) ?? "") === "https";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function serveHttp(port: number): Promise<void> {
  const store: Store = await createStore();
  const operatorKeys = (process.env.SUPERPOWER_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const stripe = stripeConfig();
  const billing = { stripeEnabled: !!stripe };

  async function keyAllowed(token: string): Promise<boolean> {
    if (operatorKeys.includes(token)) return true;
    if (!token.startsWith("sp_live_")) return false;
    const account = await store.getAccountByKey(token);
    return !!account && account.stripe_status !== "canceled";
  }

  /** Send (or dev-expose) a magic link; returns the page to render. */
  async function sendMagicLink(req: IncomingMessage, email: string, purpose: "signup" | "login"): Promise<string> {
    const token = randomBytes(24).toString("base64url");
    const expires = new Date(Date.now() + 30 * 60_000).toISOString();
    await store.createLoginToken(token, email, purpose, expires);
    const link = `${baseUrl(req)}/auth?token=${token}`;
    if (emailEnabled()) {
      const { subject, html: body } = magicLinkEmail(link, purpose);
      await sendEmail(email, subject, body);
      return checkEmailPage(email);
    }
    // dev mode: no email provider — expose the link for local testing
    return checkEmailPage(email, link);
  }

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const path = url.pathname;

    try {
      // ---------- MCP ----------
      if (path === "/mcp") {
        const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
        if (!(await keyAllowed(token))) {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "unauthorized" }));
          return;
        }
        const server = buildServer(store);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on("close", () => {
          void transport.close();
          void server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res);
        return;
      }

      // ---------- portal ----------
      if (path === "/" && req.method === "GET") {
        html(res, landingPage());
        return;
      }

      // one email flow for both signup and login/recovery
      if ((path === "/signup" || path === "/login") && req.method === "POST") {
        const ip =
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
          req.socket.remoteAddress ??
          "?";
        const form = await readForm(req);
        const email = (form.get("email") ?? "").trim().toLowerCase();
        if (!EMAIL_RE.test(email)) {
          html(res, landingPage("that email doesn't parse — try again"), 400);
          return;
        }
        if (rateLimited(ip) || rateLimited(`mail:${email}`)) {
          html(res, landingPage("rate limit: too many attempts — try again later"), 429);
          return;
        }
        const existing = await store.getAccountByEmail(email);
        const page = await sendMagicLink(req, email, existing ? "login" : "signup");
        html(res, page);
        return;
      }

      if (path === "/auth" && req.method === "GET") {
        const token = url.searchParams.get("token") ?? "";
        const consumed = token ? await store.consumeLoginToken(token) : null;
        if (!consumed) {
          html(res, landingPage("that link is expired or already used — request a fresh one"), 400);
          return;
        }
        const cookie = makeSessionCookie(consumed.email, isSecure(req));
        let account = await store.getAccountByEmail(consumed.email);
        if (!account) {
          const apiKey = `sp_live_${randomBytes(24).toString("hex")}`;
          account = await store.createAccount(consumed.email, apiKey);
          html(res, keyIssuedPage(account, baseUrl(req), true), 200, { "set-cookie": cookie });
          return;
        }
        res.writeHead(303, { location: "/dashboard", "set-cookie": cookie }).end();
        return;
      }

      if (path === "/dashboard" && req.method === "GET") {
        const email = readSession(req.headers.cookie);
        const account = email ? await store.getAccountByEmail(email) : null;
        if (account) {
          html(res, dashboardPage(account, baseUrl(req), billing, url.searchParams.get("rotated") === "1"));
          return;
        }
        html(res, dashboardLoginPage());
        return;
      }

      // key-based login fallback (API-first users) — also starts a session
      if (path === "/dashboard" && req.method === "POST") {
        const form = await readForm(req);
        const key = (form.get("key") ?? "").trim();
        const account = key ? await store.getAccountByKey(key) : null;
        if (!account) {
          html(res, dashboardLoginPage("key not recognized"), 401);
          return;
        }
        html(res, dashboardPage(account, baseUrl(req), billing), 200, {
          "set-cookie": makeSessionCookie(account.email, isSecure(req)),
        });
        return;
      }

      if (path === "/account/rotate" && req.method === "POST") {
        const email = readSession(req.headers.cookie);
        const account = email ? await store.getAccountByEmail(email) : null;
        if (!account) {
          html(res, dashboardLoginPage("session expired — log in again"), 401);
          return;
        }
        const newKey = `sp_live_${randomBytes(24).toString("hex")}`;
        await store.rotateAccountKey(account.email, newKey);
        res.writeHead(303, { location: "/dashboard?rotated=1" }).end();
        return;
      }

      if (path === "/logout" && req.method === "POST") {
        res.writeHead(303, { location: "/", "set-cookie": clearSessionCookie() }).end();
        return;
      }

      if (path === "/billing/checkout" && req.method === "POST" && stripe) {
        const email = readSession(req.headers.cookie);
        const account = email ? await store.getAccountByEmail(email) : null;
        if (!account) {
          html(res, dashboardLoginPage("session expired — log in again"), 401);
          return;
        }
        const checkoutUrl = await createCheckoutSession(stripe, account.email, baseUrl(req));
        res.writeHead(303, { location: checkoutUrl }).end();
        return;
      }

      if (path === "/billing/portal" && req.method === "POST" && stripe) {
        const email = readSession(req.headers.cookie);
        const account = email ? await store.getAccountByEmail(email) : null;
        if (!account || !account.stripe_customer_id) {
          html(res, dashboardLoginPage("no billing profile on this account yet"), 401);
          return;
        }
        const portalUrl = await createPortalSession(stripe, account.stripe_customer_id, baseUrl(req));
        res.writeHead(303, { location: portalUrl }).end();
        return;
      }

      if (path === "/webhook/stripe" && req.method === "POST" && stripe) {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        if (!verifyWebhookSignature(raw, req.headers["stripe-signature"] as string, stripe.webhookSecret)) {
          res.writeHead(400, { "content-type": "application/json" }).end('{"error":"bad signature"}');
          return;
        }
        const event = JSON.parse(raw) as Record<string, unknown>;
        const outcome = interpretEvent(event);
        if (outcome.status) {
          if (outcome.email) {
            await store.setAccountStripe(outcome.email, outcome.customerId ?? "", "pro", outcome.status);
            console.error(`stripe: ${outcome.email} → ${outcome.status}`);
          } else if (outcome.customerId) {
            const account = await store.getAccountByStripeCustomer(outcome.customerId);
            if (account) {
              await store.setAccountStatus(account.email, outcome.status === "active" ? "pro" : account.plan, outcome.status);
              console.error(`stripe: ${account.email} → ${outcome.status}`);
            }
          }
        }
        res.writeHead(200, { "content-type": "application/json" }).end('{"received":true}');
        return;
      }

      if (path === "/healthz") {
        res.writeHead(200, { "content-type": "text/plain" }).end("ok");
        return;
      }

      res.writeHead(404, { "content-type": "text/plain" }).end("404");
    } catch (e) {
      console.error("http error:", (e as Error).message);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" }).end("500");
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(port, resolve));
  console.error(
    `superpower portal + MCP on http://localhost:${port} (email auth: ${emailEnabled() ? "resend" : "DEV MODE — links exposed on page"}, stripe: ${stripe ? "on" : "off"})`
  );
}
