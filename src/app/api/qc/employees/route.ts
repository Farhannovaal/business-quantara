import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(
    user,
    "qc.view",
  );

  if (permission.response) {
    return permission.response;
  }

  try {
    const employees =
      await prisma.employee.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
      });

    return NextResponse.json({
      success: true,
      data: employees,
    });
  } catch (error) {
    console.error(
      "GET /api/qc/employees error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to load QC employees",
      },
      {
        status: 500,
      },
    );
  }
}