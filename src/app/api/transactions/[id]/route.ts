
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
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
    { status }
  );
}

function getMaxQuantity(
  code: string,
  status: ReturnType<typeof calculateSPKStatus>,
  spkQuantity: number
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
        0
      );

    case "PENERIMAAN_RIJEK":
      return Math.max(
        status.totalPengirimanRijek -
          status.totalPenerimaanRijek,
        0
      );

    default:
      return null;
  }
}

function parsePositiveInteger(value: unknown): number | null {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export const PATCH = withApiAuth<RouteContext>(
  async ({ request, context, user, tenant }) => {
    const companyId = tenant!.id;

    const { id } = await context.params;
    const transactionId = parsePositiveInteger(id);

    if (transactionId === null) {
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

    if (
      !Number.isSafeInteger(input.quantity) ||
      input.quantity <= 0
    ) {
      return jsonError(
        "Jumlah harus berupa bilangan bulat lebih dari 0.",
        400
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
          // Ambil role dan companyId terbaru dari database.
          const currentUser = await tx.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              companyId: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          });

          if (!currentUser) {
            throw new Error("USER_NOT_FOUND");
          }

          const roleName =
            currentUser.role?.name?.toLowerCase() ?? "";

          const isSuperAdmin = roleName === "superadmin";
          const isAdministrator = roleName === "administrator";

          if (!isSuperAdmin && currentUser.companyId == null) {
            throw new Error("USER_COMPANY_REQUIRED");
          }

          // Pastikan user biasa tetap berada di perusahaan session.
          if (
            !isSuperAdmin &&
            currentUser.companyId !== companyId
          ) {
            throw new Error("FORBIDDEN");
          }

          // Transaksi wajib berasal dari tenant aktif.
          // Super Admin juga tidak dapat mengedit transaksi
          // milik perusahaan lain melalui ID langsung.
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
              spk: {
                select: {
                  id: true,
                  companyId: true,
                  status: true,
                  deletedAt: true,
                  spkNumber: true,
                  tailorId: true,
                  tailor: {
                    select: {
                      id: true,
                      companyId: true,
                    },
                  },
                  items: {
                    select: {
                      productId: true,
                      quantity: true,
                      product: {
                        select: {
                          id: true,
                          companyId: true,
                        },
                      },
                    },
                  },
                },
              },
              product: {
                select: {
                  id: true,
                  companyId: true,
                },
              },
              tailor: {
                select: {
                  id: true,
                  companyId: true,
                },
              },
            },
          });

          if (!transaction) {
            throw new Error("TRANSACTION_NOT_FOUND");
          }

          if (transaction.companyId == null) {
            throw new Error("TRANSACTION_COMPANY_REQUIRED");
          }

          const transactionCompanyId = transaction.companyId;

          // Role selain Super Admin hanya boleh mengedit
          // transaksi di perusahaan miliknya.
          if (
            !isSuperAdmin &&
            currentUser.companyId !== transactionCompanyId
          ) {
            throw new Error("FORBIDDEN");
          }

          const isCreator =
            transaction.createdById === currentUser.id;

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

          // Pastikan relasi transaksi dan SPK konsisten.
          const spk = transaction.spk;

          if (!spk || spk.deletedAt !== null) {
            throw new Error("SPK_NOT_FOUND");
          }

          if (
            spk.companyId == null ||
            spk.companyId !== transactionCompanyId
          ) {
            throw new Error("SPK_COMPANY_MISMATCH");
          }

          if (
            transaction.product.companyId !== transactionCompanyId ||
            transaction.tailor.companyId !== transactionCompanyId ||
            spk.tailor.companyId !== transactionCompanyId
          ) {
            throw new Error("RELATED_COMPANY_MISMATCH");
          }

          if (spk.status !== "ACTIVE") {
            throw new Error("SPK_NOT_ACTIVE");
          }

          const spkItem = spk.items.find(
            (item) => item.productId === transaction.productId
          );

          if (
            !spkItem ||
            spkItem.product.companyId !== transactionCompanyId
          ) {
            throw new Error("PRODUCT_NOT_IN_SPK");
          }

          // Cegah perubahan transaksi yang sudah memiliki transaksi lanjutan.
          const dependent = await tx.transaction.findFirst({
            where: {
              companyId: transactionCompanyId,
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
            },
            orderBy: [
              { createdAt: "asc" },
              { id: "asc" },
            ],
          });

          if (dependent) {
            throw new Error("HAS_DEPENDENT_TRANSACTION");
          }

          // Transaksi yang sudah masuk tagihan submitted/paid
          // tidak boleh diedit.
          const billItem = await tx.tailorBillItem.findFirst({
            where: {
              spkId: transaction.spkId,
              productId: transaction.productId,
              bill: {
                companyId: transactionCompanyId,
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

          // Karyawan harus aktif dan berasal dari perusahaan transaksi.
          const employee = await tx.employee.findFirst({
            where: {
              id: input.employeeId,
              companyId: transactionCompanyId,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
            },
          });

          if (!employee) {
            throw new Error("EMPLOYEE_NOT_AVAILABLE");
          }

          // Hitung ulang progres tanpa transaksi yang sedang diedit.
          const otherTransactions = await tx.transaction.findMany({
            where: {
              companyId: transactionCompanyId,
              spkId: transaction.spkId,
              productId: transaction.productId,
              status: "ACTIVE",
              id: {
                not: transaction.id,
              },
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
            otherTransactions as SPKTransactionForStatus[],
            spkItem.quantity
          );

          const maxQuantity = getMaxQuantity(
            transaction.transactionType.code,
            status,
            spkItem.quantity
          );

          if (
            maxQuantity !== null &&
            input.quantity > maxQuantity
          ) {
            throw new Error(`QUANTITY_EXCEEDS:${maxQuantity}`);
          }

          const quantityChanged =
            transaction.quantity !== input.quantity;

          const employeeChanged =
            transaction.employeeId !== input.employeeId;

          if (!quantityChanged && !employeeChanged) {
            return tx.transaction.findFirstOrThrow({
              where: {
                id: transaction.id,
                companyId: transactionCompanyId,
              },
              include: {
                spk: {
                  select: {
                    id: true,
                    spkNumber: true,
                  },
                },
                transactionType: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
                product: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
                tailor: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                employee: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            });
          }

          // Update tetap menggunakan filter companyId.
          const updatedTransaction = await tx.transaction.updateMany({
            where: {
              id: transaction.id,
              companyId: transactionCompanyId,
              status: "ACTIVE",
            },
            data: {
              quantity: input.quantity,
              employeeId: input.employeeId,
            },
          });

          if (updatedTransaction.count === 0) {
            throw new Error("TRANSACTION_NOT_FOUND");
          }

          const result = await tx.transaction.findFirstOrThrow({
            where: {
              id: transaction.id,
              companyId: transactionCompanyId,
            },
            include: {
              spk: {
                select: {
                  id: true,
                  spkNumber: true,
                },
              },
              transactionType: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
              tailor: {
                select: {
                  id: true,
                  name: true,
                },
              },
              employee: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });

          const changes: string[] = [];

          if (quantityChanged) {
            changes.push(
              `quantity: ${transaction.quantity} -> ${input.quantity}`
            );
          }

          if (employeeChanged) {
            changes.push(
              `employeeId: ${transaction.employeeId} -> ${input.employeeId}`
            );
          }

          // Activity log wajib memakai companyId transaksi.
          await tx.activityLog.create({
            data: {
              companyId: transactionCompanyId,
              userId: currentUser.id,
              action: "UPDATE",
              entityType: "Transaction",
              entityId: String(transaction.id),
              description:
                `Transaction ${transaction.transactionNumber} updated. ` +
                changes.join("; "),
            },
          });

          return result;
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
        message: "Transaksi berhasil diperbarui.",
        data: updated,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "";

      if (message === "USER_NOT_FOUND") {
        return jsonError("User tidak ditemukan.", 401);
      }

      if (message === "USER_COMPANY_REQUIRED") {
        return jsonError(
          "User belum terhubung dengan perusahaan.",
          403
        );
      }

      if (message === "TRANSACTION_NOT_FOUND") {
        return jsonError("Transaksi tidak ditemukan.", 404);
      }

      if (message === "TRANSACTION_COMPANY_REQUIRED") {
        return jsonError(
          "Transaksi belum memiliki perusahaan yang valid.",
          409
        );
      }

      if (message === "FORBIDDEN") {
        return jsonError(
          "Anda tidak memiliki akses untuk mengedit transaksi ini.",
          403
        );
      }

      if (message === "TRANSACTION_NOT_ACTIVE") {
        return jsonError(
          "Transaksi yang dibatalkan tidak dapat diedit.",
          409
        );
      }

      if (message === "SPK_NOT_FOUND") {
        return jsonError("SPK tidak ditemukan.", 404);
      }

      if (
        message === "SPK_COMPANY_MISMATCH" ||
        message === "RELATED_COMPANY_MISMATCH"
      ) {
        return jsonError(
          "Data transaksi tidak konsisten dengan perusahaan SPK.",
          409
        );
      }

      if (message === "HAS_DEPENDENT_TRANSACTION") {
        return jsonError(
          "Transaksi tidak dapat diedit karena sudah memiliki transaksi lanjutan.",
          409
        );
      }

      if (message === "TRANSACTION_USED_IN_BILL") {
        return jsonError(
          "Transaksi sudah digunakan pada tagihan penjahit.",
          409
        );
      }

      if (message === "EMPLOYEE_NOT_AVAILABLE") {
        return jsonError(
          "Karyawan tidak ditemukan, tidak aktif, atau bukan bagian dari perusahaan transaksi.",
          400
        );
      }

      if (message === "SPK_NOT_ACTIVE") {
        return jsonError(
          "SPK tidak aktif sehingga transaksi tidak dapat diedit.",
          409
        );
      }

      if (message === "PRODUCT_NOT_IN_SPK") {
        return jsonError(
          "Produk tidak ditemukan dalam SPK atau tidak sesuai dengan perusahaan SPK.",
          400
        );
      }

      if (message.startsWith("QUANTITY_EXCEEDS:")) {
        const maxQuantity = Number(message.split(":")[1]);

        return NextResponse.json(
          {
            success: false,
            error:
              `Jumlah melebihi sisa kuantitas yang tersedia (${maxQuantity}).`,
            maxQuantity,
          },
          { status: 400 }
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

      console.error(
        "PATCH /api/transactions/[id]:",
        error
      );

      return jsonError(
        "Gagal memperbarui transaksi.",
        500
      );
    }
  },
  {
    tenant: "required",
  }
);
