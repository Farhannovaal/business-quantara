
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePermission } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
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
      error: "Workflow not found.",
      status: 404,
    } as const;
  }

  return { workflow } as const;
}

export async function GET(
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

  const permission = requirePermission(user, "workflow.view");

  if (permission.response) {
    return permission.response;
  }

  try {
    const { id } = await context.params;
    const workflowId = Number(id);

    if (!Number.isSafeInteger(workflowId) || workflowId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workflow ID",
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

    const steps = await prisma.workflowStep.findMany({
      where: {
        workflowId: access.workflow.id,
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
      { status: 500 },
    );
  }
}

export async function POST(
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
    const { id } = await context.params;
    const workflowId = Number(id);

    if (!Number.isSafeInteger(workflowId) || workflowId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workflow ID",
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

    const transactionTypeId = Number(input.transactionTypeId);
    const sequence = Number(input.sequence);

    const isRequired = input.isRequired !== false;
    const isActive = input.isActive !== false;

    if (
      !Number.isSafeInteger(transactionTypeId) ||
      transactionTypeId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction type is required",
        },
        { status: 400 },
      );
    }

    if (!Number.isSafeInteger(sequence) || sequence < 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Sequence must be a positive integer",
        },
        { status: 400 },
      );
    }

    if (
      (input.isRequired !== undefined &&
        typeof input.isRequired !== "boolean") ||
      (input.isActive !== undefined &&
        typeof input.isActive !== "boolean")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid step status.",
        },
        { status: 400 },
      );
    }

    // TransactionType harus berasal dari perusahaan yang sama
    // dengan Workflow yang sedang dikelola.
    const transactionType =
      await prisma.transactionType.findFirst({
        where: {
          id: transactionTypeId,
          companyId: access.workflow.companyId,
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

    const existingSequence =
      await prisma.workflowStep.findFirst({
        where: {
          workflowId: access.workflow.id,
          sequence,
        },
      });

    if (existingSequence) {
      return NextResponse.json(
        {
          success: false,
          error: `Sequence ${sequence} already exists in this workflow`,
        },
        { status: 409 },
      );
    }

    const existingTransactionType =
      await prisma.workflowStep.findFirst({
        where: {
          workflowId: access.workflow.id,
          transactionTypeId,
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

    const step = await prisma.workflowStep.create({
      data: {
        workflowId: access.workflow.id,
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
      { status: 201 },
    );
  } catch (error) {
    console.error("POST workflow step error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create workflow step",
      },
      { status: 500 },
    );
  }
}
