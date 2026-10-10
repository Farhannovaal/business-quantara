import { prisma } from "@/lib/prisma";
import { calculateSPKStatus } from "@/lib/spk-status";

export type QCStatus =
  | "WAITING"
  | "IN_PROGRESS"
  | "COMPLETED";

export type QCMonitoringItem = {
  spkId: number;
  spkNumber: string;

  productId: number;

  product: {
    id: number;
    code: string;
    name: string;
  };

  tailor: {
    id: number;
    name: string;
  };

  totalDiterima: number;
  totalSudahQC: number;
  totalAcc: number;
  totalRijek: number;
  sisaQC: number;

  progressPercentage: number;

  status: QCStatus;

  lastQC: {
    transactionNumber: string;
    quantity: number;
    employee: string;
    createdAt: Date;
  } | null;
};

export async function calculateQCMonitoring(
  spkId: number,
): Promise<QCMonitoringItem[]> {
  const spk = await prisma.sPK.findUnique({
    where: {
      id: spkId,
    },

    include: {
      tailor: {
        select: {
          id: true,
          name: true,
        },
      },

      items: {
        include: {
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
        orderBy: {
          createdAt: "asc",
        },

        include: {
          transactionType: {
            select: {
              code: true,
              name: true,
            },
          },

          employee: {
            select: {
              id: true,
              name: true,
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
  });

  if (!spk) {
    throw new Error("SPK tidak ditemukan.");
  }

  return spk.items.map((spkItem) => {
    const productTransactions = spk.transactions.filter(
        (transaction) =>
          transaction.productId === spkItem.productId &&
          transaction.status === "ACTIVE",
      );

   const summary = calculateSPKStatus(
      productTransactions,
      spkItem.quantity,
    );

    const totalDiterima =
      summary.totalPenerimaan;

    const totalAcc =
      summary.totalQcAcc;

    const totalRijek =
      summary.totalQcRijek;

    /**
     * Barang yang sudah memiliki keputusan QC.
     *
     * ACC + RIJEK = barang yang sudah diputuskan.
     */
    const totalSudahQC =
      totalAcc + totalRijek;

    const sisaQC = Math.max(
      totalDiterima - totalSudahQC,
      0,
    );

    const progressPercentage =
      totalDiterima > 0
        ? Math.min(
            Math.round(
              (totalSudahQC /
                totalDiterima) *
                100,
            ),
            100,
          )
        : 0;

    let status: QCStatus;

    if (totalDiterima === 0) {
      status = "WAITING";
    } else if (sisaQC === 0) {
      status = "COMPLETED";
    } else if (totalSudahQC > 0) {
      status = "IN_PROGRESS";
    } else {
      status = "WAITING";
    }

      const qcTransactions = productTransactions.filter(
      (transaction) =>
        transaction.transactionType.code === "QUALITY_CONTROL" ||
        transaction.transactionType.code === "QC_RIJEK" ||
        transaction.transactionType.code === "QC_ACC_DIKIRIM_KE_GUDANG",
    );

    const lastQCTransaction =
      qcTransactions.length > 0
        ? qcTransactions[qcTransactions.length - 1]
        : null;

    return {
      spkId: spk.id,

      spkNumber: spk.spkNumber,

      productId: spkItem.productId,

      product: spkItem.product,

      tailor: spk.tailor,

      totalDiterima,

      totalSudahQC,

      totalAcc,

      totalRijek,

      sisaQC,

      progressPercentage,

      status,

      lastQC: lastQCTransaction
        ? {
            transactionNumber:
              lastQCTransaction.transactionNumber,

            quantity:
              lastQCTransaction.quantity,

            employee:
              lastQCTransaction.employee.name,

            createdAt:
              lastQCTransaction.createdAt,
          }
        : null,
    };
  });
}