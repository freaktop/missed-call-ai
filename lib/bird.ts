import { BirdClient } from "@messagebird/sdk";
import type { EmailSendParams, SmsSendParams } from "@messagebird/sdk";

export type BirdSmsCategory = "transactional" | "marketing" | "authentication" | "service";

export interface BirdSendResult {
  status: string;
  providerId?: string;
  error?: string;
}

type BirdClientLike = {
  sms: { send: (params: SmsSendParams) => Promise<{ id: string; status: string }> };
  email: { send: (params: EmailSendParams) => Promise<{ id: string; status: string }> };
};

let birdClient: BirdClientLike | null = null;

export function getBirdClient(): BirdClientLike | null {
  const apiKey = process.env.BIRD_API_KEY;
  if (!apiKey) return null;
  if (!birdClient) {
    birdClient = new BirdClient({ apiKey }) as unknown as BirdClientLike;
  }
  return birdClient;
}

export async function sendBirdSms(params: { to: string; from: string; text: string; category?: BirdSmsCategory }): Promise<BirdSendResult> {
  const client = getBirdClient();
  if (!client) return { status: "failed", error: "BIRD_API_KEY_NOT_SET" };
  try {
    const msg = await client.sms.send({
      from: params.from,
      to: params.to,
      text: params.text,
      ...(params.category ? { category: params.category } : {}),
    });
    return { status: msg.status || "sent", providerId: msg.id, error: undefined };
  } catch (e: any) {
    return { status: "failed", error: e?.message || "bird_error" };
  }
}

export async function sendBirdEmail(params: { from: { email: string; name?: string }; to: string[]; subject: string; html: string }): Promise<BirdSendResult> {
  const client = getBirdClient();
  if (!client) return { status: "failed", error: "BIRD_API_KEY_NOT_SET" };
  try {
    const msg = await client.email.send({ from: params.from, to: params.to, subject: params.subject, html: params.html });
    return { status: msg.status || "sent", providerId: msg.id, error: undefined };
  } catch (e: any) {
    return { status: "failed", error: e?.message || "bird_error" };
  }
}
