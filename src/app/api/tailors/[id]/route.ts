
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isSuperAdmin(user: {
  role?: { name?: string | null } | null;
}) {
  return user.role?.name?.toLowerCase() === "superadmin";
}

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

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) return response;

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  const permission = requirePermission(user, "tailor.manage");
  if (permission.response) return permission.response;

  const superAdmin = isSuperAdmin(user);

  if (!superAdmin && user.companyId == null) {
    return jsonError(
      "User belum terhubung dengan perusahaan.",
      403,
    );
  }

  try {
    const { id } = await context.params;
    const tailorId = parseId(id);

    if (tailorId === null) {
      return jsonError("Invalid tailor ID", 400);
    }

    const body = await request.json();

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
          "Tailor name cannot be empty",
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

    const existing = await prisma.tailor.findFirst({
      where: {
        id: tailorId,
        ...(superAdmin
          ? {}
          : { companyId: user.companyId! }),
      },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (!existing) {
      return jsonError("Tailor not found", 404);
    }

    if (data.name !== undefined) {
      const duplicate = await prisma.tailor.findFirst({
        where: {
          companyId: existing.companyId,
          name: data.name,
          NOT: { id: tailorId },
        },
        select: { id: true },
      });

      if (duplicate) {
        return jsonError("Tailor name already exists", 409);
      }
    }

    const result = await prisma.tailor.updateMany({
      where: {
        id: tailorId,
        companyId: existing.companyId,
      },
      data,
    });

    if (result.count === 0) {
      return jsonError("Tailor not found", 404);
    }

    const tailor = await prisma.tailor.findFirst({
      where: {
        id: tailorId,
        companyId: existing.companyId,
      },
    });

    return NextResponse.json({
      success: true,
      data: tailor,
    });
  } catch (error) {
    console.error("PATCH /api/tailors/[id] error:", error);
    return jsonError("Failed to update tailor", 500);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) return response;

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  const permission = requirePermission(user, "tailor.manage");
  if (permission.response) return permission.response;

  const superAdmin = isSuperAdmin(user);

  if (!superAdmin && user.companyId == null) {
    return jsonError(
      "User belum terhubung dengan perusahaan.",
      403,
    );
  }

  try {
    const { id } = await context.params;
    const tailorId = parseId(id);

    if (tailorId === null) {
      return jsonError("Invalid tailor ID", 400);
    }

    const tailor = await prisma.tailor.findFirst({
      where: {
        id: tailorId,
        ...(superAdmin
          ? {}
          : { companyId: user.companyId! }),
      },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (!tailor) {
      return jsonError("Tailor not found", 404);
    }

    const transactionCount = await prisma.transaction.count({
      where: {
        tailorId,
        companyId: tailor.companyId,
      },
    });

    if (transactionCount > 0) {
      return jsonError(
        "Tailor cannot be deleted because it is already used by transactions. Deactivate it instead.",
        409,
      );
    }

    const spkCount = await prisma.sPK.count({
      where: {
        tailorId,
        companyId: tailor.companyId,
      },
    });

    if (spkCount > 0) {
      return jsonError(
        "Tailor cannot be deleted because it is already used by SPK. Deactivate it instead.",
        409,
      );
    }

    const result = await prisma.tailor.deleteMany({
      where: {
        id: tailorId,
        companyId: tailor.companyId,
      },
    });

    if (result.count === 0) {
      return jsonError("Tailor not found", 404);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE /api/tailors/[id] error:", error);
    return jsonError("Failed to delete tailor", 500);
  }
}
