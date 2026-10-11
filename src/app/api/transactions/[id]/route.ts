
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import {
  calculateSPKStatus,
  type SPKTransactionForStatus,
} from "@/lib/spk-status";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type EditInput = {
  quantity: number;
  employeeId: number;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status },
  );
}

function getMaxQuantity(
  code: string,
  status: ReturnType<typeof calculateSPKStatus>,
  spkQuantity: number,
): number | null {
  switch (code) {
    case "PENGIRIMAN_SIAP_JAHIT":
      return Math.max(spkQuantity - status.totalPengiriman, 0);

    case "PENERIMAAN_DARI_PENJAHIT":
      return status.sisaJahit;

    case "QUALITY_CONTROL":
    case "QC_RIJEK":
    case "QC_ACC_DIKIRIM_KE_GUDANG":
      return status.barangDiQc;

    case "PENGIRIMAN_RIJEK":
      return Math.max(
        status.totalQcRijek - status.totalPengirimanRijek,
        0,
      );

    case "PENERIMAAN_RIJEK":
      return Math.max(
        status.totalPengirimanRijek - status.totalPenerimaanRijek,
        0,
      );

    default:
      return null;
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response || !user) {
    return response ?? jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;
  const transactionId = Number(id);

  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    return jsonError("ID transaksi tidak valid.", 400);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Format JSON tidak valid.", 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return jsonError("Format data tidak valid.", 400);
  }

  const raw = body as Record<string, unknown>;
  const input: EditInput = {
    quantity: Number(raw.quantity),
    employeeId: Number(raw.employeeId),
  };

  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    return jsonError(
      "Jumlah harus berupa bilangan bulat lebih dari 0.",
      400,
    );
  }

  if (
    !Number.isSafeInteger(input.employeeId) ||
    input.employeeId <= 0
  ) {
    return jsonError("Karyawan tidak valid.", 400);
  }

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const transaction = await tx.transaction.findUnique({
          where: { id: transactionId },
          include: {
            transactionType: {
              select: { code: true, name: true },
            },
          },
        });

        if (!transaction) {
          throw new Error("TRANSACTION_NOT_FOUND");
        }

        const isAdministrator =
          user.role?.name?.toLowerCase() === "administrator";

        const isCreator = transaction.createdById === user.id;

        if (!isAdministrator && !isCreator) {
          throw new Error("FORBIDDEN");
        }

        if (transaction.status !== "ACTIVE") {
          throw new Error("TRANSACTION_NOT_ACTIVE");
        }

        // Transaksi lanjutan membuat perubahan kuantitas berisiko
        // mengubah progres produksi yang sudah berjalan.
        const dependent = await tx.transaction.findFirst({
          where: {
            spkId: transaction.spkId,
            productId: transaction.productId,
            status: "ACTIVE",
            OR: [
              { createdAt: { gt: transaction.createdAt } },
              {
                createdAt: transaction.createdAt,
                id: { gt: transaction.id },
              },
            ],
          },
          select: { transactionNumber: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });

        if (dependent) {
          throw new Error("HAS_DEPENDENT_TRANSACTION");
        }

        const billItem = await tx.tailorBillItem.findFirst({
          where: {
            spkId: transaction.spkId,
            productId: transaction.productId,
            bill: {
              status: { in: ["SUBMITTED", "PAID"] },
            },
          },
          select: { id: true },
        });

        if (billItem) {
          throw new Error("TRANSACTION_USED_IN_BILL");
        }

        const employee = await tx.employee.findUnique({
          where: { id: input.employeeId },
          select: { id: true, name: true, isActive: true },
        });

        if (!employee || !employee.isActive) {
          throw new Error("EMPLOYEE_NOT_AVAILABLE");
        }

        const spk = await tx.sPK.findUnique({
          where: { id: transaction.spkId },
          include: {
            items: {
              where: { productId: transaction.productId },
              select: { quantity: true },
            },
          },
        });

        if (!spk) {
          throw new Error("SPK_NOT_FOUND");
        }

        if (spk.status !== "ACTIVE") {
          throw new Error("SPK_NOT_ACTIVE");
        }

        const spkItem = spk.items[0];

        if (!spkItem) {
          throw new Error("PRODUCT_NOT_IN_SPK");
        }

        // Hitung progres tanpa transaksi yang sedang diedit.
        // Transaksi CANCELLED juga tidak boleh masuk perhitungan.
        const otherTransactions = await tx.transaction.findMany({
          where: {
            spkId: transaction.spkId,
            productId: transaction.productId,
            status: "ACTIVE",
            id: { not: transaction.id },
          },
          select: {
            quantity: true,
            transactionType: {
              select: { code: true },
            },
          },
        });

        const status = calculateSPKStatus(
          otherTransactions as SPKTransactionForStatus[],
          spkItem.quantity,
        );

        const maxQuantity = getMaxQuantity(
          transaction.transactionType.code,
          status,
          spkItem.quantity,
        );

        if (maxQuantity !== null && input.quantity > maxQuantity) {
          throw new Error(`QUANTITY_EXCEEDS:${maxQuantity}`);
        }

        const quantityChanged =
          transaction.quantity !== input.quantity;

        const employeeChanged =
          transaction.employeeId !== input.employeeId;

        if (!quantityChanged && !employeeChanged) {
          return tx.transaction.findUniqueOrThrow({
            where: { id: transaction.id },
            include: {
              spk: { select: { id: true, spkNumber: true } },
              transactionType: {
                select: { id: true, code: true, name: true },
              },
              product: { select: { id: true, code: true, name: true } },
              tailor: { select: { id: true, name: true } },
              employee: { select: { id: true, name: true } },
            },
          });
        }

        const updatedTransaction = await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            quantity: input.quantity,
            employeeId: input.employeeId,
          },
          include: {
            spk: { select: { id: true, spkNumber: true } },
            transactionType: {
              select: { id: true, code: true, name: true },
            },
            product: { select: { id: true, code: true, name: true } },
            tailor: { select: { id: true, name: true } },
            employee: { select: { id: true, name: true } },
          },
        });

        const changes: string[] = [];

        if (quantityChanged) {
          changes.push(
            `quantity: ${transaction.quantity} -> ${input.quantity}`,
          );
        }

        if (employeeChanged) {
          changes.push(
            `employeeId: ${transaction.employeeId} -> ${input.employeeId}`,
          );
        }

        await tx.activityLog.create({
          data: {
            userId: user.id,
            action: "UPDATE",
            entityType: "Transaction",
            entityId: String(transaction.id),
            description:
              `Transaction ${transaction.transactionNumber} updated. ` +
              changes.join("; "),
          },
        });

        return updatedTransaction;
      },
      {
        maxWait: 10000,
        timeout: 30000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return NextResponse.json({
      success: true,
      message: "Transaksi berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "TRANSACTION_NOT_FOUND") {
      return jsonError("Transaksi tidak ditemukan.", 404);
    }

    if (message === "FORBIDDEN") {
      return jsonError(
        "Hanya pembuat transaksi atau Administrator yang dapat mengedit transaksi ini.",
        403,
      );
    }

    if (message === "TRANSACTION_NOT_ACTIVE") {
      return jsonError("Transaksi yang dibatalkan tidak dapat diedit.", 409);
    }

    if (message === "HAS_DEPENDENT_TRANSACTION") {
      return jsonError(
        "Transaksi tidak dapat diedit karena sudah memiliki transaksi lanjutan.",
        409,
      );
    }

    if (message === "TRANSACTION_USED_IN_BILL") {
      return jsonError(
        "Transaksi sudah digunakan pada tagihan penjahit.",
        409,
      );
    }

    if (message === "EMPLOYEE_NOT_AVAILABLE") {
      return jsonError("Karyawan tidak ditemukan atau tidak aktif.", 400);
    }

    if (message === "SPK_NOT_FOUND") {
      return jsonError("SPK tidak ditemukan.", 404);
    }

    if (message === "SPK_NOT_ACTIVE") {
      return jsonError("SPK tidak aktif sehingga transaksi tidak dapat diedit.", 409);
    }

    if (message === "PRODUCT_NOT_IN_SPK") {
      return jsonError("Produk tidak ditemukan dalam SPK.", 400);
    }

    if (message.startsWith("QUANTITY_EXCEEDS:")) {
      const maxQuantity = Number(message.split(":")[1]);

      return NextResponse.json(
        {
          success: false,
          error: `Jumlah melebihi sisa kuantitas yang tersedia (${maxQuantity}).`,
          maxQuantity,
        },
        { status: 400 },
      );
    }

    console.error("PATCH /api/transactions/[id]:", error);
    return jsonError("Gagal memperbarui transaksi.", 500);
  }
}
    