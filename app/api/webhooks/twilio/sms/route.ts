import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTwilioSignature } from "@/lib/twilio";

const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => { params[k] = String(v); });

  const signature = req.headers.get("x-twilio-signature");
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/sms`;
  if (!verifyTwilioSignature(url, params, signature, AUTH_TOKEN)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const from = params.From;
  const to = params.To;
  const body = (params.Body || "").trim().toUpperCase();

  const business = await prisma.business.findFirst({ where: { twilioPhone: to } });

  if (business) {
    if (["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(body)) {
      await prisma.optOut.upsert({
        where: { businessId_phone: { businessId: business.id, phone: from } },
        update: {},
        create: { businessId: business.id, phone: from },
      });
      await prisma.auditLog.create({ data: { businessId: business.id, action: "opt_out_received", metadata: { phone: from } } });
    }
  }

  // TwiML response
  let reply = "";
  if (body === "HELP") {
    reply = `Reply STOP to unsubscribe. ${business?.name || ""} ${business?.bookingUrl || ""}`.trim();
  }

  const twiml = reply
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${reply}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

  return new NextResponse(twiml, { status: 200, headers: { "Content-Type": "text/xml" } });
}