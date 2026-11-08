
import { NextRequest, NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
import { getHistoricalProduction } from "@/lib/historical-production";

export const dynamic = "force-dynamic";

export const GET = withApiAuth(
  async ({ request, tenant }) => {
    const companyId = tenant!.id;

    try {
      const searchParams = request.nextUrl.searchParams;

      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");

      if (!startDate || !endDate) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Parameter startDate dan endDate wajib diisi dengan format YYYY-MM-DD.",
          },
          {
            status: 400,
          }
        );
      }

      const data = await getHistoricalProduction({
        companyId,
        startDate,
        endDate,
      });

      return NextResponse.json(
        {
          success: true,
          data,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    } catch (error) {
      console.error(
        "[GET /api/reports/production]",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat mengambil laporan produksi.";

      const isDateValidationError =
        /tanggal|format/i.test(message);

      return NextResponse.json(
        {
          success: false,
          error: isDateValidationError
            ? message
            : "Terjadi kesalahan internal saat mengambil laporan produksi.",
        },
        {
          status: isDateValidationError ? 400 : 500,
        }
      );
    }
  },
  {
    tenant: "required",
    permission: "dashboard.view",
  }
);
