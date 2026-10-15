import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";
import {
  calculateTailorBilling,
  type TailorBillingSummary,
} from "@/lib/tailor-billing/calculator";
import { createTailorBill } from "@/lib/tailor-billing/service";

export async function POST() {
  const auth = await requireAuth();

  if (auth.response) return auth.response;

  const user = auth.user;

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (!hasPermission(user, "tailor-billing.create")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  try {
    const spks = await prisma.sPK.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    const eligible: TailorBillingSummary[] = [];
    const skipped: Array<{
      spkId: number;
      reason: string;
    }> = [];

    for (const spk of spks) {
      try {
        const items = await calculateTailorBilling(spk.id);

        for (const item of items) {
          if (item.billableQuantity <= 0) continue;

          if (!item.rateAvailable) {
            skipped.push({
              spkId: item.spkId,
              reason: `Tarif belum tersedia untuk ${item.tailorName} - ${item.productName}.`,
            });
            continue;
          }

          eligible.push(item);
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

    const grouped = new Map<number, TailorBillingSummary[]>();

    for (const item of eligible) {
      const items = grouped.get(item.tailorId) ?? [];
      items.push(item);
      grouped.set(item.tailorId, items);
    }

    const bills: Array<{
      id: number;
      billNumber: string;
      tailorId: number;
      tailorName: string;
      itemCount: number;
      totalQuantity: number;
      totalAmount: number;
    }> = [];

    for (const [tailorId, items] of grouped) {
      try {
        const bill = await createTailorBill(
          {
            tailorId,
            items: items.map((item) => ({
              spkId: item.spkId,
              productId: item.productId,
              quantity: item.billableQuantity,
            })),
            notes: "Generated automatically from Dashboard.",
          },
          user.id,
        );

        bills.push({
          id: bill.id,
          billNumber: bill.billNumber,
          tailorId,
          tailorName: bill.tailor.name,
          itemCount: bill.items.length,
          totalQuantity: bill.items.reduce(
            (total, item) => total + Number(item.quantity),
            0,
          ),
          totalAmount: Number(bill.totalAmount),
        });
      } catch (error) {
        skipped.push({
          spkId: items[0]?.spkId ?? 0,
          reason:
            error instanceof Error
              ? `Penjahit ${items[0]?.tailorName ?? tailorId}: ${error.message}`
              : `Gagal membuat billing untuk penjahit ${tailorId}.`,
        });
      }
    }

    const totalQuantity = bills.reduce(
      (total, bill) => total + bill.totalQuantity,
      0,
    );

    const totalAmount = bills.reduce(
      (total, bill) => total + bill.totalAmount,
      0,
    );

    return NextResponse.json({
      success: true,
      message:
        bills.length > 0
          ? `${bills.length} billing berhasil dibuat sebagai Draft.`
          : "Tidak ada billing yang berhasil dibuat.",
      data: {
        createdBills: bills.length,
        createdItems: bills.reduce(
          (total, bill) => total + bill.itemCount,
          0,
        ),
        totalQuantity,
        totalAmount,
        bills,
        skipped,
      },
    });
  } catch (error) {
    console.error("Generate all tailor billing error:", error);

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