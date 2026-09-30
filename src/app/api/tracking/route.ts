import { requirePermission } from "@/lib/auth/authorization";

import { requireAuth } from "@/lib/auth/require-auth";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateSPKStatus } from "@/lib/spk-status";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }
  const permission = requirePermission(
    user,
    "tracking.view"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() ?? "";
    const spkIdParam = searchParams.get("spkId");

    const spks = await prisma.sPK.findMany({
      where: {
        ...(spkIdParam
          ? {
              id: Number(spkIdParam),
            }
          : {}),
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
      include: {
        product: true,
        tailor: true,
        transactions: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            transactionType: true,
            employee: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const data = spks.map((spk) => {
      const summary = calculateSPKStatus(
        spk.transactions.map((transaction) => ({
          quantity: transaction.quantity,
          transactionType: {
            code: transaction.transactionType.code,
          },
        })),
      );

      const transactions = spk.transactions.map((transaction) => ({
        id: transaction.id,
        transactionNumber: transaction.transactionNumber,
        quantity: transaction.quantity,
        createdAt: transaction.createdAt,
        transactionType: {
          id: transaction.transactionType.id,
          code: transaction.transactionType.code,
          name: transaction.transactionType.name,
        },
        employee: {
          id: transaction.employee.id,
          name: transaction.employee.name,
        },
      }));

      return {
        id: spk.id,
        spkNumber: spk.spkNumber,
        status: spk.status,

        product: {
          id: spk.product.id,
          code: spk.product.code,
          name: spk.product.name,
        },

        tailor: {
          id: spk.tailor.id,
          name: spk.tailor.name,
        },

        summary,

        transactions,
      };
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("GET /api/tracking error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil data tracking.",
      },
      {
        status: 500,
      },
    );
  }
}