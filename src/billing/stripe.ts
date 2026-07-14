/**
 * Minimal Stripe integration over fetch — checkout sessions, customer portal,
 * webhook signature verification. No SDK dependency.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.stripe.com/v1";

export interface StripeConfig {
  secretKey: string;
  priceId: string;
  webhookSecret: string;
}

export function stripeConfig(): StripeConfig | null {
  const { STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID || !STRIPE_WEBHOOK_SECRET) return null;
  return {
    secretKey: STRIPE_SECRET_KEY,
    priceId: STRIPE_PRICE_ID,
    webhookSecret: STRIPE_WEBHOOK_SECRET,
  };
}

async function call(cfg: StripeConfig, path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = (data.error as { message?: string })?.message ?? res.status;
    throw new Error(`stripe ${path}: ${err}`);
  }
  return data;
}

export async function createCheckoutSession(
  cfg: StripeConfig,
  email: string,
  baseUrl: string
): Promise<string> {
  const session = await call(cfg, "/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": cfg.priceId,
    "line_items[0][quantity]": "1",
    customer_email: email,
    client_reference_id: email,
    success_url: `${baseUrl}/dashboard?checkout=success`,
    cancel_url: `${baseUrl}/dashboard?checkout=canceled`,
    allow_promotion_codes: "true",
  });
  return session.url as string;
}

export async function createPortalSession(
  cfg: StripeConfig,
  customerId: string,
  baseUrl: string
): Promise<string> {
  const session = await call(cfg, "/billing_portal/sessions", {
    customer: customerId,
    return_url: `${baseUrl}/dashboard`,
  });
  return session.url as string;
}

/** Stripe webhook signature: HMAC-SHA256 of "<timestamp>.<payload>" with the endpoint secret. */
export function verifyWebhookSignature(
  payload: string,
  sigHeader: string | undefined,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!sigHeader) return false;
  const parts = Object.create(null) as Record<string, string[]>;
  for (const kv of sigHeader.split(",")) {
    const [k, v] = kv.split("=", 2);
    if (!k || !v) continue;
    (parts[k.trim()] ??= []).push(v.trim());
  }
  const t = parts.t?.[0];
  const v1s = parts.v1 ?? [];
  if (!t || v1s.length === 0) return false;
  if (Math.abs(nowSeconds - parseInt(t, 10)) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return v1s.some((v1) => {
    try {
      return v1.length === expected.length && timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

export interface WebhookOutcome {
  email?: string;
  customerId?: string;
  status: "active" | "past_due" | "canceled" | null;
}

/** Map the events we subscribe to onto an account status change. */
export function interpretEvent(event: Record<string, unknown>): WebhookOutcome {
  const type = event.type as string;
  const obj = (event.data as { object?: Record<string, unknown> })?.object ?? {};
  if (type === "checkout.session.completed") {
    return {
      email: (obj.client_reference_id as string) ?? (obj.customer_email as string),
      customerId: obj.customer as string,
      status: "active",
    };
  }
  if (type === "customer.subscription.updated") {
    const s = obj.status as string;
    const status = s === "active" || s === "trialing" ? "active" : s === "past_due" || s === "unpaid" ? "past_due" : s === "canceled" ? "canceled" : null;
    return { customerId: obj.customer as string, status };
  }
  if (type === "customer.subscription.deleted") {
    return { customerId: obj.customer as string, status: "canceled" };
  }
  return { status: null };
}
