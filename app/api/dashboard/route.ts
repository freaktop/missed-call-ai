import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = await prisma.businessAdmin.findUnique({ where: { id: session.user.id as string } });
  if (!admin) return NextResponse.json({ error: "admin_not_found" }, { status: 404 });
  const businessId = admin.businessId;
  const [eligibleMissedCalls, responsesSent, failedMessages, optedOut, recentActivity] = await Promise.all([
    prisma.missedCall.count({ where: { businessId } }),
    prisma.textMessage.count({ where: { businessId, status: "sent" } }),
    prisma.textMessage.count({ where: { businessId, status: "failed" } }),
    prisma.optOut.count({ where: { businessId } }),
    prisma.auditLog.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return NextResponse.json({ businessId, metrics: { eligibleMissedCalls, responsesSent, failedMessages, optedOut }, recentActivity });
}