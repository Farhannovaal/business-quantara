
import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

const url = new URL(databaseUrl);

const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace("/", ""),
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

const notificationEvents = [
  {
    module: "PRODUCTION",
    code: "SPK_CREATED",
    name: "SPK Baru Dibuat",
    description: "Dijalankan ketika SPK baru berhasil dibuat.",
    payloadSchema: {
      required: ["spkId", "spkNumber"],
      properties: {
        spkId: "number",
        spkNumber: "string",
        tailorName: "string",
        createdBy: "string",
        createdAt: "string",
      },
    },
  },
  {
    module: "PRODUCTION",
    code: "SPK_STATUS_CHANGED",
    name: "Status SPK Berubah",
    description: "Dijalankan ketika status SPK berubah.",
    payloadSchema: {
      required: ["spkId", "spkNumber", "oldStatus", "newStatus"],
      properties: {
        spkId: "number",
        spkNumber: "string",
        oldStatus: "string",
        newStatus: "string",
        updatedBy: "string",
        updatedAt: "string",
      },
    },
  },
] satisfies Array<{
  module: string;
  code: string;
  name: string;
  description: string;
  payloadSchema: Prisma.InputJsonValue;
}>;

async function main() {
  console.log("Starting notification event seed...");

  for (const event of notificationEvents) {
    const result = await prisma.notificationEvent.upsert({
      where: {
        code: event.code,
      },
      update: {
        module: event.module,
        name: event.name,
        description: event.description,
        payloadSchema: event.payloadSchema,
        isActive: true,
      },
      create: {
        module: event.module,
        code: event.code,
        name: event.name,
        description: event.description,
        payloadSchema: event.payloadSchema,
        isActive: true,
      },
    });

    console.log(`Seeded: ${result.code} - ${result.name}`);
  }

  console.log("Notification event seed completed.");
}

main()
  .catch((error) => {
    console.error("Notification event seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
