import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email dan password wajib diisi.",
        },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Email atau password salah.",
        },
        { status: 401 },
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "User tidak aktif.",
        },
        { status: 403 },
      );
    }

    const passwordValid = await verifyPassword(
      password,
      user.passwordHash,
    );

    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Email atau password salah.",
        },
        { status: 401 },
      );
    }

    await createSession(user.id);

    const permissions =
      user.role?.permissions.map(
        (item) => item.permission.code,
      ) ?? [];

    return NextResponse.json({
      success: true,
      message: "Login berhasil.",
      data: {
        id: user.id,
        name: user.name,
        email: user.email,

        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
            }
          : null,

        permissions,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat login.",
      },
      { status: 500 },
    );
  }
}