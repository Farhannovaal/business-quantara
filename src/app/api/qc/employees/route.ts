
import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

function isSuperAdmin(user: {
  role?: { name?: string | null } | null;
}) {
  return user.role?.name?.toLowerCase() === "superadmin";
}

export async function GET() {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  const permission = requirePermission(user, "qc.view");

  if (permission.response) {
    return permission.response;
  }

  const superAdmin = isSuperAdmin(user);

  if (!superAdmin && user.companyId == null) {
    return NextResponse.json(
      {
        success: false,
        error: "User belum terhubung dengan perusahaan.",
      },
      { status: 403 },
    );
  }

  try {
    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        ...(superAdmin ? {} : { companyId: user.companyId! }),
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
    console.error("GET /api/qc/employees error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load QC employees",
      },
      { status: 500 },
    );
  }
}
