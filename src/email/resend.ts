/**
 * Email via Resend (fetch, no SDK). Sender: Cael from Superpower.
 * Dev mode: with no RESEND_API_KEY, sends are skipped and the caller falls
 * back to exposing the link in an HTML comment (tests grep it).
 */
const FROM = process.env.SUPERPOWER_EMAIL_FROM ?? "Cael from Superpower <superpower@emails.mergelabs.co>";
const REPLY_TO = process.env.SUPERPOWER_EMAIL_REPLY_TO ?? "cael@mergelabs.co";

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html }),
  });
  if (!res.ok) {
    throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

export function magicLinkEmail(link: string, purpose: "signup" | "login"): { subject: string; html: string } {
  const subject = purpose === "signup" ? "Verify your email for Superpower" : "Your Superpower login link";
  const lead =
    purpose === "signup"
      ? "Thanks for signing up for Superpower. Click below to verify your email and create your account:"
      : "Here's your one-time link to log in to Superpower:";
  const cta = purpose === "signup" ? "Verify & create account" : "Log in";
  const html = `<!doctype html><html><body style="background:#0b0f0d;margin:0;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#111613;border:1px solid #1d3a28;border-radius:10px;padding:32px;color:#d6f5e2">
  <div style="font-family:ui-monospace,Menlo,Consolas,monospace;color:#33ff66;font-weight:700;font-size:18px;letter-spacing:.5px;margin-bottom:20px">SUPERPOWER</div>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#d6f5e2">${lead}</p>
  <p style="margin:0 0 28px"><a href="${link}" style="display:inline-block;background:#33ff66;color:#062012;font-weight:600;padding:13px 26px;text-decoration:none;border-radius:8px;font-size:15px">${cta}</a></p>
  <p style="font-size:13px;line-height:1.6;color:#7fb79a;margin:0 0 6px">This link expires in 30 minutes and can only be used once.</p>
  <p style="font-size:13px;line-height:1.6;color:#7fb79a;margin:0 0 24px">If you didn't request this, you can safely ignore this email — nothing happens without the link.</p>
  <p style="font-size:13px;line-height:1.6;color:#9fd4b8;margin:0">— Cael, Superpower</p>
  <hr style="border:none;border-top:1px solid #1d3a28;margin:24px 0 12px">
  <p style="font-size:11px;color:#5a8a6f;margin:0">Superpower · Merge Labs · © 2026 Stewart Ventures Inc.</p>
</div></body></html>`;
  return { subject, html };
}
