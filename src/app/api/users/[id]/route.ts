
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePermission } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import type { UserStatus } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status },
  );
}

async function getAuthorizedUser(permissionCode: string) {
  const auth = await requireAuth();

  if (auth.response || !auth.user) {
    return {
      user: null,
      response:
        auth.response ??
        jsonError("Unauthorized", 401),
    };
  }

  const permission = requirePermission(
    auth.user,
    permissionCode,
  );

  if (!permission.allowed) {
    return {
      user: null,
      response: permission.response,
    };
  }

  return { user: auth.user, response: null };
}

async function parseUserId(context: RouteContext) {
  const { id } = await context.params;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return userId;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const auth = await getAuthorizedUser("user.view");

  if (auth.response) return auth.response;

  try {
    const userId = await parseUserId(context);

    if (!userId) {
      return jsonError("ID pengguna tidak valid.", 400);
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        roleId: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!target) {
      return jsonError("Pengguna tidak ditemukan.", 404);
    }

    return NextResponse.json({
      success: true,
      data: target,
    });
  } catch (error) {
    console.error("GET /api/users/[id]:", error);
    return jsonError("Gagal mengambil data pengguna.", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const auth = await getAuthorizedUser("user.manage");

  if (auth.response || !auth.user) {
    return auth.response ?? jsonError("Unauthorized", 401);
  }

  try {
    const userId = await parseUserId(context);

    if (!userId) {
      return jsonError("ID pengguna tidak valid.", 400);
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        roleId: true,
      },
    });

    if (!existingUser) {
      return jsonError("Pengguna tidak ditemukan.", 404);
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return jsonError("Format data tidak valid.", 400);
    }

    const input = body as Record<string, unknown>;
    const data: {
      name?: string;
      email?: string;
      roleId?: number | null;
      status?: UserStatus;
      passwordHash?: string;
    } = {};

    if ("name" in input) {
      if (
        typeof input.name !== "string" ||
        !input.name.trim()
      ) {
        return jsonError("Nama wajib diisi.", 400);
      }

      if (input.name.trim().length > 150) {
        return jsonError("Nama maksimal 150 karakter.", 400);
      }

      data.name = input.name.trim();
    }

    if ("email" in input) {
      if (typeof input.email !== "string") {
        return jsonError("Email tidak valid.", 400);
      }

      const email = input.email.trim().toLowerCase();

      if (
        email.length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return jsonError("Format email tidak valid.", 400);
      }

      data.email = email;
    }

    if ("roleId" in input) {
      if (input.roleId === null) {
        data.roleId = null;
      } else if (
        typeof input.roleId === "number" &&
        Number.isInteger(input.roleId) &&
        input.roleId > 0
      ) {
        const role = await prisma.role.findUnique({
          where: { id: input.roleId },
          select: { id: true },
        });

        if (!role) {
          return jsonError("Role tidak ditemukan.", 400);
        }

        data.roleId = role.id;
      } else {
        return jsonError("Role tidak valid.", 400);
      }
    }

    if ("status" in input) {
      if (
        input.status !== "ACTIVE" &&
        input.status !== "INACTIVE"
      ) {
        return jsonError("Status pengguna tidak valid.", 400);
      }

      data.status = input.status;
    }

    if ("password" in input) {
      if (
        typeof input.password !== "string" ||
        input.password.length < 8
      ) {
        return jsonError(
          "Password minimal 8 karakter.",
          400,
        );
      }

      data.passwordHash = await hashPassword(input.password);
    }

    if (Object.keys(data).length === 0) {
      return jsonError("Tidak ada data yang diperbarui.", 400);
    }

    if (
      auth.user.id === userId &&
      data.status === "INACTIVE"
    ) {
      return jsonError(
        "Kamu tidak dapat menonaktifkan akun sendiri.",
        400,
      );
    }

    if (
      auth.user.id === userId &&
      "roleId" in data
    ) {
      if (data.roleId !== auth.user.roleId) {
        return jsonError(
          "Kamu tidak dapat mengubah role akun sendiri.",
          400,
        );
      }
    }

    if (
      auth.user.id === userId &&
      data.passwordHash
    ) {
      return jsonError(
        "Gunakan fitur ubah password untuk akun sendiri.",
        400,
      );
    }

    if (data.email) {
      const duplicate = await prisma.user.findFirst({
        where: {
          email: data.email,
          NOT: { id: userId },
        },
        select: { id: true },
      });

      if (duplicate) {
        return jsonError(
          "Email sudah digunakan oleh pengguna lain.",
          409,
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        roleId: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Data pengguna berhasil diperbarui.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("PATCH /api/users/[id]:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return jsonError("Email sudah digunakan.", 409);
    }

    return jsonError("Gagal memperbarui data pengguna.", 500);
  }
}
