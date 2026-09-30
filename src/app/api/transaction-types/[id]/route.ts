import { requirePermission } from "@/lib/auth/authorization";

import { requireAuth } from "@/lib/auth/require-auth";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }
  const permission = requirePermission(
    user,
    "transaction.manage"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const { id } = await context.params;
    const transactionTypeId = Number(id);

    if (!Number.isInteger(transactionTypeId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid transaction type ID",
        },
        { status: 400 }
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
        return NextResponse.json(
          {
            success: false,
            error: "Code cannot be empty",
          },
          { status: 400 }
        );
      }

      data.code = code;
    }

    if (body.name !== undefined) {
      const name = String(body.name).trim();

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error: "Name cannot be empty",
          },
          { status: 400 }
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

      if (!Number.isInteger(sequence) || sequence < 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Sequence must be a non-negative integer",
          },
          { status: 400 }
        );
      }

      data.sequence = sequence;
    }

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const transactionType =
      await prisma.transactionType.update({
        where: {
          id: transactionTypeId,
        },
        data,
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

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update transaction type",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }
  const permission = requirePermission(
    user,
    "transaction.manage"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const { id } = await context.params;
    const transactionTypeId = Number(id);

    if (!Number.isInteger(transactionTypeId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid transaction type ID",
        },
        { status: 400 }
      );
    }

    const transactionCount =
      await prisma.transaction.count({
        where: {
          transactionTypeId,
        },
      });

    const workflowStepCount =
      await prisma.workflowStep.count({
        where: {
          transactionTypeId,
        },
      });

    if (transactionCount > 0 || workflowStepCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Transaction type cannot be deleted because it is already used. Deactivate it instead.",
        },
        { status: 409 }
      );
    }

    await prisma.transactionType.delete({
      where: {
        id: transactionTypeId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "DELETE /api/transaction-types/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete transaction type",
      },
      { status: 500 }
    );
  }
}