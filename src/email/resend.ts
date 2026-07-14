/**
 * Email via Resend (fetch, no SDK). Sender: superpower@emails.mergelabs.co.
 * Dev mode: with no RESEND_API_KEY, sends are skipped and the caller falls
 * back to exposing the link in an HTML comment (tests grep it).
 */
const FROM = process.env.SUPERPOWER_EMAIL_FROM ?? "superpower <superpower@emails.mergelabs.co>";

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

export function magicLinkEmail(link: string, purpose: "signup" | "login"): { subject: string; html: string } {
  const action = purpose === "signup" ? "verify your email and create your account" : "log in to your dashboard";
  const subject = purpose === "signup" ? "superpower — verify your email" : "superpower — your login link";
  const html = `<!doctype html><html><body style="background:#050807;color:#33ff66;font-family:ui-monospace,Menlo,Consolas,monospace;padding:32px">
<div style="max-width:560px;margin:0 auto">
<pre style="color:#33ff66;font-size:11px;line-height:1.1">SUPERPOWER</pre>
<p style="color:#1d8a45">&gt; one-time link to ${action}:</p>
<p style="margin:24px 0"><a href="${link}" style="background:#11351f;border:1px solid #33ff66;color:#33ff66;padding:12px 22px;text-decoration:none;border-radius:2px">./authenticate</a></p>
<p style="color:#1d8a45">// expires in 30 minutes. single use. if you didn't request this, ignore it — nothing happens without the link.</p>
<p style="color:#1d8a45;font-size:12px;margin-top:32px">superpower · merge labs · © 2026 stewart ventures inc.</p>
</div></body></html>`;
  return { subject, html };
}
