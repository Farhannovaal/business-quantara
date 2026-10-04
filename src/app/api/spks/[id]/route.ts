import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { calculateSPKStatus } from "@/lib/spk-status";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SPKItemInput = {
  productId: number;
  quantity: number;
};

/**
 * GET /api/spks/[id]
 *
 * Mengambil detail SPK:
 * - SPK
 * - Tailor
 * - Multiple products / SPK items
 * - Transaction history
 * - Production summary
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(
    user,
    "spk.view",
  );

  if (permission.response) {
    return permission.response;
  }

  try {
    const { id } = await context.params;
    const spkId = Number(id);

    if (!Number.isInteger(spkId) || spkId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid SPK ID.",
        },
        {
          status: 400,
        },
      );
    }

    const spk = await prisma.sPK.findUnique({
      where: {
        id: spkId,
      },

      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                isActive: true,
              },
            },
          },

          orderBy: {
            id: "asc",
          },
        },

        tailor: {
          select: {
            id: true,
            name: true,
          },
        },

        transactions: {
          orderBy: {
            createdAt: "desc",
          },

          include: {
            transactionType: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },

            product: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },

            employee: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },

        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });

    if (!spk) {
      return NextResponse.json(
        {
          success: false,
          error: "SPK not found.",
        },
        {
          status: 404,
        },
      );
    }

    /**
     * ==========================================================
     * OVERALL SUMMARY
     * ==========================================================
     *
     * Summary keseluruhan SPK dihitung dari seluruh transaksi.
     *
     * Jangan memberikan quantity dari salah satu SPKItem di sini,
     * karena satu SPK dapat mempunyai beberapa product dengan
     * quantity yang berbeda.
     */
    const summary = calculateSPKStatus(
      spk.transactions,
    );

    /**
     * ==========================================================
     * PRODUCT SUMMARY
     * ==========================================================
     *
     * Business state dihitung PER PRODUCT.
     *
     * Contoh:
     *
     * Product A
     * Qty SPK = 100
     * Pengiriman = 50
     *
     * Product B
     * Qty SPK = 200
     * Pengiriman = 100
     *
     * Kedua product harus mempunyai status masing-masing.
     */
    const productSummaries = spk.items.map(
      (item) => {
        const productTransactions =
          spk.transactions.filter(
            (transaction) =>
              transaction.productId ===
              item.productId,
          );

        const productSummary =
          calculateSPKStatus(
            productTransactions,
            item.quantity,
          );

        return {
          productId: item.productId,

          product: item.product,

          quantity: item.quantity,

          summary: productSummary,
        };
      },
    );

    return NextResponse.json({
      success: true,

      data: {
        ...spk,

        summary,

        productSummaries,
      },
    });
  } catch (error) {
    console.error(
      "GET SPK detail error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load SPK.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * PATCH /api/spks/[id]
 *
 * Update:
 * - SPK number
 * - Items / products
 * - Tailor
 * - Status
 *
 * Format items:
 *
 * {
 *   "items": [
 *     {
 *       "productId": 1,
 *       "quantity": 100
 *     },
 *     {
 *       "productId": 2,
 *       "quantity": 50
 *     }
 *   ]
 * }
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(
    user,
    "spk.update",
  );

  if (permission.response) {
    return permission.response;
  }

  try {
    const { id } = await context.params;
    const spkId = Number(id);

    if (
      !Number.isInteger(spkId) ||
      spkId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid SPK ID.",
        },
        {
          status: 400,
        },
      );
    }

    const existing =
      await prisma.sPK.findUnique({
        where: {
          id: spkId,
        },

        include: {
          items: true,

          _count: {
            select: {
              transactions: true,
            },
          },
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: "SPK not found.",
        },
        {
          status: 404,
        },
      );
    }

    const body = await request.json();

    /**
     * ==========================================================
     * SPK NUMBER
     * ==========================================================
     */

    let spkNumber:
      | string
      | undefined;

    if (body.spkNumber !== undefined) {
      spkNumber = String(
        body.spkNumber,
      ).trim();

      if (!spkNumber) {
        return NextResponse.json(
          {
            success: false,
            error:
              "SPK number cannot be empty.",
          },
          {
            status: 400,
          },
        );
      }

      const duplicate =
        await prisma.sPK.findFirst({
          where: {
            spkNumber,

            NOT: {
              id: spkId,
            },
          },
        });

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            error: `SPK "${spkNumber}" already exists.`,
          },
          {
            status: 409,
          },
        );
      }
    }

    /**
     * ==========================================================
     * TAILOR
     * ==========================================================
     */

    let tailorId:
      | number
      | undefined;

    if (body.tailorId !== undefined) {
      tailorId = Number(
        body.tailorId,
      );

      if (
        !Number.isInteger(tailorId) ||
        tailorId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid tailor ID.",
          },
          {
            status: 400,
          },
        );
      }

      const tailor =
        await prisma.tailor.findUnique({
          where: {
            id: tailorId,
          },
        });

      if (!tailor) {
        return NextResponse.json(
          {
            success: false,
            error: "Tailor not found.",
          },
          {
            status: 404,
          },
        );
      }

      if (!tailor.isActive) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Selected tailor is inactive.",
          },
          {
            status: 400,
          },
        );
      }
    }

    /**
     * ==========================================================
     * STATUS
     * ==========================================================
     */

    let status:
      | "ACTIVE"
      | "COMPLETED"
      | "CANCELLED"
      | undefined;

    if (body.status !== undefined) {
      status = String(
        body.status,
      ) as
        | "ACTIVE"
        | "COMPLETED"
        | "CANCELLED";

      if (
        ![
          "ACTIVE",
          "COMPLETED",
          "CANCELLED",
        ].includes(status)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid SPK status.",
          },
          {
            status: 400,
          },
        );
      }
    }

    /**
     * ==========================================================
     * ITEMS
     * ==========================================================
     *
     * Multi-product SPK:
     *
     * items: [
     *   { productId, quantity },
     *   { productId, quantity }
     * ]
     */

    let items:
      | SPKItemInput[]
      | undefined;

    if (body.items !== undefined) {
      if (!Array.isArray(body.items)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Items must be an array.",
          },
          {
            status: 400,
          },
        );
      }

      if (body.items.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "At least one product is required.",
          },
          {
            status: 400,
          },
        );
      }

      const normalizedItems: SPKItemInput[] =
        body.items.map(
          (item: unknown) => {
            const raw =
              item as {
                productId?: unknown;
                quantity?: unknown;
              };

            return {
              productId: Number(
                raw.productId,
              ),

              quantity: Number(
                raw.quantity,
              ),
            };
          },
        );

      const invalidItem =
        normalizedItems.find(
          (item) =>
            !Number.isInteger(
              item.productId,
            ) ||
            item.productId <= 0 ||
            !Number.isInteger(
              item.quantity,
            ) ||
            item.quantity <= 0,
        );

      if (invalidItem) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Each item must have a valid productId and positive integer quantity.",
          },
          {
            status: 400,
          },
        );
      }

      /**
       * Prevent duplicate product
       * in the same SPK.
       */
      const productIds =
        normalizedItems.map(
          (item) => item.productId,
        );

      const uniqueProductIds =
        new Set(productIds);

      if (
        uniqueProductIds.size !==
        productIds.length
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A product can only appear once in an SPK.",
          },
          {
            status: 400,
          },
        );
      }

      /**
       * Verify all products.
       */
      const products =
        await prisma.product.findMany({
          where: {
            id: {
              in: productIds,
            },
          },

          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        });

      const productMap =
        new Map(
          products.map(
            (product) => [
              product.id,
              product,
            ],
          ),
        );

      const missingProductIds =
        productIds.filter(
          (productId) =>
            !productMap.has(
              productId,
            ),
        );

      if (
        missingProductIds.length > 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "One or more selected products were not found.",
            productIds:
              missingProductIds,
          },
          {
            status: 404,
          },
        );
      }

      const inactiveProducts =
        products.filter(
          (product) =>
            !product.isActive &&
            productIds.includes(
              product.id,
            ),
        );

      if (
        inactiveProducts.length > 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "One or more selected products are inactive.",

            products:
              inactiveProducts.map(
                (product) => ({
                  id: product.id,
                  code: product.code,
                  name: product.name,
                }),
              ),
          },
          {
            status: 400,
          },
        );
      }

      items = normalizedItems;
    }

    /**
     * ==========================================================
     * LEGACY productId SUPPORT
     * ==========================================================
     *
     * Kalau frontend lama masih mengirim:
     *
     * {
     *   productId: 123
     * }
     *
     * kita convert menjadi satu item.
     *
     * Tetapi hanya dilakukan jika `items`
     * belum dikirim.
     */

    if (
      items === undefined &&
      body.productId !== undefined
    ) {
      const productId = Number(
        body.productId,
      );

      if (
        !Number.isInteger(productId) ||
        productId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid product ID.",
          },
          {
            status: 400,
          },
        );
      }

      const product =
        await prisma.product.findUnique({
          where: {
            id: productId,
          },

          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        });

      if (!product) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Product not found.",
          },
          {
            status: 404,
          },
        );
      }

      if (!product.isActive) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Selected product is inactive.",
          },
          {
            status: 400,
          },
        );
      }

      /**
       * Ambil quantity lama jika ada.
       *
       * Ini hanya fallback compatibility.
       */
      const existingItem =
        existing.items.find(
          (item) =>
            item.productId ===
            productId,
        );

      items = [
        {
          productId,
          quantity:
            existingItem?.quantity ??
            1,
        },
      ];
    }

    /**
     * ==========================================================
     * PREVENT ITEM CHANGES AFTER TRANSACTION
     * ==========================================================
     *
     * Kalau SPK sudah punya transaction,
     * product/quantity tidak boleh diganti
     * sembarangan karena akan merusak histori
     * production.
     */

    if (
      items !== undefined &&
      existing._count.transactions > 0
    ) {
      const existingItems =
        existing.items
          .map((item) => ({
            productId:
              item.productId,

            quantity:
              item.quantity,
          }))
          .sort(
            (a, b) =>
              a.productId -
              b.productId,
          );

      const newItems = [
        ...items,
      ].sort(
        (a, b) =>
          a.productId -
          b.productId,
      );

      const sameItems =
        existingItems.length ===
          newItems.length &&
        existingItems.every(
          (item, index) =>
            item.productId ===
              newItems[index]
                .productId &&
            item.quantity ===
              newItems[index]
                .quantity,
        );

      if (!sameItems) {
        return NextResponse.json(
          {
            success: false,
            error:
              "SPK products or quantities cannot be changed because the SPK already has transactions.",
          },
          {
            status: 409,
          },
        );
      }
    }

    /**
     * ==========================================================
     * UPDATE
     * ==========================================================
     */

    const spk =
      await prisma.$transaction(
        async (tx) => {
          const updated =
            await tx.sPK.update({
              where: {
                id: spkId,
              },

              data: {
                ...(spkNumber !== undefined
                  ? {
                      spkNumber,
                    }
                  : {}),

                ...(tailorId !== undefined
                  ? {
                      tailorId,
                    }
                  : {}),

                ...(status !== undefined
                  ? {
                      status,
                    }
                  : {}),
              },
            });

          /**
           * Replace items only when the
           * request explicitly contains items.
           */
          if (items !== undefined) {
            await tx.sPKItem.deleteMany({
              where: {
                spkId,
              },
            });

            await tx.sPKItem.createMany({
              data: items.map(
                (item) => ({
                  spkId,

                  productId:
                    item.productId,

                  quantity:
                    item.quantity,
                }),
              ),
            });
          }

          return tx.sPK.findUnique({
            where: {
              id: updated.id,
            },

            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      isActive: true,
                    },
                  },
                },

                orderBy: {
                  id: "asc",
                },
              },

              tailor: {
                select: {
                  id: true,
                  name: true,
                },
              },

              _count: {
                select: {
                  transactions: true,
                },
              },
            },
          });
        },
      );

    return NextResponse.json({
      success: true,
      data: spk,
    });
  } catch (error) {
    console.error(
      "PATCH SPK error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update SPK.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * DELETE /api/spks/[id]
 *
 * SPK hanya boleh dihapus jika
 * belum mempunyai transaction.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  const { user, response } =
    await requireAuth();

  if (response) {
    return response;
  }

  const permission =
    requirePermission(
      user,
      "spk.delete",
    );

  if (permission.response) {
    return permission.response;
  }

  try {
    const { id } =
      await context.params;

    const spkId = Number(id);

    if (
      !Number.isInteger(spkId) ||
      spkId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid SPK ID.",
        },
        {
          status: 400,
        },
      );
    }

    const existing =
      await prisma.sPK.findUnique({
        where: {
          id: spkId,
        },

        include: {
          _count: {
            select: {
              transactions: true,
            },
          },
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: "SPK not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      existing._count.transactions >
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "SPK cannot be deleted because it already has transactions. Change its status instead.",
        },
        {
          status: 409,
        },
      );
    }

    await prisma.sPK.delete({
      where: {
        id: spkId,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "SPK deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE SPK error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete SPK.",
      },
      {
        status: 500,
      },
    );
  }
}