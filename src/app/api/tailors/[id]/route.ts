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
    "tailor.manage"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const { id } = await context.params;
    const tailorId = Number(id);

    if (!Number.isInteger(tailorId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid tailor ID",
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
            error: "Tailor name cannot be empty",
          },
          { status: 400 }
        );
      }

      data.name = name;
    }

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const tailor = await prisma.tailor.update({
      where: {
        id: tailorId,
      },
      data,
    });

    return NextResponse.json({
      success: true,
      data: tailor,
    });
  } catch (error) {
    console.error("PATCH /api/tailors/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update tailor",
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
    "tailor.manage"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const { id } = await context.params;
    const tailorId = Number(id);

    if (!Number.isInteger(tailorId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid tailor ID",
        },
        { status: 400 }
      );
    }

    const transactionCount = await prisma.transaction.count({
      where: {
        tailorId,
      },
    });

    if (transactionCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tailor cannot be deleted because it is already used by transactions. Deactivate it instead.",
        },
        { status: 409 }
      );
    }

    const spkCount = await prisma.sPK.count({
      where: {
        tailorId,
      },
    });

    if (spkCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tailor cannot be deleted because it is already used by SPK. Deactivate it instead.",
        },
        { status: 409 }
      );
    }

    await prisma.tailor.delete({
      where: {
        id: tailorId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE /api/tailors/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete tailor",
      },
      { status: 500 }
    );
  }
}