import { NextResponse } from "next/server";

import {
  requirePermission,
} from "@/lib/auth/authorization";

import {
  requireAuth,
} from "@/lib/auth/require-auth";

import { prisma } from "@/lib/prisma";

import {
  calculateSPKStatus,
} from "@/lib/spk-status";

import {
  createTransaction,
  TransactionEngineError,
} from "@/lib/transaction/engine";

type ExecuteQCBody = {
  spkId?: number;
  employeeId?: number;
  accQuantity?: number;
  rejectQuantity?: number;
  notes?: string;
};

export async function POST(request: Request) {
  // ==================================================
  // AUTHENTICATION
  // ==================================================

  const { user, response } =
    await requireAuth();

  if (response) {
    return response;
  }

  // ==================================================
  // PERMISSION
  // ==================================================

  const permission =
    requirePermission(
      user,
      "qc.manage",
    );

  if (permission.response) {
    return permission.response;
  }

  try {
    // ==================================================
    // READ REQUEST BODY
    // ==================================================

    const body =
      (await request.json()) as ExecuteQCBody;

    const spkId = Number(
      body.spkId,
    );

    const employeeId = Number(
      body.employeeId,
    );

    const accQuantity = Number(
      body.accQuantity ?? 0,
    );

    const rejectQuantity = Number(
      body.rejectQuantity ?? 0,
    );

    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : "";

    // ==================================================
    // BASIC VALIDATION
    // ==================================================

    if (
      !Number.isInteger(spkId) ||
      spkId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "SPK tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "PIC QC tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isInteger(accQuantity) ||
      accQuantity < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Jumlah ACC tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isInteger(rejectQuantity) ||
      rejectQuantity < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Jumlah Rijek tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    // ==================================================
    // TOTAL QC RESULT
    // ==================================================

    const totalQuantity =
      accQuantity +
      rejectQuantity;

    if (totalQuantity <= 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Jumlah ACC atau Rijek harus diisi.",
        },
        {
          status: 400,
        },
      );
    }

    // ==================================================
    // LOAD SPK
    // ==================================================

    const spk =
      await prisma.sPK.findUnique({
        where: {
          id: spkId,
        },
        include: {
          product: true,
          tailor: true,
        },
      });

    if (!spk) {
      return NextResponse.json(
        {
          success: false,
          error:
            "SPK tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    if (spk.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error:
            "SPK tidak aktif.",
        },
        {
          status: 400,
        },
      );
    }

    // ==================================================
    // GET CURRENT SPK STATUS
    // ==================================================

    const spkTransactions =
      await prisma.transaction.findMany({
        where: {
          spkId,
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
        spkTransactions,
      );

    // ==================================================
    // VALIDATE AVAILABLE QC QUANTITY
    // ==================================================

    if (status.barangDiQc <= 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tidak ada barang yang tersedia untuk diproses QC.",
          maxQuantity: 0,
        },
        {
          status: 400,
        },
      );
    }

    if (
      totalQuantity >
      status.barangDiQc
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Total ACC + Rijek melebihi jumlah barang yang tersedia untuk QC.",
          maxQuantity:
            status.barangDiQc,
          requestedQuantity:
            totalQuantity,
        },
        {
          status: 400,
        },
      );
    }

    // ==================================================
    // FIND TRANSACTION TYPES
    // ==================================================

    const transactionTypes =
      await prisma.transactionType.findMany({
        where: {
          code: {
            in: [
              "QC_ACC_DIKIRIM_KE_GUDANG",
              "QC_RIJEK",
            ],
          },
        },
      });

    const accTransactionType =
      transactionTypes.find(
        (transactionType) =>
          transactionType.code ===
          "QC_ACC_DIKIRIM_KE_GUDANG",
      );

    const rejectTransactionType =
      transactionTypes.find(
        (transactionType) =>
          transactionType.code ===
          "QC_RIJEK",
      );

    if (
      !accTransactionType ||
      !rejectTransactionType
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Transaction type QC belum tersedia.",
        },
        {
          status: 500,
        },
      );
    }

    if (
      !accTransactionType.isActive ||
      !rejectTransactionType.isActive
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Transaction type QC tidak aktif.",
        },
        {
          status: 400,
        },
      );
    }

    // ==================================================
    // CREATE QC TRANSACTIONS
    // ==================================================

    const result =
      await prisma.$transaction(
        async (tx) => {
          const transactions = [];

          // --------------------------------------------
          // QC ACC
          // --------------------------------------------

          if (accQuantity > 0) {
            const accTransaction =
              await createTransaction(
                tx,
                {
                  spkId,

                  transactionTypeId:
                    accTransactionType.id,

                  productId:
                    spk.productId,

                  tailorId:
                    spk.tailorId,

                  employeeId,

                  quantity:
                    accQuantity,

                  createdById:
                    user.id,
                },
              );

            transactions.push(
              accTransaction,
            );
          }

          // --------------------------------------------
          // QC RIJEK
          // --------------------------------------------

          if (rejectQuantity > 0) {
            const rejectTransaction =
              await createTransaction(
                tx,
                {
                  spkId,

                  transactionTypeId:
                    rejectTransactionType.id,

                  productId:
                    spk.productId,

                  tailorId:
                    spk.tailorId,

                  employeeId,

                  quantity:
                    rejectQuantity,

                  createdById:
                    user.id,
                },
              );

            transactions.push(
              rejectTransaction,
            );
          }

          // --------------------------------------------
          // QC NOTES
          // --------------------------------------------

          if (notes) {
            await tx.activityLog.create({
              data: {
                userId:
                  user.id,

                action:
                  "QC_EXECUTE",

                entityType:
                  "SPK",

                entityId:
                  String(spkId),

                description:
                  `QC executed for ${spk.spkNumber}. ` +
                  `ACC: ${accQuantity}, ` +
                  `Rijek: ${rejectQuantity}. ` +
                  `Notes: ${notes}`,
              },
            });
          }

          return transactions;
        },
      );

    // ==================================================
    // RESPONSE
    // ==================================================

    return NextResponse.json(
      {
        success: true,

        message:
          "Hasil QC berhasil disimpan.",

        data: {
          spkId,

          spkNumber:
            spk.spkNumber,

          product: {
            id:
              spk.product.id,

            code:
              spk.product.code,

            name:
              spk.product.name,
          },

          tailor: {
            id:
              spk.tailor.id,

            name:
              spk.tailor.name,
          },

          employeeId,

          accQuantity,

          rejectQuantity,

          totalQuantity,

          transactions:
            result.map(
              (transaction) => ({
                id:
                  transaction.id,

                transactionNumber:
                  transaction.transactionNumber,

                transactionType:
                  transaction
                    .transactionType
                    .code,

                quantity:
                  Number(
                    transaction.quantity,
                  ),

                createdAt:
                  transaction.createdAt,
              }),
            ),
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    // ==================================================
    // TRANSACTION ENGINE ERROR
    // ==================================================

    if (
      error instanceof
      TransactionEngineError
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            error.message,

          code:
            error.code,

          maxQuantity:
            error.maxQuantity,
        },
        {
          status:
            error.status,
        },
      );
    }

    // ==================================================
    // UNKNOWN ERROR
    // ==================================================

    console.error(
      "POST /api/qc/execute error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "Gagal menyimpan hasil QC.",
      },
      {
        status: 500,
      },
    );
  }
}