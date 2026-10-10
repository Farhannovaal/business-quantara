import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { getHistoricalProduction } from "@/lib/historical-production";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(user, "dashboard.view");

  if (permission.response) {
    return permission.response;
  }

  const startDate = request.nextUrl.searchParams.get("startDate") ?? "";
  const endDate = request.nextUrl.searchParams.get("endDate") ?? "";

  if (!startDate || !endDate) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Parameter startDate dan endDate wajib diisi dengan format YYYY-MM-DD.",
      },
      { status: 400 },
    );
  }

  try {
    const data = await getHistoricalProduction({ startDate, endDate });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal menghitung data historis.";
    const isBadRequest = /tanggal|format/i.test(message);

    if (!isBadRequest) {
      console.error("GET production report error:", error);
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: isBadRequest ? 400 : 500 },
    );
  }
}
