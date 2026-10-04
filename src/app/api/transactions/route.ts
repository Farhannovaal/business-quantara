import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createTransaction,
  TransactionEngineError,
} from "@/lib/transaction/engine";
import {
  canCreateTransactionType,
} from "@/lib/transaction/permissions";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(
    user,
    "transaction.view",
  );

  if (permission.response) {
    return permission.response;
  }

  try {
    const searchParams =
      request.nextUrl.searchParams;

    const search =
      searchParams.get("search")?.trim() || "";

    const spkIdParam =
      searchParams.get("spkId");

    const transactionTypeIdParam =
      searchParams.get("transactionTypeId");

    const where: {
      spkId?: number;
      transactionTypeId?: number;
      OR?: Array<{
        transactionNumber?: {
          contains: string;
        };
        spk?: {
          spkNumber?: {
            contains: string;
          };
        };
      }>;
    } = {};

    if (spkIdParam) {
      const spkId = Number(spkIdParam);

      if (
        !Number.isInteger(spkId) ||
        spkId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid SPK ID.",
          },
          {
            status: 400,
          },
        );
      }

      where.spkId = spkId;
    }

    if (transactionTypeIdParam) {
      const transactionTypeId =
        Number(transactionTypeIdParam);

      if (
        !Number.isInteger(transactionTypeId) ||
        transactionTypeId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid transaction type ID.",
          },
          {
            status: 400,
          },
        );
      }

      where.transactionTypeId =
        transactionTypeId;
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

    const transactions =
      await prisma.transaction.findMany({
        where,

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

    return NextResponse.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error(
      "GET transactions error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to load transactions.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  try {
    const body = await request.json();

    const spkId = Number(body?.spkId);

    const productId = Number(
      body?.productId,
    );

    const transactionTypeId =
      Number(body?.transactionTypeId);

    const employeeId =
      Number(body?.employeeId);

    const quantity =
      Number(body?.quantity);

    /*
     * ============================================================
     * BASIC REQUEST VALIDATION
     * ============================================================
     */

    if (
      !Number.isInteger(spkId) ||
      spkId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid SPK ID.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid product ID.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isInteger(transactionTypeId) ||
      transactionTypeId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid transaction type ID.",
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
          error: "Invalid employee ID.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Quantity must be a positive integer.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ============================================================
     * LOAD TRANSACTION TYPE
     * ============================================================
     *
     * Code transaction type tetap diambil dari database.
     * Client hanya mengirim ID.
     */

    const transactionType =
      await prisma.transactionType.findUnique({
        where: {
          id: transactionTypeId,
        },

        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      });

    if (!transactionType) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Transaction type not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (!transactionType.isActive) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Transaction type is inactive.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ============================================================
     * ROLE-BASED TRANSACTION AUTHORIZATION
     * ============================================================
     */

    const allowedByRole =
      canCreateTransactionType(
        user,
        transactionType.code,
      );

    if (!allowedByRole) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Anda tidak memiliki akses untuk melakukan jenis transaksi ini.",

          transactionType: {
            id: transactionType.id,
            code: transactionType.code,
            name: transactionType.name,
          },
        },
        {
          status: 403,
        },
      );
    }

    /*
     * ============================================================
     * TRANSACTION ENGINE
     * ============================================================
     *
     * Product sekarang dikirim secara eksplisit.
     *
     * Engine akan memastikan:
     *
     * - SPK valid
     * - SPK aktif
     * - product memang ada di SPK
     * - tailor sesuai SPK
     * - employee valid
     * - transaction flow valid
     * - quantity tidak melebihi maksimum
     * - status product sesuai workflow
     */

    const result =
      await prisma.$transaction(
        async (tx) => {
          const transaction =
            await createTransaction(tx, {
              spkId,

              transactionTypeId,

              productId,

              /*
               * Tailor tetap berasal dari SPK
               * dan diverifikasi kembali oleh engine.
               *
               * Karena engine membutuhkan tailorId,
               * ambil dari SPK.
               */
              tailorId:
                await getSPKTailorId(
                  tx,
                  spkId,
                ),

              employeeId,

              quantity,

              createdById: user.id,
            });

          return transaction;
        },
      );

    /*
     * ============================================================
     * RESPONSE
     * ============================================================
     */

    return NextResponse.json(
      {
        success: true,

        data: {
          id: result.id,

          transactionNumber:
            result.transactionNumber,

          quantity:
            result.quantity,

          createdAt:
            result.createdAt,

          spk: result.spk,

          transactionType:
            result.transactionType,

          product:
            result.product,

          tailor:
            result.tailor,

          employee:
            result.employee,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "POST transaction error:",
      error,
    );

    /*
     * ============================================================
     * TRANSACTION ENGINE ERROR
     * ============================================================
     */

    if (
      error instanceof
      TransactionEngineError
    ) {
      return NextResponse.json(
        {
          success: false,

          error: error.message,

          ...(error.maxQuantity !== undefined
            ? {
                maxQuantity:
                  error.maxQuantity,
              }
            : {}),
        },
        {
          status: error.status,
        },
      );
    }

    /*
     * ============================================================
     * UNEXPECTED ERROR
     * ============================================================
     */

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to create transaction.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
 * ================================================================
 * HELPER
 * ================================================================
 *
 * Tailor adalah property milik SPK.
 * Product bukan lagi property langsung SPK.
 *
 * Kita hanya mengambil tailorId di sini.
 * Validasi product dilakukan oleh createTransaction().
 */

async function getSPKTailorId(
  tx: Parameters<
    Parameters<typeof prisma.$transaction>[0]
  >[0],
  spkId: number,
): Promise<number> {
  const spk = await tx.sPK.findUnique({
    where: {
      id: spkId,
    },

    select: {
      tailorId: true,
    },
  });

  if (!spk) {
    throw new TransactionEngineError(
      "SPK_NOT_FOUND",
      "SPK not found.",
      404,
    );
  }

  return spk.tailorId;
}