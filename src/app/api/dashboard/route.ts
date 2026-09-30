import { requirePermission } from "@/lib/auth/authorization";

import { requireAuth } from "@/lib/auth/require-auth";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }
  const permission = requirePermission(
    user,
    "dashboard.view"
  );

  if (permission.response) {
    return permission.response;
  }


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
      prisma.sPK.count({
        where: {
          status: "ACTIVE",
        },
      }),

      prisma.transaction.count({
        where: {
          createdAt: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),

      prisma.product.count({
        where: {
          isActive: true,
        },
      }),

      prisma.transaction.findMany({
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
}