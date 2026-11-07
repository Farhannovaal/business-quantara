
import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth/session";

const ACTIVE_COMPANY_COOKIE = "active_company_id";

export async function POST() {
  try {
    await destroySession();

    const response = NextResponse.json({
      success: true,
      message: "Logout berhasil.",
    });

    // Hapus active company saat logout.
    response.cookies.set({
      name: ACTIVE_COMPANY_COOKIE,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat logout.",
      },
      { status: 500 },
    );
  }
}
