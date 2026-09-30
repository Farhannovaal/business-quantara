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
): Promise<TailorBillingSummary> {
  const spk = await prisma.sPK.findUnique({
    where: {
      id: spkId,
    },

    include: {
      product: true,
      tailor: true,

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

  const status = calculateSPKStatus(
    spk.transactions.map((transaction) => ({
      quantity: transaction.quantity,

      transactionType: {
        code: transaction.transactionType.code,
      },
    })),
  );

  // ============================================================
  // TOTAL SUDAH DITAGIHKAN
  // ============================================================

  const totalAlreadyBilled = spk.tailorBillItems.reduce(
    (total, item) => {
      return total + Number(item.quantity);
    },
    0,
  );

  // ============================================================
  // JUMLAH YANG MASIH BOLEH DITAGIHKAN
  // ============================================================

  const billableQuantity = Math.max(
    status.totalQcAcc - totalAlreadyBilled,
    0,
  );

  // ============================================================
  // CARI TARIF YANG BERLAKU
  // ============================================================

  const now = new Date();

  const tailorRate = await prisma.tailorRate.findFirst({
    where: {
      tailorId: spk.tailorId,
      productId: spk.productId,
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

  if (!tailorRate && billableQuantity > 0) {
    throw new Error(
      `Tarif penjahit belum tersedia untuk ${spk.tailor.name} - ${spk.product.name}.`,
    );
  }

  const rate = tailorRate
    ? Number(tailorRate.rate)
    : 0;

  const billableAmount =
    billableQuantity * rate;

  return {
    spkId: spk.id,
    spkNumber: spk.spkNumber,

    tailorId: spk.tailorId,
    tailorName: spk.tailor.name,

    productId: spk.productId,
    productCode: spk.product.code,
    productName: spk.product.name,

    totalPengiriman: status.totalPengiriman,
    totalPenerimaan: status.totalPenerimaan,

    totalQcRijek: status.totalQcRijek,
    totalQcAcc: status.totalQcAcc,

    totalPengirimanRijek:
      status.totalPengirimanRijek,

    totalPenerimaanRijek:
      status.totalPenerimaanRijek,

    sisaJahit: status.sisaJahit,
    barangDiQc: status.barangDiQc,
    jumlahRijek: status.jumlahRijek,
    jumlahBarang: status.jumlahBarang,

    totalAlreadyBilled,
    billableQuantity,

    rate,
    billableAmount,
  };
}