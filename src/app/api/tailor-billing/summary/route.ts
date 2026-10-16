import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";
import { calculateTailorBilling } from "@/lib/tailor-billing/calculator";


export async function GET() {
  const auth = await requireAuth();

  if (auth.response) return auth.response;

  const user = auth.user;

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (!hasPermission(user, "tailor-billing.view")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  try {
    const spks = await prisma.sPK.findMany({
      where: {
        status: { not: "CANCELLED" },deletedAt: null,
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    const summaries = await Promise.all(
      spks.map((spk) => calculateTailorBilling(spk.id)),
    );

    const allItems = summaries.flat();

    const readyItems = allItems
      .filter(
        (item) =>
          item.billableQuantity > 0 && item.rateAvailable,
      )
      .map((item) => ({
        spkId: item.spkId,
        spkNumber: item.spkNumber,
        tailorId: item.tailorId,
        tailorName: item.tailorName,
        productId: item.productId,
        productName: item.productName,
        billableQuantity: item.billableQuantity,
        rate: item.rate,
        amount: item.billableAmount,
      }));

    const missingRateItems = allItems
      .filter(
        (item) =>
          item.billableQuantity > 0 && !item.rateAvailable,
      )
      .map((item) => ({
        spkId: item.spkId,
        spkNumber: item.spkNumber,
        tailorId: item.tailorId,
        tailorName: item.tailorName,
        productId: item.productId,
        productName: item.productName,
        billableQuantity: item.billableQuantity,
      }));

    const readySpkIds = new Set(
      readyItems.map((item) => item.spkId),
    );

    const readyTailorIds = new Set(
      readyItems.map((item) => item.tailorId),
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

    const unpaidBills = await prisma.tailorBill.findMany({
      where: {
        status: { in: ["DRAFT", "SUBMITTED"] },
      },
      select: {
        id: true,
        billNumber: true,
        status: true,
        totalAmount: true,
        tailor: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const unpaidAmount = unpaidBills.reduce(
      (total, bill) => total + Number(bill.totalAmount),
      0,
    );

    return NextResponse.json({
      success: true,
      data: {
        readySpkCount: readySpkIds.size,
        readyTailorCount: readyTailorIds.size,
        readyQuantity,
        readyAmount,
        missingRateSpkCount: missingRateSpkIds.size,
        missingRateQuantity,
        totalSpkChecked: spks.length,
        readyItems,
        missingRateItems,
        unpaidBillCount: unpaidBills.length,
        unpaidAmount,
        unpaidBills: unpaidBills.map((bill) => ({
          id: bill.id,
          billNumber: bill.billNumber,
          status: bill.status,
          totalAmount: Number(bill.totalAmount),
          tailorName: bill.tailor.name,
        })),
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