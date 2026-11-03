import { NextRequest, NextResponse } from "next/server";
import {
  NotificationChannel,
  NotificationTrigger,
  NotificationScheduleType,
  NotificationIntervalUnit,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNotificationAccess } from "@/lib/notifications/access";
import { validateEventTemplate } from "@/lib/notifications/template-validation";

export const runtime = "nodejs";
function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function validateRecipient(
  channel: NotificationChannel,
  recipient: unknown,
): string | null {
  if (
    !recipient ||
    typeof recipient !== "object" ||
    Array.isArray(recipient)
  ) {
    return "Recipient harus berupa object";
  }
  const data = recipient as Record<string, unknown>;
  if (channel === "TELEGRAM") {
    if (
      !Array.isArray(data.chatIds) ||
      data.chatIds.length === 0 ||
      !data.chatIds.every(
        (item) => typeof item === "string" && item.trim().length > 0,
      )
    ) {
      return "Recipient Telegram wajib memiliki chatIds berupa array string";
    }
  }
  if (channel === "EMAIL") {
    if (
      !Array.isArray(data.emails) ||
      data.emails.length === 0 ||
      !data.emails.every(
        (item) =>
          typeof item === "string" &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item),
      )
    ) {
      return "Recipient Email wajib memiliki emails berupa array email valid";
    }
  }
  return null;
}
function validateSchedule(data: Record<string, unknown>): string | null {
  if (data.trigger === "EVENT") {
    const eventId = Number(data.eventId);
    if (!Number.isSafeInteger(eventId) || eventId <= 0) {
      return "eventId wajib dipilih untuk trigger EVENT";
    }
    return null;
  }
  if (data.trigger !== "SCHEDULED") {
    return "Trigger tidak valid";
  }
  if (data.scheduleType === "INTERVAL") {
    if (
      !Number.isInteger(data.intervalValue) ||
      Number(data.intervalValue) < 1
    ) {
      return "intervalValue wajib berupa bilangan bulat minimal 1";
    }
    if (
      data.intervalUnit !== "MINUTES" &&
      data.intervalUnit !== "HOURS"
    ) {
      return "intervalUnit harus MINUTES atau HOURS";
    }
    return null;
  }
  if (data.scheduleType === "DAILY") {
    if (!isValidTime(data.dailyTime)) {
      return "dailyTime wajib menggunakan format HH:mm";
    }
    return null;
  }
  return "scheduleType harus INTERVAL atau DAILY";
}
export async function GET() {
  try {
    const access = await getNotificationAccess();
    if (access.response) return access.response;
    const configs = await prisma.notificationConfig.findMany({
      where: access.where!,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        event: {
          select: {
            id: true,
            code: true,
            name: true,
            module: true,
          },
        },
        _count: {
          select: {
            jobs: true,
            logs: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json({
      success: true,
      data: configs,
    });
  } catch (error) {
    console.error("[GET notification-configs]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil konfigurasi notifikasi",
      },
      { status: 500 },
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    const access = await getNotificationAccess();
    if (access.response || !access.user) {
      return (
        access.response ??
        NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        )
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const channel = body.channel;
    const trigger = body.trigger;
    const scheduleType = body.scheduleType;
    const template =
      typeof body.template === "string" ? body.template.trim() : "";
    const timezone =
      typeof body.timezone === "string"
        ? body.timezone.trim()
        : "Asia/Jakarta";
    const recipient = body.recipient;
    if (!name || name.length > 150) {
      return NextResponse.json(
        {
          success: false,
          error: "Nama wajib diisi, maksimal 150 karakter",
        },
        { status: 400 },
      );
    }
    if (
      channel !== NotificationChannel.TELEGRAM &&
      channel !== NotificationChannel.EMAIL
    ) {
      return NextResponse.json(
        { success: false, error: "Channel tidak valid" },
        { status: 400 },
      );
    }
    if (
      trigger !== NotificationTrigger.SCHEDULED &&
      trigger !== NotificationTrigger.EVENT
    ) {
      return NextResponse.json(
        { success: false, error: "Trigger tidak valid" },
        { status: 400 },
      );
    }
    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template pesan wajib diisi" },
        { status: 400 },
      );
    }
    const recipientError = validateRecipient(channel, recipient);
    if (recipientError) {
      return NextResponse.json(
        { success: false, error: recipientError },
        { status: 400 },
      );
    }
    const scheduleError = validateSchedule({
      trigger,
      scheduleType,
      intervalValue: body.intervalValue,
      intervalUnit: body.intervalUnit,
      dailyTime: body.dailyTime,
      eventId: body.eventId,
    });
    if (scheduleError) {
      return NextResponse.json(
        { success: false, error: scheduleError },
        { status: 400 },
      );
    }
    if (timezone.length < 1 || timezone.length > 60) {
      return NextResponse.json(
        { success: false, error: "Timezone tidak valid" },
        { status: 400 },
      );
    }
    // Superadmin harus menentukan companyId.
    // Administrator selalu menggunakan companyId dari sesi.
    let companyId: number;
    if (access.isSuperAdmin) {
      companyId = Number(body.companyId);
      if (!Number.isSafeInteger(companyId) || companyId < 1) {
        return NextResponse.json(
          { success: false, error: "companyId wajib dipilih" },
          { status: 400 },
        );
      }
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      });
      if (!company) {
        return NextResponse.json(
          { success: false, error: "Perusahaan tidak ditemukan" },
          { status: 404 },
        );
      }
    } else {
      const userCompanyId = access.user.companyId;
      if (!userCompanyId || userCompanyId < 1) {
        return NextResponse.json(
          {
            success: false,
            error: "Akun belum terhubung dengan perusahaan",
          },
          { status: 403 },
        );
      }
      companyId = userCompanyId;
    }
    let selectedEvent: {
      id: number;
      code: string;
      payloadSchema: Prisma.JsonValue | null;
    } | null = null;
    if (trigger === "EVENT") {
      const eventId = Number(body.eventId);
      selectedEvent = await prisma.notificationEvent.findFirst({
        where: {
          id: eventId,
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          payloadSchema: true,
        },
      });
      if (!selectedEvent) {
        return NextResponse.json(
          {
            success: false,
            error: "Event tidak ditemukan atau sedang nonaktif",
          },
          { status: 400 },
        );
      }
      const templateValidation = validateEventTemplate(
        template,
        selectedEvent.payloadSchema,
      );
      if (!templateValidation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: templateValidation.error,
            invalidVariables: templateValidation.unknownVariables,
          },
          { status: 400 },
        );
      }
    }
    const config = await prisma.notificationConfig.create({
      data: {
        companyId,
        name,
        channel,
        trigger,
        scheduleType:
          trigger === "SCHEDULED"
            ? (scheduleType as NotificationScheduleType)
            : null,
        intervalValue:
          trigger === "SCHEDULED" && scheduleType === "INTERVAL"
            ? Number(body.intervalValue)
            : null,
        intervalUnit:
          trigger === "SCHEDULED" && scheduleType === "INTERVAL"
            ? (body.intervalUnit as NotificationIntervalUnit)
            : null,
        dailyTime:
          trigger === "SCHEDULED" && scheduleType === "DAILY"
            ? String(body.dailyTime)
            : null,
        eventName: selectedEvent?.code ?? null,
        eventId: selectedEvent?.id ?? null,
        timezone,
        recipient: recipient as Prisma.InputJsonValue,
        template,
        isActive:
          body.isActive === undefined ? true : body.isActive === true,
        createdById: access.user.id,
        nextRunAt: null,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        event: {
          select: {
            id: true,
            code: true,
            name: true,
            module: true,
            payloadSchema: true,
          },
        },
      },
    });
    return NextResponse.json(
      {
        success: true,
        data: config,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST notification-configs]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal membuat konfigurasi notifikasi",
      },
      { status: 500 },
    );
  }
}
