
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import { requirePermission } from "@/lib/auth/authorization";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, response } = await requireAuth();

  if (response || !user) {
    return response;
  }

  const permission = requirePermission(user, "user.view");

  if (permission.response) {
    return permission.response;
  }

  try {
    const [users, roles] = await Promise.all([
      prisma.user.findMany({
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
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.role.findMany({
        select: {
          id: true,
          name: true,
          description: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: users,
      roles,
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

  if (response || !user) {
    return response;
  }

  const permission = requirePermission(user, "user.manage");

  if (permission.response) {
    return permission.response;
  }

  try {
    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    const roleId = Number(body.roleId);

    const status = body.status ?? "ACTIVE";

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

    if (!Number.isInteger(roleId) || roleId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Role wajib dipilih.",
        },
        { status: 400 },
      );
    }

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Status akun tidak valid.",
        },
        { status: 400 },
      );
    }

    const [existingUser, role] = await Promise.all([
      prisma.user.findUnique({
        where: { email },
        select: { id: true },
      }),

      prisma.role.findUnique({
        where: { id: roleId },
        select: { id: true },
      }),
    ]);

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Email sudah digunakan.",
        },
        { status: 409 },
      );
    }

    if (!role) {
      return NextResponse.json(
        {
          success: false,
          error: "Role tidak ditemukan.",
        },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);

    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        roleId,
        status,
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        roleId: true,
        createdAt: true,
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

    return NextResponse.json(
      {
        success: false,
        error: "Gagal membuat akun.",
      },
      { status: 500 },
    );
  }
}
