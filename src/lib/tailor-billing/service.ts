
import { Prisma } from "@prisma/client";

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

/**
 * Mengambil tanggal berdasarkan kalender Asia/Jakarta.
 *
 * Representasi dibuat konsisten dengan calculator.ts.
 *
 * Contoh:
 * 13 November 2026
 * menjadi 2026-11-13T00:00:00.000Z.
 *
 * Catatan:
 * Format ini mengikuti representasi tanggal yang saat ini
 * digunakan oleh kolom effectiveFrom di database.
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

/**
 * Membuat nomor billing.
 */
function generateBillNumber(sequence: number, date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `BILL-${year}${month}${day}-${String(sequence).padStart(6, "0")}`;
}

/**
 * Memeriksa serialization conflict Prisma.
 */
function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

/**
 * Membuat billing penjahit.
 *
 * Flow:
 * 1. Validasi input.
 * 2. Validasi tenant dan penjahit.
 * 3. Validasi SPK dan produk.
 * 4. Hitung transaksi dan QC ACC.
 * 5. Hitung quantity yang sudah ditagihkan.
 * 6. Hitung quantity yang dapat ditagihkan.
 * 7. Ambil tarif berdasarkan periode efektif.
 * 8. Hitung nominal billing.
 * 9. Generate nomor billing.
 * 10. Simpan draft dan detail billing.
 * 11. Simpan activity log.
 */
export async function createTailorBill(
  input: CreateTailorBillInput,
  userId: number,
  companyId: number
) {
  // STEP 1: Validasi company.
  if (!Number.isSafeInteger(companyId) || companyId <= 0) {
    throw new Error("Perusahaan tidak valid.");
  }

  // STEP 2: Validasi tailor.
  if (
    !Number.isSafeInteger(input.tailorId) ||
    input.tailorId <= 0
  ) {
    throw new Error("Penjahit tidak valid.");
  }

  // STEP 3: Validasi items.
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("Minimal satu item harus dipilih.");
  }

  /**
   * STEP 4:
   * Gabungkan item dengan kombinasi SPK dan produk yang sama.
   */
  const uniqueItemMap = new Map<
    string,
    CreateTailorBillItemInput
  >();

  for (const rawItem of input.items) {
    const item = {
      spkId: Number(rawItem.spkId),
      productId: Number(rawItem.productId),
      quantity: Number(rawItem.quantity),
    };

    if (!Number.isSafeInteger(item.spkId) || item.spkId <= 0) {
      throw new Error("SPK tidak valid.");
    }

    if (
      !Number.isSafeInteger(item.productId) ||
      item.productId <= 0
    ) {
      throw new Error(
        `Product untuk SPK ${item.spkId} tidak valid.`
      );
    }

    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new Error(
        `Quantity SPK ${item.spkId} / product ${item.productId} harus berupa angka bulat lebih dari 0.`
      );
    }

    const key = `${item.spkId}:${item.productId}`;
    const existing = uniqueItemMap.get(key);

    if (existing) {
      existing.quantity += item.quantity;

      if (!Number.isSafeInteger(existing.quantity)) {
        throw new Error("Total quantity item tidak valid.");
      }
    } else {
      uniqueItemMap.set(key, item);
    }
  }

  const uniqueItems = Array.from(uniqueItemMap.values());

  /**
   * STEP 5:
   * Retry jika terjadi serialization conflict.
   */
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          /**
           * STEP 6:
           * Validasi penjahit berdasarkan tenant aktif.
           */
          const tailor = await tx.tailor.findFirst({
            where: {
              id: input.tailorId,
              companyId,
            },
          });

          if (!tailor) {
            throw new Error(
              "Penjahit tidak ditemukan pada perusahaan aktif."
            );
          }

          if (!tailor.isActive) {
            throw new Error("Penjahit tidak aktif.");
          }

          const preparedItems: Array<{
            spkId: number;
            productId: number;
            quantity: number;
            rate: number;
            amount: number;
          }> = [];

          // Waktu aktual untuk timestamp dan nomor billing.
          const now = new Date();

          // Referensi tanggal tarif berdasarkan kalender Jakarta.
          // Harus sama dengan calculator.ts.
          const rateReferenceDate = getJakartaDateReference();

          /**
           * STEP 7:
           * Proses seluruh item billing.
           */
          for (const item of uniqueItems) {
            /**
             * STEP 7A:
             * Ambil SPK milik tenant aktif.
             */
            const spk = await tx.sPK.findFirst({
              where: {
                id: item.spkId,
                companyId,
                deletedAt: null,
              },
              include: {
                items: {
                  include: {
                    product: true,
                  },
                },
                transactions: {
                  where: {
                    productId: item.productId,
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
              },
            });

            if (!spk) {
              throw new Error(
                `SPK dengan ID ${item.spkId} tidak ditemukan pada perusahaan aktif.`
              );
            }

            if (spk.status === "CANCELLED") {
              throw new Error(
                `SPK ${spk.spkNumber} sudah dibatalkan.`
              );
            }

            if (spk.tailorId !== input.tailorId) {
              throw new Error(
                `SPK ${spk.spkNumber} bukan milik penjahit yang dipilih.`
              );
            }

            /**
             * STEP 7B:
             * Pastikan produk terdapat pada SPK.
             */
            const spkItem = spk.items.find(
              (value) => value.productId === item.productId
            );

            if (!spkItem) {
              throw new Error(
                `Product ${item.productId} tidak terdapat pada SPK ${spk.spkNumber}.`
              );
            }

            if (spkItem.product.companyId !== companyId) {
              throw new Error(
                `Product ${item.productId} bukan milik perusahaan aktif.`
              );
            }

            /**
             * STEP 7C:
             * Hitung status transaksi dan QC ACC.
             */
            const status = calculateSPKStatus(
              spk.transactions.map((transaction) => ({
                quantity: transaction.quantity,
                transactionType: {
                  code: transaction.transactionType.code,
                },
              }))
            );

            /**
             * STEP 7D:
             * Hitung quantity yang sudah pernah ditagihkan.
             *
             * Billing CANCELLED tidak dihitung.
             */
            const alreadyBilled =
              await tx.tailorBillItem.aggregate({
                where: {
                  spkId: spk.id,
                  productId: item.productId,
                  bill: {
                    companyId,
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
              alreadyBilled._sum.quantity ?? 0
            );

            /**
             * STEP 7E:
             * Hitung quantity yang masih dapat ditagihkan.
             *
             * Formula:
             * QC ACC - Already Billed.
             */
            const billableQuantity = Math.max(
              Number(status.totalQcAcc) - totalAlreadyBilled,
              0
            );

            if (billableQuantity <= 0) {
              throw new Error(
                `SPK ${spk.spkNumber} - ${spkItem.product.name} tidak memiliki quantity yang dapat ditagihkan.`
              );
            }

            if (item.quantity > billableQuantity) {
              throw new Error(
                `SPK ${spk.spkNumber} - ${spkItem.product.name} hanya dapat ditagihkan ${billableQuantity} pcs.`
              );
            }

            /**
             * STEP 7F:
             * Cari tarif berdasarkan tenant, tailor, produk,
             * status aktif, dan periode efektif.
             *
             * Pencarian ini harus sama dengan calculator.ts.
             */
            const tailorRate = await tx.tailorRate.findFirst({
              where: {
                companyId,
                tailorId: spk.tailorId,
                productId: item.productId,
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

            if (!tailorRate) {
              throw new Error(
                `Tarif ${tailor.name} - ${spkItem.product.name} belum tersedia atau belum berlaku.`
              );
            }

            /**
             * STEP 7G:
             * Validasi nominal tarif.
             */
            const rate = Number(tailorRate.rate);

            if (!Number.isFinite(rate) || rate <= 0) {
              throw new Error(
                `Tarif ${tailor.name} - ${spkItem.product.name} tidak valid.`
              );
            }

            /**
             * STEP 7H:
             * Hitung nominal item.
             */
            const amount = item.quantity * rate;

            if (!Number.isFinite(amount)) {
              throw new Error(
                `Nominal billing ${spkItem.product.name} tidak valid.`
              );
            }

            preparedItems.push({
              spkId: spk.id,
              productId: item.productId,
              quantity: item.quantity,
              rate,
              amount,
            });
          }

          /**
           * STEP 8:
           * Hitung subtotal seluruh item.
           */
          const subtotal = preparedItems.reduce(
            (total, item) => total + item.amount,
            0
          );

          if (!Number.isFinite(subtotal)) {
            throw new Error("Total billing tidak valid.");
          }

          /**
           * STEP 9:
           * Generate sequence nomor billing.
           *
           * Tetap menggunakan mekanisme sequence global
           * sesuai implementasi sebelumnya.
           */
          const sequenceDate =
            `${now.getFullYear()}` +
            `${String(now.getMonth() + 1).padStart(2, "0")}` +
            `${String(now.getDate()).padStart(2, "0")}`;

          const sequence = await tx.tailorBillSequence.upsert({
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

          const billNumber = generateBillNumber(
            sequence.lastValue,
            now
          );

          /**
           * STEP 10:
           * Buat billing dengan status DRAFT.
           */
          const bill = await tx.tailorBill.create({
            data: {
              companyId,
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

          /**
           * STEP 11:
           * Simpan activity log.
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

          return bill;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );
    } catch (error) {
      if (isSerializationConflict(error) && attempt < 2) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    "Billing gagal dibuat karena terjadi konflik transaksi. Silakan coba kembali."
  );
}
