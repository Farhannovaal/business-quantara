import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";
import { calculateSPKStatus } from "@/lib/spk-status";

export async function GET() {
  const auth = await requireAuth();

  if (auth.response) {
    return auth.response;
  }

  const user = auth.user;

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  if (!hasPermission(user, "tailor-billing.view")) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      { status: 403 },
    );
  }

  try {
    const now = new Date();

    const spks = await prisma.sPK.findMany({
      where: {
        status: {
          not: "CANCELLED",
        },
      },

      include: {
        product: true,
        tailor: true,

        transactions: {
          include: {
            transactionType: true,
          },

          orderBy: {
            createdAt: "asc",
          },
        },

        tailorBillItems: {
          where: {
            bill: {
              status: {
                not: "CANCELLED",
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    let readySpkCount = 0;
    let missingRateSpkCount = 0;

    let readyQuantity = 0;
    let readyAmount = 0;

    let missingRateQuantity = 0;

    const tailorIds = new Set<number>();

    const readyItems: {
      spkId: number;
      spkNumber: string;
      tailorId: number;
      tailorName: string;
      productId: number;
      productName: string;
      billableQuantity: number;
      rate: number;
      amount: number;
    }[] = [];

    const missingRateItems: {
      spkId: number;
      spkNumber: string;
      tailorId: number;
      tailorName: string;
      productId: number;
      productName: string;
      billableQuantity: number;
    }[] = [];

    for (const spk of spks) {
      const status = calculateSPKStatus(
        spk.transactions.map((transaction) => ({
          quantity: transaction.quantity,

          transactionType: {
            code: transaction.transactionType.code,
          },
        })),
      );

      const totalAlreadyBilled =
        spk.tailorBillItems.reduce(
          (total, item) =>
            total + Number(item.quantity),
          0,
        );

      const billableQuantity = Math.max(
        status.totalQcAcc -
          totalAlreadyBilled,
        0,
      );

      if (billableQuantity <= 0) {
        continue;
      }

      const tailorRate =
        await prisma.tailorRate.findFirst({
          where: {
            tailorId: spk.tailorId,
            productId: spk.productId,
            isActive: true,

            effectiveFrom: {
              lte: now,
            },

            OR: [
              {
                effectiveTo: null,
              },
              {
                effectiveTo: {
                  gte: now,
                },
              },
            ],
          },

          orderBy: {
            effectiveFrom: "desc",
          },
        });

      if (!tailorRate) {
        missingRateSpkCount++;
        missingRateQuantity +=
          billableQuantity;

        missingRateItems.push({
          spkId: spk.id,
          spkNumber: spk.spkNumber,

          tailorId: spk.tailorId,
          tailorName: spk.tailor.name,

          productId: spk.productId,
          productName: spk.product.name,

          billableQuantity,
        });

        continue;
      }

      const rate = Number(tailorRate.rate);

      const amount =
        billableQuantity * rate;

      readySpkCount++;
      readyQuantity += billableQuantity;
      readyAmount += amount;

      tailorIds.add(spk.tailorId);

      readyItems.push({
        spkId: spk.id,
        spkNumber: spk.spkNumber,

        tailorId: spk.tailorId,
        tailorName: spk.tailor.name,

        productId: spk.productId,
        productName: spk.product.name,

        billableQuantity,
        rate,
        amount,
      });
    }

    return NextResponse.json({
      success: true,

      data: {
        readySpkCount,
        readyTailorCount: tailorIds.size,

        readyQuantity,
        readyAmount,

        missingRateSpkCount,
        missingRateQuantity,

        totalSpkChecked: spks.length,

        readyItems,
        missingRateItems,
      },
    });
  } catch (error) {
    console.error(
      "Get tailor billing summary error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Gagal mengambil summary billing penjahit.",
      },
      {
        status: 500,
      },
    );
  }
}