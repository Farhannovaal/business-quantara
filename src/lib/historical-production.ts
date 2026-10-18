
import { prisma } from "@/lib/prisma";
import { calculateSPKStatus } from "@/lib/spk-status";

const JAKARTA_OFFSET = "+07:00";
const TIMEZONE = "Asia/Jakarta";

export type DateRange = {
  startDate: string;
  endDate: string;
};

type ProductionSummary = {
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
};

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/**
 * Membuat batas tanggal berdasarkan waktu lokal Jakarta.
 *
 * endExclusive adalah awal hari setelah endDate.
 * Dengan demikian, seluruh transaksi pada endDate tercakup.
 */
export function parseDateRange(range: DateRange) {
  if (
    !isValidCalendarDate(range.startDate) ||
    !isValidCalendarDate(range.endDate)
  ) {
    throw new Error(
      "Format tanggal tidak valid. Gunakan YYYY-MM-DD."
    );
  }

  // Format YYYY-MM-DD dapat dibandingkan secara leksikografis.
  // Tanggal dengan format tersebut tersusun dari tahun, bulan, hari.
  if (range.startDate > range.endDate) {
    throw new Error(
      "Tanggal awal tidak boleh melebihi tanggal akhir."
    );
  }

  const start = new Date(
    `${range.startDate}T00:00:00${JAKARTA_OFFSET}`
  );

  const endExclusive = new Date(
    `${range.endDate}T00:00:00${JAKARTA_OFFSET}`
  );

  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  return {
    start,
    endExclusive,
  };
}

function emptyTotals(): ProductionSummary {
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

function addSummary(
  target: ProductionSummary,
  source: ProductionSummary
): ProductionSummary {
  target.totalPengiriman += source.totalPengiriman;
  target.totalPenerimaan += source.totalPenerimaan;
  target.totalQcRijek += source.totalQcRijek;
  target.totalQcAcc += source.totalQcAcc;
  target.totalPengirimanRijek +=
    source.totalPengirimanRijek;
  target.totalPenerimaanRijek +=
    source.totalPenerimaanRijek;
  target.sisaJahit += source.sisaJahit;
  target.barangDiQc += source.barangDiQc;
  target.jumlahRijek += source.jumlahRijek;
  target.jumlahBarang += source.jumlahBarang;

  return target;
}

function toProductionSummary(
  value: Record<string, unknown>
): ProductionSummary {
  const numberValue = (key: keyof ProductionSummary) => {
    const raw = value[key];

    return typeof raw === "number" && Number.isFinite(raw)
      ? raw
      : 0;
  };

  return {
    totalPengiriman: numberValue("totalPengiriman"),
    totalPenerimaan: numberValue("totalPenerimaan"),
    totalQcRijek: numberValue("totalQcRijek"),
    totalQcAcc: numberValue("totalQcAcc"),
    totalPengirimanRijek: numberValue(
      "totalPengirimanRijek"
    ),
    totalPenerimaanRijek: numberValue(
      "totalPenerimaanRijek"
    ),
    sisaJahit: numberValue("sisaJahit"),
    barangDiQc: numberValue("barangDiQc"),
    jumlahRijek: numberValue("jumlahRijek"),
    jumlahBarang: numberValue("jumlahBarang"),
  };
}

function calculateProgress(
  completedQuantity: number,
  targetQuantity: number
): number {
  if (targetQuantity <= 0) {
    return 0;
  }

  return Math.min(
    (completedQuantity / targetQuantity) * 100,
    100
  );
}

export async function getHistoricalProduction(
  range: DateRange
) {
  const { start, endExclusive } = parseDateRange(range);

  const [
    spks,
    periodTransactions,
  ] = await Promise.all([
    prisma.sPK.findMany({
      where: {
        // SPK yang di-soft-delete tidak masuk laporan.
        deletedAt: null,
        createdAt: {
          lt: endExclusive,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        spkNumber: true,
        status: true,
        createdAt: true,
        tailor: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          orderBy: {
            id: "asc",
          },
          select: {
            id: true,
            productId: true,
            quantity: true,
            product: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        transactions: {
          where: {
            createdAt: {
              lt: endExclusive,
            },
          },
          orderBy: [
            {
              createdAt: "asc",
            },
            {
              id: "asc",
            },
          ],
          select: {
            id: true,
            transactionNumber: true,
            spkId: true,
            productId: true,
            quantity: true,
            status: true,
            createdAt: true,
            transactionType: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    }),

    prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: start,
          lt: endExclusive,
        },

        // Filter relasi SPK dilakukan di WHERE,
        // bukan di dalam SELECT.
        spk: {
          is: {
            deletedAt: null,
          },
        },
      },
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: {
        id: true,
        transactionNumber: true,
        spkId: true,
        productId: true,
        quantity: true,
        status: true,
        createdAt: true,
        spk: {
          select: {
            spkNumber: true,
          },
        },
        product: {
          select: {
            code: true,
            name: true,
          },
        },
        tailor: {
          select: {
            name: true,
          },
        },
        employee: {
          select: {
            name: true,
          },
        },
        transactionType: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    }),
  ]);

  /*
   * Hitung aktivitas dalam periode laporan.
   * Transaksi dari SPK yang sudah di-soft-delete
   * sudah dikecualikan oleh query Prisma di atas.
   */
  const activityByType: Record<string, number> = {};

  let activityQuantity = 0;

  for (const transaction of periodTransactions) {
    const typeCode =
      transaction.transactionType.code || "UNKNOWN";

    activityByType[typeCode] =
      (activityByType[typeCode] ?? 0) + 1;

    activityQuantity += transaction.quantity;
  }

  /*
   * Hitung posisi produksi sampai akhir tanggal laporan.
   * Hanya SPK yang tidak di-soft-delete yang diproses.
   */
  const positionTotals = emptyTotals();

  let targetQuantity = 0;
  let completedQuantity = 0;

  const historicalSPKs = spks.map((spk) => {
    const historicalItems = spk.items.map((item) => {
      const itemTransactions = spk.transactions.filter(
        (transaction) =>
          transaction.productId === item.productId
      );

      const calculated = calculateSPKStatus(
        itemTransactions,
        item.quantity
      );

      const summary = toProductionSummary(
        calculated as unknown as Record<string, unknown>
      );

      const itemTarget = item.quantity;
      const itemCompleted = summary.totalQcAcc;

      targetQuantity += itemTarget;
      completedQuantity += itemCompleted;

      addSummary(positionTotals, summary);

      return {
        id: item.id,
        productId: item.productId,
        product: item.product,
        targetQuantity: itemTarget,
        completedQuantity: itemCompleted,
        progressPercent: calculateProgress(
          itemCompleted,
          itemTarget
        ),
        summary: {
          ...summary,
          nextTransactionTypes:
            calculated.nextTransactionTypes ?? [],
        },
        currentStatus: spk.status,
      };
    });

    const spkSummary = historicalItems.reduce(
      (totals, item) =>
        addSummary(totals, item.summary),
      emptyTotals()
    );

    const spkTarget = historicalItems.reduce(
      (total, item) => total + item.targetQuantity,
      0
    );

    const spkCompleted = historicalItems.reduce(
      (total, item) => total + item.completedQuantity,
      0
    );

    return {
      id: spk.id,
      spkNumber: spk.spkNumber,
      createdAt: spk.createdAt,
      tailor: spk.tailor,
      currentStatus: spk.status,

      // Belum menyimpulkan status historis tanpa
      // tabel/audit perubahan status yang valid.
      historicalCancellationStatus:
        "UNKNOWN_WITHOUT_STATUS_HISTORY",

      items: historicalItems,
      summary: spkSummary,
      targetQuantity: spkTarget,
      completedQuantity: spkCompleted,
      progressPercent: calculateProgress(
        spkCompleted,
        spkTarget
      ),
    };
  });

  return {
    period: {
      startDate: range.startDate,
      endDate: range.endDate,
      timezone: TIMEZONE,
    },

    activity: {
      transactionCount: periodTransactions.length,
      quantity: activityQuantity,
      byType: activityByType,
      transactions: periodTransactions,
    },

    position: {
      spkCount: historicalSPKs.length,
      totals: positionTotals,
      targetQuantity,
      completedQuantity,
      progressPercent: calculateProgress(
        completedQuantity,
        targetQuantity
      ),
      spks: historicalSPKs,
    },

    notes: [
      "Aktivitas hanya menghitung transaksi dalam rentang tanggal yang dipilih.",
      "Posisi produksi dihitung dari transaksi sampai akhir tanggal laporan.",
      "SPK dengan deletedAt terisi tidak disertakan dalam aktivitas maupun posisi produksi.",
      "Data transaksi historis tetap tersimpan di database.",
    ],
  };
}
