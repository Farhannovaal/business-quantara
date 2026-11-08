
import { NextRequest, NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
import { getAllowedTransactionTypes } from "@/lib/transaction/permissions";

function jsonError(error: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

// GET: Mengambil transaction types berdasarkan perusahaan aktif.
export const GET = withApiAuth(
  async ({ request, user, tenant }) => {
    const companyId = tenant!.id;

    try {
      const forTransaction =
        request.nextUrl.searchParams.get("forTransaction") === "true";

      let allowedCodes: string[] | undefined;

      if (forTransaction) {
        allowedCodes = getAllowedTransactionTypes(user);
      }

      const transactionTypes =
        await prisma.transactionType.findMany({
          where: {
            companyId,
            ...(forTransaction
              ? {
                  isActive: true,
                  code: {
                    in: allowedCodes ?? [],
                  },
                }
              : {}),
          },
          orderBy: {
            sequence: "asc",
          },
        });

      return NextResponse.json({
        success: true,
        data: transactionTypes,
      });
    } catch (error) {
      console.error(
        "GET /api/transaction-types error:",
        error
      );

      return jsonError(
        "Failed to load transaction types",
        500
      );
    }
  },
  {
    tenant: "required",
    permission: "transaction.view",
  }
);

// POST: Membuat transaction type untuk perusahaan aktif.
export const POST = withApiAuth(
  async ({ request, tenant }) => {
    const companyId = tenant!.id;

    try {
      const body = await request.json();

      const code = String(body.code ?? "").trim();
      const name = String(body.name ?? "").trim();

      const description = body.description
        ? String(body.description).trim()
        : null;

      const sequence = Number(body.sequence ?? 0);
      const isActive = body.isActive !== false;

      if (!code) {
        return jsonError(
          "Transaction type code is required",
          400
        );
      }

      if (!name) {
        return jsonError(
          "Transaction type name is required",
          400
        );
      }

      if (
        !Number.isInteger(sequence) ||
        sequence < 0
      ) {
        return jsonError(
          "Sequence must be a non-negative integer",
          400
        );
      }

      const duplicate = await prisma.transactionType.findFirst({
        where: {
          companyId,
          OR: [
            { code },
            { name },
          ],
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        return jsonError(
          "Transaction type code or name already exists in this company.",
          409
        );
      }

      const transactionType =
        await prisma.transactionType.create({
          data: {
            companyId,
            code,
            name,
            description,
            sequence,
            isActive,
          },
        });

      return NextResponse.json(
        {
          success: true,
          data: transactionType,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error(
        "POST /api/transaction-types error:",
        error
      );

      return jsonError(
        "Failed to create transaction type",
        500
      );
    }
  },
  {
    tenant: "required",
    permission: "transaction.manage",
  }
);
