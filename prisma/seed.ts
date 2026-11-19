import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
async function main() {
  const business = await prisma.business.upsert({
    where: { slug: "demo-business" },
    update: {},
    create: { name: "Demo Business", slug: "demo-business", cooldownHours: 24, enabled: true, twilioPhone: "+10000000000" },
  });
  const passwordHash = await bcrypt.hash("demo1234", 10);
  await prisma.businessAdmin.upsert({
    where: { email: "admin@missedcall.ai" },
    update: {},
    create: { businessId: business.id, email: "admin@missedcall.ai", passwordHash, name: "Demo Admin" },
  });
  console.log("Seed complete. Login: admin@missedcall.ai / demo1234");
}
main().catch((e)=>{console.error(e);process.exit(1);}).finally(()=>prisma.$disconnect());