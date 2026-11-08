
import { NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = withApiAuth<RouteContext>(
  async ({ context, tenant }) => {
    const companyId = tenant!.id;

    try {
      const { id } = await context.params;
      const transactionId = Number(id);

      if (
        !Number.isSafeInteger(transactionId) ||
        transactionId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "ID transaksi tidak valid.",
          },
          { status: 400 }
        );
      }

      // Pastikan transaksi merupakan milik tenant aktif.
      const transaction = await prisma.transaction.findFirst({
        where: {
          id: transactionId,
          companyId,
        },
        select: {
          id: true,
          transactionNumber: true,
        },
      });

      if (!transaction) {
        return NextResponse.json(
          {
            success: false,
            error: "Transaksi tidak ditemukan.",
          },
          { status: 404 }
        );
      }

      // Activity log hanya boleh diambil dari tenant aktif.
      const logs = await prisma.activityLog.findMany({
        where: {
          companyId,
          entityType: "Transaction",
          entityId: String(transactionId),
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: logs,
        transaction,
      });
    } catch (error) {
      console.error("GET transaction activity error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Gagal mengambil riwayat aktivitas transaksi.",
        },
        { status: 500 }
      );
    }
  },
  {
    tenant: "required",
    permission: "activity.view",
  }
);
