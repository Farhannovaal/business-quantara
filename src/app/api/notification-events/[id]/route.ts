import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNotificationAccess } from "@/lib/notifications/access";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
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

async function getEventId(context: RouteContext) {
  const { id } = await context.params;
  const eventId = Number(id);

  if (
    !Number.isSafeInteger(eventId) ||
    eventId <= 0
  ) {
    return null;
  }

  return eventId;
}

/**
 * GET /api/notification-events/[id]
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const access = await getNotificationAccess();

    if (access.response) {
      return access.response;
    }

    const id = await getEventId(context);

    if (!id) {
      return errorResponse("ID event tidak valid");
    }

    const event = await prisma.notificationEvent.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            configs: true,
          },
        },
      },
    });

    if (!event) {
      return errorResponse(
        "Event tidak ditemukan",
        404
      );
    }

    // Administrator hanya boleh melihat event aktif.
    if (!access.isSuperAdmin && !event.isActive) {
      return errorResponse(
        "Event tidak ditemukan",
        404
      );
    }

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("[GET notification-event detail]", error);

    return errorResponse(
      "Gagal mengambil detail event",
      500
    );
  }
}

/**
 * PATCH /api/notification-events/[id]
 *
 * Code tidak dapat diubah melalui endpoint ini.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const access = await getNotificationAccess();

    if (access.response) {
      return access.response;
    }

    if (!access.isSuperAdmin) {
      return errorResponse(
        "Hanya Superadmin yang dapat mengubah event",
        403
      );
    }

    const id = await getEventId(context);

    if (!id) {
      return errorResponse("ID event tidak valid");
    }

    const existing = await prisma.notificationEvent.findUnique({
      where: { id },
    });

    if (!existing) {
      return errorResponse(
        "Event tidak ditemukan",
        404
      );
    }

    const body = await request.json();

    const data: Prisma.NotificationEventUpdateInput = {};

    if (body.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.trim().length > 150
      ) {
        return errorResponse(
          "Nama event wajib diisi dan maksimal 150 karakter"
        );
      }

      data.name = body.name.trim();
    }

    if (body.module !== undefined) {
      if (!isValidModule(body.module)) {
        return errorResponse(
          "Module tidak valid"
        );
      }

      data.module = body.module.trim().toUpperCase();
    }

    if (body.description !== undefined) {
      if (
        body.description !== null &&
        (typeof body.description !== "string" ||
          body.description.trim().length > 1000)
      ) {
        return errorResponse(
          "Deskripsi maksimal 1000 karakter"
        );
      }

      data.description =
        typeof body.description === "string"
          ? body.description.trim() || null
          : null;
    }

    if (body.payloadSchema !== undefined) {
      if (!isValidPayloadSchema(body.payloadSchema)) {
        return errorResponse(
          "Payload schema harus berupa object JSON atau null"
        );
      }

      data.payloadSchema =
        body.payloadSchema === null
          ? Prisma.DbNull
          : (body.payloadSchema as Prisma.InputJsonValue);
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return errorResponse(
          "Status isActive harus berupa boolean"
        );
      }

      data.isActive = body.isActive;
    }

    // Code sengaja tidak dimasukkan ke data update.
    const event = await prisma.notificationEvent.update({
      where: { id },
      data,
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

    return NextResponse.json({
      success: true,
      message: "Event berhasil diperbarui",
      data: event,
    });
  } catch (error) {
    console.error("[PATCH notification-event]", error);

    return errorResponse(
      "Gagal memperbarui event",
      500
    );
  }
}

/**
 * DELETE /api/notification-events/[id]
 *
 * Event tidak boleh dihapus jika masih digunakan
 * oleh NotificationConfig.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const access = await getNotificationAccess();

    if (access.response) {
      return access.response;
    }

    if (!access.isSuperAdmin) {
      return errorResponse(
        "Hanya Superadmin yang dapat menghapus event",
        403
      );
    }

    const id = await getEventId(context);

    if (!id) {
      return errorResponse("ID event tidak valid");
    }

    const event = await prisma.notificationEvent.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            configs: true,
          },
        },
      },
    });

    if (!event) {
      return errorResponse(
        "Event tidak ditemukan",
        404
      );
    }

    if (event._count.configs > 0) {
      return errorResponse(
        `Event tidak dapat dihapus karena masih digunakan oleh ${event._count.configs} konfigurasi notifikasi. Nonaktifkan event jika tidak ingin digunakan lagi.`,
        409
      );
    }

    await prisma.notificationEvent.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Event berhasil dihapus",
    });
  } catch (error) {
    console.error("[DELETE notification-event]", error);

    return errorResponse(
      "Gagal menghapus event",
      500
    );
  }
}