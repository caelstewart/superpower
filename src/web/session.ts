/** Signed session cookies: sp_session=<b64url(email)>.<exp>.<hmac>. Stateless, 30 days. */
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "sp_session";
const TTL_SECONDS = 30 * 24 * 3600;

function secret(): string {
  const s = process.env.SUPERPOWER_SESSION_SECRET;
  if (!s) throw new Error("SUPERPOWER_SESSION_SECRET not set");
  return s;
}

function sign(email: string, exp: number): string {
  return createHmac("sha256", secret()).update(`${email}.${exp}`).digest("hex");
}

export function makeSessionCookie(email: string, secure: boolean): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const value = `${Buffer.from(email).toString("base64url")}.${exp}.${sign(email, exp)}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSession(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const raw = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [emailB64, expStr, mac] = raw.split(".");
  if (!emailB64 || !expStr || !mac) return null;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return null;
  let email: string;
  try {
    email = Buffer.from(emailB64, "base64url").toString();
  } catch {
    return null;
  }
  const expected = sign(email, exp);
  try {
    if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return email;
}
