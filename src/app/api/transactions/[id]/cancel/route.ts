
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

export const PATCH = withApiAuth<RouteContext>(
  async ({ request, context, user, tenant }) => {
    const companyId = tenant!.id;

    const { id: rawId } = await context.params;
    const transactionId = Number(rawId);

    if (
      !Number.isSafeInteger(transactionId) ||
      transactionId <= 0
    ) {
      return jsonError("ID transaksi tidak valid.", 400);
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
      return jsonError("Format alasan tidak valid.", 400);
    }

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim() || null
        : null;

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const transaction = await tx.transaction.findFirst({
            where: {
              id: transactionId,
              companyId,
            },
            include: {
              transactionType: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          });

          if (!transaction) {
            throw new Error("TRANSACTION_NOT_FOUND");
          }

          const roleName =
            user.role?.name?.toLowerCase() ?? "";

          const isSuperAdmin = roleName === "superadmin";
          const isAdministrator = roleName === "administrator";

          const isCreator =
            transaction.createdById === user.id;

          if (
            !isSuperAdmin &&
            !isAdministrator &&
            !isCreator
          ) {
            throw new Error("FORBIDDEN");
          }

          if (transaction.status !== "ACTIVE") {
            throw new Error("TRANSACTION_NOT_ACTIVE");
          }

          const dependentTransaction =
            await tx.transaction.findFirst({
              where: {
                companyId,
                spkId: transaction.spkId,
                productId: transaction.productId,
                status: "ACTIVE",
                OR: [
                  {
                    createdAt: {
                      gt: transaction.createdAt,
                    },
                  },
                  {
                    createdAt: transaction.createdAt,
                    id: {
                      gt: transaction.id,
                    },
                  },
                ],
              },
              select: {
                transactionNumber: true,
                transactionType: {
                  select: {
                    name: true,
                  },
                },
              },
              orderBy: [
                { createdAt: "asc" },
                { id: "asc" },
              ],
            });

          if (dependentTransaction) {
            throw new Error(
              `HAS_DEPENDENT_TRANSACTION:${dependentTransaction.transactionNumber}`
            );
          }

          // Jangan batalkan transaksi yang sudah dipakai
          // pada tagihan penjahit aktif.
          const billItem = await tx.tailorBillItem.findFirst({
            where: {
              spkId: transaction.spkId,
              productId: transaction.productId,
              bill: {
                companyId,
                status: {
                  in: ["SUBMITTED", "PAID"],
                },
              },
            },
            select: {
              id: true,
            },
          });

          if (billItem) {
            throw new Error("TRANSACTION_USED_IN_BILL");
          }

          // Conditional update mencegah pembatalan kedua
          // terhadap transaksi yang statusnya sudah berubah.
          const cancelledAt = new Date();

          const updated = await tx.transaction.updateMany({
            where: {
              id: transaction.id,
              companyId,
              status: "ACTIVE",
            },
            data: {
              status: "CANCELLED",
              cancelledAt,
              cancelledById: user.id,
              cancellationReason: reason,
            },
          });

          if (updated.count !== 1) {
            throw new Error("TRANSACTION_NOT_ACTIVE");
          }

          await tx.activityLog.create({
            data: {
              companyId,
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
            cancelledAt,
            cancelledById: user.id,
            cancellationReason: reason,
          };
        },
        {
          maxWait: 10000,
          timeout: 30000,
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        }
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
        return jsonError(
          "Transaksi tidak ditemukan.",
          404
        );
      }

      if (message === "FORBIDDEN") {
        return jsonError(
          "Hanya pembuat transaksi, administrator, atau Super Admin yang dapat membatalkan transaksi ini.",
          403
        );
      }

      if (message === "TRANSACTION_NOT_ACTIVE") {
        return jsonError(
          "Transaksi sudah dibatalkan atau tidak lagi aktif.",
          409
        );
      }

      if (message.startsWith("HAS_DEPENDENT_TRANSACTION:")) {
        const transactionNumber = message.split(":")[1];

        return jsonError(
          `Pembatalan ditolak karena terdapat transaksi lanjutan ${transactionNumber}.`,
          409
        );
      }

      if (message === "TRANSACTION_USED_IN_BILL") {
        return jsonError(
          "Pembatalan ditolak karena transaksi sudah digunakan pada tagihan penjahit.",
          409
        );
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        return jsonError(
          "Transaksi berubah bersamaan. Silakan muat ulang lalu coba lagi.",
          409
        );
      }

      console.error("Cancel transaction error:", error);

      return jsonError(
        "Gagal membatalkan transaksi.",
        500
      );
    }
  },
  {
    tenant: "required",
  }
);
