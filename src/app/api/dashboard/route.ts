
import { NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = withApiAuth(
  async ({ tenant }) => {
    const companyId = tenant!.id;

    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const [
        activeSpks,
        todayTransactions,
        activeProducts,
        recentTransactions,
      ] = await Promise.all([
        // Total SPK aktif milik perusahaan.
        prisma.sPK.count({
          where: {
            companyId,
            status: "ACTIVE",
            deletedAt: null,
          },
        }),

        // Total transaksi hari ini milik perusahaan.
        prisma.transaction.count({
          where: {
            companyId,
            createdAt: {
              gte: startOfToday,
              lte: endOfToday,
            },
          },
        }),

        // Total produk aktif milik perusahaan.
        prisma.product.count({
          where: {
            companyId,
            isActive: true,
          },
        }),

        // Lima transaksi terakhir milik perusahaan.
        prisma.transaction.findMany({
          where: {
            companyId,
          },
          take: 5,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            transactionType: true,
            spk: true,
            product: true,
            tailor: true,
            employee: true,
          },
        }),
      ]);

      return NextResponse.json({
        success: true,

        stats: {
          activeSpks,
          todayTransactions,
          activeProducts,
        },

        recentTransactions,
      });
    } catch (error) {
      console.error("Dashboard error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load dashboard data",
        },
        {
          status: 500,
        }
      );
    }
  },
  {
    tenant: "required",
    permission: "dashboard.view",
  }
);
