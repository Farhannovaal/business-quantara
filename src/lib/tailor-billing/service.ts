import { prisma } from "@/lib/prisma";
import { calculateSPKStatus } from "@/lib/spk-status";

type CreateTailorBillItemInput = {
  spkId: number;
  quantity: number;
};

type CreateTailorBillInput = {
  tailorId: number;
  items: CreateTailorBillItemInput[];
  notes?: string | null;
};

function generateBillNumber(sequence: number) {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `BILL-${year}${month}${day}-${String(sequence).padStart(6, "0")}`;
}

export async function createTailorBill(
  input: CreateTailorBillInput,
  userId: number,
) {
  if (!Number.isInteger(input.tailorId) || input.tailorId <= 0) {
    throw new Error("Penjahit tidak valid.");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("Minimal satu SPK harus dipilih.");
  }

  /*
   * Hilangkan duplicate SPK.
   *
   * Contoh:
   * [
   *   { spkId: 1, quantity: 10 },
   *   { spkId: 1, quantity: 20 }
   * ]
   *
   * menjadi satu item saja.
   */
  const uniqueItems = Array.from(
    new Map(
      input.items.map((item) => [item.spkId, item]),
    ).values(),
  );

  return prisma.$transaction(async (tx) => {
    /*
     * ============================================================
     * 1. VALIDASI PENJAHIT
     * ============================================================
     */

    const tailor = await tx.tailor.findUnique({
      where: {
        id: input.tailorId,
      },
    });

    if (!tailor) {
      throw new Error("Penjahit tidak ditemukan.");
    }

    if (!tailor.isActive) {
      throw new Error("Penjahit tidak aktif.");
    }

    /*
     * ============================================================
     * 2. SIAPKAN ITEM TAGIHAN
     * ============================================================
     */

    const preparedItems: Array<{
      spkId: number;
      productId: number;
      quantity: number;
      rate: number;
      amount: number;
    }> = [];

    /*
     * ============================================================
     * 3. VALIDASI SETIAP SPK
     * ============================================================
     */

    for (const item of uniqueItems) {
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(
          `Quantity SPK ${item.spkId} harus berupa angka bulat lebih dari 0.`,
        );
      }

      /*
       * Ambil SPK beserta transaksi produksinya.
       */
      const spk = await tx.sPK.findUnique({
        where: {
          id: item.spkId,
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
        },
      });

      if (!spk) {
        throw new Error(
          `SPK dengan ID ${item.spkId} tidak ditemukan.`,
        );
      }

      /*
       * SPK CANCELLED tidak boleh ditagihkan.
       */
      if (spk.status === "CANCELLED") {
        throw new Error(
          `SPK ${spk.spkNumber} sudah dibatalkan.`,
        );
      }

      /*
       * SPK harus milik penjahit yang dipilih.
       */
      if (spk.tailorId !== input.tailorId) {
        throw new Error(
          `SPK ${spk.spkNumber} bukan milik penjahit yang dipilih.`,
        );
      }

      /*
       * ==========================================================
       * 4. HITUNG STATUS PRODUKSI SPK
       * ==========================================================
       */

      const status = calculateSPKStatus(
        spk.transactions.map((transaction) => ({
          quantity: transaction.quantity,
          transactionType: {
            code: transaction.transactionType.code,
          },
        })),
      );

      /*
       * ==========================================================
       * 5. HITUNG QUANTITY YANG SUDAH DITAGIHKAN
       * ==========================================================
       *
       * CANCELLED tidak dihitung.
       *
       * DRAFT tetap dihitung supaya dua operator tidak dapat
       * membuat draft yang mengklaim quantity yang sama.
       */

      const alreadyBilled =
        await tx.tailorBillItem.aggregate({
          where: {
            spkId: spk.id,

            bill: {
              status: {
                not: "CANCELLED",
              },
            },
          },

          _sum: {
            quantity: true,
          },
        });

      const totalAlreadyBilled = Number(
        alreadyBilled._sum.quantity ?? 0,
      );

      /*
       * ==========================================================
       * 6. HITUNG QUANTITY YANG MASIH BISA DITAGIHKAN
       * ==========================================================
       *
       * Yang dibayar adalah QC ACC.
       *
       * BUKAN:
       * - Sisa Jahit
       * - Barang di QC
       * - Jumlah Barang
       *
       * Rumus:
       *
       * Billable =
       * Total QC ACC - Sudah Ditagihkan
       */

      const billableQuantity = Math.max(
        status.totalQcAcc - totalAlreadyBilled,
        0,
      );

      if (billableQuantity <= 0) {
        throw new Error(
          `SPK ${spk.spkNumber} tidak memiliki quantity yang dapat ditagihkan.`,
        );
      }

      /*
       * ==========================================================
       * 7. CEGAH OVER-BILLING
       * ==========================================================
       */

      if (quantity > billableQuantity) {
        throw new Error(
          `SPK ${spk.spkNumber} hanya dapat ditagihkan ${billableQuantity} pcs.`,
        );
      }

      /*
       * ==========================================================
       * 8. CARI TARIF PENJAHIT
       * ==========================================================
       */

      const now = new Date();

      const tailorRate = await tx.tailorRate.findFirst({
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

      if (!tailorRate) {
        throw new Error(
          `Tarif ${spk.tailor.name} - ${spk.product.name} belum tersedia.`,
        );
      }

      /*
       * ==========================================================
       * 9. HITUNG NOMINAL ITEM
       * ==========================================================
       */

      const rate = Number(tailorRate.rate);

      const amount = quantity * rate;

      preparedItems.push({
        spkId: spk.id,
        productId: spk.productId,
        quantity,
        rate,
        amount,
      });
    }

    /*
     * ============================================================
     * 10. HITUNG SUBTOTAL
     * ============================================================
     */

    const subtotal = preparedItems.reduce(
      (total, item) => total + item.amount,
      0,
    );

    /*
     * ============================================================
     * 11. GENERATE NOMOR TAGIHAN
     * ============================================================
     *
     * Untuk sementara menggunakan TransactionSequence
     * yang sudah tersedia.
     *
     * Format:
     *
     * BILL-YYYYMMDD-000001
     *
     * Catatan:
     * Nanti bisa kita pisahkan menjadi TailorBillSequence
     * kalau ingin counter BILL benar-benar terpisah dari TRX.
     */

    const now = new Date();

    const sequenceDate =
    `${now.getFullYear()}${String(
        now.getMonth() + 1,
    ).padStart(2, "0")}${String(
        now.getDate(),
    ).padStart(2, "0")}`;

    const sequence =
    await tx.tailorBillSequence.upsert({
        where: {
        date: sequenceDate,
        },
        update: {
        lastValue: {
            increment: 1,
        },
        },
        create: {
        date: sequenceDate,
        lastValue: 1,
        },
    });

    const billNumber =
    `BILL-${sequenceDate}-${String(
        sequence.lastValue,
    ).padStart(6, "0")}`;

    /*
     * ============================================================
     * 12. CREATE TAILOR BILL
     * ============================================================
     */

    const bill = await tx.tailorBill.create({
      data: {
        billNumber,

        tailorId: input.tailorId,

        status: "DRAFT",

        subtotal,

        totalAmount: subtotal,

        notes: input.notes ?? null,

        createdById: userId,

        items: {
          create: preparedItems.map((item) => ({
            spkId: item.spkId,

            productId: item.productId,

            quantity: item.quantity,

            rate: item.rate,

            amount: item.amount,
          })),
        },
      },

      include: {
        tailor: true,

        items: {
          include: {
            spk: true,

            product: true,
          },
        },
      },
    });

    /*
     * ============================================================
     * 13. ACTIVITY LOG
     * ============================================================
     */

   await tx.activityLog.create({
    data: {
        userId,
        action: "CREATE",
        entityType: "TAILOR_BILL",
        entityId: String(bill.id),
        description: `Membuat tagihan penjahit ${bill.billNumber}`,
    },
    });

    /*
     * ============================================================
     * 14. RETURN BILL
     * ============================================================
     */

    return bill;
  });
}