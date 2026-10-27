
import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

import {
  createTransaction,
  TransactionEngineError,
} from "@/lib/transaction/engine";

import { canCreateTransactionType } from "@/lib/transaction/permissions";

type BatchItem = {
  productId: number;
  quantity: number;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status },
  );
}

async function isSuperAdmin(userId: number): Promise<boolean> {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  return currentUser?.role?.name?.toLowerCase() === "superadmin";
}

/**
 * GET: mengambil transaksi sesuai cakupan perusahaan pengguna.
 */
export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response || !user) {
    return response ?? jsonError("Unauthorized.", 401);
  }

  const permission = requirePermission(user, "transaction.view");

  if (permission.response) {
    return permission.response;
  }

  try {
    const superAdmin = await isSuperAdmin(user.id);

    if (!superAdmin && user.companyId == null) {
      return jsonError(
        "User belum terhubung dengan perusahaan.",
        403,
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() || "";
    const spkIdParam = searchParams.get("spkId");
    const transactionTypeIdParam =
      searchParams.get("transactionTypeId");

    const where: {
      spkId?: number;
      transactionTypeId?: number;
      OR?: Array<
        | { transactionNumber: { contains: string } }
        | { spk: { spkNumber: { contains: string } } }
      >;
    } = {};

    if (spkIdParam) {
      const spkId = Number(spkIdParam);

      if (!Number.isSafeInteger(spkId) || spkId <= 0) {
        return jsonError("Invalid SPK ID.", 400);
      }

      where.spkId = spkId;
    }

    if (transactionTypeIdParam) {
      const transactionTypeId = Number(transactionTypeIdParam);

      if (
        !Number.isSafeInteger(transactionTypeId) ||
        transactionTypeId <= 0
      ) {
        return jsonError("Invalid transaction type ID.", 400);
      }

      where.transactionTypeId = transactionTypeId;
    }

    if (search) {
      where.OR = [
        {
          transactionNumber: {
            contains: search,
          },
        },
        {
          spk: {
            spkNumber: {
              contains: search,
            },
          },
        },
      ];
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        ...where,

        // User biasa hanya dapat membaca transaksi perusahaannya.
        ...(superAdmin ? {} : { companyId: user.companyId! }),

        // Jangan tampilkan transaksi yang SPK-nya sudah dihapus.
        spk: {
          is: {
            deletedAt: null,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
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

    const transactionIds = transactions.map((item) =>
      String(item.id),
    );

    const activityCompanyFilter = superAdmin
      ? {}
      : { companyId: user.companyId! };

    const [editCounts, activityCounts] = transactionIds.length
      ? await Promise.all([
          prisma.activityLog.groupBy({
            by: ["entityId"],
            where: {
              ...activityCompanyFilter,
              entityType: "Transaction",
              entityId: {
                in: transactionIds,
              },
              action: "UPDATE",
            },
            _count: {
              _all: true,
            },
          }),

          prisma.activityLog.groupBy({
            by: ["entityId"],
            where: {
              ...activityCompanyFilter,
              entityType: "Transaction",
              entityId: {
                in: transactionIds,
              },
            },
            _count: {
              _all: true,
            },
          }),
        ])
      : [[], []];

    const editCountById = new Map(
      editCounts.map((item) => [
        item.entityId,
        item._count._all,
      ]),
    );

    const activityCountById = new Map(
      activityCounts.map((item) => [
        item.entityId,
        item._count._all,
      ]),
    );

    const transactionsWithActivity = transactions.map(
      (transaction) => ({
        ...transaction,
        editCount:
          editCountById.get(String(transaction.id)) ?? 0,
        activityCount:
          activityCountById.get(String(transaction.id)) ?? 0,
      }),
    );

    return NextResponse.json({
      success: true,
      data: transactionsWithActivity,
    });
  } catch (error) {
    console.error("GET transactions error:", error);

    return jsonError("Failed to load transactions.", 500);
  }
}

/**
 * POST: membuat transaksi dengan companyId berdasarkan SPK,
 * bukan berdasarkan input dari client.
 */
export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response || !user) {
    return response ?? jsonError("Unauthorized.", 401);
  }

  try {
    const superAdmin = await isSuperAdmin(user.id);

    if (!superAdmin && user.companyId == null) {
      return jsonError(
        "User belum terhubung dengan perusahaan.",
        403,
      );
    }

    const body: unknown = await request.json();

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return jsonError("Format data tidak valid.", 400);
    }

    const input = body as Record<string, unknown>;

    const spkId = Number(input.spkId);
    const transactionTypeId = Number(input.transactionTypeId);
    const employeeId = Number(input.employeeId);

    // Format batch tetap didukung.
    // Format lama productId + quantity juga tetap didukung.
    const items: BatchItem[] = Array.isArray(input.items)
      ? input.items.map((item) => {
          const value =
            item !== null &&
            typeof item === "object" &&
            !Array.isArray(item)
              ? (item as Record<string, unknown>)
              : {};

          return {
            productId: Number(value.productId),
            quantity: Number(value.quantity),
          };
        })
      : [
          {
            productId: Number(input.productId),
            quantity: Number(input.quantity),
          },
        ];

    if (!Number.isSafeInteger(spkId) || spkId <= 0) {
      return jsonError("Invalid SPK ID.", 400);
    }

    if (
      !Number.isSafeInteger(transactionTypeId) ||
      transactionTypeId <= 0
    ) {
      return jsonError("Invalid transaction type ID.", 400);
    }

    if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
      return jsonError("Invalid employee ID.", 400);
    }

    if (items.length === 0) {
      return jsonError("Pilih minimal satu produk.", 400);
    }

    if (
      items.some(
        (item) =>
          !Number.isSafeInteger(item.productId) ||
          item.productId <= 0 ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity <= 0,
      )
    ) {
      return jsonError(
        "Setiap produk harus memiliki ID valid dan jumlah bulat lebih dari 0.",
        400,
      );
    }

    if (
      new Set(items.map((item) => item.productId)).size !==
      items.length
    ) {
      return jsonError(
        "Produk yang sama tidak boleh dimasukkan dua kali.",
        400,
      );
    }

    const results = await prisma.$transaction(
      async (tx) => {
        // Batasi pencarian SPK untuk user biasa.
        const spk = await tx.sPK.findFirst({
          where: {
            id: spkId,
            deletedAt: null,
            ...(superAdmin
              ? {}
              : { companyId: user.companyId! }),
          },
          select: {
            id: true,
            companyId: true,
            tailorId: true,
          },
        });

        if (!spk) {
          throw new TransactionEngineError(
            "SPK_NOT_FOUND",
            "SPK tidak ditemukan atau tidak dapat diakses.",
            404,
          );
        }

        if (spk.companyId == null) {
          throw new TransactionEngineError(
            "INVALID_COMPANY",
            "SPK belum terhubung dengan perusahaan.",
            400,
          );
        }

        // Jenis transaksi harus berasal dari perusahaan SPK.
        const transactionType =
          await tx.transactionType.findFirst({
            where: {
              id: transactionTypeId,
              companyId: spk.companyId,
            },
            select: {
              id: true,
              companyId: true,
              code: true,
              name: true,
              isActive: true,
            },
          });

        if (!transactionType) {
          throw new TransactionEngineError(
            "TRANSACTION_TYPE_NOT_FOUND",
            "Jenis transaksi tidak ditemukan untuk perusahaan ini.",
            404,
          );
        }

        if (!transactionType.isActive) {
          throw new TransactionEngineError(
            "TRANSACTION_TYPE_INACTIVE",
            "Transaction type is inactive.",
            400,
          );
        }

        if (!canCreateTransactionType(user, transactionType.code)) {
          throw new TransactionEngineError(
            "TRANSACTION_TYPE_FORBIDDEN",
            "Anda tidak memiliki akses untuk melakukan jenis transaksi ini.",
            403,
          );
        }

        const created = [];

        for (const item of items) {
          const transaction = await createTransaction(tx, {
            spkId,
            transactionTypeId,
            productId: item.productId,
            tailorId: spk.tailorId,
            employeeId,
            quantity: item.quantity,
            createdById: user.id,
          });

          // Engine harus memastikan produk, tailor, karyawan,
          // dan jenis transaksi sesuai dengan companyId SPK.
          // companyId tidak diterima dari client.
          if (transaction.companyId !== spk.companyId) {
            throw new TransactionEngineError(
              "COMPANY_MISMATCH",
              "Perusahaan transaksi tidak sesuai dengan perusahaan SPK.",
              400,
            );
          }

          created.push(transaction);
        }

        return created;
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );

    return NextResponse.json(
      {
        success: true,
        data: results,
        count: results.length,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof TransactionEngineError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          ...(error.maxQuantity !== undefined
            ? { maxQuantity: error.maxQuantity }
            : {}),
        },
        { status: error.status },
      );
    }

    console.error("POST transaction error:", error);

    return jsonError("Failed to create transaction.", 500);
  }
}