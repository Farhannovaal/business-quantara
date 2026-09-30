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

/**
 * GET /api/spks/[id]
 *
 * Mengambil detail SPK:
 * - Product
 * - Tailor
 * - Transaction history
 * - Production summary
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
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
        }
      );
    }

    const spk = await prisma.sPK.findUnique({
      where: {
        id: spkId,
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
        }
      );
    }

    /**
     * Hitung production state berdasarkan
     * seluruh transaction SPK.
     */
    const summary = calculateSPKStatus(
      spk.transactions
    );

    return NextResponse.json({
      success: true,

      data: {
        ...spk,

        summary,
      },
    });
  } catch (error) {
    console.error(
      "GET SPK detail error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load SPK.",
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * PATCH /api/spks/[id]
 *
 * Update:
 * - SPK number
 * - Product
 * - Tailor
 * - Status
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }
  const permission = requirePermission(
    user,
    "spk.update"
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
        }
      );
    }

    const existing = await prisma.sPK.findUnique({
      where: {
        id: spkId,
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
        }
      );
    }

    const body = await request.json();

    const data: {
      spkNumber?: string;
      productId?: number;
      tailorId?: number;
      status?:
        | "ACTIVE"
        | "COMPLETED"
        | "CANCELLED";
    } = {};

    /**
     * SPK Number
     */
    if (body.spkNumber !== undefined) {
      const spkNumber = String(
        body.spkNumber
      ).trim();

      if (!spkNumber) {
        return NextResponse.json(
          {
            success: false,
            error: "SPK number cannot be empty.",
          },
          {
            status: 400,
          }
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
          }
        );
      }

      data.spkNumber = spkNumber;
    }

    /**
     * Product
     */
    if (body.productId !== undefined) {
      const productId = Number(
        body.productId
      );

      if (
        !Number.isInteger(productId) ||
        productId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid product ID.",
          },
          {
            status: 400,
          }
        );
      }

      const product =
        await prisma.product.findUnique({
          where: {
            id: productId,
          },
        });

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
            error:
              "Selected product is inactive.",
          },
          {
            status: 400,
          }
        );
      }

      data.productId = productId;
    }

    /**
     * Tailor
     */
    if (body.tailorId !== undefined) {
      const tailorId = Number(
        body.tailorId
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
          }
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
          }
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
          }
        );
      }

      data.tailorId = tailorId;
    }

    /**
     * Status
     */
    if (body.status !== undefined) {
      const status = String(
        body.status
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
          }
        );
      }

      data.status = status;
    }

    /**
     * Update SPK
     */
    const spk = await prisma.sPK.update({
      where: {
        id: spkId,
      },

      data,

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

    return NextResponse.json({
      success: true,
      data: spk,
    });
  } catch (error) {
    console.error(
      "PATCH SPK error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update SPK.",
      },
      {
        status: 500,
      }
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
  context: RouteContext
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }
  const permission = requirePermission(
    user,
    "spk.delete"
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
        }
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
        }
      );
    }

    if (existing._count.transactions > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "SPK cannot be deleted because it already has transactions. Change its status instead.",
        },
        {
          status: 409,
        }
      );
    }

    await prisma.sPK.delete({
      where: {
        id: spkId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "SPK deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE SPK error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete SPK.",
      },
      {
        status: 500,
      }
    );
  }
}