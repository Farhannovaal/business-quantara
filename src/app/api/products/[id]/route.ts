
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { withApiAuth } from "@/lib/auth/api-guard";
import { isSuperAdmin } from "@/lib/auth/authorization";
import { requireActiveCompany } from "@/lib/auth/tenant";
import type { AuthenticatedUser } from "@/lib/auth/require-auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ProductOwnership = {
  id: number;
  companyId: number | null;
};

function jsonError(
  error: string,
  status: number,
  message?: string
) {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(message ? { message } : {}),
    },
    { status }
  );
}

function parseProductId(
  id: string
): number | null {
  const productId = Number(id);

  if (
    !Number.isSafeInteger(productId) ||
    productId <= 0
  ) {
    return null;
  }

  return productId;
}

/**
 * Find product using the authenticated user's scope.
 *
 * Tenant user:
 * - Can only find products from their company.
 *
 * Superadmin:
 * - Can find products across companies.
 *
 * Company-owned products:
 * - Their company must be ACTIVE.
 *
 * Legacy products with companyId = null:
 * - Accessible only by Superadmin.
 */
async function findAccessibleProduct(
  user: AuthenticatedUser,
  productId: number
): Promise<{
  product: ProductOwnership | null;
  response: NextResponse | null;
}> {
  const superAdmin = isSuperAdmin(user);

  const product = await prisma.product.findFirst({
    where: {
      id: productId,

      ...(!superAdmin
        ? {
            companyId: user.companyId!,
          }
        : {}),
    },
    select: {
      id: true,
      companyId: true,
    },
  });

  if (!product) {
    return {
      product: null,
      response: jsonError(
        "Product not found",
        404
      ),
    };
  }

  /**
   * Legacy unassigned product.
   * Only Superadmin can manage it.
   */
  if (product.companyId === null) {
    if (!superAdmin) {
      return {
        product: null,
        response: jsonError(
          "Product not found",
          404
        ),
      };
    }

    return {
      product,
      response: null,
    };
  }

  /**
   * Validate company status.
   *
   * Superadmin must also respect company status
   * when operating on company-owned products.
   */
  const tenant = await requireActiveCompany(
    user,
    product.companyId
  );

  if (!tenant.allowed) {
    return {
      product: null,
      response: tenant.response,
    };
  }

  return {
    product,
    response: null,
  };
}

/**
 * PATCH /api/products/[id]
 *
 * Permission:
 * - product.manage
 *
 * Valid fields:
 * - code
 * - name
 * - isActive
 */
export const PATCH = withApiAuth<RouteContext>(
  async ({ request, context, user }) => {
    try {
      const { id } = await context.params;

      const productId = parseProductId(id);

      if (productId === null) {
        return jsonError(
          "Invalid product ID",
          400
        );
      }

      let body: unknown;

      try {
        body = await request.json();
      } catch {
        return jsonError(
          "Invalid request body",
          400
        );
      }

      if (
        body === null ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        return jsonError(
          "Invalid request body",
          400
        );
      }

      const payload = body as Record<string, unknown>;

      const data: {
        code?: string;
        name?: string;
        isActive?: boolean;
      } = {};

      /**
       * Validate product code.
       */
      if (payload.code !== undefined) {
        if (typeof payload.code !== "string") {
          return jsonError(
            "Product code must be a string",
            400
          );
        }

        const code = payload.code.trim();

        if (!code) {
          return jsonError(
            "Product code cannot be empty",
            400
          );
        }

        data.code = code;
      }

      /**
       * Validate product name.
       */
      if (payload.name !== undefined) {
        if (typeof payload.name !== "string") {
          return jsonError(
            "Product name must be a string",
            400
          );
        }

        const name = payload.name.trim();

        if (!name) {
          return jsonError(
            "Product name cannot be empty",
            400
          );
        }

        data.name = name;
      }

      /**
       * Validate active status.
       */
      if (payload.isActive !== undefined) {
        if (typeof payload.isActive !== "boolean") {
          return jsonError(
            "isActive must be a boolean",
            400
          );
        }

        data.isActive = payload.isActive;
      }

      if (Object.keys(data).length === 0) {
        return jsonError(
          "No valid fields to update",
          400
        );
      }

      /**
       * Resolve product ownership and company status.
       */
      const access = await findAccessibleProduct(
        user,
        productId
      );

      if (access.response || !access.product) {
        return (
          access.response ??
          jsonError("Product not found", 404)
        );
      }

      const companyId = access.product.companyId;

      /**
       * Check duplicate product code
       * within the same company.
       */
      if (data.code !== undefined) {
        const duplicate = await prisma.product.findFirst({
          where: {
            companyId,
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
          return jsonError(
            "Product code already exists",
            409
          );
        }
      }

      /**
       * Update only the product matching
       * both ID and company ownership.
       *
       * companyId = null is retained only for
       * legacy Superadmin-managed products.
       */
      const result = await prisma.product.updateMany({
        where: {
          id: productId,
          companyId,
        },
        data,
      });

      if (result.count === 0) {
        return jsonError(
          "Product not found",
          404
        );
      }

      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          companyId,
        },
      });

      if (!product) {
        return jsonError(
          "Product not found",
          404
        );
      }

      return NextResponse.json({
        success: true,
        data: product,
      });
    } catch (error) {
      console.error(
        "PATCH /api/products/[id] error:",
        error
      );

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return jsonError(
          "Product code already exists",
          409
        );
      }

      return jsonError(
        "Failed to update product",
        500
      );
    }
  },
  {
    tenant: "none",
    permission: "product.manage",
  }
);

/**
 * DELETE /api/products/[id]
 *
 * Cannot delete product when:
 * - Used by transactions.
 * - Used by SPK items.
 */
export const DELETE = withApiAuth<RouteContext>(
  async ({ context, user }) => {
    try {
      const { id } = await context.params;

      const productId = parseProductId(id);

      if (productId === null) {
        return jsonError(
          "Invalid product ID",
          400
        );
      }

      /**
       * Resolve product ownership and company status.
       */
      const access = await findAccessibleProduct(
        user,
        productId
      );

      if (access.response || !access.product) {
        return (
          access.response ??
          jsonError("Product not found", 404)
        );
      }

      const companyId = access.product.companyId;

      /**
       * Check whether product is used by transactions.
       */
      const transactionCount =
        await prisma.transaction.count({
          where: {
            productId,
            companyId,
          },
        });

      if (transactionCount > 0) {
        return jsonError(
          "Product cannot be deleted because it is already used by transactions. Deactivate it instead.",
          409
        );
      }

      /**
       * Check whether product is used by SPK.
       */
      const spkCount = await prisma.sPK.count({
        where: {
          companyId,
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
          409
        );
      }

      /**
       * Delete only the product matching
       * both ID and company ownership.
       */
      const result = await prisma.product.deleteMany({
        where: {
          id: productId,
          companyId,
        },
      });

      if (result.count === 0) {
        return jsonError(
          "Product not found",
          404
        );
      }

      return NextResponse.json({
        success: true,
      });
    } catch (error) {
      console.error(
        "DELETE /api/products/[id] error:",
        error
      );

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (
          error.code === "P2003" ||
          error.code === "P2014"
        )
      ) {
        return jsonError(
          "Product cannot be deleted because it is still referenced by other records. Deactivate it instead.",
          409
        );
      }

      return jsonError(
        "Failed to delete product",
        500
      );
    }
  },
  {
    tenant: "none",
    permission: "product.manage",
  }
);
