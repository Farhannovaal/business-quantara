import { requirePermission } from "@/lib/auth/authorization";

import { requireAuth } from "@/lib/auth/require-auth";

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

    const workflow = await prisma.workflow.findUnique({
      where: {
        id: workflowId,
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
      return NextResponse.json(
        {
          success: false,
          error: "Workflow not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    console.error(
      "GET /api/workflows/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load workflow",
      },
      { status: 500 }
    );
  }
}

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

    const data: {
      name?: string;
      code?: string;
      description?: string | null;
      isActive?: boolean;
    } = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error: "Workflow name cannot be empty",
          },
          { status: 400 }
        );
      }

      data.name = name;
    }

    if (body.code !== undefined) {
      const code = String(body.code).trim();

      if (!code) {
        return NextResponse.json(
          {
            success: false,
            error: "Workflow code cannot be empty",
          },
          { status: 400 }
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
      data.isActive = Boolean(body.isActive);
    }

    const workflow = await prisma.workflow.update({
      where: {
        id: workflowId,
      },
      data,
    });

    return NextResponse.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    console.error(
      "PATCH /api/workflows/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update workflow",
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

    await prisma.workflow.delete({
      where: {
        id: workflowId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "DELETE /api/workflows/[id] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete workflow",
      },
      { status: 500 }
    );
  }
}