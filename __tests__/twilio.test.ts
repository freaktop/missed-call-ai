import crypto from "crypto";
import { verifyTwilioSignature, isQuietHours, renderMessage } from "@/lib/twilio";

describe("verifyTwilioSignature", () => {
  const token = "secret";
  const url = "https://example.com/webhook";
  const params = { From: "+123", To: "+456", Body: "hi" };
  function sig() {
    const keys = Object.keys(params).sort();
    let data = url;
    for (const k of keys) data += k + (params as any)[k];
    return crypto.createHmac("sha1", token).update(data).digest("base64");
  }
  it("verifies valid", () => { expect(verifyTwilioSignature(url, params, sig(), token)).toBe(true); });
  it("rejects tampered", () => { expect(verifyTwilioSignature(url, params, sig()+"x", token)).toBe(false); });
  it("rejects missing", () => { expect(verifyTwilioSignature(url, params, null, token)).toBe(false); });
});

describe("isQuietHours", () => {
  it("false when not configured", () => { expect(isQuietHours(new Date(), null, null)).toBe(false); });
});

describe("renderMessage", () => {
  it("replaces vars", () => { expect(renderMessage("Hi {{business_name}} {{booking_url}}", { business_name: "Acme", booking_url: "http://x" })).toBe("Hi Acme http://x"); });
});