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
        items: {
          include: {
            product: true,
          },
          orderBy: {
            id: "asc",
          },
        },
        tailor: true,
        transactions: {
          include: {
            transactionType: true,
          },
          orderBy: [
            {
              createdAt: "asc",
            },
            {
              id: "asc",
            },
          ],
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

    const tailorIds = new Set<number>();

    for (const spk of spks) {
      for (const spkItem of spk.items) {
        const productId = spkItem.productId;

        const productTransactions = spk.transactions.filter(
          (transaction) =>
            transaction.productId === productId &&
            transaction.status === "ACTIVE",
        );

        const status = calculateSPKStatus(
          productTransactions.map((transaction) => ({
            quantity: transaction.quantity,
            transactionType: {
              code: transaction.transactionType.code,
            },
          })),
        );

        const totalAlreadyBilled = spk.tailorBillItems
          .filter((item) => item.productId === productId)
          .reduce(
            (total, item) => total + Number(item.quantity),
            0,
          );

        const billableQuantity = Math.max(
          status.totalQcAcc - totalAlreadyBilled,
          0,
        );

        if (billableQuantity <= 0) {
          continue;
        }

        const tailorRate = await prisma.tailorRate.findFirst({
          where: {
            tailorId: spk.tailorId,
            productId,
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
          missingRateItems.push({
            spkId: spk.id,
            spkNumber: spk.spkNumber,
            tailorId: spk.tailorId,
            tailorName: spk.tailor.name,
            productId,
            productName: spkItem.product.name,
            billableQuantity,
          });

          continue;
        }

        const rate = Number(tailorRate.rate);
        const amount = billableQuantity * rate;

        tailorIds.add(spk.tailorId);

        readyItems.push({
          spkId: spk.id,
          spkNumber: spk.spkNumber,
          tailorId: spk.tailorId,
          tailorName: spk.tailor.name,
          productId,
          productName: spkItem.product.name,
          billableQuantity,
          rate,
          amount,
        });
      }
    }

    const readySpkIds = new Set(
      readyItems.map((item) => item.spkId),
    );

    const missingRateSpkIds = new Set(
      missingRateItems.map((item) => item.spkId),
    );

    const readyQuantity = readyItems.reduce(
      (total, item) => total + item.billableQuantity,
      0,
    );

    const readyAmount = readyItems.reduce(
      (total, item) => total + item.amount,
      0,
    );

    const missingRateQuantity = missingRateItems.reduce(
      (total, item) => total + item.billableQuantity,
      0,
    );

    return NextResponse.json({
      success: true,
      data: {
        readySpkCount: readySpkIds.size,
        readyTailorCount: tailorIds.size,
        readyQuantity,
        readyAmount,
        missingRateSpkCount: missingRateSpkIds.size,
        missingRateQuantity,
        totalSpkChecked: spks.length,
        readyItems,
        missingRateItems,
      },
    });
  } catch (error) {
    console.error("Get tailor billing summary error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil summary billing penjahit.",
      },
      { status: 500 },
    );
  }
}