import crypto from "crypto";

export function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null, authToken: string): boolean {
  if (!signature || !authToken) return false;
  const keys = Object.keys(params).sort();
  let data = url;
  for (const k of keys) data += k + params[k];
  const expected = crypto.createHmac("sha1", authToken).update(data).digest("base64");
  try { return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); } catch { return false; }
}

export function isQuietHours(now: Date, start?: number | null, end?: number | null): boolean {
  if (start == null || end == null) return false;
  const h = now.getHours();
  if (start < end) return h < start || h >= end;
  // wraps midnight
  return h >= start || h < end;
}

export function renderMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}