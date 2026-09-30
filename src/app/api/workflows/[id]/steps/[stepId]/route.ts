import { requirePermission } from "@/lib/auth/authorization";

import { requireAuth } from "@/lib/auth/require-auth";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
    stepId: string;
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
    "workflow.manage"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const { id, stepId } = await context.params;

    const workflowId = Number(id);
    const workflowStepId = Number(stepId);

    if (
      !Number.isInteger(workflowId) ||
      !Number.isInteger(workflowStepId)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workflow or step ID",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const data: {
      transactionTypeId?: number;
      sequence?: number;
      isRequired?: boolean;
      isActive?: boolean;
    } = {};

    if (body.transactionTypeId !== undefined) {
      const transactionTypeId = Number(
        body.transactionTypeId
      );

      if (!Number.isInteger(transactionTypeId)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid transaction type",
          },
          { status: 400 }
        );
      }

      data.transactionTypeId = transactionTypeId;
    }

    if (body.sequence !== undefined) {
      const sequence = Number(body.sequence);

      if (!Number.isInteger(sequence) || sequence < 1) {
        return NextResponse.json(
          {
            success: false,
            error: "Sequence must be a positive integer",
          },
          { status: 400 }
        );
      }

      data.sequence = sequence;
    }

    if (body.isRequired !== undefined) {
      data.isRequired = Boolean(body.isRequired);
    }

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const existingStep =
      await prisma.workflowStep.findFirst({
        where: {
          id: workflowStepId,
          workflowId,
        },
      });

    if (!existingStep) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow step not found",
        },
        { status: 404 }
      );
    }

    const step = await prisma.workflowStep.update({
      where: {
        id: workflowStepId,
      },
      data,
      include: {
        transactionType: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: step,
    });
  } catch (error) {
    console.error(
      "PATCH workflow step error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update workflow step",
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
    "workflow.manage"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const { id, stepId } = await context.params;

    const workflowId = Number(id);
    const workflowStepId = Number(stepId);

    if (
      !Number.isInteger(workflowId) ||
      !Number.isInteger(workflowStepId)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workflow or step ID",
        },
        { status: 400 }
      );
    }

    const existingStep =
      await prisma.workflowStep.findFirst({
        where: {
          id: workflowStepId,
          workflowId,
        },
      });

    if (!existingStep) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow step not found",
        },
        { status: 404 }
      );
    }

    await prisma.workflowStep.delete({
      where: {
        id: workflowStepId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "DELETE workflow step error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete workflow step",
      },
      { status: 500 }
    );
  }
}