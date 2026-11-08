
import { NextRequest, NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import {
  calculateQCMonitoring,
  type QCMonitoringItem,
} from "@/lib/qc/calculator";

export const GET = withApiAuth(
  async ({ request, tenant }) => {
    const companyId = tenant!.id;

    try {
      const searchParams = request.nextUrl.searchParams;

      const search =
        searchParams.get("search")?.trim().toLowerCase() || "";

      const status =
        searchParams.get("status")?.trim().toUpperCase() || "";

      // Ambil SPK hanya dari perusahaan aktif.
      const spks = await prisma.sPK.findMany({
        where: {
          companyId,
          deletedAt: null,
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
                    items: {
                      some: {
                        product: {
                          name: {
                            contains: search,
                          },
                        },
                      },
                    },
                  },
                  {
                    items: {
                      some: {
                        product: {
                          code: {
                            contains: search,
                          },
                        },
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

      const results: QCMonitoringItem[] = [];

      for (const spk of spks) {
        const items = await calculateQCMonitoring(spk.id);

        for (const item of items) {
          // Jangan tampilkan product yang belum menerima barang ke QC.
          if (item.totalDiterima === 0) {
            continue;
          }

          // Filter status dilakukan per product, bukan per SPK.
          if (status && item.status !== status) {
            continue;
          }

          results.push(item);
        }
      }

      const summary = {
        totalDiterima: results.reduce(
          (total, item) => total + item.totalDiterima,
          0
        ),

        totalSudahQC: results.reduce(
          (total, item) => total + item.totalSudahQC,
          0
        ),

        totalAcc: results.reduce(
          (total, item) => total + item.totalAcc,
          0
        ),

        totalRijek: results.reduce(
          (total, item) => total + item.totalRijek,
          0
        ),

        sisaQC: results.reduce(
          (total, item) => total + item.sisaQC,
          0
        ),

        waiting: results.filter(
          (item) => item.status === "WAITING"
        ).length,

        inProgress: results.filter(
          (item) => item.status === "IN_PROGRESS"
        ).length,

        completed: results.filter(
          (item) => item.status === "COMPLETED"
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
      console.error("GET QC monitoring error:", error);

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
        }
      );
    }
  },
  {
    tenant: "required",
    permission: "qc.view",
  }
);
