import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { success: false, error },
    { status },
  );
}

function parseId(id: string): number | null {
  const value = Number(id);

  if (!Number.isSafeInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

export const PATCH = withApiAuth<RouteContext>(
  async ({ request, context, tenant }) => {
    if (!tenant) {
      return jsonError("Company context is unavailable.", 403);
    }

    try {
      const { id } = await context.params;
      const employeeId = parseId(id);

      if (employeeId === null) {
        return jsonError("Invalid employee ID", 400);
      }

      const body = await request.json().catch(() => null);

      if (
        body === null ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        return jsonError("Invalid request body", 400);
      }

      const data: {
        name?: string;
        isActive?: boolean;
      } = {};

      if (body.name !== undefined) {
        if (
          typeof body.name !== "string" ||
          !body.name.trim()
        ) {
          return jsonError(
            "Employee name cannot be empty",
            400,
          );
        }

        data.name = body.name.trim();
      }

      if (body.isActive !== undefined) {
        if (typeof body.isActive !== "boolean") {
          return jsonError("isActive must be a boolean", 400);
        }

        data.isActive = body.isActive;
      }

      if (Object.keys(data).length === 0) {
        return jsonError("No valid fields to update", 400);
      }

      // Pastikan employee berasal dari company aktif.
      const existing = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          companyId: tenant.id,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return jsonError("Employee not found", 404);
      }

      // Update tetap dibatasi berdasarkan ID dan companyId.
      const result = await prisma.employee.updateMany({
        where: {
          id: employeeId,
          companyId: tenant.id,
        },
        data,
      });

      if (result.count === 0) {
        return jsonError("Employee not found", 404);
      }

      const employee = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          companyId: tenant.id,
        },
      });

      return NextResponse.json({
        success: true,
        data: employee,
      });
    } catch (error) {
      console.error("PATCH /api/employees/[id] error:", error);
      return jsonError("Failed to update employee", 500);
    }
  },
  {
    tenant: "required",
    permission: "employee.manage",
  },
);

export const DELETE = withApiAuth<RouteContext>(
  async ({ context, tenant }) => {
    if (!tenant) {
      return jsonError("Company context is unavailable.", 403);
    }

    try {
      const { id } = await context.params;
      const employeeId = parseId(id);

      if (employeeId === null) {
        return jsonError("Invalid employee ID", 400);
      }

      const employee = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          companyId: tenant.id,
        },
        select: {
          id: true,
        },
      });

      if (!employee) {
        return jsonError("Employee not found", 404);
      }

      const transactionCount = await prisma.transaction.count({
        where: {
          employeeId,
          companyId: tenant.id,
        },
      });

      if (transactionCount > 0) {
        return jsonError(
          "Employee cannot be deleted because it is already used by transactions. Deactivate it instead.",
          409,
        );
      }

      const result = await prisma.employee.deleteMany({
        where: {
          id: employeeId,
          companyId: tenant.id,
        },
      });

      if (result.count === 0) {
        return jsonError("Employee not found", 404);
      }

      return NextResponse.json({
        success: true,
      });
    } catch (error) {
      console.error("DELETE /api/employees/[id] error:", error);
      return jsonError("Failed to delete employee", 500);
    }
  },
  {
    tenant: "required",
    permission: "employee.manage",
  },
);