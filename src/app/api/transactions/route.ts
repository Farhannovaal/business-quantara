import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {
  createTransaction,
  TransactionEngineError,
} from "@/lib/transaction/engine";

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
          { status: 400 },
        );
      }

      where.spkId = spkId;
    }

    if (transactionTypeIdParam) {
      const transactionTypeId = Number(
        transactionTypeIdParam,
      );

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
          { status: 400 },
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
        error: "Failed to load transactions.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(
    user,
    "transaction.create",
  );

  if (permission.response) {
    return permission.response;
  }

  try {
    const body = await request.json();

    const spkId = Number(body?.spkId);

    const transactionTypeId =
      Number(body?.transactionTypeId);

    const employeeId =
      Number(body?.employeeId);

    const quantity =
      Number(body?.quantity);

    /*
     * Basic request validation.
     *
     * Business validation seperti:
     * - SPK aktif
     * - transaction type aktif
     * - employee aktif
     * - product SPK
     * - tailor SPK
     * - transaction type yang diperbolehkan
     * - quantity maksimum
     *
     * semuanya ditangani oleh Transaction Engine.
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
        { status: 400 },
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
        { status: 400 },
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
        { status: 400 },
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
        { status: 400 },
      );
    }

    /*
     * Product dan tailor tidak diterima
     * dari client.
     *
     * Keduanya diambil dari SPK.
     *
     * Ini menjaga agar operator tidak bisa
     * membuat transaction dengan product/tailor
     * yang berbeda dari SPK.
     */
    const result =
      await prisma.$transaction(
        async (tx) => {
          const spk =
            await tx.sPK.findUnique({
              where: {
                id: spkId,
              },

              select: {
                productId: true,
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

          /*
           * Semua business rule transaction
           * diproses melalui Transaction Engine.
           */
          const transaction =
            await createTransaction(tx, {
              spkId,

              transactionTypeId,

              productId:
                spk.productId,

              tailorId:
                spk.tailorId,

              employeeId,

              quantity,

              createdById:
                user.id,
            });

          return transaction;
        },
      );

    /*
     * Response dibuat tetap mirip dengan
     * response API sebelumnya:
     *
     * success
     * data
     * transaction
     * SPK
     * transaction type
     * product
     * tailor
     * employee
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
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST transaction error:",
      error,
    );

    /*
     * Error dari Transaction Engine
     * dikembalikan ke client dengan status
     * dan message yang sesuai.
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
     * Unexpected error.
     */
    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to create transaction.",
      },
      { status: 500 },
    );
  }
}