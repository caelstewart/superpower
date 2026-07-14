/**
 * Remote mode: Streamable HTTP MCP at /mcp + terminal-styled customer portal
 * at / (signup, key issuance, dashboard, billing links).
 *
 * MCP auth: bearer key must be an operator key (SUPERPOWER_API_KEYS env) or an
 * account key from the accounts table. Stateless per the 2026-07-28 MCP spec
 * direction. Billing: real Stripe integration — checkout sessions, customer
 * portal, signature-verified webhooks flipping account status automatically
 * (canceled accounts lose MCP access). Configure STRIPE_SECRET_KEY,
 * STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./server.js";
import { createStore } from "../db/database.js";
import {
  landingPage,
  keyIssuedPage,
  dashboardLoginPage,
  dashboardPage,
} from "../web/pages.js";
import {
  stripeConfig,
  createCheckoutSession,
  createPortalSession,
  verifyWebhookSignature,
  interpretEvent,
} from "../billing/stripe.js";

const SIGNUPS_PER_HOUR = 5;
const signupHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (signupHits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (hits.length >= SIGNUPS_PER_HOUR) return true;
  hits.push(now);
  signupHits.set(ip, hits);
  return false;
}

function html(res: ServerResponse, body: string, status = 200): void {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
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

export async function serveHttp(port: number): Promise<void> {
  const store = await createStore();
  const operatorKeys = (process.env.SUPERPOWER_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const stripe = stripeConfig();
  const billing = {
    stripeEnabled: !!stripe,
    paymentLink: process.env.STRIPE_PAYMENT_LINK,
    portalLink: process.env.STRIPE_PORTAL_LINK,
  };

  async function keyAllowed(token: string): Promise<boolean> {
    if (operatorKeys.includes(token)) return true;
    if (!token.startsWith("sp_live_")) return false;
    const account = await store.getAccountByKey(token);
    return !!account && account.stripe_status !== "canceled";
  }

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const path = url.pathname;

    try {
      // ---------- MCP ----------
      if (path === "/mcp") {
        // Auth is always required now that self-serve account keys exist —
        // an open /mcp would bypass the accounts system entirely.
        const auth = req.headers.authorization ?? "";
        const token = auth.replace(/^Bearer\s+/i, "");
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

      if (path === "/signup" && req.method === "POST") {
        const ip =
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
          req.socket.remoteAddress ??
          "?";
        if (rateLimited(ip)) {
          html(res, landingPage("rate limit: too many signups from your address — try again later"), 429);
          return;
        }
        const form = await readForm(req);
        const email = (form.get("email") ?? "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          html(res, landingPage("that email doesn't parse — try again"), 400);
          return;
        }
        const existing = await store.getAccountByEmail(email);
        if (existing) {
          html(res, landingPage("account exists for that email — log in with your api key below"), 409);
          return;
        }
        const apiKey = `sp_live_${randomBytes(24).toString("hex")}`;
        const account = await store.createAccount(email, apiKey);
        html(res, keyIssuedPage(account, baseUrl(req)));
        return;
      }

      if (path === "/dashboard" && req.method === "GET") {
        html(res, dashboardLoginPage());
        return;
      }

      if (path === "/dashboard" && req.method === "POST") {
        const form = await readForm(req);
        const key = (form.get("key") ?? "").trim();
        const account = key ? await store.getAccountByKey(key) : null;
        if (!account) {
          html(res, dashboardLoginPage("key not recognized"), 401);
          return;
        }
        html(res, dashboardPage(account, baseUrl(req), billing));
        return;
      }

      if (path === "/billing/checkout" && req.method === "POST" && stripe) {
        const form = await readForm(req);
        const account = await store.getAccountByKey((form.get("key") ?? "").trim());
        if (!account) {
          html(res, dashboardLoginPage("key not recognized"), 401);
          return;
        }
        const url = await createCheckoutSession(stripe, account.email, baseUrl(req));
        res.writeHead(303, { location: url }).end();
        return;
      }

      if (path === "/billing/portal" && req.method === "POST" && stripe) {
        const form = await readForm(req);
        const account = await store.getAccountByKey((form.get("key") ?? "").trim());
        if (!account || !account.stripe_customer_id) {
          html(res, dashboardLoginPage("no billing profile on this account yet"), 401);
          return;
        }
        const url = await createPortalSession(stripe, account.stripe_customer_id, baseUrl(req));
        res.writeHead(303, { location: url }).end();
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
    `superpower portal + MCP on http://localhost:${port} (mcp: /mcp, ${operatorKeys.length} operator key(s), account keys via db)`
  );
}
