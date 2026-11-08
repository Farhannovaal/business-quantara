
import { NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function jsonError(error: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

// PATCH: Update transaction type.
export const PATCH = withApiAuth<RouteContext>(
  async ({ request, context, tenant }) => {
    const companyId = tenant!.id;

    try {
      const { id } = await context.params;
      const transactionTypeId = Number(id);

      if (
        !Number.isInteger(transactionTypeId) ||
        transactionTypeId <= 0
      ) {
        return jsonError(
          "Invalid transaction type ID",
          400
        );
      }

      const ownershipWhere = {
        id: transactionTypeId,
        companyId,
      };

      const existingTransactionType =
        await prisma.transactionType.findFirst({
          where: ownershipWhere,
        });

      if (!existingTransactionType) {
        return jsonError(
          "Transaction type not found",
          404
        );
      }

      const body = await request.json();

      const data: {
        code?: string;
        name?: string;
        description?: string | null;
        sequence?: number;
        isActive?: boolean;
      } = {};

      if (body.code !== undefined) {
        const code = String(body.code).trim();

        if (!code) {
          return jsonError(
            "Code cannot be empty",
            400
          );
        }

        data.code = code;
      }

      if (body.name !== undefined) {
        const name = String(body.name).trim();

        if (!name) {
          return jsonError(
            "Name cannot be empty",
            400
          );
        }

        data.name = name;
      }

      if (body.description !== undefined) {
        data.description =
          body.description === null
            ? null
            : String(body.description).trim();
      }

      if (body.sequence !== undefined) {
        const sequence = Number(body.sequence);

        if (
          !Number.isInteger(sequence) ||
          sequence < 0
        ) {
          return jsonError(
            "Sequence must be a non-negative integer",
            400
          );
        }

        data.sequence = sequence;
      }

      if (body.isActive !== undefined) {
        if (typeof body.isActive !== "boolean") {
          return jsonError(
            "isActive must be a boolean",
            400
          );
        }

        data.isActive = body.isActive;
      }

      if (
        data.code !== undefined ||
        data.name !== undefined
      ) {
        const duplicate =
          await prisma.transactionType.findFirst({
            where: {
              companyId,
              id: {
                not: transactionTypeId,
              },
              OR: [
                ...(data.code !== undefined
                  ? [{ code: data.code }]
                  : []),
                ...(data.name !== undefined
                  ? [{ name: data.name }]
                  : []),
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
      }

      const updated = await prisma.transactionType.updateMany({
        where: ownershipWhere,
        data,
      });

      if (updated.count === 0) {
        return jsonError(
          "Transaction type not found",
          404
        );
      }

      const transactionType =
        await prisma.transactionType.findFirst({
          where: ownershipWhere,
        });

      return NextResponse.json({
        success: true,
        data: transactionType,
      });
    } catch (error) {
      console.error(
        "PATCH /api/transaction-types/[id] error:",
        error
      );

      return jsonError(
        "Failed to update transaction type",
        500
      );
    }
  },
  {
    tenant: "required",
    permission: "transaction.manage",
  }
);

// DELETE: Menghapus transaction type jika belum digunakan.
export const DELETE = withApiAuth<RouteContext>(
  async ({ context, tenant }) => {
    const companyId = tenant!.id;

    try {
      const { id } = await context.params;
      const transactionTypeId = Number(id);

      if (
        !Number.isInteger(transactionTypeId) ||
        transactionTypeId <= 0
      ) {
        return jsonError(
          "Invalid transaction type ID",
          400
        );
      }

      const ownershipWhere = {
        id: transactionTypeId,
        companyId,
      };

      const existingTransactionType =
        await prisma.transactionType.findFirst({
          where: ownershipWhere,
        });

      if (!existingTransactionType) {
        return jsonError(
          "Transaction type not found",
          404
        );
      }

      const [transactionCount, workflowStepCount] =
        await Promise.all([
          prisma.transaction.count({
            where: {
              transactionTypeId,
            },
          }),

          prisma.workflowStep.count({
            where: {
              transactionTypeId,
            },
          }),
        ]);

      if (
        transactionCount > 0 ||
        workflowStepCount > 0
      ) {
        return jsonError(
          "Transaction type cannot be deleted because it is already used. Deactivate it instead.",
          409
        );
      }

      const deleted = await prisma.transactionType.deleteMany({
        where: ownershipWhere,
      });

      if (deleted.count === 0) {
        return jsonError(
          "Transaction type not found",
          404
        );
      }

      return NextResponse.json({
        success: true,
      });
    } catch (error) {
      console.error(
        "DELETE /api/transaction-types/[id] error:",
        error
      );

      return jsonError(
        "Failed to delete transaction type",
        500
      );
    }
  },
  {
    tenant: "required",
    permission: "transaction.manage",
  }
);
