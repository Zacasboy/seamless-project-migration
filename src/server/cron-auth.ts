import { timingSafeEqual } from "node:crypto";

/** A Vercel Cron envia "Authorization: Bearer <CRON_SECRET>". Sem segredo (32+), recusa. */
export function cronAuthorized(request: Request) {
  const secret = process.env["CRON_SECRET"]?.trim();
  if (!secret || secret.length < 32) return false;
  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
