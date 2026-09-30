import { requirePermission } from "@/lib/auth/authorization";

import { requireAuth } from "@/lib/auth/require-auth";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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
    "employee.manage"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const { id } = await context.params;
    const employeeId = Number(id);

    if (!Number.isInteger(employeeId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid employee ID",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const data: {
      name?: string;
      isActive?: boolean;
    } = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error: "Employee name cannot be empty",
          },
          { status: 400 }
        );
      }

      data.name = name;
    }

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const employee = await prisma.employee.update({
      where: {
        id: employeeId,
      },
      data,
    });

    return NextResponse.json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error("PATCH /api/employees/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update employee",
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
    "employee.manage"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const { id } = await context.params;
    const employeeId = Number(id);

    if (!Number.isInteger(employeeId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid employee ID",
        },
        { status: 400 }
      );
    }

    const transactionCount = await prisma.transaction.count({
      where: {
        employeeId,
      },
    });

    if (transactionCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Employee cannot be deleted because it is already used by transactions. Deactivate it instead.",
        },
        { status: 409 }
      );
    }

    await prisma.employee.delete({
      where: {
        id: employeeId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE /api/employees/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete employee",
      },
      { status: 500 }
    );
  }
}