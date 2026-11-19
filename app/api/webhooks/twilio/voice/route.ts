import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTwilioSignature, isQuietHours, renderMessage } from "@/lib/twilio";

const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => { params[k] = String(v); });

  const signature = req.headers.get("x-twilio-signature");
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/voice`;
  if (!verifyTwilioSignature(url, params, signature, AUTH_TOKEN)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const callSid = params.CallSid;
  const from = params.From;
  const to = params.To;
  const status = params.CallStatus; // ringing, in-progress, completed, busy, failed, no-answer, canceled

  // idempotency
  const existing = await prisma.webhookEvent.findUnique({ where: { idempotencyKey: callSid } });
  if (existing) return new NextResponse("OK", { status: 200 });

  await prisma.webhookEvent.create({
    data: { source: "twilio", eventType: "voice.status", idempotencyKey: callSid, payload: params as any, status: "processing" },
  });

  const missedStatuses = ["no-answer", "busy", "failed", "canceled"];
  if (!missedStatuses.includes(status)) {
    await prisma.webhookEvent.update({ where: { idempotencyKey: callSid }, data: { status: "processed", processedAt: new Date() } });
    return new NextResponse("OK", { status: 200 });
  }

  const business = await prisma.business.findFirst({ where: { twilioPhone: to } });
  if (!business || !business.enabled) {
    await prisma.webhookEvent.update({ where: { idempotencyKey: callSid }, data: { status: "processed", processedAt: new Date() } });
    return new NextResponse("OK", { status: 200 });
  }

  const missedCall = await prisma.missedCall.create({
    data: { businessId: business.id, callerPhone: from, callSid, status },
  });

  // opt-out check
  const optedOut = await prisma.optOut.findUnique({ where: { businessId_phone: { businessId: business.id, phone: from } } });
  if (optedOut) {
    await prisma.webhookEvent.update({ where: { idempotencyKey: callSid }, data: { status: "processed", processedAt: new Date() } });
    return new NextResponse("OK", { status: 200 });
  }

  // cooldown check
  const cooldownCutoff = new Date(Date.now() - business.cooldownHours * 60 * 60 * 1000);
  const recent = await prisma.textMessage.findFirst({
    where: { businessId: business.id, toPhone: from, createdAt: { gte: cooldownCutoff } },
  });
  if (recent) {
    await prisma.webhookEvent.update({ where: { idempotencyKey: callSid }, data: { status: "processed", processedAt: new Date() } });
    return new NextResponse("OK", { status: 200 });
  }

  // quiet hours
  if (isQuietHours(new Date(), business.quietHoursStart, business.quietHoursEnd)) {
    await prisma.webhookEvent.update({ where: { idempotencyKey: callSid }, data: { status: "processed", processedAt: new Date() } });
    return new NextResponse("OK", { status: 200 });
  }

  // send SMS via Twilio
  const body = renderMessage(business.responseMessage, {
    business_name: business.name,
    booking_url: business.bookingUrl || "",
  });

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER || business.twilioPhone || "";

  let status_msg = "failed";
  let providerId: string | undefined;
  let error: string | undefined;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: from, From: fromPhone, Body: body }).toString(),
    });
    const json = await res.json();
    if (res.ok) { status_msg = "sent"; providerId = json.sid; }
    else { error = json.message || "twilio_error"; }
  } catch (e: any) {
    error = e?.message;
  }

  await prisma.textMessage.create({
    data: {
      businessId: business.id,
      missedCallId: missedCall.id,
      toPhone: from,
      fromPhone,
      body,
      status: status_msg,
      providerId,
      error,
      sentAt: status_msg === "sent" ? new Date() : null,
    },
  });

  await prisma.webhookEvent.update({ where: { idempotencyKey: callSid }, data: { status: "processed", processedAt: new Date() } });
  return new NextResponse("OK", { status: 200 });
}