import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";
import { calculateTailorBilling } from "@/lib/tailor-billing/calculator";
import { createTailorBill } from "@/lib/tailor-billing/service";

export async function POST() {
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

  if (!hasPermission(user, "tailor-billing.create")) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      { status: 403 },
    );
  }

  try {
    const spks = await prisma.sPK.findMany({
      where: {
        status: {
          not: "CANCELLED",
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const eligible = [];

    const skipped: {
      spkId: number;
      reason: string;
    }[] = [];

    for (const spk of spks) {
      try {
        const summary = await calculateTailorBilling(spk.id);

        if (summary.billableQuantity > 0) {
          eligible.push(summary);
        }
      } catch (error) {
        skipped.push({
          spkId: spk.id,
          reason:
            error instanceof Error
              ? error.message
              : "Gagal menghitung billing.",
        });
      }
    }

    if (eligible.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Tidak ada SPK yang dapat dibuatkan billing.",
        data: {
          createdBills: 0,
          createdItems: 0,
          totalQuantity: 0,
          totalAmount: 0,
          bills: [],
          skipped,
        },
      });
    }

    const grouped = new Map<number, typeof eligible>();

    for (const item of eligible) {
      const current = grouped.get(item.tailorId) || [];

      current.push(item);
      grouped.set(item.tailorId, current);
    }

    const createdBills: {
      id: number;
      billNumber: string;
      tailorId: number;
      tailorName: string;
      itemCount: number;
      totalQuantity: number;
      totalAmount: number;
    }[] = [];

    for (const [tailorId, items] of grouped.entries()) {
      try {
        const bill = await createTailorBill(
          {
            tailorId,
            items: items.map((item) => ({
              spkId: item.spkId,
              quantity: item.billableQuantity,
            })),
            notes: "Generated automatically from Dashboard.",
          },
          user.id,
        );

        createdBills.push({
          id: bill.id,
          billNumber: bill.billNumber,
          tailorId,
          tailorName: items[0]?.tailorName || "-",
          itemCount: items.length,
          totalQuantity: items.reduce(
            (total, item) => total + item.billableQuantity,
            0,
          ),
          totalAmount: items.reduce(
            (total, item) => total + item.billableAmount,
            0,
          ),
        });
      } catch (error) {
        skipped.push({
          spkId: items[0]?.spkId || 0,
          reason:
            error instanceof Error
              ? `Penjahit ${
                  items[0]?.tailorName || tailorId
                }: ${error.message}`
              : `Gagal membuat billing untuk penjahit ${tailorId}.`,
        });
      }
    }

    const totalQuantity = createdBills.reduce(
      (total, bill) => total + bill.totalQuantity,
      0,
    );

    const totalAmount = createdBills.reduce(
      (total, bill) => total + bill.totalAmount,
      0,
    );

    return NextResponse.json({
      success: true,
      message:
        createdBills.length > 0
          ? `${createdBills.length} billing berhasil dibuat.`
          : "Tidak ada billing yang berhasil dibuat.",
      data: {
        createdBills: createdBills.length,
        createdItems: createdBills.reduce(
          (total, bill) => total + bill.itemCount,
          0,
        ),
        totalQuantity,
        totalAmount,
        bills: createdBills,
        skipped,
      },
    });
  } catch (error) {
    console.error(
      "Generate all tailor billing error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal generate seluruh billing.",
      },
      { status: 500 },
    );
  }
}