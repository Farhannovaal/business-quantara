import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePermission } from "@/lib/auth/authorization";
import {
  calculateQCMonitoring,
} from "@/lib/qc/calculator";

export async function GET(
  request: NextRequest,
) {
  const { user, response } =
    await requireAuth();

  if (response) {
    return response;
  }

  const permission =
    requirePermission(
      user,
      "qc.view",
    );

  if (permission.response) {
    return permission.response;
  }

  try {
    const searchParams =
      request.nextUrl.searchParams;

    const search =
      searchParams
        .get("search")
        ?.trim()
        .toLowerCase() || "";

    const status =
      searchParams
        .get("status")
        ?.trim()
        .toUpperCase() || "";

    const spks =
      await prisma.sPK.findMany({
        where: {
          status: {
            not: "CANCELLED",
          },

          ...(search
            ? {
                OR: [
                  {
                    spkNumber: {
                      contains: search,
                    },
                  },
                  {
                    product: {
                      name: {
                        contains: search,
                      },
                    },
                  },
                  {
                    product: {
                      code: {
                        contains: search,
                      },
                    },
                  },
                  {
                    tailor: {
                      name: {
                        contains: search,
                      },
                    },
                  },
                ],
              }
            : {}),
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
      const item =
        await calculateQCMonitoring(
          spk.id,
        );

      if (
        status &&
        item.status !== status
      ) {
        continue;
      }

      /*
       * Jangan tampilkan SPK yang
       * belum pernah menerima barang
       * ke QC.
       */
      if (
        item.totalDiterima === 0
      ) {
        continue;
      }

      results.push(item);
    }

    const summary = {
      totalDiterima: results.reduce(
        (total, item) =>
          total +
          item.totalDiterima,
        0,
      ),

      totalSudahQC: results.reduce(
        (total, item) =>
          total +
          item.totalSudahQC,
        0,
      ),

      totalAcc: results.reduce(
        (total, item) =>
          total +
          item.totalAcc,
        0,
      ),

      totalRijek: results.reduce(
        (total, item) =>
          total +
          item.totalRijek,
        0,
      ),

      sisaQC: results.reduce(
        (total, item) =>
          total +
          item.sisaQC,
        0,
      ),

      waiting: results.filter(
        (item) =>
          item.status === "WAITING",
      ).length,

      inProgress: results.filter(
        (item) =>
          item.status ===
          "IN_PROGRESS",
      ).length,

      completed: results.filter(
        (item) =>
          item.status ===
          "COMPLETED",
      ).length,
    };

    return NextResponse.json({
      success: true,

      data: {
        summary,
        items: results,
      },
    });
  } catch (error) {
    console.error(
      "GET QC monitoring error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengambil data QC.",
      },
      {
        status: 500,
      },
    );
  }
}