
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { calculateSPKStatus } from "@/lib/spk-status";
import { prisma } from "@/lib/prisma";
import { dispatchNotificationEvent } from "@/lib/notifications/dispatcher";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SPKItemInput = {
  productId: number;
  quantity: number;
};

type SPKStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status },
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isSPKStatus(value: unknown): value is SPKStatus {
  return (
    value === "ACTIVE" ||
    value === "COMPLETED" ||
    value === "CANCELLED"
  );
}

function isPrismaUniqueError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function getSPKId(context: RouteContext) {
  const { id } = await context.params;
  const spkId = Number(id);

  if (!Number.isSafeInteger(spkId) || spkId <= 0) {
    return null;
  }

  return spkId;
}

async function getCompanyAuth(permissionCode: string) {
  const auth = await requireAuth();

  if (auth.response || !auth.user) {
    return {
      user: null,
      isSuperAdmin: false,
      response: auth.response ?? jsonError("Unauthorized.", 401),
    };
  }

  const permission = requirePermission(auth.user, permissionCode);

  if (permission.response) {
    return {
      user: null,
      isSuperAdmin: false,
      response: permission.response,
    };
  }

  // Ambil role terkini dari database.
  const currentUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      companyId: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!currentUser) {
    return {
      user: null,
      isSuperAdmin: false,
      response: jsonError("User not found.", 401),
    };
  }

  const isSuperAdmin =
    currentUser.role?.name?.toLowerCase() === "superadmin";

  if (!isSuperAdmin && currentUser.companyId == null) {
    return {
      user: null,
      isSuperAdmin: false,
      response: jsonError(
        "User belum terhubung dengan perusahaan.",
        403,
      ),
    };
  }

  return {
    user: {
      ...auth.user,
      companyId: currentUser.companyId,
    },
    isSuperAdmin,
    response: null,
  };
}

/**
 * GET /api/spks/[id]
 *
 * Super Admin dapat melihat SPK lintas perusahaan.
 * User biasa hanya dapat melihat SPK perusahaannya.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const auth = await getCompanyAuth("spk.view");

  if (auth.response || !auth.user) {
    return auth.response ?? jsonError("Unauthorized.", 401);
  }

  try {
    const spkId = await getSPKId(context);

    if (spkId === null) {
      return jsonError("Invalid SPK ID.", 400);
    }

    const spk = await prisma.sPK.findFirst({
      where: {
        id: spkId,
        ...(auth.isSuperAdmin
          ? {}
          : { companyId: auth.user.companyId! }),
        deletedAt: null,
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
          orderBy: { id: "asc" },
        },

        tailor: {
          select: {
            id: true,
            name: true,
          },
        },

        transactions: {
          where: {
            // Abaikan transaksi dari SPK yang sudah dihapus
            // secara soft delete.
            spk: { deletedAt: null },
          },

          orderBy: { createdAt: "desc" },

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
          select: { transactions: true },
        },
      },
    });

    if (!spk) {
      return jsonError("SPK not found.", 404);
    }

    const activeTransactions = spk.transactions.filter(
      (transaction) => transaction.status === "ACTIVE",
    );

    const summary = calculateSPKStatus(activeTransactions);

    const productSummaries = spk.items.map((item) => {
      const productTransactions = activeTransactions.filter(
        (transaction) => transaction.productId === item.productId,
      );

      return {
        productId: item.productId,
        product: item.product,
        quantity: item.quantity,
        summary: calculateSPKStatus(
          productTransactions,
          item.quantity,
        ),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...spk,
        summary,
        productSummaries,
      },
    });
  } catch (error) {
    console.error("GET SPK detail error:", error);
    return jsonError("Failed to load SPK.", 500);
  }
}

/**
 * PATCH /api/spks/[id]
 *
 * Memperbarui SPK sesuai cakupan perusahaan.
 * CompanyId SPK tidak dapat diubah melalui request ini.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const auth = await getCompanyAuth("spk.update");

  if (auth.response || !auth.user) {
    return auth.response ?? jsonError("Unauthorized.", 401);
  }

  try {
    const spkId = await getSPKId(context);

    if (spkId === null) {
      return jsonError("Invalid SPK ID.", 400);
    }

    const existing = await prisma.sPK.findFirst({
      where: {
        id: spkId,
        ...(auth.isSuperAdmin
          ? {}
          : { companyId: auth.user.companyId! }),
        deletedAt: null,
      },

      include: {
        items: true,
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!existing) {
      return jsonError("SPK not found.", 404);
    }

    // Seluruh validasi item tetap mengacu pada perusahaan SPK.
    const companyId = existing.companyId;

    const body: unknown = await request.json();

    if (!isObject(body)) {
      return jsonError("Invalid request body.", 400);
    }

    // Jangan izinkan pemindahan SPK ke perusahaan lain
    // melalui PATCH, termasuk untuk Super Admin.
    if (body.companyId !== undefined) {
      return jsonError(
        "Company assignment cannot be changed through this endpoint.",
        400,
      );
    }

    let spkNumber: string | undefined;

    if (body.spkNumber !== undefined) {
      if (typeof body.spkNumber !== "string") {
        return jsonError("Invalid SPK number.", 400);
      }

      spkNumber = body.spkNumber.trim();

      if (!spkNumber) {
        return jsonError("SPK number cannot be empty.", 400);
      }

      const duplicate = await prisma.sPK.findFirst({
        where: {
          companyId,
          spkNumber,
          id: { not: spkId },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (duplicate) {
        return jsonError(
          `SPK "${spkNumber}" already exists.`,
          409,
        );
      }
    }

    let tailorId: number | undefined;

    if (body.tailorId !== undefined) {
      tailorId = Number(body.tailorId);

      if (!Number.isSafeInteger(tailorId) || tailorId <= 0) {
        return jsonError("Invalid tailor ID.", 400);
      }

      const tailor = await prisma.tailor.findFirst({
        where: {
          id: tailorId,
          companyId,
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!tailor) {
        return jsonError(
          "Tailor not found in this company.",
          404,
        );
      }

      if (!tailor.isActive) {
        return jsonError("Selected tailor is inactive.", 400);
      }
    }

    let status: SPKStatus | undefined;

    if (body.status !== undefined) {
      if (!isSPKStatus(body.status)) {
        return jsonError("Invalid SPK status.", 400);
      }

      status = body.status;
    }

    let items: SPKItemInput[] | undefined;

    if (body.items !== undefined) {
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return jsonError(
          "At least one product is required.",
          400,
        );
      }

      const normalizedItems: SPKItemInput[] = [];

      for (const rawItem of body.items) {
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
            "Each item must have a valid productId and positive integer quantity.",
            400,
          );
        }

        normalizedItems.push({ productId, quantity });
      }

      const productIds = normalizedItems.map(
        (item) => item.productId,
      );

      if (new Set(productIds).size !== productIds.length) {
        return jsonError(
          "A product can only appear once in an SPK.",
          400,
        );
      }

      const products = await prisma.product.findMany({
        where: {
          companyId,
          id: { in: productIds },
        },
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      });

      const productMap = new Map(
        products.map((product) => [product.id, product]),
      );

      const missingProductIds = productIds.filter(
        (productId) => !productMap.has(productId),
      );

      if (missingProductIds.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "One or more selected products were not found in this company.",
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

      items = normalizedItems;
    }

    // Dukungan format lama: productId tunggal.
    if (items === undefined && body.productId !== undefined) {
      const productId = Number(body.productId);

      if (!Number.isSafeInteger(productId) || productId <= 0) {
        return jsonError("Invalid product ID.", 400);
      }

      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          companyId,
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!product) {
        return jsonError(
          "Product not found in this company.",
          404,
        );
      }

      if (!product.isActive) {
        return jsonError("Selected product is inactive.", 400);
      }

      const existingItem = existing.items.find(
        (item) => item.productId === productId,
      );

      items = [
        {
          productId,
          quantity: existingItem?.quantity ?? 1,
        },
      ];
    }

    if (items !== undefined && existing._count.transactions > 0) {
      const existingItems = existing.items
        .map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        }))
        .sort((a, b) => a.productId - b.productId);

      const newItems = [...items].sort(
        (a, b) => a.productId - b.productId,
      );

      const sameItems =
        existingItems.length === newItems.length &&
        existingItems.every(
          (item, index) =>
            item.productId === newItems[index].productId &&
            item.quantity === newItems[index].quantity,
        );

      if (!sameItems) {
        return jsonError(
          "SPK products or quantities cannot be changed because the SPK already has transactions.",
          409,
        );
      }
    }

    // =====================================================
    // UPDATE SPK + NOTIFICATION JOB
    // =====================================================

    const updatedSPK = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.sPK.updateMany({
          where: {
            id: spkId,
            companyId,
            deletedAt: null,
          },

          data: {
            ...(spkNumber !== undefined ? { spkNumber } : {}),
            ...(tailorId !== undefined ? { tailorId } : {}),
            ...(status !== undefined ? { status } : {}),
          },
        });

        if (updated.count === 0) {
          throw new Error("SPK_NOT_FOUND_OR_DELETED");
        }

        if (items !== undefined) {
          await tx.sPKItem.deleteMany({
            where: {
              spkId,
              spk: {
                companyId,
                deletedAt: null,
              },
            },
          });

          await tx.sPKItem.createMany({
            data: items.map((item) => ({
              spkId,
              productId: item.productId,
              quantity: item.quantity,
            })),
          });
        }

        const updatedSPK = await tx.sPK.findFirst({
          where: {
            id: spkId,
            companyId,
            deletedAt: null,
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
              orderBy: { id: "asc" },
            },

            tailor: {
              select: {
                id: true,
                name: true,
              },
            },

            _count: {
              select: { transactions: true },
            },
          },
        });

        if (!updatedSPK) {
          return null;
        }

        // Hanya dispatch ketika status benar-benar berubah.
        // SPK tanpa companyId tidak memiliki tenant notification config.
        if (
          companyId !== null &&
          status !== undefined &&
          existing.status !== updatedSPK.status
        ) {
          await dispatchNotificationEvent(tx, {
            companyId,
            eventCode: "SPK_STATUS_CHANGED",
            eventKey: [
              "spk",
              updatedSPK.id,
              "status",
              existing.status,
              updatedSPK.status,
              updatedSPK.updatedAt.toISOString(),
            ].join(":"),

            payload: {
              spkId: updatedSPK.id,
              spkNumber: updatedSPK.spkNumber,
              oldStatus: existing.status,
              newStatus: updatedSPK.status,
              updatedBy: String(auth.user!.id),
              updatedAt: updatedSPK.updatedAt.toISOString(),
            },
          });
        }

        return updatedSPK;
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );

    if (!updatedSPK) {
      return jsonError("SPK not found.", 404);
    }

    return NextResponse.json({
      success: true,
      data: updatedSPK,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "SPK_NOT_FOUND_OR_DELETED"
    ) {
      return jsonError(
        "SPK not found or already deleted.",
        404,
      );
    }

    if (isPrismaUniqueError(error)) {
      return jsonError("SPK number already exists.", 409);
    }

    console.error("PATCH SPK error:", error);
    return jsonError("Failed to update SPK.", 500);
  }
}

/**
 * DELETE /api/spks/[id]
 *
 * Soft delete SPK.
 * Super Admin dapat menghapus SPK lintas perusahaan.
 * User biasa hanya dapat menghapus SPK perusahaannya.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  const auth = await getCompanyAuth("spk.delete");

  if (auth.response || !auth.user) {
    return auth.response ?? jsonError("Unauthorized.", 401);
  }

  try {
    const spkId = await getSPKId(context);

    if (spkId === null) {
      return jsonError("Invalid SPK ID.", 400);
    }

    const existing = await prisma.sPK.findFirst({
      where: {
        id: spkId,
        ...(auth.isSuperAdmin
          ? {}
          : { companyId: auth.user.companyId! }),
        deletedAt: null,
      },

      select: {
        id: true,
        companyId: true,
        spkNumber: true,
      },
    });

    if (!existing) {
      return jsonError(
        "SPK not found or already deleted.",
        404,
      );
    }

    // Gunakan companyId dari SPK, bukan dari request.
    const companyId = existing.companyId;

    await prisma.$transaction(async (tx) => {
      const result = await tx.sPK.updateMany({
        where: {
          id: spkId,
          companyId,
          deletedAt: null,
        },

        data: {
          deletedAt: new Date(),
          deletedById: auth.user!.id,
        },
      });

      if (result.count === 0) {
        throw new Error("SPK_ALREADY_DELETED");
      }

      await tx.activityLog.create({
        data: {
          companyId,
          userId: auth.user!.id,
          action: "SOFT_DELETE",
          entityType: "SPK",
          entityId: String(spkId),
          description: `Soft-deleted SPK ${existing.spkNumber}`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "SPK deleted successfully.",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "SPK_ALREADY_DELETED"
    ) {
      return jsonError(
        "SPK not found or already deleted.",
        404,
      );
    }

    console.error("DELETE SPK error:", error);
    return jsonError("Failed to delete SPK.", 500);
  }
}
