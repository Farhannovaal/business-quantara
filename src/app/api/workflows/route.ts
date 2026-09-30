import { requirePermission } from "@/lib/auth/authorization";

import { requireAuth } from "@/lib/auth/require-auth";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
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
    const workflows = await prisma.workflow.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            steps: true,
            rules: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: workflows,
    });
  } catch (error) {
    console.error("GET /api/workflows error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load workflows",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "").trim();
    const description = body.description
      ? String(body.description).trim()
      : null;

    const isActive = body.isActive !== false;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow name is required",
        },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow code is required",
        },
        { status: 400 }
      );
    }

    const workflow = await prisma.workflow.create({
      data: {
        name,
        code,
        description,
        isActive,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: workflow,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/workflows error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create workflow",
      },
      { status: 500 }
    );
  }
}