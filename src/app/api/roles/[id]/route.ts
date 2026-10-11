// src/app/api/roles/[id]/route.ts

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

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status },
  );
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response || !user) {
    return response ?? jsonError("Unauthorized", 401);
  }

  const permission = requirePermission(user, "user.manage");

  if (permission.response) {
    return permission.response;
  }

  try {
    const { id } = await context.params;
    const roleId = Number(id);

    if (!Number.isInteger(roleId) || roleId <= 0) {
      return jsonError("ID role tidak valid.", 400);
    }

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

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });

    if (!role) {
      return jsonError("Role tidak ditemukan.", 404);
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

    const updatedRole = await prisma.$transaction(async (tx) => {
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

      // Ganti assignment permission sesuai pilihan terbaru.
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      const assignments = permissionRecords
        .filter((item) => codes.includes(item.code))
        .map((item) => ({
          roleId,
          permissionId: item.id,
        }));

      if (assignments.length > 0) {
        await tx.rolePermission.createMany({
          data: assignments,
          skipDuplicates: true,
        });
      }

      return tx.role.update({
        where: { id: roleId },
        data: {
          name,
          description: description || null,
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

    return NextResponse.json({
      success: true,
      message: "Role dan permission berhasil diperbarui.",
      data: updatedRole,
    });
  } catch (error) {
    console.error("PATCH /api/roles/[id] error:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return jsonError("Nama role sudah digunakan.", 409);
    }

    return jsonError(
      "Gagal memperbarui role dan permission.",
      500,
    );
  }
}