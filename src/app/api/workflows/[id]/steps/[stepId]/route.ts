
import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
    stepId: string;
  }>;
};

async function resolveWorkflowAccess(
  workflowId: number,
  user: {
    id: number;
    companyId: number | null;
    role?: { name?: string | null } | null;
  },
  request: NextRequest,
) {
  const isSuperAdmin =
    user.role?.name?.toLowerCase() === "superadmin";

  let companyId: number;

  if (isSuperAdmin) {
    const requestedCompanyId = Number(
      request.nextUrl.searchParams.get("companyId"),
    );

    if (
      !Number.isSafeInteger(requestedCompanyId) ||
      requestedCompanyId <= 0
    ) {
      return {
        error: "Company ID wajib dipilih.",
        status: 400,
      } as const;
    }

    const company = await prisma.company.findUnique({
      where: { id: requestedCompanyId },
      select: { id: true },
    });

    if (!company) {
      return {
        error: "Perusahaan tidak ditemukan.",
        status: 404,
      } as const;
    }

    companyId = company.id;
  } else {
    if (user.companyId == null) {
      return {
        error: "User belum terhubung dengan perusahaan.",
        status: 403,
      } as const;
    }

    companyId = user.companyId;
  }

  const workflow = await prisma.workflow.findFirst({
    where: {
      id: workflowId,
      companyId,
    },
    select: {
      id: true,
      companyId: true,
    },
  });

  if (!workflow) {
    return {
      error: "Workflow not found",
      status: 404,
    } as const;
  }

  return { workflow } as const;
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) return response;

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  const permission = requirePermission(user, "workflow.manage");

  if (permission.response) {
    return permission.response;
  }

  try {
    const { id, stepId } = await context.params;

    const workflowId = Number(id);
    const workflowStepId = Number(stepId);

    if (
      !Number.isSafeInteger(workflowId) ||
      workflowId <= 0 ||
      !Number.isSafeInteger(workflowStepId) ||
      workflowStepId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workflow or step ID",
        },
        { status: 400 },
      );
    }

    const access = await resolveWorkflowAccess(
      workflowId,
      user,
      request,
    );

    if ("error" in access) {
      return NextResponse.json(
        {
          success: false,
          error: access.error,
        },
        { status: access.status },
      );
    }

    const body: unknown = await request.json();

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 },
      );
    }

    const input = body as Record<string, unknown>;

    const data: {
      transactionTypeId?: number;
      sequence?: number;
      isRequired?: boolean;
      isActive?: boolean;
    } = {};

    if (input.transactionTypeId !== undefined) {
      const transactionTypeId = Number(input.transactionTypeId);

      if (
        !Number.isSafeInteger(transactionTypeId) ||
        transactionTypeId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid transaction type",
          },
          { status: 400 },
        );
      }

      const transactionType =
        await prisma.transactionType.findFirst({
          where: {
            id: transactionTypeId,
            companyId: access.workflow.companyId,
          },
          select: {
            id: true,
          },
        });

      if (!transactionType) {
        return NextResponse.json(
          {
            success: false,
            error: "Transaction type not found for this company",
          },
          { status: 404 },
        );
      }

      data.transactionTypeId = transactionTypeId;
    }

    if (input.sequence !== undefined) {
      const sequence = Number(input.sequence);

      if (!Number.isSafeInteger(sequence) || sequence < 1) {
        return NextResponse.json(
          {
            success: false,
            error: "Sequence must be a positive integer",
          },
          { status: 400 },
        );
      }

      data.sequence = sequence;
    }

    if (input.isRequired !== undefined) {
      if (typeof input.isRequired !== "boolean") {
        return NextResponse.json(
          {
            success: false,
            error: "isRequired must be a boolean",
          },
          { status: 400 },
        );
      }

      data.isRequired = input.isRequired;
    }

    if (input.isActive !== undefined) {
      if (typeof input.isActive !== "boolean") {
        return NextResponse.json(
          {
            success: false,
            error: "isActive must be a boolean",
          },
          { status: 400 },
        );
      }

      data.isActive = input.isActive;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No fields to update",
        },
        { status: 400 },
      );
    }

    const existingStep =
      await prisma.workflowStep.findFirst({
        where: {
          id: workflowStepId,
          workflowId: access.workflow.id,
        },
      });

    if (!existingStep) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow step not found",
        },
        { status: 404 },
      );
    }

    if (data.sequence !== undefined) {
      const existingSequence =
        await prisma.workflowStep.findFirst({
          where: {
            workflowId: access.workflow.id,
            sequence: data.sequence,
            NOT: {
              id: workflowStepId,
            },
          },
        });

      if (existingSequence) {
        return NextResponse.json(
          {
            success: false,
            error: `Sequence ${data.sequence} already exists in this workflow`,
          },
          { status: 409 },
        );
      }
    }

    if (data.transactionTypeId !== undefined) {
      const existingTransactionType =
        await prisma.workflowStep.findFirst({
          where: {
            workflowId: access.workflow.id,
            transactionTypeId: data.transactionTypeId,
            NOT: {
              id: workflowStepId,
            },
          },
        });

      if (existingTransactionType) {
        return NextResponse.json(
          {
            success: false,
            error: "This transaction type is already in the workflow",
          },
          { status: 409 },
        );
      }
    }

    const updated = await prisma.workflowStep.updateMany({
      where: {
        id: workflowStepId,
        workflowId: access.workflow.id,
      },
      data,
    });

    if (updated.count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow step not found",
        },
        { status: 404 },
      );
    }

    const step = await prisma.workflowStep.findFirst({
      where: {
        id: workflowStepId,
        workflowId: access.workflow.id,
      },
      include: {
        transactionType: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: step,
    });
  } catch (error) {
    console.error("PATCH workflow step error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update workflow step",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) return response;

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  const permission = requirePermission(user, "workflow.manage");

  if (permission.response) {
    return permission.response;
  }

  try {
    const { id, stepId } = await context.params;

    const workflowId = Number(id);
    const workflowStepId = Number(stepId);

    if (
      !Number.isSafeInteger(workflowId) ||
      workflowId <= 0 ||
      !Number.isSafeInteger(workflowStepId) ||
      workflowStepId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workflow or step ID",
        },
        { status: 400 },
      );
    }

    const access = await resolveWorkflowAccess(
      workflowId,
      user,
      request,
    );

    if ("error" in access) {
      return NextResponse.json(
        {
          success: false,
          error: access.error,
        },
        { status: access.status },
      );
    }

    const existingStep =
      await prisma.workflowStep.findFirst({
        where: {
          id: workflowStepId,
          workflowId: access.workflow.id,
        },
      });

    if (!existingStep) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow step not found",
        },
        { status: 404 },
      );
    }

    await prisma.workflowStep.deleteMany({
      where: {
        id: workflowStepId,
        workflowId: access.workflow.id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE workflow step error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete workflow step",
      },
      { status: 500 },
    );
  }
}
