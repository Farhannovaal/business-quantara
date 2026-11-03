import { NextRequest, NextResponse } from "next/server";
import {
  NotificationChannel,
  NotificationTrigger,
  NotificationScheduleType,
  NotificationIntervalUnit,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccessibleNotificationConfig } from "@/lib/notifications/access";
import { validateEventTemplate } from "@/lib/notifications/template-validation";

export const runtime = "nodejs";
type RouteContext = {
  params: Promise<{ id: string }>;
};
function parseId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function validTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  );
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
        (value) =>
          typeof value === "string" && value.trim().length > 0,
      )
    ) {
      return "Recipient Telegram wajib memiliki chatIds";
    }
  }
  if (channel === "EMAIL") {
    if (
      !Array.isArray(data.emails) ||
      data.emails.length === 0 ||
      !data.emails.every(
        (value) =>
          typeof value === "string" &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      )
    ) {
      return "Recipient Email wajib memiliki emails yang valid";
    }
  }
  return null;
}
function validateSchedule(data: {
  trigger: NotificationTrigger;
  scheduleType: NotificationScheduleType | null;
  intervalValue: unknown;
  intervalUnit: unknown;
  dailyTime: unknown;
  eventId: unknown;
}): string | null {
  if (data.trigger === "EVENT") {
    const eventId = Number(data.eventId);
    return Number.isSafeInteger(eventId) && eventId > 0
      ? null
      : "eventId wajib dipilih untuk trigger EVENT";
  }
  if (data.trigger !== "SCHEDULED") {
    return "Trigger tidak valid";
  }
  if (data.scheduleType === "INTERVAL") {
    if (
      !Number.isInteger(data.intervalValue) ||
      Number(data.intervalValue) < 1
    ) {
      return "intervalValue minimal 1";
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
    return validTime(data.dailyTime)
      ? null
      : "dailyTime harus menggunakan format HH:mm";
  }
  return "scheduleType harus INTERVAL atau DAILY";
}
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const id = parseId((await context.params).id);
    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID tidak valid" },
        { status: 400 },
      );
    }
    const { access, config } =
      await getAccessibleNotificationConfig(id);
    if (access.response) return access.response;
    if (!config) {
      return NextResponse.json(
        { success: false, error: "Konfigurasi tidak ditemukan" },
        { status: 404 },
      );
    }
    const data = await prisma.notificationConfig.findUnique({
      where: { id },
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
            description: true,
            payloadSchema: true,
          },
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        _count: {
          select: {
            jobs: true,
            logs: true,
          },
        },
      },
    });
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[GET notification-config]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil detail konfigurasi",
      },
      { status: 500 },
    );
  }
}
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const id = parseId((await context.params).id);
    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID tidak valid" },
        { status: 400 },
      );
    }
    const { access, config } =
      await getAccessibleNotificationConfig(id);
    if (access.response) return access.response;
    if (!config) {
      return NextResponse.json(
        { success: false, error: "Konfigurasi tidak ditemukan" },
        { status: 404 },
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    const channel = (body.channel ?? config.channel) as NotificationChannel;
    const trigger = (body.trigger ?? config.trigger) as NotificationTrigger;
    const scheduleType = (
      body.scheduleType === undefined
        ? config.scheduleType
        : body.scheduleType
    ) as NotificationScheduleType | null;
    const intervalValue =
      body.intervalValue === undefined
        ? config.intervalValue
        : body.intervalValue;
    const intervalUnit =
      body.intervalUnit === undefined
        ? config.intervalUnit
        : body.intervalUnit;
    const dailyTime =
      body.dailyTime === undefined
        ? config.dailyTime
        : body.dailyTime;
    const eventId =
      body.eventId === undefined
        ? config.eventId
        : body.eventId;
    const template =
      body.template === undefined
        ? config.template
        : body.template;
    const recipient =
      body.recipient === undefined
        ? config.recipient
        : body.recipient;
    const timezone =
      body.timezone === undefined
        ? config.timezone
        : body.timezone;
    const name =
      body.name === undefined
        ? config.name
        : body.name;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 150
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Nama wajib diisi, maksimal 150 karakter",
        },
        { status: 400 },
      );
    }
    if (channel !== "TELEGRAM" && channel !== "EMAIL") {
      return NextResponse.json(
        { success: false, error: "Channel tidak valid" },
        { status: 400 },
      );
    }
    if (trigger !== "SCHEDULED" && trigger !== "EVENT") {
      return NextResponse.json(
        { success: false, error: "Trigger tidak valid" },
        { status: 400 },
      );
    }
    if (typeof template !== "string" || !template.trim()) {
      return NextResponse.json(
        { success: false, error: "Template pesan wajib diisi" },
        { status: 400 },
      );
    }
    if (
      typeof timezone !== "string" ||
      !timezone.trim() ||
      timezone.length > 60
    ) {
      return NextResponse.json(
        { success: false, error: "Timezone tidak valid" },
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
      intervalValue,
      intervalUnit,
      dailyTime,
      eventId,
    });
    if (scheduleError) {
      return NextResponse.json(
        { success: false, error: scheduleError },
        { status: 400 },
      );
    }
    // EVENT harus berasal dari katalog event yang aktif.
    let selectedEvent: {
      id: number;
      code: string;
      name: string;
      module: string;
      payloadSchema: Prisma.JsonValue | null;
    } | null = null;
    if (trigger === "EVENT") {
      selectedEvent = await prisma.notificationEvent.findFirst({
        where: {
          id: Number(eventId),
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          module: true,
          payloadSchema: true,
        },
      });
      if (!selectedEvent) {
        return NextResponse.json(
          {
            success: false,
            error: "Event tidak ditemukan atau sudah tidak aktif",
          },
          { status: 400 },
        );
      }
      const templateValidation = validateEventTemplate(
        String(template),
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
    const updated = await prisma.notificationConfig.update({
      where: { id },
      data: {
        name: name.trim(),
        channel,
        trigger,
        scheduleType:
          trigger === "SCHEDULED" ? scheduleType : null,
        intervalValue:
          trigger === "SCHEDULED" && scheduleType === "INTERVAL"
            ? Number(intervalValue)
            : null,
        intervalUnit:
          trigger === "SCHEDULED" && scheduleType === "INTERVAL"
            ? (intervalUnit as NotificationIntervalUnit)
            : null,
        dailyTime:
          trigger === "SCHEDULED" && scheduleType === "DAILY"
            ? String(dailyTime)
            : null,
        // Simpan relasi event dan pertahankan eventName
        // sebagai kompatibilitas dengan data lama.
        eventId: selectedEvent?.id ?? null,
        eventName: selectedEvent?.code ?? null,
        timezone: timezone.trim(),
        recipient: recipient as Prisma.InputJsonValue,
        template: template.trim(),
        ...(typeof body.isActive === "boolean"
          ? { isActive: body.isActive }
          : {}),
        // Worker akan menghitung ulang jadwal berikutnya.
        nextRunAt: null,
      },
      include: {
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
    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("[PATCH notification-config]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengubah konfigurasi",
      },
      { status: 500 },
    );
  }
}
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const id = parseId((await context.params).id);
    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID tidak valid" },
        { status: 400 },
      );
    }
    const { access, config } =
      await getAccessibleNotificationConfig(id);
    if (access.response) return access.response;
    if (!config) {
      return NextResponse.json(
        { success: false, error: "Konfigurasi tidak ditemukan" },
        { status: 404 },
      );
    }
    const [jobCount, logCount] = await Promise.all([
      prisma.notificationJob.count({
        where: { configId: id },
      }),
      prisma.notificationDeliveryLog.count({
        where: { configId: id },
      }),
    ]);
    if (jobCount > 0 || logCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Konfigurasi memiliki job atau riwayat pengiriman. Nonaktifkan konfigurasi agar riwayat tetap terjaga.",
        },
        { status: 409 },
      );
    }
    await prisma.notificationConfig.delete({
      where: { id },
    });
    return NextResponse.json({
      success: true,
      message: "Konfigurasi berhasil dihapus",
    });
  } catch (error) {
    console.error("[DELETE notification-config]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal menghapus konfigurasi",
      },
      { status: 500 },
    );
  }
}
