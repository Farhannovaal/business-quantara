
import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function isObjectBody(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

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
      error: "Workflow tidak ditemukan.",
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
      { success: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  const permission = requirePermission(user, "workflow.view");
  if (permission.response) return permission.response;

  try {
    const { id } = await context.params;
    const workflowId = Number(id);

    if (!Number.isSafeInteger(workflowId) || workflowId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workflow ID.",
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

    const rules = await prisma.workflowRule.findMany({
      where: {
        workflowId: access.workflow.id,
      },
      orderBy: [
        { priority: "asc" },
        { id: "asc" },
      ],
    });

    return NextResponse.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error("GET workflow rules error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load workflow rules.",
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
      { success: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  const permission = requirePermission(user, "workflow.manage");
  if (permission.response) return permission.response;

  try {
    const { id } = await context.params;
    const workflowId = Number(id);

    if (!Number.isSafeInteger(workflowId) || workflowId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workflow ID.",
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

    if (!isObjectBody(body)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 },
      );
    }

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const description =
      body.description == null
        ? null
        : String(body.description).trim();

    const condition =
      typeof body.condition === "string"
        ? body.condition.trim()
        : "";

    const action =
      typeof body.action === "string"
        ? body.action.trim()
        : "";

    const priority =
      body.priority === undefined
        ? 0
        : Number(body.priority);

    const isActive =
      body.isActive === undefined
        ? true
        : body.isActive;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Rule name is required.",
        },
        { status: 400 },
      );
    }

    if (!condition) {
      return NextResponse.json(
        {
          success: false,
          error: "Condition is required.",
        },
        { status: 400 },
      );
    }

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: "Action is required.",
        },
        { status: 400 },
      );
    }

    if (!Number.isSafeInteger(priority) || priority < 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Priority must be a non-negative integer.",
        },
        { status: 400 },
      );
    }

    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid active status.",
        },
        { status: 400 },
      );
    }

    const rule = await prisma.workflowRule.create({
      data: {
        workflowId: access.workflow.id,
        name,
        description,
        condition,
        action,
        priority,
        isActive,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: rule,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST workflow rule error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create workflow rule.",
      },
      { status: 500 },
    );
  }
}
