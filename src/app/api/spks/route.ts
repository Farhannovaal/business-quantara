import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(user, "spk.view");

  if (permission.response) {
    return permission.response;
  }

  try {
    const { searchParams } = new URL(request.url);

    const search =
      searchParams.get("search")?.trim() || "";

    const status =
      searchParams.get("status")?.trim() || "";

    const spks = await prisma.sPK.findMany({
      where: {
        ...(search
          ? {
              OR: [
                {
                  spkNumber: {
                    contains: search,
                  },
                },
                {
                  items: {
                    some: {
                      product: {
                        name: {
                          contains: search,
                        },
                      },
                    },
                  },
                },
                {
                  items: {
                    some: {
                      product: {
                        code: {
                          contains: search,
                        },
                      },
                    },
                  },
                },
                {
                  tailor: {
                    name: {
                      contains: search,
                    },
                  },
                },
              ],
            }
          : {}),

        ...(status
          ? {
              status: status as
                | "ACTIVE"
                | "COMPLETED"
                | "CANCELLED",
            }
          : {}),
      },

      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
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

      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: spks,
    });
  } catch (error) {
    console.error("GET SPKs error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load SPKs.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(user, "spk.create");

  if (permission.response) {
    return permission.response;
  }

  try {
    const body = await request.json();

    const spkNumber = String(
      body.spkNumber ?? "",
    ).trim();

    const tailorId = Number(body.tailorId);

    const rawItems = Array.isArray(body.items)
      ? body.items
      : [];

    // =========================================================
    // BASIC VALIDATION
    // =========================================================

    if (!spkNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "SPK number is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isInteger(tailorId) ||
      tailorId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid tailor is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (rawItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one product is required.",
        },
        {
          status: 400,
        },
      );
    }

    // =========================================================
    // NORMALIZE ITEMS
    // =========================================================

    const items = rawItems.map(
      (item: {
        productId?: unknown;
        quantity?: unknown;
      }) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity),
      }),
    );

    // =========================================================
    // VALIDATE ITEM VALUES
    // =========================================================

    for (const item of items) {
      if (
        !Number.isInteger(item.productId) ||
        item.productId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Every item must have a valid product.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Every product quantity must be a positive integer.",
          },
          {
            status: 400,
          },
        );
      }
    }

    // =========================================================
    // CHECK DUPLICATE PRODUCT
    // =========================================================

    const productIds: number[] = items.map(
      (item: {
        productId: number;
        quantity: number;
      }) => item.productId,
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

    // =========================================================
    // CHECK SPK NUMBER
    // =========================================================

    const existing =
      await prisma.sPK.findUnique({
        where: {
          spkNumber,
        },
      });

    if (existing) {
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

    // =========================================================
    // LOAD PRODUCTS + TAILOR
    // =========================================================

    const [products, tailor] =
      await Promise.all([
        prisma.product.findMany({
          where: {
            id: {
              in: productIds,
            },
          },
        }),

        prisma.tailor.findUnique({
          where: {
            id: tailorId,
          },
        }),
      ]);

    // =========================================================
    // VALIDATE TAILOR
    // =========================================================

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
          error: "Selected tailor is inactive.",
        },
        {
          status: 400,
        },
      );
    }

    // =========================================================
    // VALIDATE PRODUCTS
    // =========================================================

    if (products.length !== productIds.length) {
      const foundProductIds = new Set(
        products.map(
          (product) => product.id,
        ),
      );

      const missingProductIds =
          productIds.filter(
            (id: number) =>
              !foundProductIds.has(id),
          );

      return NextResponse.json(
        {
          success: false,
          error: `Product not found: ${missingProductIds.join(", ")}`,
        },
        {
          status: 404,
        },
      );
    }

    const inactiveProducts =
      products.filter(
        (product) => !product.isActive,
      );

    if (inactiveProducts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Selected product is inactive: ${inactiveProducts
            .map(
              (product) =>
                product.name,
            )
            .join(", ")}`,
        },
        {
          status: 400,
        },
      );
    }

    // =========================================================
    // CREATE SPK + SPK ITEMS
    // =========================================================

    const spk = await prisma.sPK.create({
      data: {
        spkNumber,
        tailorId,
        status: "ACTIVE",

        items: {
          create: items.map(
            (item: {
              productId: number;
              quantity: number;
            }) => ({
              productId:
                item.productId,
              quantity:
                item.quantity,
            }),
          ),
        },
      },

      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
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
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: spk,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "POST SPK error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create SPK.",
      },
      {
        status: 500,
      },
    );
  }
}