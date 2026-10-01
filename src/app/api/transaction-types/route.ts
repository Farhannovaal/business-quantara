import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

import {
  getAllowedTransactionTypes,
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
    const forTransaction =
      request.nextUrl.searchParams.get(
        "forTransaction",
      ) === "true";

    /*
     * Default:
     * /api/transaction-types
     *
     * Digunakan oleh Master Transaction Types,
     * Workflow, dan kebutuhan administrasi lainnya.
     *
     * Semua transaction type tetap dikembalikan.
     */

    let where:
      | undefined
      | {
          isActive?: boolean;
          code?: {
            in: string[];
          };
        };

    /*
     * Jika dipanggil dari halaman transaksi:
     *
     * /api/transaction-types?forTransaction=true
     *
     * Maka hanya transaction type yang boleh dilakukan
     * oleh role user yang dikembalikan.
     */

    if (forTransaction) {
      const allowedTransactionTypes =
        getAllowedTransactionTypes(user);

      where = {
        isActive: true,
        code: {
          in: allowedTransactionTypes,
        },
      };
    }

    const transactionTypes =
      await prisma.transactionType.findMany({
        where,

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
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to load transaction types",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(
    user,
    "transaction.manage",
  );

  if (permission.response) {
    return permission.response;
  }

  try {
    const body = await request.json();

    const code = String(
      body.code ?? "",
    ).trim();

    const name = String(
      body.name ?? "",
    ).trim();

    const description = body.description
      ? String(body.description).trim()
      : null;

    const sequence = Number(
      body.sequence ?? 0,
    );

    const isActive =
      body.isActive !== false;

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Transaction type code is required",
        },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Transaction type name is required",
        },
        { status: 400 },
      );
    }

    if (
      !Number.isInteger(sequence) ||
      sequence < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Sequence must be a non-negative integer",
        },
        { status: 400 },
      );
    }

    const transactionType =
      await prisma.transactionType.create({
        data: {
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
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/transaction-types error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to create transaction type",
      },
      { status: 500 },
    );
  }
}