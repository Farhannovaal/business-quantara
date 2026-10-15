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

function generateBillNumber(sequence: number, date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `BILL-${year}${month}${day}-${String(sequence).padStart(6, "0")}`;
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export async function createTailorBill(
  input: CreateTailorBillInput,
  userId: number,
) {
  if (!Number.isInteger(input.tailorId) || input.tailorId <= 0) {
    throw new Error("Penjahit tidak valid.");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("Minimal satu item harus dipilih.");
  }

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
      throw new Error(`Product untuk SPK ${item.spkId} tidak valid.`);
    }

    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new Error(
        `Quantity SPK ${item.spkId} / product ${item.productId} harus berupa angka bulat lebih dari 0.`,
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

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const tailor = await tx.tailor.findUnique({
            where: { id: input.tailorId },
          });

          if (!tailor) {
            throw new Error("Penjahit tidak ditemukan.");
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

          const now = new Date();

          for (const item of uniqueItems) {
            const spk = await tx.sPK.findUnique({
              where: { id: item.spkId },
              include: {
                items: {
                  include: { product: true },
                },
                transactions: {
                  where: {
                    productId: item.productId,
                    status: "ACTIVE",
                  },
                  include: { transactionType: true },
                  orderBy: [
                    { createdAt: "asc" },
                    { id: "asc" },
                  ],
                },
              },
            });

            if (!spk) {
              throw new Error(
                `SPK dengan ID ${item.spkId} tidak ditemukan.`,
              );
            }

            if (spk.status === "CANCELLED") {
              throw new Error(`SPK ${spk.spkNumber} sudah dibatalkan.`);
            }

            if (spk.tailorId !== input.tailorId) {
              throw new Error(
                `SPK ${spk.spkNumber} bukan milik penjahit yang dipilih.`,
              );
            }

            const spkItem = spk.items.find(
              (value) => value.productId === item.productId,
            );

            if (!spkItem) {
              throw new Error(
                `Product ${item.productId} tidak terdapat pada SPK ${spk.spkNumber}.`,
              );
            }

            const status = calculateSPKStatus(
              spk.transactions.map((transaction) => ({
                quantity: transaction.quantity,
                transactionType: {
                  code: transaction.transactionType.code,
                },
              })),
            );

            const alreadyBilled =
              await tx.tailorBillItem.aggregate({
                where: {
                  spkId: spk.id,
                  productId: item.productId,
                  bill: {
                    status: { not: "CANCELLED" },
                  },
                },
                _sum: { quantity: true },
              });

            const totalAlreadyBilled = Number(
              alreadyBilled._sum.quantity ?? 0,
            );

            const billableQuantity = Math.max(
              Number(status.totalQcAcc) - totalAlreadyBilled,
              0,
            );

            if (billableQuantity <= 0) {
              throw new Error(
                `SPK ${spk.spkNumber} - ${spkItem.product.name} tidak memiliki quantity yang dapat ditagihkan.`,
              );
            }

            if (item.quantity > billableQuantity) {
              throw new Error(
                `SPK ${spk.spkNumber} - ${spkItem.product.name} hanya dapat ditagihkan ${billableQuantity} pcs.`,
              );
            }

            const tailorRate = await tx.tailorRate.findFirst({
              where: {
                tailorId: spk.tailorId,
                productId: item.productId,
                isActive: true,
                effectiveFrom: { lte: now },
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: now } },
                ],
              },
              orderBy: { effectiveFrom: "desc" },
            });

            if (!tailorRate) {
              throw new Error(
                `Tarif ${tailor.name} - ${spkItem.product.name} belum tersedia.`,
              );
            }

            const rate = Number(tailorRate.rate);

            if (!Number.isFinite(rate) || rate < 0) {
              throw new Error(
                `Tarif ${tailor.name} - ${spkItem.product.name} tidak valid.`,
              );
            }

            preparedItems.push({
              spkId: spk.id,
              productId: item.productId,
              quantity: item.quantity,
              rate,
              amount: item.quantity * rate,
            });
          }

          const subtotal = preparedItems.reduce(
            (total, item) => total + item.amount,
            0,
          );

          if (!Number.isFinite(subtotal)) {
            throw new Error("Total billing tidak valid.");
          }

          const sequenceDate =
            `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

          const sequence = await tx.tailorBillSequence.upsert({
            where: { date: sequenceDate },
            update: {
              lastValue: { increment: 1 },
            },
            create: {
              date: sequenceDate,
              lastValue: 1,
            },
          });

          const billNumber = generateBillNumber(
            sequence.lastValue,
            now,
          );

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
        },
      );
    } catch (error) {
      if (isSerializationConflict(error) && attempt < 2) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    "Billing gagal dibuat karena terjadi konflik transaksi. Silakan coba kembali.",
  );
}