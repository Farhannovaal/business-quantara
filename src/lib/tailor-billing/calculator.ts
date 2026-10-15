import { prisma } from "@/lib/prisma";
import { calculateSPKStatus } from "@/lib/spk-status";

export type TailorBillingSummary = {
  spkId: number;
  spkNumber: string;
  tailorId: number;
  tailorName: string;
  productId: number;
  productCode: string;
  productName: string;
  totalPengiriman: number;
  totalPenerimaan: number;
  totalQcRijek: number;
  totalQcAcc: number;
  totalPengirimanRijek: number;
  totalPenerimaanRijek: number;
  sisaJahit: number;
  barangDiQc: number;
  jumlahRijek: number;
  jumlahBarang: number;
  totalAlreadyBilled: number;
  billableQuantity: number;
  rate: number;
  rateAvailable: boolean;
  billableAmount: number;
};

export async function calculateTailorBilling(
  spkId: number,
): Promise<TailorBillingSummary[]> {
  const spk = await prisma.sPK.findUnique({
    where: { id: spkId },
    include: {
      tailor: true,
      items: {
        include: { product: true },
        orderBy: { id: "asc" },
      },
      transactions: {
        where: { status: "ACTIVE" },
        include: { transactionType: true },
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      },
      tailorBillItems: {
        where: {
          bill: {
            status: { not: "CANCELLED" },
          },
        },
      },
    },
  });

  if (!spk) {
    throw new Error("SPK tidak ditemukan.");
  }

  const now = new Date();

  const results: TailorBillingSummary[] = [];

  for (const spkItem of spk.items) {
    const productTransactions = spk.transactions.filter(
      (transaction) =>
        transaction.productId === spkItem.productId,
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
      .filter((item) => item.productId === spkItem.productId)
      .reduce(
        (total, item) => total + Number(item.quantity),
        0,
      );

    const billableQuantity = Math.max(
      Number(status.totalQcAcc) - totalAlreadyBilled,
      0,
    );

    const tailorRate = await prisma.tailorRate.findFirst({
      where: {
        tailorId: spk.tailorId,
        productId: spkItem.productId,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } },
        ],
      },
      orderBy: { effectiveFrom: "desc" },
    });

    const rateAvailable = tailorRate !== null;
    const rate = tailorRate ? Number(tailorRate.rate) : 0;

    results.push({
      spkId: spk.id,
      spkNumber: spk.spkNumber,
      tailorId: spk.tailorId,
      tailorName: spk.tailor.name,
      productId: spkItem.productId,
      productCode: spkItem.product.code,
      productName: spkItem.product.name,
      totalPengiriman: Number(status.totalPengiriman),
      totalPenerimaan: Number(status.totalPenerimaan),
      totalQcRijek: Number(status.totalQcRijek),
      totalQcAcc: Number(status.totalQcAcc),
      totalPengirimanRijek: Number(status.totalPengirimanRijek),
      totalPenerimaanRijek: Number(status.totalPenerimaanRijek),
      sisaJahit: Number(status.sisaJahit),
      barangDiQc: Number(status.barangDiQc),
      jumlahRijek: Number(status.jumlahRijek),
      jumlahBarang: Number(status.jumlahBarang),
      totalAlreadyBilled,
      billableQuantity,
      rate,
      rateAvailable,
      billableAmount: rateAvailable ? billableQuantity * rate : 0,
    });
  }

  return results;
}