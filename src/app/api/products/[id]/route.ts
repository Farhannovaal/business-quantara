
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function jsonError(error: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status },
  );
}

function parseProductId(id: string): number | null {
  const productId = Number(id);

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return null;
  }

  return productId;
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) return response;

  const permission = requirePermission(user, "product.manage");
  if (permission.response) return permission.response;

  if (user.companyId == null) {
    return jsonError(
      "User belum terhubung dengan perusahaan.",
      403,
    );
  }

  try {
    const { id } = await context.params;
    const productId = parseProductId(id);

    if (productId === null) {
      return jsonError("Invalid product ID", 400);
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
      code?: string;
      name?: string;
      isActive?: boolean;
    } = {};

    if (body.code !== undefined) {
      if (typeof body.code !== "string") {
        return jsonError("Product code must be a string", 400);
      }

      const code = body.code.trim();

      if (!code) {
        return jsonError("Product code cannot be empty", 400);
      }

      data.code = code;
    }

    if (body.name !== undefined) {
      if (typeof body.name !== "string") {
        return jsonError("Product name must be a string", 400);
      }

      const name = body.name.trim();

      if (!name) {
        return jsonError("Product name cannot be empty", 400);
      }

      data.name = name;
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

    // Pastikan produk dimiliki perusahaan user.
    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        companyId: user.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!existingProduct) {
      return jsonError("Product not found", 404);
    }

    // Kode produk harus unik dalam perusahaan yang sama.
    if (data.code !== undefined) {
      const duplicate = await prisma.product.findFirst({
        where: {
          companyId: user.companyId,
          code: data.code,
          NOT: {
            id: productId,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        return jsonError("Product code already exists", 409);
      }
    }

    // Filter companyId tetap diterapkan pada operasi update.
    const result = await prisma.product.updateMany({
      where: {
        id: productId,
        companyId: user.companyId,
      },
      data,
    });

    if (result.count === 0) {
      return jsonError("Product not found", 404);
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        companyId: user.companyId,
      },
    });

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("PATCH /api/products/[id] error:", error);

    return jsonError("Failed to update product", 500);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) return response;

  const permission = requirePermission(user, "product.manage");
  if (permission.response) return permission.response;

  if (user.companyId == null) {
    return jsonError(
      "User belum terhubung dengan perusahaan.",
      403,
    );
  }

  try {
    const { id } = await context.params;
    const productId = parseProductId(id);

    if (productId === null) {
      return jsonError("Invalid product ID", 400);
    }

    // Verifikasi kepemilikan produk terlebih dahulu.
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        companyId: user.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      return jsonError("Product not found", 404);
    }

    // Periksa transaksi dalam perusahaan yang sama.
    const transactionCount = await prisma.transaction.count({
      where: {
        productId,
        companyId: user.companyId,
      },
    });

    if (transactionCount > 0) {
      return jsonError(
        "Product cannot be deleted because it is already used by transactions. Deactivate it instead.",
        409,
      );
    }

    // Periksa SPK dalam perusahaan yang sama.
    const spkCount = await prisma.sPK.count({
      where: {
        companyId: user.companyId,
        items: {
          some: {
            productId,
          },
        },
      },
    });

    if (spkCount > 0) {
      return jsonError(
        "Product cannot be deleted because it is already used by SPK. Deactivate it instead.",
        409,
      );
    }

    const result = await prisma.product.deleteMany({
      where: {
        id: productId,
        companyId: user.companyId,
      },
    });

    if (result.count === 0) {
      return jsonError("Product not found", 404);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE /api/products/[id] error:", error);

    return jsonError("Failed to delete product", 500);
  }
}
