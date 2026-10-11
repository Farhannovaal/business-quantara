// src/app/api/roles/route.ts

import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import { requirePermission } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

const ACTIVITY_PERMISSION = {
  code: "activity.view",
  name: "Melihat Riwayat Aktivitas",
  description:
    "Melihat riwayat aktivitas dan perubahan data transaksi.",
} as const;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status },
  );
}

export async function GET() {
  const { user, response } = await requireAuth();

  if (response || !user) {
    return response ?? jsonError("Unauthorized", 401);
  }

  const permission = requirePermission(user, "user.view");

  if (permission.response) {
    return permission.response;
  }

  try {
    const [roles, permissions] = await Promise.all([
      prisma.role.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { users: true },
          },
          permissions: {
            select: {
              permission: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  description: true,
                },
              },
            },
          },
        },
      }),

      prisma.permission.findMany({
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
        },
      }),
    ]);

    // Tampilkan activity.view di UI meskipun belum ada di database.
    const permissionCatalog: Array<{
      id: number;
      code: string;
      name: string;
      description: string | null;
    }> = permissions.some(
      (item) => item.code === ACTIVITY_PERMISSION.code,
    )
      ? permissions
      : [...permissions, { id: 0, ...ACTIVITY_PERMISSION }].sort(
          (a, b) => a.code.localeCompare(b.code),
        );

    return NextResponse.json({
      success: true,
      data: roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        userCount: role._count.users,
        permissionCodes: role.permissions.map(
          (item) => item.permission.code,
        ),
      })),
      permissions: permissionCatalog,
    });
  } catch (error) {
    console.error("GET /api/roles error:", error);

    return jsonError(
      "Gagal mengambil data role dan permission.",
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response || !user) {
    return response ?? jsonError("Unauthorized", 401);
  }

  const permission = requirePermission(user, "user.manage");

  if (permission.response) {
    return permission.response;
  }

  try {
    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return jsonError("Format data tidak valid.", 400);
    }

    const input = body as Record<string, unknown>;

    const name =
      typeof input.name === "string" ? input.name.trim() : "";

    const description =
      typeof input.description === "string"
        ? input.description.trim()
        : "";

    const permissionCodes = input.permissionCodes;

    if (!name || name.length > 100) {
      return jsonError(
        "Nama role wajib diisi dan maksimal 100 karakter.",
        400,
      );
    }

    if (description.length > 255) {
      return jsonError(
        "Deskripsi maksimal 255 karakter.",
        400,
      );
    }

    if (
      !Array.isArray(permissionCodes) ||
      !permissionCodes.every(
        (code): code is string => typeof code === "string",
      )
    ) {
      return jsonError("Daftar permission tidak valid.", 400);
    }

    const codes = [...new Set(permissionCodes)];

    const existingPermissions =
      await prisma.permission.findMany({
        where: {
          code: {
            in: codes.filter(
              (code) => code !== ACTIVITY_PERMISSION.code,
            ),
          },
        },
        select: {
          id: true,
          code: true,
        },
      });

    const allowedCodes = new Set([
      ...existingPermissions.map((item) => item.code),
      ACTIVITY_PERMISSION.code,
    ]);

    if (codes.some((code) => !allowedCodes.has(code))) {
      return jsonError(
        "Terdapat permission yang tidak dikenal.",
        400,
      );
    }

    const createdRole = await prisma.$transaction(async (tx) => {
      const permissionRecords = [...existingPermissions];

      if (codes.includes(ACTIVITY_PERMISSION.code)) {
        const activityPermission = await tx.permission.upsert({
          where: {
            code: ACTIVITY_PERMISSION.code,
          },
          update: {
            name: ACTIVITY_PERMISSION.name,
            description: ACTIVITY_PERMISSION.description,
          },
          create: ACTIVITY_PERMISSION,
          select: {
            id: true,
            code: true,
          },
        });

        permissionRecords.push(activityPermission);
      }

      return tx.role.create({
        data: {
          name,
          description: description || null,
          permissions: {
            create: permissionRecords
              .filter((item) => codes.includes(item.code))
              .map((item) => ({
                permissionId: item.id,
              })),
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: "Role berhasil dibuat.",
        data: createdRole,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/roles error:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return jsonError("Nama role sudah digunakan.", 409);
    }

    return jsonError("Gagal membuat role.", 500);
  }
}