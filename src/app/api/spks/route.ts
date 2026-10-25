
import { Prisma, SPKStatus } from "@prisma/client";
import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type SPKItemInput = {
  productId: number;
  quantity: number;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status },
  );
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isPrismaUniqueError(
  error: unknown,
): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response || !user) {
    return response ?? jsonError("Unauthorized.", 401);
  }

  const permission = requirePermission(user, "spk.view");

  if (permission.response) {
    return permission.response;
  }

  if (user.companyId == null) {
    return jsonError(
      "User belum terhubung dengan perusahaan.",
      403,
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const rawStatus = searchParams.get("status")?.trim() || "";

    const validStatuses = Object.values(SPKStatus) as string[];

    if (
      rawStatus &&
      !validStatuses.includes(rawStatus)
    ) {
      return jsonError("Invalid SPK status filter.", 400);
    }

    const status: SPKStatus | undefined = rawStatus
      ? (rawStatus as SPKStatus)
      : undefined;

    const spks = await prisma.sPK.findMany({
      where: {
        companyId: user.companyId,
        deletedAt: null,

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

        ...(status ? { status } : {}),
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

    return jsonError("Failed to load SPKs.", 500);
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response || !user) {
    return response ?? jsonError("Unauthorized.", 401);
  }

  const permission = requirePermission(user, "spk.create");

  if (permission.response) {
    return permission.response;
  }

  if (user.companyId == null) {
    return jsonError(
      "User belum terhubung dengan perusahaan.",
      403,
    );
  }

  try {
    const body: unknown = await request.json();

    if (!isObject(body)) {
      return jsonError("Invalid request body.", 400);
    }

    const spkNumber =
      typeof body.spkNumber === "string"
        ? body.spkNumber.trim()
        : "";

    const tailorId = Number(body.tailorId);
    const rawItems = body.items;

    if (!spkNumber) {
      return jsonError("SPK number is required.", 400);
    }

    if (
      !Number.isSafeInteger(tailorId) ||
      tailorId <= 0
    ) {
      return jsonError("Valid tailor is required.", 400);
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return jsonError(
        "At least one product is required.",
        400,
      );
    }

    const items: SPKItemInput[] = [];

    for (const rawItem of rawItems) {
      if (!isObject(rawItem)) {
        return jsonError("Invalid SPK item.", 400);
      }

      const productId = Number(rawItem.productId);
      const quantity = Number(rawItem.quantity);

      if (
        !Number.isSafeInteger(productId) ||
        productId <= 0 ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
      ) {
        return jsonError(
          "Each item must have a valid product and positive integer quantity.",
          400,
        );
      }

      items.push({
        productId,
        quantity,
      });
    }

    const productIds = items.map((item) => item.productId);

    if (new Set(productIds).size !== productIds.length) {
      return jsonError(
        "Duplicate products are not allowed in one SPK.",
        400,
      );
    }

    const companyId = user.companyId;

    const [existingSPK, tailor, products] = await Promise.all([
      prisma.sPK.findUnique({
        where: {
          companyId_spkNumber: {
            companyId,
            spkNumber,
          },
        },
        select: {
          id: true,
        },
      }),

      prisma.tailor.findUnique({
        where: {
          companyId_id: {
            companyId,
            id: tailorId,
          },
        },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      }),

      prisma.product.findMany({
        where: {
          companyId,
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
      }),
    ]);

    if (existingSPK) {
      return jsonError("SPK number already exists.", 409);
    }

    if (!tailor) {
      return jsonError(
        "Tailor not found in this company.",
        404,
      );
    }

    if (!tailor.isActive) {
      return jsonError("Selected tailor is inactive.", 400);
    }

    const foundProductIds = new Set(
      products.map((product) => product.id),
    );

    const missingProductIds = productIds.filter(
      (id) => !foundProductIds.has(id),
    );

    if (missingProductIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "One or more products were not found in this company.",
          productIds: missingProductIds,
        },
        { status: 404 },
      );
    }

    const inactiveProducts = products.filter(
      (product) => !product.isActive,
    );

    if (inactiveProducts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "One or more selected products are inactive.",
          products: inactiveProducts.map((product) => ({
            id: product.id,
            code: product.code,
            name: product.name,
          })),
        },
        { status: 400 },
      );
    }

    const spk = await prisma.sPK.create({
      data: {
        companyId,
        spkNumber,
        tailorId,
        status: "ACTIVE",

        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
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
      { status: 201 },
    );
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return jsonError("SPK number already exists.", 409);
    }

    console.error("POST SPK error:", error);

    return jsonError("Failed to create SPK.", 500);
  }
}
