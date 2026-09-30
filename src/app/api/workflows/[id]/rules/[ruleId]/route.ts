import { requirePermission } from "@/lib/auth/authorization";

import { requireAuth } from "@/lib/auth/require-auth";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
    ruleId: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
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
    const { id, ruleId } = await context.params;

    const workflowId = Number(id);
    const ruleIdNumber = Number(ruleId);

    if (
      !Number.isInteger(workflowId) ||
      !Number.isInteger(ruleIdNumber)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid ID.",
        },
        { status: 400 }
      );
    }

    const existingRule =
      await prisma.workflowRule.findFirst({
        where: {
          id: ruleIdNumber,
          workflowId,
        },
      });

    if (!existingRule) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow rule not found.",
        },
        { status: 404 }
      );
    }

    const body = await request.json();

    const data: {
      name?: string;
      description?: string | null;
      condition?: string;
      action?: string;
      priority?: number;
      isActive?: boolean;
    } = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error: "Rule name cannot be empty.",
          },
          { status: 400 }
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
      const condition = String(
        body.condition
      ).trim();

      if (!condition) {
        return NextResponse.json(
          {
            success: false,
            error: "Condition cannot be empty.",
          },
          { status: 400 }
        );
      }

      data.condition = condition;
    }

    if (body.action !== undefined) {
      const action = String(
        body.action
      ).trim();

      if (!action) {
        return NextResponse.json(
          {
            success: false,
            error: "Action cannot be empty.",
          },
          { status: 400 }
        );
      }

      data.action = action;
    }

    if (body.priority !== undefined) {
      const priority = Number(body.priority);

      if (
        !Number.isInteger(priority) ||
        priority < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Priority must be a non-negative integer.",
          },
          { status: 400 }
        );
      }

      data.priority = priority;
    }

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const rule =
      await prisma.workflowRule.update({
        where: {
          id: ruleIdNumber,
        },
        data,
      });

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error(
      "PATCH workflow rule error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update workflow rule.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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
    const { id, ruleId } = await context.params;

    const workflowId = Number(id);
    const ruleIdNumber = Number(ruleId);

    if (
      !Number.isInteger(workflowId) ||
      !Number.isInteger(ruleIdNumber)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid ID.",
        },
        { status: 400 }
      );
    }

    const existingRule =
      await prisma.workflowRule.findFirst({
        where: {
          id: ruleIdNumber,
          workflowId,
        },
      });

    if (!existingRule) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow rule not found.",
        },
        { status: 404 }
      );
    }

    await prisma.workflowRule.delete({
      where: {
        id: ruleIdNumber,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Workflow rule deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE workflow rule error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete workflow rule.",
      },
      { status: 500 }
    );
  }
}