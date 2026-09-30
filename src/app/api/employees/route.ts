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
    "employee.view"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const employees = await prisma.employee.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: employees,
    });
  } catch (error) {
    console.error("GET /api/employees error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load employees",
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
    "employee.manage"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const isActive = body.isActive !== false;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Employee name is required",
        },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        isActive,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: employee,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/employees error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create employee",
      },
      { status: 500 }
    );
  }
}