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

/**
 * Membuat transaksi dengan validasi konsistensi perusahaan.
 *
 * Company ID transaksi ditentukan dari SPK yang valid,
 * bukan dari input yang dikirim frontend.
 *
 * Fungsi ini harus dipanggil di dalam Prisma transaction.
 */
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

  // ============================================================
  // 1. VALIDASI INPUT
  // ============================================================

  if (!Number.isInteger(spkId) || spkId <= 0) {
    throw new TransactionEngineError(
      "INVALID_SPK",
      "Invalid SPK.",
    );
  }

  if (
    !Number.isInteger(transactionTypeId) ||
    transactionTypeId <= 0
  ) {
    throw new TransactionEngineError(
      "INVALID_TRANSACTION_TYPE",
      "Invalid transaction type.",
    );
  }

  if (!Number.isInteger(productId) || productId <= 0) {
    throw new TransactionEngineError(
      "INVALID_PRODUCT",
      "Invalid product.",
    );
  }

  if (!Number.isInteger(tailorId) || tailorId <= 0) {
    throw new TransactionEngineError(
      "INVALID_TAILOR",
      "Invalid tailor.",
    );
  }

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw new TransactionEngineError(
      "INVALID_EMPLOYEE",
      "Invalid employee.",
    );
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new TransactionEngineError(
      "INVALID_QUANTITY",
      "Quantity must be a positive integer.",
    );
  }

  if (!Number.isInteger(createdById) || createdById <= 0) {
    throw new TransactionEngineError(
      "INVALID_CREATED_BY",
      "Invalid transaction creator.",
    );
  }

  // ============================================================
  // 2. AMBIL SPK DAN PERUSAHAANNYA
  // ============================================================

  const spk = await tx.sPK.findFirst({
    where: {
      id: spkId,
      deletedAt: null,
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
      "SPK not found.",
      404,
    );
  }

  if (spk.companyId == null) {
    throw new TransactionEngineError(
      "SPK_COMPANY_REQUIRED",
      "SPK does not have a valid company.",
    );
  }

  const companyId = spk.companyId;

  if (spk.status !== "ACTIVE") {
    throw new TransactionEngineError(
      "SPK_NOT_ACTIVE",
      "SPK is not active.",
    );
  }

  // ============================================================
  // 3. VALIDASI PENJAHIT
  // ============================================================

  const tailor = await tx.tailor.findUnique({
    where: {
      id: tailorId,
    },
  });

  if (!tailor) {
    throw new TransactionEngineError(
      "TAILOR_NOT_FOUND",
      "Tailor not found.",
      404,
    );
  }

  if (!tailor.isActive) {
    throw new TransactionEngineError(
      "TAILOR_NOT_ACTIVE",
      "Tailor is not active.",
    );
  }

  if (spk.tailorId !== tailorId) {
    throw new TransactionEngineError(
      "TAILOR_NOT_MATCH_SPK",
      "Tailor does not match the SPK.",
    );
  }

  if (
    tailor.companyId == null ||
    tailor.companyId !== companyId
  ) {
    throw new TransactionEngineError(
      "TAILOR_COMPANY_MISMATCH",
      "Tailor does not belong to the SPK company.",
    );
  }

  // Pastikan relasi SPK ke penjahit juga konsisten.
  if (
    spk.tailor.companyId == null ||
    spk.tailor.companyId !== companyId
  ) {
    throw new TransactionEngineError(
      "SPK_TAILOR_COMPANY_MISMATCH",
      "SPK and its tailor belong to different companies.",
    );
  }

  // ============================================================
  // 4. VALIDASI PRODUK DAN ITEM SPK
  // ============================================================

  const spkItem = spk.items.find(
    (item) => item.productId === productId,
  );

  if (!spkItem) {
    throw new TransactionEngineError(
      "PRODUCT_NOT_IN_SPK",
      "Product does not belong to this SPK.",
    );
  }

  const product = await tx.product.findUnique({
    where: {
      id: productId,
    },
  });

  if (!product) {
    throw new TransactionEngineError(
      "PRODUCT_NOT_FOUND",
      "Product not found.",
      404,
    );
  }

  if (!product.isActive) {
    throw new TransactionEngineError(
      "PRODUCT_NOT_ACTIVE",
      "Product is not active.",
    );
  }

  if (
    product.companyId == null ||
    product.companyId !== companyId
  ) {
    throw new TransactionEngineError(
      "PRODUCT_COMPANY_MISMATCH",
      "Product does not belong to the SPK company.",
    );
  }

  // Pastikan produk yang terhubung ke item SPK
  // juga mempunyai perusahaan yang sama.
  if (
    spkItem.product.companyId == null ||
    spkItem.product.companyId !== companyId
  ) {
    throw new TransactionEngineError(
      "SPK_ITEM_PRODUCT_COMPANY_MISMATCH",
      "SPK item product does not belong to the SPK company.",
    );
  }

  // ============================================================
  // 5. VALIDASI JENIS TRANSAKSI
  // ============================================================

  const transactionType = await tx.transactionType.findUnique({
    where: {
      id: transactionTypeId,
    },
  });

  if (!transactionType) {
    throw new TransactionEngineError(
      "TRANSACTION_TYPE_NOT_FOUND",
      "Transaction type not found.",
      404,
    );
  }

  if (!transactionType.isActive) {
    throw new TransactionEngineError(
      "TRANSACTION_TYPE_NOT_ACTIVE",
      "Transaction type is not active.",
    );
  }

  if (
    transactionType.companyId == null ||
    transactionType.companyId !== companyId
  ) {
    throw new TransactionEngineError(
      "TRANSACTION_TYPE_COMPANY_MISMATCH",
      "Transaction type does not belong to the SPK company.",
    );
  }

  // ============================================================
  // 6. VALIDASI KARYAWAN
  // ============================================================

  const employee = await tx.employee.findUnique({
    where: {
      id: employeeId,
    },
  });

  if (!employee) {
    throw new TransactionEngineError(
      "EMPLOYEE_NOT_FOUND",
      "Employee not found.",
      404,
    );
  }

  if (!employee.isActive) {
    throw new TransactionEngineError(
      "EMPLOYEE_NOT_ACTIVE",
      "Employee is not active.",
    );
  }

  if (
    employee.companyId == null ||
    employee.companyId !== companyId
  ) {
    throw new TransactionEngineError(
      "EMPLOYEE_COMPANY_MISMATCH",
      "Employee does not belong to the SPK company.",
    );
  }

  // ============================================================
  // 7. HITUNG STATUS TRANSAKSI SPK
  // ============================================================

  const spkTransactions = await tx.transaction.findMany({
    where: {
      companyId,
      spkId,
      productId,
      status: "ACTIVE",
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

  const status = calculateSPKStatus(
    spkTransactions as SPKTransactionForStatus[],
    spkItem.quantity,
  );

  const isAllowed = status.nextTransactionTypes.includes(
    transactionType.code,
  );

  if (!isAllowed) {
    throw new TransactionEngineError(
      "TRANSACTION_TYPE_NOT_ALLOWED",
      "This transaction type is not allowed for the current SPK product status.",
    );
  }

  // ============================================================
  // 8. VALIDASI KUANTITAS
  // ============================================================

  let maxQuantity: number | null = null;

  switch (transactionType.code) {
    case "PENGIRIMAN_SIAP_JAHIT":
      maxQuantity = Math.max(
        spkItem.quantity - status.totalPengiriman,
        0,
      );
      break;

    case "PENERIMAAN_DARI_PENJAHIT":
      maxQuantity = status.sisaJahit;
      break;

    case "QUALITY_CONTROL":
    case "QC_RIJEK":
    case "QC_ACC_DIKIRIM_KE_GUDANG":
      maxQuantity = status.barangDiQc;
      break;

    case "PENGIRIMAN_RIJEK":
      maxQuantity = Math.max(
        status.totalQcRijek - status.totalPengirimanRijek,
        0,
      );
      break;

    case "PENERIMAAN_RIJEK":
      maxQuantity = Math.max(
        status.totalPengirimanRijek -
          status.totalPenerimaanRijek,
        0,
      );
      break;
  }

  if (maxQuantity !== null && quantity > maxQuantity) {
    throw new TransactionEngineError(
      "QUANTITY_EXCEEDS_AVAILABLE",
      "Quantity exceeds the available quantity.",
      400,
      maxQuantity,
    );
  }

  // ============================================================
  // 9. GENERATE NOMOR TRANSAKSI
  // ============================================================

  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const dateKey = `${year}${month}${day}`;

  const sequence = await tx.transactionSequence.upsert({
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

  const transactionNumber = `TRX-${dateKey}-${String(
    sequence.lastValue,
  ).padStart(6, "0")}`;

  // ============================================================
  // 10. SIMPAN TRANSAKSI DENGAN COMPANY ID
  // ============================================================

  const transaction = await tx.transaction.create({
    data: {
      companyId,
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

  // ============================================================
  // 11. CATAT ACTIVITY LOG DENGAN COMPANY ID
  // ============================================================

  await tx.activityLog.create({
    data: {
      companyId,
      userId: createdById,
      action: "CREATE",
      entityType: "Transaction",
      entityId: String(transaction.id),
      description: `Transaction ${transaction.transactionNumber} created.`,
    },
  });

  return transaction;
}