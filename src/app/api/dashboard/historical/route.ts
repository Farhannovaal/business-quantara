
import { NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
import { getHistoricalProduction } from "@/lib/historical-production";

export const dynamic = "force-dynamic";

export const GET = withApiAuth(
  async ({ request, tenant }) => {
    const companyId = tenant!.id;

    const startDate =
      request.nextUrl.searchParams.get("startDate") ?? "";

    const endDate =
      request.nextUrl.searchParams.get("endDate") ?? "";

    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Parameter startDate dan endDate wajib diisi (YYYY-MM-DD).",
        },
        { status: 400 }
      );
    }

    try {
      const data = await getHistoricalProduction({
        companyId,
        startDate,
        endDate,
      });

      return NextResponse.json({
        success: true,
        data,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal menghitung data historis.";

      const status = /tanggal|format/i.test(message)
        ? 400
        : 500;

      if (status === 500) {
        console.error(
          "GET historical dashboard error:",
          error
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status }
      );
    }
  },
  {
    tenant: "required",
    permission: "dashboard.view",
  }
);
