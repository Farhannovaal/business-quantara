import { requirePermission } from "@/lib/auth/authorization";

import { requireAuth } from "@/lib/auth/require-auth";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
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
          error: "Invalid workflow ID.",
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
          error: "Workflow not found.",
        },
        { status: 404 }
      );
    }

    const rules = await prisma.workflowRule.findMany({
      where: {
        workflowId,
      },
      orderBy: [
        {
          priority: "asc",
        },
        {
          id: "asc",
        },
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
      { status: 500 }
    );
  }
}

export async function POST(
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
    const { id } = await context.params;
    const workflowId = Number(id);

    if (!Number.isInteger(workflowId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid workflow ID.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const description =
      body.description == null
        ? null
        : String(body.description).trim();

    const condition = String(
      body.condition ?? ""
    ).trim();

    const action = String(
      body.action ?? ""
    ).trim();

    const priority = Number(body.priority ?? 0);

    const isActive =
      body.isActive === undefined
        ? true
        : Boolean(body.isActive);

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Rule name is required.",
        },
        { status: 400 }
      );
    }

    if (!condition) {
      return NextResponse.json(
        {
          success: false,
          error: "Condition is required.",
        },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: "Action is required.",
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(priority) || priority < 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Priority must be a non-negative integer.",
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
          error: "Workflow not found.",
        },
        { status: 404 }
      );
    }

    const rule = await prisma.workflowRule.create({
      data: {
        workflowId,
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
      { status: 201 }
    );
  } catch (error) {
    console.error("POST workflow rule error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create workflow rule.",
      },
      { status: 500 }
    );
  }
}