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
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(
    user,
    "product.manage",
  );

  if (permission.response) {
    return permission.response;
  }

  try {
    const { id } = await context.params;
    const productId = Number(id);

    if (
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid product ID",
        },
        {
          status: 400,
        },
      );
    }

    const body = await request.json();

    const data: {
      code?: string;
      name?: string;
      isActive?: boolean;
    } = {};

    if (body.code !== undefined) {
      const code = String(body.code).trim();

      if (!code) {
        return NextResponse.json(
          {
            success: false,
            error: "Product code cannot be empty",
          },
          {
            status: 400,
          },
        );
      }

      data.code = code;
    }

    if (body.name !== undefined) {
      const name = String(body.name).trim();

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error: "Product name cannot be empty",
          },
          {
            status: 400,
          },
        );
      }

      data.name = name;
    }

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const product = await prisma.product.update({
      where: {
        id: productId,
      },
      data,
    });

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error(
      "PATCH /api/products/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update product",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(
    user,
    "product.manage",
  );

  if (permission.response) {
    return permission.response;
  }

  try {
    const { id } = await context.params;
    const productId = Number(id);

    if (
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid product ID",
        },
        {
          status: 400,
        },
      );
    }

    // ==================================================
    // CHECK TRANSACTIONS
    // ==================================================

    const transactionCount =
      await prisma.transaction.count({
        where: {
          productId,
        },
      });

    if (transactionCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Product cannot be deleted because it is already used by transactions. Deactivate it instead.",
        },
        {
          status: 409,
        },
      );
    }

    // ==================================================
    // CHECK SPK ITEMS
    // ==================================================

    const spkCount = await prisma.sPK.count({
      where: {
        items: {
          some: {
            productId,
          },
        },
      },
    });

    if (spkCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Product cannot be deleted because it is already used by SPK. Deactivate it instead.",
        },
        {
          status: 409,
        },
      );
    }

    // ==================================================
    // DELETE PRODUCT
    // ==================================================

    await prisma.product.delete({
      where: {
        id: productId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "DELETE /api/products/[id] error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete product",
      },
      {
        status: 500,
      },
    );
  }
}