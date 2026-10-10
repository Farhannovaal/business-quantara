import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const { id: rawId } = await context.params;
  const transactionId = Number(rawId);

  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    return NextResponse.json(
      { success: false, error: "ID transaksi tidak valid." },
      { status: 400 },
    );
  }

  let body: { reason?: unknown } = {};

  try {
    body = await request.json();
  } catch {
    // Alasan bersifat opsional; body kosong diperbolehkan.
  }

  if (
    body.reason !== undefined &&
    body.reason !== null &&
    typeof body.reason !== "string"
  ) {
    return NextResponse.json(
      { success: false, error: "Format alasan tidak valid." },
      { status: 400 },
    );
  }

  const reason =
    typeof body.reason === "string"
      ? body.reason.trim() || null
      : null;

  try {
    const result = await prisma.$transaction(
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

        const dependentTransaction =
          await tx.transaction.findFirst({
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
            select: {
              transactionNumber: true,
              transactionType: {
                select: { name: true },
              },
            },
            orderBy: [
              { createdAt: "asc" },
              { id: "asc" },
            ],
          });

        if (dependentTransaction) {
          throw new Error(
            `HAS_DEPENDENT_TRANSACTION:${dependentTransaction.transactionNumber}`,
          );
        }

        // Jangan batalkan transaksi yang sudah dipakai
        // pada tagihan penjahit aktif.
        const billItem = await tx.tailorBillItem.findFirst({
          where: {
            spkId: transaction.spkId,
            productId: transaction.productId,
            bill: {
              status: {
                in: ["SUBMITTED", "PAID"],
              },
            },
          },
          select: { id: true },
        });

        if (billItem) {
          throw new Error("TRANSACTION_USED_IN_BILL");
        }

        // Conditional update mencegah pembatalan kedua
        // terhadap transaksi yang statusnya sudah berubah.
        const updated = await tx.transaction.updateMany({
          where: {
            id: transaction.id,
            status: "ACTIVE",
          },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelledById: user.id,
            cancellationReason: reason,
          },
        });

        if (updated.count !== 1) {
          throw new Error("TRANSACTION_NOT_ACTIVE");
        }

        await tx.activityLog.create({
          data: {
            userId: user.id,
            action: "CANCEL",
            entityType: "Transaction",
            entityId: String(transaction.id),
            description:
              `Transaction ${transaction.transactionNumber} cancelled by ${user.name}.` +
              (reason ? ` Reason: ${reason}` : ""),
          },
        });

        return {
          id: transaction.id,
          transactionNumber: transaction.transactionNumber,
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledById: user.id,
          cancellationReason: reason,
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return NextResponse.json({
      success: true,
      message: "Transaksi berhasil dibatalkan.",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "TRANSACTION_NOT_FOUND") {
      return NextResponse.json(
        { success: false, error: "Transaksi tidak ditemukan." },
        { status: 404 },
      );
    }

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          error: "Hanya pembuat transaksi atau administrator yang dapat membatalkan transaksi ini.",
        },
        { status: 403 },
      );
    }

    if (message === "TRANSACTION_NOT_ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: "Transaksi sudah dibatalkan atau tidak lagi aktif.",
        },
        { status: 409 },
      );
    }

    if (message.startsWith("HAS_DEPENDENT_TRANSACTION:")) {
      const transactionNumber = message.split(":")[1];

      return NextResponse.json(
        {
          success: false,
          error: `Pembatalan ditolak karena terdapat transaksi lanjutan ${transactionNumber}.`,
        },
        { status: 409 },
      );
    }

    if (message === "TRANSACTION_USED_IN_BILL") {
      return NextResponse.json(
        {
          success: false,
          error: "Pembatalan ditolak karena transaksi sudah digunakan pada tagihan penjahit.",
        },
        { status: 409 },
      );
    }

    console.error("Cancel transaction error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal membatalkan transaksi.",
      },
      { status: 500 },
    );
  }
}