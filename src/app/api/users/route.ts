import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import { requirePermission } from "@/lib/auth/authorization";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

type RequestBody = Record<string, unknown>;

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

function isPrismaUniqueError(
  error: unknown,
): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

/**
 * Superadmin dikenali berdasarkan nama role persis "Superadmin".
 * Identitas role diambil kembali dari database.
 */
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

export async function GET() {
  const { user, response } = await requireAuth();

  if (response) return response;

  const permission = requirePermission(user, "user.view");
  if (permission.response) return permission.response;

  try {
    const superAdmin = await isSuperAdmin(user.id);

    if (!superAdmin && user.companyId == null) {
      return NextResponse.json(
        {
          success: false,
          error: "User belum terhubung dengan perusahaan.",
        },
        { status: 403 },
      );
    }

    const companyId = user.companyId;

    const [users, roles, companies] = await Promise.all([
      prisma.user.findMany({
        where: superAdmin
          ? {}
          : {
              companyId: companyId!,
            },
        select: {
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
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.role.findMany({
        where: superAdmin
          ? {
              companyId: {
                not: null,
              },
            }
          : {
              companyId: companyId!,
            },
        select: {
          id: true,
          companyId: true,
          name: true,
          description: true,
          company: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: [
          { companyId: "asc" },
          { name: "asc" },
        ],
      }),

      superAdmin
        ? prisma.company.findMany({
            select: {
              id: true,
              name: true,
              code: true,
              slug: true,
              status: true,
            },
            orderBy: {
              name: "asc",
            },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      success: true,
      data: users,
      roles,
      companies,
      isSuperAdmin: superAdmin,
    });
  } catch (error) {
    console.error("GET /api/users error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil data pengguna.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) return response;

  const permission = requirePermission(user, "user.manage");
  if (permission.response) return permission.response;

  try {
    const superAdmin = await isSuperAdmin(user.id);

    if (!superAdmin && user.companyId == null) {
      return NextResponse.json(
        {
          success: false,
          error: "User belum terhubung dengan perusahaan.",
        },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();

    if (!isObjectBody(body)) {
      return NextResponse.json(
        {
          success: false,
          error: "Format data tidak valid.",
        },
        { status: 400 },
      );
    }

    const input = body;

    const name =
      typeof input.name === "string"
        ? input.name.trim()
        : "";

    const email =
      typeof input.email === "string"
        ? input.email.trim().toLowerCase()
        : "";

    const password =
      typeof input.password === "string"
        ? input.password
        : "";

    const roleId = parsePositiveInteger(input.roleId);
    const status = input.status ?? "ACTIVE";

    /*
     * Superadmin wajib memilih perusahaan tujuan.
     * User biasa tidak dapat menentukan companyId sendiri.
     */
    let targetCompanyId: number;

    if (superAdmin) {
      const requestedCompanyId = parsePositiveInteger(
        input.companyId,
      );

      if (requestedCompanyId === null) {
        return NextResponse.json(
          {
            success: false,
            error: "Perusahaan tujuan wajib dipilih.",
          },
          { status: 400 },
        );
      }

      targetCompanyId = requestedCompanyId;
    } else {
      targetCompanyId = user.companyId!;
    }

    if (!name || name.length > 150) {
      return NextResponse.json(
        {
          success: false,
          error: "Nama wajib diisi dan maksimal 150 karakter.",
        },
        { status: 400 },
      );
    }

    if (
      !email ||
      email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Format email tidak valid.",
        },
        { status: 400 },
      );
    }

    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        {
          success: false,
          error: "Password harus terdiri dari 8–128 karakter.",
        },
        { status: 400 },
      );
    }

    if (roleId === null) {
      return NextResponse.json(
        {
          success: false,
          error: "Role wajib dipilih.",
        },
        { status: 400 },
      );
    }

    if (status !== "ACTIVE" && status !== "INACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: "Status akun tidak valid.",
        },
        { status: 400 },
      );
    }

    /*
     * Pastikan perusahaan tujuan benar-benar tersedia.
     */
    const company = await prisma.company.findUnique({
      where: {
        id: targetCompanyId,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          error: "Perusahaan tujuan tidak ditemukan.",
        },
        { status: 400 },
      );
    }

    if (company.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: "Perusahaan tujuan tidak aktif.",
        },
        { status: 400 },
      );
    }

    /*
     * Role harus berasal dari perusahaan tujuan.
     * Role global (companyId = null) tidak diperbolehkan.
     */
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        companyId: targetCompanyId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!role) {
      return NextResponse.json(
        {
          success: false,
          error: "Role tidak ditemukan untuk perusahaan tujuan.",
        },
        { status: 400 },
      );
    }

    /*
     * Email unik secara global sesuai Prisma schema.
     */
    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Email sudah digunakan.",
        },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);

    const createdUser = await prisma.user.create({
      data: {
        companyId: targetCompanyId,
        name,
        email,
        passwordHash,
        roleId,
        status,
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        status: true,
        roleId: true,
        createdAt: true,
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
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Akun berhasil dibuat.",
        data: createdUser,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/users error:", error);

    if (isPrismaUniqueError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: "Email sudah digunakan.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Gagal membuat akun.",
      },
      { status: 500 },
    );
  }
}