import { requirePermission } from "@/lib/auth/authorization";

import { requireAuth } from "@/lib/auth/require-auth";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }
  const permission = requirePermission(
    user,
    "spk.view"
  );

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
                  product: {
                    name: {
                      contains: search,
                    },
                  },
                },
                {
                  product: {
                    code: {
                      contains: search,
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
        product: {
          select: {
            id: true,
            code: true,
            name: true,
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
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }
  const permission = requirePermission(
    user,
    "spk.create"
  );

  if (permission.response) {
    return permission.response;
  }


  try {
    const body = await request.json();

    const spkNumber = String(
      body.spkNumber ?? ""
    ).trim();

    const productId = Number(
      body.productId
    );

    const tailorId = Number(
      body.tailorId
    );

    if (!spkNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "SPK number is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid product is required.",
        },
        {
          status: 400,
        }
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
        }
      );
    }

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
        }
      );
    }

    const [product, tailor] =
      await Promise.all([
        prisma.product.findUnique({
          where: {
            id: productId,
          },
        }),

        prisma.tailor.findUnique({
          where: {
            id: tailorId,
          },
        }),
      ]);

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: "Product not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (!product.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "Selected product is inactive.",
        },
        {
          status: 400,
        }
      );
    }

    if (!tailor) {
      return NextResponse.json(
        {
          success: false,
          error: "Tailor not found.",
        },
        {
          status: 404,
        }
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
        }
      );
    }

    const spk = await prisma.sPK.create({
      data: {
        spkNumber,
        productId,
        tailorId,
        status: "ACTIVE",
      },

      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
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
      }
    );
  } catch (error) {
    console.error("POST SPK error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create SPK.",
      },
      {
        status: 500,
      }
    );
  }
}