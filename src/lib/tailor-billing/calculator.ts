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
  billableAmount: number;
};

export async function calculateTailorBilling(
  spkId: number,
): Promise<TailorBillingSummary[]> {
  const spk = await prisma.sPK.findUnique({
    where: {
      id: spkId,
    },

    include: {
      tailor: true,

      items: {
        include: {
          product: true,
        },
      },

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
  });

  if (!spk) {
    throw new Error("SPK tidak ditemukan.");
  }

  const now = new Date();

  const results: TailorBillingSummary[] = [];

  for (const spkItem of spk.items) {
    /**
     * Hanya gunakan transaksi milik product ini.
     */
    const productTransactions =
      spk.transactions.filter(
        (transaction) =>
          transaction.productId ===
          spkItem.productId,
      );

    const status = calculateSPKStatus(
      productTransactions.map(
        (transaction) => ({
          quantity: transaction.quantity,

          transactionType: {
            code:
              transaction.transactionType.code,
          },
        }),
      ),
    );

    /**
     * ============================================================
     * TOTAL SUDAH DITAGIHKAN
     * ============================================================
     *
     * Hanya bill item untuk product ini
     * yang dihitung.
     */
    const totalAlreadyBilled =
      spk.tailorBillItems.reduce(
        (total, item) => {
          if (
            item.productId !==
            spkItem.productId
          ) {
            return total;
          }

          return (
            total + Number(item.quantity)
          );
        },
        0,
      );

    /**
     * ============================================================
     * JUMLAH YANG MASIH BOLEH DITAGIHKAN
     * ============================================================
     *
     * Yang dibayar adalah QC ACC.
     */
    const billableQuantity = Math.max(
      status.totalQcAcc -
        totalAlreadyBilled,
      0,
    );

    /**
     * ============================================================
     * CARI TARIF YANG BERLAKU
     * ============================================================
     *
     * Tarif berdasarkan:
     * Tailor × Product
     */
    const tailorRate =
      await prisma.tailorRate.findFirst({
        where: {
          tailorId: spk.tailorId,
          productId: spkItem.productId,
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

    if (
      !tailorRate &&
      billableQuantity > 0
    ) {
      throw new Error(
        `Tarif penjahit belum tersedia untuk ${spk.tailor.name} - ${spkItem.product.name}.`,
      );
    }

    const rate = tailorRate
      ? Number(tailorRate.rate)
      : 0;

    const billableAmount =
      billableQuantity * rate;

    results.push({
      spkId: spk.id,
      spkNumber: spk.spkNumber,

      tailorId: spk.tailorId,
      tailorName: spk.tailor.name,

      productId: spkItem.productId,
      productCode: spkItem.product.code,
      productName: spkItem.product.name,

      totalPengiriman:
        status.totalPengiriman,

      totalPenerimaan:
        status.totalPenerimaan,

      totalQcRijek:
        status.totalQcRijek,

      totalQcAcc:
        status.totalQcAcc,

      totalPengirimanRijek:
        status.totalPengirimanRijek,

      totalPenerimaanRijek:
        status.totalPenerimaanRijek,

      sisaJahit:
        status.sisaJahit,

      barangDiQc:
        status.barangDiQc,

      jumlahRijek:
        status.jumlahRijek,

      jumlahBarang:
        status.jumlahBarang,

      totalAlreadyBilled,
      billableQuantity,

      rate,
      billableAmount,
    });
  }

  return results;
}