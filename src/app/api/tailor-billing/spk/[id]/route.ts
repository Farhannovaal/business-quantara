
import { NextRequest, NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
import { calculateTailorBilling } from "@/lib/tailor-billing/calculator";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const GET = withApiAuth<RouteContext>(
  async ({ context, tenant }) => {
    try {
      const { id } = await context.params;

      const spkId = Number(id);

      if (!Number.isInteger(spkId) || spkId <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "ID SPK tidak valid.",
          },
          {
            status: 400,
          }
        );
      }

      const companyId = tenant!.id;

      const data = await calculateTailorBilling(
        spkId,
        companyId
      );

      return NextResponse.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "Tailor billing calculation error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Gagal menghitung tagihan penjahit.",
        },
        {
          status: 500,
        }
      );
    }
  },
  {
    tenant: "required",
    permission: "tailor-billing.view",
  }
);
