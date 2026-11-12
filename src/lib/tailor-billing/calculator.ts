
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

/**
 * Mengambil referensi awal tanggal berdasarkan kalender Jakarta.
 *
 * Format tanggal disamakan dengan createTailorBill()
 * agar pencarian tarif konsisten.
 */
function getJakartaDateReference(): Date {
  const jakartaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return new Date(`${jakartaDate}T00:00:00.000Z`);
}

export async function calculateTailorBilling(
  spkId: number,
  companyId: number
): Promise<TailorBillingSummary[]> {
  // Validasi parameter.
  if (!Number.isSafeInteger(spkId) || spkId <= 0) {
    return [];
  }

  if (!Number.isSafeInteger(companyId) || companyId <= 0) {
    return [];
  }

  /**
   * STEP 1
   * Ambil SPK berdasarkan tenant aktif.
   *
   * SPK yang dibatalkan atau sudah dihapus
   * tidak boleh masuk perhitungan billing.
   */
  const spk = await prisma.sPK.findFirst({
    where: {
      id: spkId,
      companyId,
      deletedAt: null,
      status: {
        not: "CANCELLED",
      },
    },
    include: {
      tailor: true,
      items: {
        include: {
          product: true,
        },
        orderBy: {
          id: "asc",
        },
      },
      transactions: {
        where: {
          companyId,
          status: "ACTIVE",
        },
        include: {
          transactionType: true,
        },
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      },
      tailorBillItems: {
        where: {
          bill: {
            companyId,
            status: {
              not: "CANCELLED",
            },
          },
        },
      },
    },
  });

  // SPK tidak ditemukan, bukan milik tenant,
  // sudah dihapus, atau dibatalkan.
  if (!spk) {
    return [];
  }

  const rateReferenceDate = getJakartaDateReference();

  const results: TailorBillingSummary[] = [];

  /**
   * STEP 2
   * Proses setiap produk dalam SPK.
   */
  for (const spkItem of spk.items) {
    /**
     * STEP 3
     * Ambil transaksi aktif berdasarkan produk.
     */
    const productTransactions = spk.transactions.filter(
      (transaction) =>
        transaction.productId === spkItem.productId
    );

    /**
     * STEP 4
     * Hitung status SPK.
     *
     * Perhitungan tetap menggunakan calculateSPKStatus
     * agar konsisten dengan workflow transaksi SPK.
     */
    const status = calculateSPKStatus(
      productTransactions.map((transaction) => ({
        quantity: transaction.quantity,
        transactionType: {
          code: transaction.transactionType.code,
        },
      }))
    );

    /**
     * STEP 5
     * Hitung total quantity yang sudah ditagihkan.
     *
     * Bill CANCELLED tidak ikut dihitung.
     */
    const totalAlreadyBilled = spk.tailorBillItems
      .filter(
        (item) => item.productId === spkItem.productId
      )
      .reduce(
        (total, item) => total + Number(item.quantity),
        0
      );

    /**
     * STEP 6
     * Hitung quantity yang masih dapat ditagihkan.
     *
     * Dasar perhitungan:
     * Total QC ACC - Total Already Billed.
     */
    const billableQuantity = Math.max(
      Number(status.totalQcAcc) - totalAlreadyBilled,
      0
    );

    /**
     * STEP 7
     * Cari Master Tarif Tailor.
     *
     * Semua pencarian dibatasi berdasarkan:
     * - companyId
     * - tailorId
     * - productId
     * - isActive
     * - effectiveFrom
     * - effectiveTo
     */
    const tailorRate = await prisma.tailorRate.findFirst({
      where: {
        companyId,
        tailorId: spk.tailorId,
        productId: spkItem.productId,
        isActive: true,
        effectiveFrom: {
          lte: rateReferenceDate,
        },
        OR: [
          {
            effectiveTo: null,
          },
          {
            effectiveTo: {
              gte: rateReferenceDate,
            },
          },
        ],
      },
      orderBy: {
        effectiveFrom: "desc",
      },
    });

    /**
     * STEP 8
     * Tentukan ketersediaan tarif.
     */
    const rateAvailable =
      tailorRate !== null &&
      Number.isFinite(Number(tailorRate.rate)) &&
      Number(tailorRate.rate) > 0;

    const rate = rateAvailable
      ? Number(tailorRate.rate)
      : 0;

    /**
     * STEP 9
     * Hitung nominal yang dapat ditagihkan.
     */
    const billableAmount = rateAvailable
      ? billableQuantity * rate
      : 0;

    /**
     * STEP 10
     * Masukkan hasil perhitungan ke response.
     *
     * Struktur output dipertahankan agar kompatibel
     * dengan frontend Tailor Billing.
     */
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

      totalPengirimanRijek: Number(
        status.totalPengirimanRijek
      ),

      totalPenerimaanRijek: Number(
        status.totalPenerimaanRijek
      ),

      sisaJahit: Number(status.sisaJahit),
      barangDiQc: Number(status.barangDiQc),
      jumlahRijek: Number(status.jumlahRijek),
      jumlahBarang: Number(status.jumlahBarang),

      totalAlreadyBilled,
      billableQuantity,

      rate,
      rateAvailable,
      billableAmount,
    });
  }

  return results;
}
