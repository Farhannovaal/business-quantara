import { prisma } from "@/lib/prisma";
import { calculateSPKStatus } from "@/lib/spk-status";

type CreateTailorBillItemInput = {
  spkId: number;
  productId: number;
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
  if (
    !Number.isInteger(input.tailorId) ||
    input.tailorId <= 0
  ) {
    throw new Error("Penjahit tidak valid.");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("Minimal satu item harus dipilih.");
  }

  /*
   * ============================================================
   * VALIDASI INPUT ITEM
   * ============================================================
   */

  const normalizedItems = input.items.map((item) => ({
    spkId: Number(item.spkId),
    productId: Number(item.productId),
    quantity: Number(item.quantity),
  }));

  for (const item of normalizedItems) {
    if (
      !Number.isInteger(item.spkId) ||
      item.spkId <= 0
    ) {
      throw new Error("SPK tidak valid.");
    }

    if (
      !Number.isInteger(item.productId) ||
      item.productId <= 0
    ) {
      throw new Error(
        `Product untuk SPK ${item.spkId} tidak valid.`,
      );
    }

    if (
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new Error(
        `Quantity SPK ${item.spkId} / product ${item.productId} harus berupa angka bulat lebih dari 0.`,
      );
    }
  }

  /*
   * ============================================================
   * HILANGKAN DUPLICATE SPK + PRODUCT
   * ============================================================
   *
   * Satu bill tidak boleh memiliki dua item dengan kombinasi:
   *
   * SPK 1 + Product 10
   *
   * Jika dikirim dua kali, kita gabungkan quantity-nya.
   * ============================================================
   */

  const uniqueItemMap = new Map<
    string,
    CreateTailorBillItemInput
  >();

  for (const item of normalizedItems) {
    const key = `${item.spkId}:${item.productId}`;

    const existing = uniqueItemMap.get(key);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      uniqueItemMap.set(key, {
        ...item,
      });
    }
  }

  const uniqueItems = Array.from(
    uniqueItemMap.values(),
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
     * 3. VALIDASI SETIAP SPK + PRODUCT
     * ============================================================
     */

    for (const item of uniqueItems) {
      const spk = await tx.sPK.findUnique({
        where: {
          id: item.spkId,
        },

        include: {
          tailor: true,

          items: {
            include: {
              product: true,
            },
          },

          transactions: {
            where: {
              productId: item.productId,
            },

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
       * SPK harus milik tailor yang dipilih.
       */

      if (spk.tailorId !== input.tailorId) {
        throw new Error(
          `SPK ${spk.spkNumber} bukan milik penjahit yang dipilih.`,
        );
      }

      /*
       * ==========================================================
       * VALIDASI PRODUCT ADA DI SPK
       * ==========================================================
       */

      const spkItem = spk.items.find(
        (value) =>
          value.productId === item.productId,
      );

      if (!spkItem) {
        throw new Error(
          `Product ${item.productId} tidak terdapat pada SPK ${spk.spkNumber}.`,
        );
      }

      /*
       * ==========================================================
       * 4. HITUNG STATUS PRODUK
       * ==========================================================
       *
       * Transactions yang sudah difilter berdasarkan productId.
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
       * 5. HITUNG QUANTITY SUDAH DITAGIHKAN
       * ==========================================================
       *
       * Hanya item dengan SPK + PRODUCT yang sama.
       *
       * CANCELLED tidak dihitung.
       * DRAFT tetap dihitung agar quantity tidak bisa
       * diklaim oleh billing lain.
       */

      const alreadyBilled =
        await tx.tailorBillItem.aggregate({
          where: {
            spkId: spk.id,
            productId: item.productId,

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
       * Yang dibayar adalah:
       *
       * QC ACC DIKIRIM KE GUDANG
       *
       * Bukan:
       * - Sisa Jahit
       * - Barang di QC
       * - Jumlah Barang
       *
       * Billable =
       * Total QC ACC - Sudah Ditagihkan
       */

      const billableQuantity = Math.max(
        status.totalQcAcc -
          totalAlreadyBilled,
        0,
      );

      if (billableQuantity <= 0) {
        throw new Error(
          `SPK ${spk.spkNumber} - ${spkItem.product.name} tidak memiliki quantity yang dapat ditagihkan.`,
        );
      }

      /*
       * ==========================================================
       * 7. CEGAH OVER-BILLING
       * ==========================================================
       */

      if (item.quantity > billableQuantity) {
        throw new Error(
          `SPK ${spk.spkNumber} - ${spkItem.product.name} hanya dapat ditagihkan ${billableQuantity} pcs.`,
        );
      }

      /*
       * ==========================================================
       * 8. CARI TARIF PENJAHIT + PRODUCT
       * ==========================================================
       */

      const now = new Date();

      const tailorRate =
        await tx.tailorRate.findFirst({
          where: {
            tailorId: spk.tailorId,
            productId: item.productId,

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
          `Tarif ${tailor.name} - ${spkItem.product.name} belum tersedia.`,
        );
      }

      /*
       * ==========================================================
       * 9. HITUNG NOMINAL ITEM
       * ==========================================================
       */

      const rate = Number(tailorRate.rate);
      const amount = item.quantity * rate;

      preparedItems.push({
        spkId: spk.id,
        productId: item.productId,
        quantity: item.quantity,
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
      (total, item) =>
        total + item.amount,
      0,
    );

    /*
     * ============================================================
     * 11. GENERATE NOMOR TAGIHAN
     * ============================================================
     *
     * Format:
     *
     * BILL-YYYYMMDD-000001
     * ============================================================
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
      generateBillNumber(
        sequence.lastValue,
      );

    /*
     * ============================================================
     * 12. CREATE TAILOR BILL
     * ============================================================
     */

    const bill =
      await tx.tailorBill.create({
        data: {
          billNumber,

          tailorId:
            input.tailorId,

          status: "DRAFT",

          subtotal,

          totalAmount: subtotal,

          notes:
            input.notes ?? null,

          createdById: userId,

          items: {
            create: preparedItems.map(
              (item) => ({
                spkId: item.spkId,
                productId:
                  item.productId,
                quantity:
                  item.quantity,
                rate: item.rate,
                amount:
                  item.amount,
              }),
            ),
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

        entityType:
          "TAILOR_BILL",

        entityId:
          String(bill.id),

        description:
          `Membuat tagihan penjahit ${bill.billNumber}`,
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