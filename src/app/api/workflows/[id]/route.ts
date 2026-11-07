
import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

function parseCompanyId(value: string | null): number | null {
  if (!value) return null;

  const companyId = Number(value);

  if (!Number.isInteger(companyId) || companyId <= 0) {
    return null;
  }

  return companyId;
}

async function resolveCompanyId(
  request: NextRequest,
  user: {
    companyId?: number | null;
    role?: { name?: string | null } | null;
  },
): Promise<
  | { companyId: number; error?: never }
  | { companyId?: never; error: NextResponse }
> {
  if (isSuperAdmin(user)) {
    const companyIdParam =
      request.nextUrl.searchParams.get("companyId");

    const companyId = parseCompanyId(companyIdParam);

    if (!companyId) {
      return {
        error: jsonError(
          "Superadmin harus memilih companyId.",
          400,
        ),
      };
    }

    const company = await prisma.company.findUnique({
      where: {
        id: companyId,
      },
      select: {
        id: true,
      },
    });

    if (!company) {
      return {
        error: jsonError("Company tidak ditemukan.", 404),
      };
    }

    return { companyId };
  }

  if (user.companyId == null) {
    return {
      error: jsonError(
        "User belum terhubung dengan perusahaan.",
        403,
      ),
    };
  }

  // Tenant selalu menggunakan companyId dari session.
  return {
    companyId: user.companyId,
  };
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) return response;
  if (!user) return jsonError("Unauthorized.", 401);

  const permission = requirePermission(user, "workflow.view");
  if (permission.response) return permission.response;

  try {
    const { id } = await context.params;
    const workflowId = Number(id);

    if (!Number.isInteger(workflowId) || workflowId <= 0) {
      return jsonError("Invalid workflow ID", 400);
    }

    const companyResult = await resolveCompanyId(request, user);

    if (companyResult.error) {
      return companyResult.error;
    }

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        companyId: companyResult.companyId,
      },
      include: {
        steps: {
          include: {
            transactionType: true,
          },
          orderBy: {
            sequence: "asc",
          },
        },
        rules: {
          orderBy: [
            {
              priority: "asc",
            },
            {
              createdAt: "asc",
            },
          ],
        },
      },
    });

    if (!workflow) {
      return jsonError("Workflow not found", 404);
    }

    return NextResponse.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    console.error(
      "GET /api/workflows/[id] error:",
      error,
    );

    return jsonError("Failed to load workflow", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) return response;
  if (!user) return jsonError("Unauthorized.", 401);

  const permission = requirePermission(user, "workflow.manage");
  if (permission.response) return permission.response;

  try {
    const { id } = await context.params;
    const workflowId = Number(id);

    if (!Number.isInteger(workflowId) || workflowId <= 0) {
      return jsonError("Invalid workflow ID", 400);
    }

    const companyResult = await resolveCompanyId(request, user);

    if (companyResult.error) {
      return companyResult.error;
    }

    const ownershipWhere = {
      id: workflowId,
      companyId: companyResult.companyId,
    };

    const existingWorkflow = await prisma.workflow.findFirst({
      where: ownershipWhere,
    });

    if (!existingWorkflow) {
      return jsonError("Workflow not found", 404);
    }

    const body = await request.json();

    const data: {
      name?: string;
      code?: string;
      description?: string | null;
      isActive?: boolean;
    } = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();

      if (!name) {
        return jsonError(
          "Workflow name cannot be empty",
          400,
        );
      }

      data.name = name;
    }

    if (body.code !== undefined) {
      const code = String(body.code).trim();

      if (!code) {
        return jsonError(
          "Workflow code cannot be empty",
          400,
        );
      }

      data.code = code;
    }

    if (body.description !== undefined) {
      data.description =
        body.description === null
          ? null
          : String(body.description).trim();
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return jsonError(
          "isActive must be a boolean",
          400,
        );
      }

      data.isActive = body.isActive;
    }

    if (data.name !== undefined || data.code !== undefined) {
      const duplicate = await prisma.workflow.findFirst({
        where: {
          companyId: existingWorkflow.companyId,
          id: {
            not: workflowId,
          },
          OR: [
            ...(data.name !== undefined
              ? [{ name: data.name }]
              : []),
            ...(data.code !== undefined
              ? [{ code: data.code }]
              : []),
          ],
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        return jsonError(
          "Workflow name or code already exists in this company.",
          409,
        );
      }
    }

    const updated = await prisma.workflow.updateMany({
      where: ownershipWhere,
      data,
    });

    if (updated.count === 0) {
      return jsonError("Workflow not found", 404);
    }

    const workflow = await prisma.workflow.findFirst({
      where: ownershipWhere,
    });

    return NextResponse.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    console.error(
      "PATCH /api/workflows/[id] error:",
      error,
    );

    return jsonError("Failed to update workflow", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) return response;
  if (!user) return jsonError("Unauthorized.", 401);

  const permission = requirePermission(user, "workflow.manage");
  if (permission.response) return permission.response;

  try {
    const { id } = await context.params;
    const workflowId = Number(id);

    if (!Number.isInteger(workflowId) || workflowId <= 0) {
      return jsonError("Invalid workflow ID", 400);
    }

    const companyResult = await resolveCompanyId(request, user);

    if (companyResult.error) {
      return companyResult.error;
    }

    const ownershipWhere = {
      id: workflowId,
      companyId: companyResult.companyId,
    };

    const existingWorkflow = await prisma.workflow.findFirst({
      where: ownershipWhere,
      select: {
        id: true,
      },
    });

    if (!existingWorkflow) {
      return jsonError("Workflow not found", 404);
    }

    const deleted = await prisma.workflow.deleteMany({
      where: ownershipWhere,
    });

    if (deleted.count === 0) {
      return jsonError("Workflow not found", 404);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "DELETE /api/workflows/[id] error:",
      error,
    );

    return jsonError("Failed to delete workflow", 500);
  }
}
