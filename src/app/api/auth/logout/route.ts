import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth/session";

export async function POST() {
  try {
    await destroySession();

    return NextResponse.json({
      success: true,
      message: "Logout berhasil.",
    });
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat logout.",
      },
      {
        status: 500,
      },
    );
  }
}