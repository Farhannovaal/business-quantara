import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { getHistoricalProduction } from "@/lib/historical-production";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();
  if (response) return response;

  const permission = requirePermission(user, "dashboard.view");
  if (permission.response) return permission.response;

  const startDate = request.nextUrl.searchParams.get("startDate") ?? "";
  const endDate = request.nextUrl.searchParams.get("endDate") ?? "";
  if (!startDate || !endDate) {
    return NextResponse.json(
      { success: false, error: "Parameter startDate dan endDate wajib diisi (YYYY-MM-DD)." },
      { status: 400 },
    );
  }

  try {
    const data = await getHistoricalProduction({ startDate, endDate });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menghitung data historis.";
    const status = /tanggal|format/i.test(message) ? 400 : 500;
    if (status === 500) console.error("GET historical dashboard error:", error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
