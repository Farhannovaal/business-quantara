import { requireAuth } from "@/lib/auth/require-auth";
import { requirePermission } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }
  const permission = requirePermission(
    user,
    "workflow.view"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const { id } = await context.params;
    const workflowId = Number(id);

    if (!Number.isInteger(workflowId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workflow ID",
        },
        { status: 400 }
      );
    }

    const steps = await prisma.workflowStep.findMany({
      where: {
        workflowId,
      },
      include: {
        transactionType: true,
      },
      orderBy: {
        sequence: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      data: steps,
    });
  } catch (error) {
    console.error("GET workflow steps error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load workflow steps",
      },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const { id } = await context.params;
    const workflowId = Number(id);

    if (!Number.isInteger(workflowId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workflow ID",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const transactionTypeId = Number(body.transactionTypeId);
    const sequence = Number(body.sequence);

    const isRequired = body.isRequired !== false;
    const isActive = body.isActive !== false;

    if (!Number.isInteger(transactionTypeId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction type is required",
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(sequence) || sequence < 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Sequence must be a positive integer",
        },
        { status: 400 }
      );
    }

    const workflow = await prisma.workflow.findUnique({
      where: {
        id: workflowId,
      },
    });

    if (!workflow) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow not found",
        },
        { status: 404 }
      );
    }

    const transactionType =
      await prisma.transactionType.findUnique({
        where: {
          id: transactionTypeId,
        },
      });

    if (!transactionType) {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction type not found",
        },
        { status: 404 }
      );
    }

    const existingSequence =
      await prisma.workflowStep.findFirst({
        where: {
          workflowId,
          sequence,
        },
      });

    if (existingSequence) {
      return NextResponse.json(
        {
          success: false,
          error: `Sequence ${sequence} already exists in this workflow`,
        },
        { status: 409 }
      );
    }

    const existingTransactionType =
      await prisma.workflowStep.findFirst({
        where: {
          workflowId,
          transactionTypeId,
        },
      });

    if (existingTransactionType) {
      return NextResponse.json(
        {
          success: false,
          error: "This transaction type is already in the workflow",
        },
        { status: 409 }
      );
    }

    const step = await prisma.workflowStep.create({
      data: {
        workflowId,
        transactionTypeId,
        sequence,
        isRequired,
        isActive,
      },
      include: {
        transactionType: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: step,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST workflow step error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create workflow step",
      },
      { status: 500 }
    );
  }
}