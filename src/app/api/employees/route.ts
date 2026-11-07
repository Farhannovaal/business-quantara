import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { success: false, error },
    { status },
  );
}

export const GET = withApiAuth(
  async ({ tenant }) => {
    if (!tenant) {
      return jsonError("Company context is unavailable.", 403);
    }

    try {
      const employees = await prisma.employee.findMany({
        where: {
          companyId: tenant.id,
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        success: true,
        data: employees,
      });
    } catch (error) {
      console.error("GET /api/employees error:", error);
      return jsonError("Failed to load employees", 500);
    }
  },
  {
    tenant: "required",
    permission: "employee.view",
  },
);

export const POST = withApiAuth(
  async ({ request, tenant }) => {
    if (!tenant) {
      return jsonError("Company context is unavailable.", 403);
    }

    try {
      const body = await request.json().catch(() => null);

      if (
        body === null ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        return jsonError("Invalid request body", 400);
      }

      if (
        typeof body.name !== "string" ||
        !body.name.trim()
      ) {
        return jsonError("Employee name is required", 400);
      }

      let isActive = true;

      if (body.isActive !== undefined) {
        if (typeof body.isActive !== "boolean") {
          return jsonError("isActive must be a boolean", 400);
        }

        isActive = body.isActive;
      }

      const employee = await prisma.employee.create({
        data: {
          companyId: tenant.id,
          name: body.name.trim(),
          isActive,
        },
      });

      return NextResponse.json(
        {
          success: true,
          data: employee,
        },
        { status: 201 },
      );
    } catch (error) {
      console.error("POST /api/employees error:", error);
      return jsonError("Failed to create employee", 500);
    }
  },
  {
    tenant: "required",
    permission: "employee.manage",
  },
);