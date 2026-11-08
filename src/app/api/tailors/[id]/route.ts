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
      const tailorId = parseId(id);

      if (tailorId === null) {
        return jsonError("Invalid tailor ID", 400);
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

      // Cari tailor hanya dalam company aktif.
      const existing = await prisma.tailor.findFirst({
        where: {
          id: tailorId,
          companyId: tenant.id,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return jsonError("Tailor not found", 404);
      }

      // Validasi nama unik dalam company aktif.
      if (data.name !== undefined) {
        const duplicate = await prisma.tailor.findFirst({
          where: {
            companyId: tenant.id,
            name: data.name,
            NOT: {
              id: tailorId,
            },
          },
          select: {
            id: true,
          },
        });

        if (duplicate) {
          return jsonError("Tailor name already exists", 409);
        }
      }

      // Update dibatasi berdasarkan ID dan company aktif.
      const result = await prisma.tailor.updateMany({
        where: {
          id: tailorId,
          companyId: tenant.id,
        },
        data,
      });

      if (result.count === 0) {
        return jsonError("Tailor not found", 404);
      }

      const tailor = await prisma.tailor.findFirst({
        where: {
          id: tailorId,
          companyId: tenant.id,
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
  },
  {
    tenant: "required",
    permission: "tailor.manage",
  },
);

export const DELETE = withApiAuth<RouteContext>(
  async ({ context, tenant }) => {
    if (!tenant) {
      return jsonError("Company context is unavailable.", 403);
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
          companyId: tenant.id,
        },
        select: {
          id: true,
        },
      });

      if (!tailor) {
        return jsonError("Tailor not found", 404);
      }

      const transactionCount = await prisma.transaction.count({
        where: {
          tailorId,
          companyId: tenant.id,
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
          companyId: tenant.id,
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
          companyId: tenant.id,
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
  },
  {
    tenant: "required",
    permission: "tailor.manage",
  },
);