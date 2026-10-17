import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) return response;

  const permission = requirePermission(user, "spk.view");
  if (permission.response) return permission.response;

  if (user.companyId == null) {
    return NextResponse.json(
      {
        success: false,
        error: "User belum terhubung dengan perusahaan.",
      },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";

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
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) return response;

  const permission = requirePermission(user, "spk.create");
  if (permission.response) return permission.response;

  if (user.companyId == null) {
    return NextResponse.json(
      {
        success: false,
        error: "User belum terhubung dengan perusahaan.",
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();

    const spkNumber = String(body.spkNumber ?? "").trim();
    const tailorId = Number(body.tailorId);
    const rawItems = body.items;

    if (!spkNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "SPK number is required.",
        },
        { status: 400 },
      );
    }

    if (!Number.isInteger(tailorId) || tailorId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid tailor is required.",
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one product is required.",
        },
        { status: 400 },
      );
    }

    const items: { productId: number; quantity: number }[] = [];

    for (const item of rawItems) {
      const productId = Number(item?.productId);
      const quantity = Number(item?.quantity);

      if (
        !Number.isInteger(productId) ||
        productId <= 0 ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Each item must have a valid product and quantity.",
          },
          { status: 400 },
        );
      }

      items.push({ productId, quantity });
    }

    const productIds = [...new Set(items.map((item) => item.productId))];

    if (productIds.length !== items.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Duplicate products are not allowed in one SPK.",
        },
        { status: 400 },
      );
    }

    const existingSPK = await prisma.sPK.findUnique({
      where: {
        companyId_spkNumber: {
          companyId: user.companyId,
          spkNumber,
        },
      },
    });

    if (existingSPK) {
      return NextResponse.json(
        {
          success: false,
          error: "SPK number already exists.",
        },
        { status: 409 },
      );
    }

    const [tailor, products] = await Promise.all([
      prisma.tailor.findUnique({
        where: {
          companyId_id: {
            companyId: user.companyId,
            id: tailorId,
          },
        },
      }),
      prisma.product.findMany({
        where: {
          companyId: user.companyId,
          id: {
            in: productIds,
          },
        },
      }),
    ]);

    if (!tailor) {
      return NextResponse.json(
        {
          success: false,
          error: "Tailor not found.",
        },
        { status: 404 },
      );
    }

    if (!tailor.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "Selected tailor is inactive.",
        },
        { status: 400 },
      );
    }

    if (products.length !== productIds.length) {
      const foundProductIds = new Set(products.map((product) => product.id));
      const missingProductIds = productIds.filter(
        (id) => !foundProductIds.has(id),
      );

      return NextResponse.json(
        {
          success: false,
          error: `Product not found: ${missingProductIds.join(", ")}`,
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
          error: `Selected product is inactive: ${inactiveProducts
            .map((product) => product.name)
            .join(", ")}`,
        },
        { status: 400 },
      );
    }

    const spk = await prisma.sPK.create({
      data: {
        companyId: user.companyId,
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
    console.error("POST SPK error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create SPK.",
      },
      { status: 500 },
    );
  }
}