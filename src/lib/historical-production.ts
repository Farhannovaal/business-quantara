import { prisma } from "@/lib/prisma";
import { calculateSPKStatus } from "@/lib/spk-status";

const JAKARTA_OFFSET = "+07:00";

export type DateRange = { startDate: string; endDate: string };

/** Convert date-picker YYYY-MM-DD values to Jakarta-local boundaries. */
export function parseDateRange(range: DateRange) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(range.startDate) || !datePattern.test(range.endDate)) {
    throw new Error("Format tanggal harus YYYY-MM-DD.");
  }

  const start = new Date(`${range.startDate}T00:00:00${JAKARTA_OFFSET}`);
  const endExclusive = new Date(`${range.endDate}T00:00:00${JAKARTA_OFFSET}`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
    throw new Error("Tanggal tidak valid.");
  }
  if (start >= endExclusive) throw new Error("Tanggal awal harus sebelum tanggal akhir.");

  return { start, endExclusive };
}

function emptyTotals() {
  return {
    totalPengiriman: 0,
    totalPenerimaan: 0,
    totalQcRijek: 0,
    totalQcAcc: 0,
    totalPengirimanRijek: 0,
    totalPenerimaanRijek: 0,
    sisaJahit: 0,
    barangDiQc: 0,
    jumlahRijek: 0,
    jumlahBarang: 0,
  };
}

/**
 * Historical view has two separate concepts:
 * - activity: transactions created inside the selected interval
 * - position: all transactions up to the end of the selected interval
 *
 * SPK status is deliberately returned as currentStatus only. The current schema
 * does not store status-change history, so historical CANCELLED status cannot
 * be reconstructed reliably from the current status field.
 */
export async function getHistoricalProduction(range: DateRange) {
  const { start, endExclusive } = parseDateRange(range);
  const endInclusive = new Date(endExclusive.getTime() - 1);

  const [spks, periodTransactions] = await Promise.all([
    prisma.sPK.findMany({
      where: { createdAt: { lt: endExclusive } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        spkNumber: true,
        status: true,
        createdAt: true,
        tailor: { select: { id: true, name: true } },
        items: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            productId: true,
            quantity: true,
            product: { select: { id: true, code: true, name: true } },
          },
        },
        transactions: {
          where: { createdAt: { lt: endExclusive } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            transactionNumber: true,
            spkId: true,
            productId: true,
            quantity: true,
            createdAt: true,
            transactionType: { select: { code: true, name: true } },
          },
        },
      },
    }),
    prisma.transaction.findMany({
      where: { createdAt: { gte: start, lt: endExclusive } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        transactionNumber: true,
        spkId: true,
        productId: true,
        quantity: true,
        createdAt: true,
        spk: { select: { spkNumber: true } },
        product: { select: { code: true, name: true } },
        tailor: { select: { name: true } },
        employee: { select: { name: true } },
        transactionType: { select: { code: true, name: true } },
      },
    }),
  ]);

  const positionBySpk = spks.map((spk) => {
    const items = spk.items.map((item) => {
      const itemTransactions = spk.transactions.filter((tx) => tx.productId === item.productId);
      const status = calculateSPKStatus(
        itemTransactions.map((tx) => ({
          quantity: tx.quantity,
          transactionType: { code: tx.transactionType.code },
        })),
        item.quantity,
      );
      const completedQuantity = Math.min(status.totalQcAcc, item.quantity);
      const progressPercent = item.quantity > 0
        ? Math.min(100, (completedQuantity / item.quantity) * 100)
        : 0;

      return {
        id: item.id,
        productId: item.productId,
        product: item.product,
        targetQuantity: item.quantity,
        completedQuantity,
        progressPercent,
        summary: status,
        // Progress is defined as quantity accepted by QC divided by target quantity.
        // Do not use the current administrative status to exclude historical production.
        currentStatus: spk.status,
      };
    });

    const totals = items.reduce((acc, item) => {
      for (const key of Object.keys(acc) as Array<keyof typeof acc>) {
        acc[key] += Number(item.summary[key] ?? 0);
      }
      return acc;
    }, emptyTotals());

    const targetQuantity = items.reduce((sum, item) => sum + item.targetQuantity, 0);
    const completedQuantity = items.reduce((sum, item) => sum + item.completedQuantity, 0);
    const progressPercent = targetQuantity > 0
      ? Math.min(100, (completedQuantity / targetQuantity) * 100)
      : 0;

    return {
      id: spk.id,
      spkNumber: spk.spkNumber,
      createdAt: spk.createdAt,
      tailor: spk.tailor,
      currentStatus: spk.status,
      historicalCancellationStatus: "UNKNOWN_WITHOUT_STATUS_HISTORY" as const,
      items,
      summary: totals,
      targetQuantity,
      completedQuantity,
      progressPercent,
    };
  });

  const positionTotals = positionBySpk.reduce((acc, spk) => {
    for (const key of Object.keys(acc) as Array<keyof typeof acc>) {
      acc[key] += Number(spk.summary[key] ?? 0);
    }
    return acc;
  }, emptyTotals());

  const overallTargetQuantity = positionBySpk.reduce((sum, spk) => sum + spk.targetQuantity, 0);
  const overallCompletedQuantity = positionBySpk.reduce((sum, spk) => sum + spk.completedQuantity, 0);
  const overallProgressPercent = overallTargetQuantity > 0
    ? Math.min(100, (overallCompletedQuantity / overallTargetQuantity) * 100)
    : 0;

  const activityTotals = periodTransactions.reduce((acc, tx) => {
    acc.transactionCount += 1;
    acc.quantity += tx.quantity;
    acc.byType[tx.transactionType.code] = (acc.byType[tx.transactionType.code] ?? 0) + tx.quantity;
    return acc;
  }, {
    transactionCount: 0,
    quantity: 0,
    byType: {} as Record<string, number>,
  });

  return {
    period: {
      startDate: range.startDate,
      endDate: range.endDate,
      startAt: start,
      endAt: endInclusive,
      timezone: "Asia/Jakarta",
    },
    activity: {
      ...activityTotals,
      transactions: periodTransactions,
    },
    position: {
      spkCount: positionBySpk.length,
      totals: positionTotals,
      targetQuantity: overallTargetQuantity,
      completedQuantity: overallCompletedQuantity,
      progressPercent: overallProgressPercent,
      spks: positionBySpk,
    },
    notes: [
      "Aktivitas hanya menghitung transaksi yang dibuat dalam periode terpilih.",
      "Posisi akhir menghitung seluruh transaksi sampai akhir periode, termasuk transaksi sebelum tanggal awal.",
      "Status CANCELLED historis tidak dapat dipastikan karena schema belum menyimpan riwayat perubahan status SPK.",
    ],
  };
}
