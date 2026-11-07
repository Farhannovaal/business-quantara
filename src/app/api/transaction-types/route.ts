
import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getAllowedTransactionTypes } from "@/lib/transaction/permissions";

function isSuperAdmin(user: {
  role?: { name?: string | null } | null;
}) {
  return user.role?.name?.toLowerCase() === "superadmin";
}

function jsonError(error: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status },
  );
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) return response;
  if (!user) return jsonError("Unauthorized.", 401);

  const permission = requirePermission(user, "transaction.view");
  if (permission.response) return permission.response;

  try {
    const superAdmin = isSuperAdmin(user);
    const forTransaction =
      request.nextUrl.searchParams.get("forTransaction") === "true";

    const companyIdParam =
      request.nextUrl.searchParams.get("companyId");

    let companyId: number;

    if (superAdmin) {
      if (!companyIdParam) {
        return jsonError(
          "Superadmin harus memilih companyId.",
          400,
        );
      }

      companyId = Number(companyIdParam);

      if (!Number.isInteger(companyId) || companyId <= 0) {
        return jsonError("Company ID tidak valid.", 400);
      }

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      });

      if (!company) {
        return jsonError("Company tidak ditemukan.", 404);
      }
    } else {
      if (user.companyId == null) {
        return jsonError(
          "User belum terhubung dengan perusahaan.",
          403,
        );
      }

      companyId = user.companyId;
    }

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
      error,
    );

    return jsonError(
      "Failed to load transaction types",
      500,
    );
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireAuth();

  if (response) return response;
  if (!user) return jsonError("Unauthorized.", 401);

  const permission = requirePermission(user, "transaction.manage");
  if (permission.response) return permission.response;

  try {
    const body = await request.json();
    const superAdmin = isSuperAdmin(user);

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
        400,
      );
    }

    if (!name) {
      return jsonError(
        "Transaction type name is required",
        400,
      );
    }

    if (
      !Number.isInteger(sequence) ||
      sequence < 0
    ) {
      return jsonError(
        "Sequence must be a non-negative integer",
        400,
      );
    }

    let companyId: number;

    if (superAdmin) {
      companyId = Number(body.companyId);

      if (!Number.isInteger(companyId) || companyId <= 0) {
        return jsonError(
          "Superadmin harus menentukan companyId.",
          400,
        );
      }

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      });

      if (!company) {
        return jsonError("Company tidak ditemukan.", 404);
      }
    } else {
      if (user.companyId == null) {
        return jsonError(
          "User belum terhubung dengan perusahaan.",
          403,
        );
      }

      companyId = user.companyId;
    }

    const duplicate = await prisma.transactionType.findFirst({
      where: {
        companyId,
        OR: [
          { code },
          { name },
        ],
      },
      select: { id: true },
    });

    if (duplicate) {
      return jsonError(
        "Transaction type code or name already exists in this company.",
        409,
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
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/transaction-types error:",
      error,
    );

    return jsonError(
      "Failed to create transaction type",
      500,
    );
  }
}
