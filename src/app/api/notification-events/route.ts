import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNotificationAccess } from "@/lib/notifications/access";

export const runtime = "nodejs";

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

function isValidCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Z][A-Z0-9_]{2,99}$/.test(value.trim())
  );
}

function isValidModule(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Z][A-Z0-9_]{1,49}$/.test(value.trim())
  );
}

function isValidPayloadSchema(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === "object" &&
      !Array.isArray(value))
  );
}

/**
 * GET /api/notification-events
 *
 * Default:
 * - Mengambil event aktif saja.
 *
 * Superadmin:
 * - Bisa mengambil semua event menggunakan
 *   ?includeInactive=true
 *
 * Administrator:
 * - Hanya bisa melihat event aktif.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await getNotificationAccess();

    if (access.response) {
      return access.response;
    }

    const includeInactive =
      request.nextUrl.searchParams.get("includeInactive") === "true" &&
      access.isSuperAdmin;

    const events = await prisma.notificationEvent.findMany({
      where: includeInactive
        ? {}
        : {
            isActive: true,
          },
      select: {
        id: true,
        code: true,
        name: true,
        module: true,
        description: true,
        payloadSchema: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            configs: true,
          },
        },
      },
      orderBy: [
        { module: "asc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("[GET notification-events]", error);

    return errorResponse(
      "Gagal mengambil katalog event notifikasi",
      500
    );
  }
}

/**
 * POST /api/notification-events
 *
 * Hanya Superadmin yang dapat membuat event global.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await getNotificationAccess();

    if (access.response) {
      return access.response;
    }

    if (!access.isSuperAdmin) {
      return errorResponse(
        "Hanya Superadmin yang dapat membuat event",
        403
      );
    }

    const body = await request.json();

    const code =
      typeof body.code === "string"
        ? body.code.trim().toUpperCase()
        : "";

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const module =
      typeof body.module === "string"
        ? body.module.trim().toUpperCase()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : null;

    if (!isValidCode(code)) {
      return errorResponse(
        "Kode event wajib diisi dengan format uppercase dan underscore. Contoh: SPK_CREATED"
      );
    }

    if (!name || name.length > 150) {
      return errorResponse(
        "Nama event wajib diisi dan maksimal 150 karakter"
      );
    }

    if (!isValidModule(module)) {
      return errorResponse(
        "Module tidak valid. Contoh: PRODUCTION atau FINANCE"
      );
    }

    if (
      description !== null &&
      description.length > 1000
    ) {
      return errorResponse(
        "Deskripsi maksimal 1000 karakter"
      );
    }

    if (
      body.payloadSchema !== undefined &&
      !isValidPayloadSchema(body.payloadSchema)
    ) {
      return errorResponse(
        "Payload schema harus berupa object JSON atau null"
      );
    }

    const existing = await prisma.notificationEvent.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      return errorResponse(
        `Event dengan kode ${code} sudah tersedia`,
        409
      );
    }

    const event = await prisma.notificationEvent.create({
      data: {
        code,
        name,
        module,
        description,
        ...(body.payloadSchema !== undefined
          ? {
              payloadSchema:
                body.payloadSchema === null
                  ? Prisma.DbNull
                  : (body.payloadSchema as Prisma.InputJsonValue),
            }
          : {}),
        isActive: body.isActive !== false,
      },
      select: {
        id: true,
        code: true,
        name: true,
        module: true,
        description: true,
        payloadSchema: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Event berhasil dibuat",
        data: event,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST notification-events]", error);

    return errorResponse(
      "Gagal membuat event notifikasi",
      500
    );
  }
}