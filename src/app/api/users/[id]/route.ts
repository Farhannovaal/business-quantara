import { NextRequest, NextResponse } from "next/server";
import type { UserStatus } from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePermission } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AuthorizedUser = {
  id: number;
  companyId: number | null;
  roleId: number | null;
};

type RequestBody = Record<string, unknown>;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

function isObjectBody(value: unknown): value is RequestBody {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function parsePositiveInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;

  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

async function isSuperAdmin(userId: number): Promise<boolean> {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  return currentUser?.role?.name === "Superadmin";
}

async function getAuthorizedUser(permissionCode: string) {
  const auth = await requireAuth();

  if (auth.response || !auth.user) {
    return {
      user: null,
      isSuperAdmin: false,
      response: auth.response ?? jsonError("Unauthorized", 401),
    };
  }

  const permission = requirePermission(
    auth.user,
    permissionCode
  );

  if (permission.response) {
    return {
      user: null,
      isSuperAdmin: false,
      response: permission.response,
    };
  }

  // Periksa role terbaru dari database, bukan dari payload client.
  const superAdmin = await isSuperAdmin(auth.user.id);

  if (!superAdmin && auth.user.companyId == null) {
    return {
      user: null,
      isSuperAdmin: false,
      response: jsonError(
        "User belum terhubung dengan perusahaan.",
        403
      ),
    };
  }

  return {
    user: auth.user as AuthorizedUser,
    isSuperAdmin: superAdmin,
    response: null,
  };
}

async function parseUserId(context: RouteContext) {
  const { id } = await context.params;
  const userId = Number(id);

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return null;
  }

  return userId;
}

const userSelect = {
  id: true,
  companyId: true,
  name: true,
  email: true,
  status: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
  company: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  role: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const auth = await getAuthorizedUser("user.view");

  if (auth.response || !auth.user) {
    return auth.response ?? jsonError("Unauthorized", 401);
  }

  try {
    const userId = await parseUserId(context);

    if (userId === null) {
      return jsonError("ID pengguna tidak valid.", 400);
    }

    const target = await prisma.user.findFirst({
      where: auth.isSuperAdmin
        ? { id: userId }
        : {
            id: userId,
            companyId: auth.user.companyId!,
          },
      select: userSelect,
    });

    if (!target) {
      return jsonError("Pengguna tidak ditemukan.", 404);
    }

    return NextResponse.json({
      success: true,
      data: target,
      isSuperAdmin: auth.isSuperAdmin,
    });
  } catch (error) {
    console.error("GET /api/users/[id] error:", error);

    return jsonError(
      "Gagal mengambil data pengguna.",
      500
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const auth = await getAuthorizedUser("user.manage");

  if (auth.response || !auth.user) {
    return auth.response ?? jsonError("Unauthorized", 401);
  }

  try {
    const userId = await parseUserId(context);

    if (userId === null) {
      return jsonError("ID pengguna tidak valid.", 400);
    }

    const existingUser = await prisma.user.findFirst({
      where: auth.isSuperAdmin
        ? { id: userId }
        : {
            id: userId,
            companyId: auth.user.companyId!,
          },
      select: {
        id: true,
        companyId: true,
        status: true,
        roleId: true,
      },
    });

    if (!existingUser) {
      return jsonError("Pengguna tidak ditemukan.", 404);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Format JSON tidak valid.", 400);
    }

    if (!isObjectBody(body)) {
      return jsonError("Format data tidak valid.", 400);
    }

    const input = body;

    // Pengguna biasa tidak boleh mengirim perubahan perusahaan.
    if (!auth.isSuperAdmin && "companyId" in input) {
      return jsonError(
        "Hanya Superadmin yang dapat mengubah perusahaan pengguna.",
        403
      );
    }

    const data: {
      name?: string;
      email?: string;
      companyId?: number;
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

      const name = input.name.trim();

      if (name.length > 150) {
        return jsonError(
          "Nama maksimal 150 karakter.",
          400
        );
      }

      data.name = name;
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
        return jsonError(
          "Format email tidak valid.",
          400
        );
      }

      data.email = email;
    }

    /*
     * Tentukan perusahaan tujuan.
     * Superadmin boleh mengubahnya; user biasa tetap di perusahaan asal.
     */
    let targetCompanyId = existingUser.companyId;

    if (auth.isSuperAdmin && "companyId" in input) {
      const requestedCompanyId = parsePositiveInteger(
        input.companyId
      );

      if (requestedCompanyId === null) {
        return jsonError(
          "Perusahaan tujuan wajib dipilih.",
          400
        );
      }

      const company = await prisma.company.findUnique({
        where: { id: requestedCompanyId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!company) {
        return jsonError(
          "Perusahaan tujuan tidak ditemukan.",
          400
        );
      }

      if (company.status !== "ACTIVE") {
        return jsonError(
          "Perusahaan tujuan tidak aktif.",
          400
        );
      }

      targetCompanyId = company.id;
      data.companyId = company.id;
    }

    const companyChanged =
      targetCompanyId !== existingUser.companyId;

    /*
     * Jika perusahaan berubah, role tujuan wajib dipilih juga.
     * Ini mencegah user membawa role dari perusahaan sebelumnya.
     */
    if (companyChanged && !("roleId" in input)) {
      return jsonError(
        "Pilih role yang sesuai dengan perusahaan tujuan.",
        400
      );
    }

    if ("roleId" in input) {
      if (input.roleId === null) {
        return jsonError("Role wajib dipilih.", 400);
      }

      const roleId = parsePositiveInteger(input.roleId);

      if (roleId === null) {
        return jsonError("Role tidak valid.", 400);
      }

      if (targetCompanyId === null) {
        return jsonError(
          "Perusahaan pengguna belum ditentukan.",
          400
        );
      }

      // Role harus milik perusahaan tujuan, bukan perusahaan asal.
      const role = await prisma.role.findFirst({
        where: {
          id: roleId,
          companyId: targetCompanyId,
        },
        select: {
          id: true,
        },
      });

      if (!role) {
        return jsonError(
          "Role tidak ditemukan untuk perusahaan tujuan.",
          400
        );
      }

      data.roleId = role.id;
    }

    if ("status" in input) {
      if (
        input.status !== "ACTIVE" &&
        input.status !== "INACTIVE"
      ) {
        return jsonError(
          "Status pengguna tidak valid.",
          400
        );
      }

      data.status = input.status;
    }

    if ("password" in input) {
      if (
        typeof input.password !== "string" ||
        input.password.length < 8 ||
        input.password.length > 128
      ) {
        return jsonError(
          "Password harus terdiri dari 8–128 karakter.",
          400
        );
      }

      data.passwordHash = await hashPassword(
        input.password
      );
    }

    if (Object.keys(data).length === 0) {
      return jsonError(
        "Tidak ada data yang diperbarui.",
        400
      );
    }

    // Pengamanan perubahan akun sendiri.
    if (
      auth.user.id === userId &&
      data.status === "INACTIVE"
    ) {
      return jsonError(
        "Kamu tidak dapat menonaktifkan akun sendiri.",
        400
      );
    }

    if (
      auth.user.id === userId &&
      "roleId" in data &&
      data.roleId !== auth.user.roleId
    ) {
      return jsonError(
        "Kamu tidak dapat mengubah role akun sendiri.",
        400
      );
    }

    if (
      auth.user.id === userId &&
      "companyId" in data &&
      data.companyId !== auth.user.companyId
    ) {
      return jsonError(
        "Kamu tidak dapat memindahkan akun sendiri ke perusahaan lain.",
        400
      );
    }

    if (
      auth.user.id === userId &&
      data.passwordHash !== undefined
    ) {
      return jsonError(
        "Gunakan fitur ubah password untuk akun sendiri.",
        400
      );
    }

    // Email harus unik secara global.
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
          409
        );
      }
    }

    /*
     * Update dibatasi berdasarkan perusahaan untuk user biasa.
     * Superadmin dapat memperbarui pengguna lintas perusahaan.
     */
    const result = await prisma.user.updateMany({
      where: auth.isSuperAdmin
        ? { id: userId }
        : {
            id: userId,
            companyId: auth.user.companyId!,
          },
      data,
    });

    if (result.count === 0) {
      return jsonError(
        "Pengguna tidak ditemukan.",
        404
      );
    }

    const updatedUser = await prisma.user.findFirst({
      where: auth.isSuperAdmin
        ? { id: userId }
        : {
            id: userId,
            companyId: auth.user.companyId!,
          },
      select: userSelect,
    });

    if (!updatedUser) {
      return jsonError(
        "Data pengguna berhasil diperbarui tetapi gagal dimuat ulang.",
        500
      );
    }

    return NextResponse.json({
      success: true,
      message: "Data pengguna berhasil diperbarui.",
      data: updatedUser,
    });
  } catch (error) {
    console.error(
      "PATCH /api/users/[id] error:",
      error
    );

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return jsonError(
        "Email sudah digunakan.",
        409
      );
    }

    return jsonError(
      "Gagal memperbarui data pengguna.",
      500
    );
  }
}