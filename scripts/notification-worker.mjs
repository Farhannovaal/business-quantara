import os from "node:os";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const POLL_MS = Math.max(
  1000,
  Number(process.env.NOTIFICATION_POLL_INTERVAL_MS || 5000),
);

const WORKER_ID =
  process.env.NOTIFICATION_WORKER_ID ||
  `${os.hostname()}-${process.pid}`;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const STALE_LOCK_MS = 5 * 60 * 1000;

function createPrisma() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL belum dikonfigurasi");
  }

  const url = new URL(databaseUrl);

  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 3,
  });

  return new PrismaClient({ adapter });
}

const prisma = createPrisma();

function log(message, details = "") {
  console.log(
    `[${new Date().toISOString()}] [${WORKER_ID}] ${message}`,
    details,
  );
}

function intervalMs(config) {
  const value = Number(config.intervalValue);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Interval konfigurasi ${config.id} tidak valid`);
  }

  if (config.intervalUnit === "MINUTES") {
    return value * 60_000;
  }

  if (config.intervalUnit === "HOURS") {
    return value * 60 * 60_000;
  }

  throw new Error(`Unit interval konfigurasi ${config.id} tidak valid`);
}

function getTimeParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function nextDailyRun(config, from = new Date()) {
  const [targetHour, targetMinute] = String(config.dailyTime || "").split(":").map(Number);

  if (
    !Number.isInteger(targetHour) ||
    !Number.isInteger(targetMinute) ||
    targetHour < 0 ||
    targetHour > 23 ||
    targetMinute < 0 ||
    targetMinute > 59
  ) {
    throw new Error(`dailyTime konfigurasi ${config.id} tidak valid`);
  }

  const timezone = config.timezone || "Asia/Jakarta";
  const currentParts = getTimeParts(from, timezone);

  let candidate = new Date(
    from.getTime() +
      (targetHour - Number(currentParts.hour)) * 60 * 60_000 +
      (targetMinute - Number(currentParts.minute)) * 60_000,
  );

  // Konversi di atas hanya perkiraan ketika zona waktu bergeser.
  // Iterasi untuk mencari waktu lokal yang sesuai dengan target.
  for (let i = 0; i < 4; i += 1) {
    const actual = getTimeParts(candidate, timezone);
    const hourDiff = targetHour - Number(actual.hour);
    const minuteDiff = targetMinute - Number(actual.minute);

    if (hourDiff === 0 && minuteDiff === 0) break;

    candidate = new Date(
      candidate.getTime() + hourDiff * 60 * 60_000 + minuteDiff * 60_000,
    );
  }

  if (candidate <= from) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60_000);
  }

  return candidate;
}

function nextScheduledRun(config, from = new Date()) {
  if (config.scheduleType === "INTERVAL") {
    return new Date(from.getTime() + intervalMs(config));
  }

  if (config.scheduleType === "DAILY") {
    return nextDailyRun(config, from);
  }

  throw new Error(`Schedule type konfigurasi ${config.id} tidak didukung`);
}

function getChatIds(recipient) {
  const ids = recipient?.chatIds;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("Recipient Telegram tidak memiliki chatIds");
  }

  return ids.map((id) => String(id).trim()).filter(Boolean);
}

function renderTemplate(template, payload) {
  return String(template).replace(
    /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
    (_match, path) => {
      const value = path
        .split(".")
        .reduce((current, key) => current?.[key], payload);

      if (value === null || value === undefined) return "";
      if (typeof value === "object") return JSON.stringify(value);

      return String(value);
    },
  );
}

async function sendTelegram(chatId, text) {
  if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN belum dikonfigurasi");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    throw new Error(
      result?.description || `Telegram API HTTP ${response.status}`,
    );
  }

  return String(result.result?.message_id ?? "");
}

async function recordDelivery({
  configId,
  jobId,
  recipient,
  status,
  providerId,
  errorMessage,
  attempt,
}) {
  await prisma.notificationDeliveryLog.create({
    data: {
      configId,
      jobId,
      channel: "TELEGRAM",
      recipient,
      status,
      providerId: providerId || null,
      errorMessage: errorMessage
        ? String(errorMessage).slice(0, 60_000)
        : null,
      attempt,
      sentAt: status === "SUCCESS" ? new Date() : null,
    },
  });
}

async function scheduleDueNotifications() {
  const now = new Date();

  const configs = await prisma.notificationConfig.findMany({
    where: {
      isActive: true,
      trigger: "SCHEDULED",
      channel: "TELEGRAM",
      scheduleType: { in: ["INTERVAL", "DAILY"] },
    },
    take: 100,
    orderBy: [{ nextRunAt: "asc" }, { id: "asc" }],
  });

  for (const config of configs) {
    try {
      if (!config.nextRunAt) {
        const nextRunAt = nextScheduledRun(config, now);

        await prisma.notificationConfig.updateMany({
          where: {
            id: config.id,
            isActive: true,
            nextRunAt: null,
          },
          data: { nextRunAt },
        });

        log(`Jadwal awal ditetapkan untuk config ${config.id}`, nextRunAt.toISOString());
        continue;
      }

      if (config.nextRunAt > now) continue;

      const dueAt = config.nextRunAt;
      const nextRunAt = nextScheduledRun(config, now);
      const eventKey = `schedule:${dueAt.toISOString()}`;

      await prisma.$transaction(async (tx) => {
        await tx.notificationJob.create({
          data: {
            configId: config.id,
            eventKey,
            payload: {
              message: "Pengingat otomatis dari Notification Management",
              scheduledAt: dueAt.toISOString(),
              configName: config.name,
            },
          },
        });

        await tx.notificationConfig.updateMany({
          where: {
            id: config.id,
            isActive: true,
            nextRunAt: dueAt,
          },
          data: {
            lastRunAt: now,
            nextRunAt,
          },
        });
      });

      log(`Job dibuat untuk config ${config.id}`, eventKey);
    } catch (error) {
      // Unique conflict dapat terjadi jika jadwal yang sama telah dibuat.
      // Error lain dicatat supaya worker tetap memproses config lainnya.
      log(`Gagal menjadwalkan config ${config.id}`, error.message);
    }
  }
}

async function claimJob() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);

  const candidate = await prisma.notificationJob.findFirst({
    where: {
      OR: [
        { status: "PENDING", availableAt: { lte: now } },
        { status: "PROCESSING", lockedAt: { lt: staleBefore } },
      ],
    },
    orderBy: [{ availableAt: "asc" }, { id: "asc" }],
  });

  if (!candidate) return null;

  const claimed = await prisma.notificationJob.updateMany({
    where: {
      id: candidate.id,
      OR: [
        { status: "PENDING", availableAt: { lte: now } },
        { status: "PROCESSING", lockedAt: { lt: staleBefore } },
      ],
    },
    data: {
      status: "PROCESSING",
      lockedAt: now,
      lockedBy: WORKER_ID,
      attempts: { increment: 1 },
    },
  });

  if (claimed.count !== 1) return null;

  return prisma.notificationJob.findUnique({
    where: { id: candidate.id },
    include: { config: true },
  });
}

async function processJob(job) {
  const { config } = job;
  const attempt = job.attempts;

  try {
    if (!config || config.channel !== "TELEGRAM") {
      throw new Error("Job bukan konfigurasi Telegram yang valid");
    }

    if (!config.isActive) {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lockedAt: null,
          lockedBy: null,
          lastError: "Konfigurasi dinonaktifkan sebelum pengiriman",
        },
      });
      return;
    }

    const chatIds = getChatIds(config.recipient);
    const payload =
      job.payload && typeof job.payload === "object"
        ? job.payload
        : {};

    const message = renderTemplate(config.template, payload);

    if (!message.trim()) {
      throw new Error("Template menghasilkan pesan kosong");
    }

    // Catat hasil per recipient. Jika ada yang gagal, job akan di-retry.
    const failures = [];

    for (const chatId of chatIds) {
      try {
        const providerId = await sendTelegram(chatId, message);

        await recordDelivery({
          configId: config.id,
          jobId: job.id,
          recipient: chatId,
          status: "SUCCESS",
          providerId,
          attempt,
        });

        log(`Telegram terkirim ke ${chatId}`, `job=${job.id}`);
      } catch (error) {
        failures.push(`${chatId}: ${error.message}`);

        await recordDelivery({
          configId: config.id,
          jobId: job.id,
          recipient: chatId,
          status: "FAILED",
          errorMessage: error.message,
          attempt,
        });
      }
    }

    if (failures.length > 0) {
      throw new Error(failures.join(" | "));
    }

    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: "SENT",
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  } catch (error) {
    const exhausted = attempt >= job.maxAttempts;
    const retryDelayMs = Math.min(60 * 60_000, 5000 * 2 ** (attempt - 1));

    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: exhausted ? "DEAD" : "PENDING",
        availableAt: exhausted
          ? new Date()
          : new Date(Date.now() + retryDelayMs),
        lockedAt: null,
        lockedBy: null,
        lastError: String(error.message || error).slice(0, 60_000),
      },
    });

    log(
      exhausted ? `Job ${job.id} DEAD` : `Job ${job.id} dijadwalkan ulang`,
      error.message,
    );
  }
}

let stopping = false;

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN belum diatur di environment");
  }

  log("Notification worker dimulai");

  while (!stopping) {
    try {
      await scheduleDueNotifications();

      const job = await claimJob();

      if (job) {
        await processJob(job);
      } else {
        await sleep(POLL_MS);
      }
    } catch (error) {
      log("Loop worker mengalami error", error.message);
      await sleep(POLL_MS);
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    log(`Menerima ${signal}, worker akan berhenti`);
  });
}

main()
  .catch((error) => {
    console.error("Worker fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });