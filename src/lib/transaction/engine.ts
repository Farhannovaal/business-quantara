import { Prisma } from "@prisma/client";

import {
  calculateSPKStatus,
  type SPKTransactionForStatus,
} from "@/lib/spk-status";

type TransactionDb = Prisma.TransactionClient;

export type CreateTransactionInput = {
  spkId: number;
  transactionTypeId: number;
  productId: number;
  tailorId: number;
  employeeId: number;
  quantity: number;
  createdById: number;
};

export class TransactionEngineError extends Error {
  code: string;
  status: number;
  maxQuantity?: number;

  constructor(
    code: string,
    message: string,
    status = 400,
    maxQuantity?: number,
  ) {
    super(message);

    this.name = "TransactionEngineError";
    this.code = code;
    this.status = status;
    this.maxQuantity = maxQuantity;
  }
}

export async function createTransaction(
  tx: TransactionDb,
  input: CreateTransactionInput,
) {
  const {
    spkId,
    transactionTypeId,
    productId,
    tailorId,
    employeeId,
    quantity,
    createdById,
  } = input;

  // =========================================================
  // BASIC VALIDATION
  // =========================================================

  if (!Number.isInteger(spkId) || spkId <= 0) {
    throw new TransactionEngineError(
      "INVALID_SPK",
      "Invalid SPK",
    );
  }

  if (
    !Number.isInteger(transactionTypeId) ||
    transactionTypeId <= 0
  ) {
    throw new TransactionEngineError(
      "INVALID_TRANSACTION_TYPE",
      "Invalid transaction type",
    );
  }

  if (!Number.isInteger(productId) || productId <= 0) {
    throw new TransactionEngineError(
      "INVALID_PRODUCT",
      "Invalid product",
    );
  }

  if (!Number.isInteger(tailorId) || tailorId <= 0) {
    throw new TransactionEngineError(
      "INVALID_TAILOR",
      "Invalid tailor",
    );
  }

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw new TransactionEngineError(
      "INVALID_EMPLOYEE",
      "Invalid employee",
    );
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new TransactionEngineError(
      "INVALID_QUANTITY",
      "Quantity must be a positive integer",
    );
  }

  // =========================================================
  // LOAD SPK
  // =========================================================

  const spk = await tx.sPK.findUnique({
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
    },
  });

  if (!spk) {
    throw new TransactionEngineError(
      "SPK_NOT_FOUND",
      "SPK not found",
      404,
    );
  }

  if (spk.status !== "ACTIVE") {
    throw new TransactionEngineError(
      "SPK_NOT_ACTIVE",
      "SPK is not active",
    );
  }

  // =========================================================
  // FIND PRODUCT INSIDE SPK
  // =========================================================

  const spkItem = spk.items.find(
    (item) => item.productId === productId,
  );

  if (!spkItem) {
    throw new TransactionEngineError(
      "PRODUCT_NOT_IN_SPK",
      "Product does not belong to this SPK",
    );
  }

  // =========================================================
  // TRANSACTION TYPE
  // =========================================================

  const transactionType =
    await tx.transactionType.findUnique({
      where: {
        id: transactionTypeId,
      },
    });

  if (!transactionType) {
    throw new TransactionEngineError(
      "TRANSACTION_TYPE_NOT_FOUND",
      "Transaction type not found",
      404,
    );
  }

  if (!transactionType.isActive) {
    throw new TransactionEngineError(
      "TRANSACTION_TYPE_NOT_ACTIVE",
      "Transaction type is not active",
    );
  }

  // =========================================================
  // PRODUCT
  // =========================================================

  const product =
    await tx.product.findUnique({
      where: {
        id: productId,
      },
    });

  if (!product) {
    throw new TransactionEngineError(
      "PRODUCT_NOT_FOUND",
      "Product not found",
      404,
    );
  }

  if (!product.isActive) {
    throw new TransactionEngineError(
      "PRODUCT_NOT_ACTIVE",
      "Product is not active",
    );
  }

  // =========================================================
  // TAILOR
  // =========================================================

  const tailor =
    await tx.tailor.findUnique({
      where: {
        id: tailorId,
      },
    });

  if (!tailor) {
    throw new TransactionEngineError(
      "TAILOR_NOT_FOUND",
      "Tailor not found",
      404,
    );
  }

  if (!tailor.isActive) {
    throw new TransactionEngineError(
      "TAILOR_NOT_ACTIVE",
      "Tailor is not active",
    );
  }

  // =========================================================
  // EMPLOYEE
  // =========================================================

  const employee =
    await tx.employee.findUnique({
      where: {
        id: employeeId,
      },
    });

  if (!employee) {
    throw new TransactionEngineError(
      "EMPLOYEE_NOT_FOUND",
      "Employee not found",
      404,
    );
  }

  if (!employee.isActive) {
    throw new TransactionEngineError(
      "EMPLOYEE_NOT_ACTIVE",
      "Employee is not active",
    );
  }

  // =========================================================
  // TAILOR MUST MATCH SPK
  // =========================================================

  if (spk.tailorId !== tailorId) {
    throw new TransactionEngineError(
      "TAILOR_NOT_MATCH_SPK",
      "Tailor does not match the SPK",
    );
  }

  // =========================================================
  // GET TRANSACTIONS FOR THIS SPK + PRODUCT ONLY
  // =========================================================

  const spkTransactions =
    await tx.transaction.findMany({
      where: {
        spkId,
        productId,
      },

      select: {
        quantity: true,

        transactionType: {
          select: {
            code: true,
          },
        },
      },
    });

  const status =
    calculateSPKStatus(
      spkTransactions as SPKTransactionForStatus[],
      spkItem.quantity,
    );

  // =========================================================
  // CHECK TRANSACTION TYPE
  // =========================================================

  const isAllowed =
    status.nextTransactionTypes.includes(
      transactionType.code,
    );

  if (!isAllowed) {
    throw new TransactionEngineError(
      "TRANSACTION_TYPE_NOT_ALLOWED",
      "This transaction type is not allowed for the current SPK product status",
    );
  }

  // =========================================================
  // MAX QUANTITY
  // =========================================================

  let maxQuantity: number | null = null;

  // ---------------------------------------------------------
  // PENGIRIMAN SIAP JAHIT
  // ---------------------------------------------------------

  switch (transactionType.code) {
    case "PENGIRIMAN_SIAP_JAHIT":
      maxQuantity = Math.max(
        spkItem.quantity -
          status.totalPengiriman,
        0,
      );
      break;

    // -------------------------------------------------------
    // PENERIMAAN DARI PENJAHIT
    // -------------------------------------------------------

    case "PENERIMAAN_DARI_PENJAHIT":
      maxQuantity =
        status.sisaJahit;
      break;

    // -------------------------------------------------------
    // QC
    // -------------------------------------------------------

    case "QUALITY_CONTROL":
    case "QC_RIJEK":
    case "QC_ACC_DIKIRIM_KE_GUDANG":
      maxQuantity =
        status.barangDiQc;
      break;

    // -------------------------------------------------------
    // PENGIRIMAN RIJEK
    // -------------------------------------------------------

    case "PENGIRIMAN_RIJEK":
      maxQuantity = Math.max(
        status.totalQcRijek -
          status.totalPengirimanRijek,
        0,
      );
      break;

    // -------------------------------------------------------
    // PENERIMAAN RIJEK
    // -------------------------------------------------------

    case "PENERIMAAN_RIJEK":
      maxQuantity = Math.max(
        status.totalPengirimanRijek -
          status.totalPenerimaanRijek,
        0,
      );
      break;
  }

  // =========================================================
  // VALIDATE MAX QUANTITY
  // =========================================================

  if (
    maxQuantity !== null &&
    quantity > maxQuantity
  ) {
    throw new TransactionEngineError(
      "QUANTITY_EXCEEDS_AVAILABLE",
      "Quantity exceeds the available quantity",
      400,
      maxQuantity,
    );
  }

  // =========================================================
  // GENERATE TRANSACTION NUMBER
  // =========================================================

  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      now.getDate(),
    ).padStart(2, "0");

  const dateKey =
    `${year}${month}${day}`;

  const sequence =
    await tx.transactionSequence.upsert({
      where: {
        date: dateKey,
      },

      create: {
        date: dateKey,
        lastValue: 1,
      },

      update: {
        lastValue: {
          increment: 1,
        },
      },
    });

  const transactionNumber =
    `TRX-${dateKey}-${String(
      sequence.lastValue,
    ).padStart(6, "0")}`;

  // =========================================================
  // CREATE TRANSACTION
  // =========================================================

  const transaction =
    await tx.transaction.create({
      data: {
        transactionNumber,

        spkId,
        transactionTypeId,
        productId,
        tailorId,
        employeeId,

        quantity,

        createdById,
      },

      include: {
        spk: {
          include: {
            tailor: true,

            items: {
              include: {
                product: true,
              },
            },
          },
        },

        transactionType: true,
        product: true,
        tailor: true,
        employee: true,
      },
    });

  // =========================================================
  // ACTIVITY LOG
  // =========================================================

  await tx.activityLog.create({
    data: {
      userId: createdById,

      action: "CREATE",

      entityType: "Transaction",

      entityId: String(
        transaction.id,
      ),

      description:
        `Transaction ${transaction.transactionNumber} created.`,
    },
  });

  return transaction;
}