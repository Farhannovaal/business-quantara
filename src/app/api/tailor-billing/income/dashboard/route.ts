
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;

  const date = new Date(`${value}T00:00:00.000`);

  return Number.isNaN(date.getTime()) ? fallback : date;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endExclusive(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  );
}

export async function GET(request: NextRequest) {
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
    const params = request.nextUrl.searchParams;
    const now = new Date();

    const startDate = parseDate(
      params.get("startDate"),
      startOfMonth(now),
    );

    const requestedEndDate = parseDate(
      params.get("endDate"),
      now,
    );

    const endDate =
      requestedEndDate < startDate
        ? startDate
        : requestedEndDate;

    const tailorIdParam = params.get("tailorId");

    const tailorId =
      tailorIdParam && /^\d+$/.test(tailorIdParam)
        ? Number(tailorIdParam)
        : undefined;

    if (
      tailorIdParam &&
      (!tailorId || !Number.isSafeInteger(tailorId))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "ID penjahit tidak valid.",
        },
        { status: 400 },
      );
    }

    const bills = await prisma.tailorBill.findMany({
      where: {
        status: "PAID",

        paidAt: {
          gte: startDate,
          lt: endExclusive(endDate),
        },

        ...(tailorId ? { tailorId } : {}),

        // Hanya ambil tagihan yang masih memiliki
        // minimal satu item dari SPK yang belum dihapus.
        items: {
          some: {
            spk: {
              deletedAt: null,
            },
          },
        },
      },

      select: {
        id: true,
        billNumber: true,
        tailorId: true,
        paidAt: true,
        totalAmount: true,

        tailor: {
          select: {
            id: true,
            name: true,
          },
        },

        items: {
          // Jangan masukkan item dari SPK yang dihapus
          // ke perhitungan pendapatan operasional.
          where: {
            spk: {
              deletedAt: null,
            },
          },

          select: {
            id: true,
            spkId: true,
            quantity: true,
            rate: true,
            amount: true,

            spk: {
              select: {
                id: true,
                spkNumber: true,
              },
            },

            product: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },

      orderBy: [
        { paidAt: "desc" },
        { id: "desc" },
      ],
    });

    const tailorMap = new Map<
      number,
      {
        tailorId: number;
        tailorName: string;
        totalIncome: number;
        totalPaidBills: number;
        totalQuantity: number;
        spkIds: Set<number>;
      }
    >();

    const monthlyMap = new Map<string, number>();

    const details: {
      id: number;
      billId: number;
      billNumber: string;
      paidAt: string | null;
      tailorId: number;
      tailorName: string;
      spkId: number;
      spkNumber: string;
      productId: number;
      productCode: string;
      productName: string;
      quantity: number;
      rate: number;
      amount: number;
    }[] = [];

    let totalIncome = 0;
    let totalQuantity = 0;

    for (const bill of bills) {
      const paidAt = bill.paidAt;

      const tailor = tailorMap.get(bill.tailorId) ?? {
        tailorId: bill.tailorId,
        tailorName: bill.tailor.name,
        totalIncome: 0,
        totalPaidBills: 0,
        totalQuantity: 0,
        spkIds: new Set<number>(),
      };

      // Hitung pendapatan hanya berdasarkan item SPK aktif.
      let activeBillAmount = 0;
      let activeBillHasItems = false;

      for (const item of bill.items) {
        const quantity = Number(item.quantity);
        const rate = Number(item.rate);
        const amount = Number(item.amount);

        activeBillAmount += amount;
        activeBillHasItems = true;

        totalQuantity += quantity;
        tailor.totalQuantity += quantity;
        tailor.spkIds.add(item.spkId);

        details.push({
          id: item.id,
          billId: bill.id,
          billNumber: bill.billNumber,
          paidAt: paidAt?.toISOString() ?? null,
          tailorId: bill.tailorId,
          tailorName: bill.tailor.name,
          spkId: item.spk.id,
          spkNumber: item.spk.spkNumber,
          productId: item.product.id,
          productCode: item.product.code,
          productName: item.product.name,
          quantity,
          rate,
          amount,
        });
      }

      // Abaikan tagihan tanpa item SPK aktif.
      if (!activeBillHasItems) {
        continue;
      }

      totalIncome += activeBillAmount;
      tailor.totalIncome += activeBillAmount;
      tailor.totalPaidBills += 1;

      if (paidAt) {
        const monthKey = [
          paidAt.getFullYear(),
          String(paidAt.getMonth() + 1).padStart(2, "0"),
        ].join("-");

        monthlyMap.set(
          monthKey,
          (monthlyMap.get(monthKey) ?? 0) + activeBillAmount,
        );
      }

      tailorMap.set(bill.tailorId, tailor);
    }

    const tailors = [...tailorMap.values()]
      .map(({ spkIds, ...tailor }) => ({
        ...tailor,
        totalSpk: spkIds.size,
      }))
      .sort((a, b) => b.totalIncome - a.totalIncome);

    const monthly = [...monthlyMap.entries()]
      .sort(([monthA], [monthB]) =>
        monthA.localeCompare(monthB),
      )
      .map(([month, amount]) => ({
        month,
        amount,
      }));

    return NextResponse.json({
      success: true,

      filters: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        tailorId: tailorId ?? null,
        status: "PAID",
      },

      summary: {
        totalIncome,
        totalPaidBills: tailors.reduce(
          (total, tailor) => total + tailor.totalPaidBills,
          0,
        ),
        totalTailors: tailors.length,
        totalQuantity,
        totalSpk: new Set(
          details.map((item) => item.spkId),
        ).size,
      },

      monthly,
      tailors,
      details,
    });
  } catch (error) {
    console.error(
      "Get tailor billing income dashboard error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil data pendapatan penjahit.",
      },
      { status: 500 },
    );
  }
}
