
import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
    ruleId: string;
  }>;
};

type AuthenticatedUser = {
  id: number;
  companyId: number | null;
  role?: { name?: string | null } | null;
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

async function resolveRuleAccess(
  workflowId: number,
  ruleId: number,
  user: AuthenticatedUser,
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

  // Pastikan workflow memang milik perusahaan yang diakses.
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

  // WorkflowRule tidak memiliki companyId.
  // Isolasi tenant dilakukan melalui workflowId yang sudah tervalidasi.
  const rule = await prisma.workflowRule.findFirst({
    where: {
      id: ruleId,
      workflowId: workflow.id,
    },
  });

  if (!rule) {
    return {
      error: "Workflow rule not found.",
      status: 404,
    } as const;
  }

  return {
    workflow,
    rule,
  } as const;
}

export async function PATCH(
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

  const permission = requirePermission(
    user,
    "workflow.manage",
  );

  if (permission.response) return permission.response;

  try {
    const { id, ruleId } = await context.params;

    const workflowId = Number(id);
    const ruleIdNumber = Number(ruleId);

    if (
      !Number.isSafeInteger(workflowId) ||
      workflowId <= 0 ||
      !Number.isSafeInteger(ruleIdNumber) ||
      ruleIdNumber <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid ID.",
        },
        { status: 400 },
      );
    }

    const access = await resolveRuleAccess(
      workflowId,
      ruleIdNumber,
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

    const data: {
      name?: string;
      description?: string | null;
      condition?: string;
      action?: string;
      priority?: number;
      isActive?: boolean;
    } = {};

    if (body.name !== undefined) {
      const name =
        typeof body.name === "string"
          ? body.name.trim()
          : "";

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error: "Rule name cannot be empty.",
          },
          { status: 400 },
        );
      }

      data.name = name;
    }

    if (body.description !== undefined) {
      data.description =
        body.description == null
          ? null
          : String(body.description).trim();
    }

    if (body.condition !== undefined) {
      const condition =
        typeof body.condition === "string"
          ? body.condition.trim()
          : "";

      if (!condition) {
        return NextResponse.json(
          {
            success: false,
            error: "Condition cannot be empty.",
          },
          { status: 400 },
        );
      }

      data.condition = condition;
    }

    if (body.action !== undefined) {
      const action =
        typeof body.action === "string"
          ? body.action.trim()
          : "";

      if (!action) {
        return NextResponse.json(
          {
            success: false,
            error: "Action cannot be empty.",
          },
          { status: 400 },
        );
      }

      data.action = action;
    }

    if (body.priority !== undefined) {
      const priority = Number(body.priority);

      if (
        !Number.isSafeInteger(priority) ||
        priority < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Priority must be a non-negative integer.",
          },
          { status: 400 },
        );
      }

      data.priority = priority;
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid active status.",
          },
          { status: 400 },
        );
      }

      data.isActive = body.isActive;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No fields to update.",
        },
        { status: 400 },
      );
    }

    const updated = await prisma.workflowRule.updateMany({
      where: {
        id: access.rule.id,
        workflowId: access.workflow.id,
      },
      data,
    });

    if (updated.count !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow rule not found.",
        },
        { status: 404 },
      );
    }

    const rule = await prisma.workflowRule.findFirst({
      where: {
        id: access.rule.id,
        workflowId: access.workflow.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error("PATCH workflow rule error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update workflow rule.",
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
      { success: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  const permission = requirePermission(
    user,
    "workflow.manage",
  );

  if (permission.response) return permission.response;

  try {
    const { id, ruleId } = await context.params;

    const workflowId = Number(id);
    const ruleIdNumber = Number(ruleId);

    if (
      !Number.isSafeInteger(workflowId) ||
      workflowId <= 0 ||
      !Number.isSafeInteger(ruleIdNumber) ||
      ruleIdNumber <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid ID.",
        },
        { status: 400 },
      );
    }

    const access = await resolveRuleAccess(
      workflowId,
      ruleIdNumber,
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

    const deleted = await prisma.workflowRule.deleteMany({
      where: {
        id: access.rule.id,
        workflowId: access.workflow.id,
      },
    });

    if (deleted.count !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow rule not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Workflow rule deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE workflow rule error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete workflow rule.",
      },
      { status: 500 },
    );
  }
}
