
import { NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { calculateTailorBilling } from "@/lib/tailor-billing/calculator";

export const GET = withApiAuth(
  async ({ tenant }) => {
    const companyId = tenant!.id;

    try {
      const spks = await prisma.sPK.findMany({
        where: {
          companyId,
          status: {
            not: "CANCELLED",
          },
          deletedAt: null,
        },
        select: {
          id: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const results = [];

      for (const spk of spks) {
        try {
          const summaries = await calculateTailorBilling(
            spk.id,
            companyId
          );

          for (const summary of summaries) {
            if (summary.billableQuantity > 0) {
              results.push(summary);
            }
          }
        } catch (error) {
          // SPK tanpa tarif tidak membuat seluruh halaman gagal.
          // UI dapat menampilkan informasi bahwa tarif belum tersedia.
          console.warn(
            `Skip billing calculation for SPK ${spk.id}:`,
            error
          );
        }
      }

      return NextResponse.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error(
        "Get eligible tailor billing error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Gagal mengambil data SPK yang dapat ditagihkan.",
        },
        { status: 500 }
      );
    }
  },
  {
    tenant: "required",
    permission: "tailor-billing.view",
  }
);
