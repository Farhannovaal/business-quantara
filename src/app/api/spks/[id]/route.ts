import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import { calculateSPKStatus } from "@/lib/spk-status";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SPKItemInput = {
  productId: number;
  quantity: number;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(user, "spk.view");

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
        { status: 400 },
      );
    }

    const spk = await prisma.sPK.findFirst({
      where: {
        id: spkId,
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
        { status: 404 },
      );
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

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load SPK.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(user, "spk.update");

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
        { status: 400 },
      );
    }

    const existing = await prisma.sPK.findFirst({
      where: {
        id: spkId,
        deletedAt: null,
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
        { status: 404 },
      );
    }

    const body = await request.json();

    let spkNumber: string | undefined;

    if (body.spkNumber !== undefined) {
      spkNumber = String(body.spkNumber).trim();

      if (!spkNumber) {
        return NextResponse.json(
          {
            success: false,
            error: "SPK number cannot be empty.",
          },
          { status: 400 },
        );
      }

      const duplicate = await prisma.sPK.findFirst({
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
          { status: 409 },
        );
      }
    }

    let tailorId: number | undefined;

    if (body.tailorId !== undefined) {
      tailorId = Number(body.tailorId);

      if (!Number.isInteger(tailorId) || tailorId <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid tailor ID.",
          },
          { status: 400 },
        );
      }

      const tailor = await prisma.tailor.findUnique({
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
    }

    let status:
      | "ACTIVE"
      | "COMPLETED"
      | "CANCELLED"
      | undefined;

    if (body.status !== undefined) {
      const requestedStatus = String(body.status);

      if (
        !["ACTIVE", "COMPLETED", "CANCELLED"].includes(
          requestedStatus,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid SPK status.",
          },
          { status: 400 },
        );
      }

      status = requestedStatus as
        | "ACTIVE"
        | "COMPLETED"
        | "CANCELLED";
    }

    let items: SPKItemInput[] | undefined;

    if (body.items !== undefined) {
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "At least one product is required.",
          },
          { status: 400 },
        );
      }

      const normalizedItems: SPKItemInput[] = body.items.map(
        (item: unknown) => {
          const raw = item as {
            productId?: unknown;
            quantity?: unknown;
          };

          return {
            productId: Number(raw.productId),
            quantity: Number(raw.quantity),
          };
        },
      );

      const invalidItem = normalizedItems.find(
        (item) =>
          !Number.isInteger(item.productId) ||
          item.productId <= 0 ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0,
      );

      if (invalidItem) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Each item must have a valid productId and positive integer quantity.",
          },
          { status: 400 },
        );
      }

      const productIds = normalizedItems.map(
        (item) => item.productId,
      );

      if (new Set(productIds).size !== productIds.length) {
        return NextResponse.json(
          {
            success: false,
            error: "A product can only appear once in an SPK.",
          },
          { status: 400 },
        );
      }

      const products = await prisma.product.findMany({
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
            error: "One or more selected products were not found.",
            productIds: missingProductIds,
          },
          { status: 404 },
        );
      }

      const inactiveProducts = products.filter(
        (product) =>
          !product.isActive && productIds.includes(product.id),
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

    if (
      items === undefined &&
      body.productId !== undefined
    ) {
      const productId = Number(body.productId);

      if (!Number.isInteger(productId) || productId <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid product ID.",
          },
          { status: 400 },
        );
      }

      const product = await prisma.product.findUnique({
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
            error: "Product not found.",
          },
          { status: 404 },
        );
      }

      if (!product.isActive) {
        return NextResponse.json(
          {
            success: false,
            error: "Selected product is inactive.",
          },
          { status: 400 },
        );
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

    if (
      items !== undefined &&
      existing._count.transactions > 0
    ) {
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
        return NextResponse.json(
          {
            success: false,
            error:
              "SPK products or quantities cannot be changed because the SPK already has transactions.",
          },
          { status: 409 },
        );
      }
    }

    const spk = await prisma.$transaction(async (tx) => {
      const updated = await tx.sPK.updateMany({
        where: {
          id: spkId,
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

      return tx.sPK.findFirst({
        where: {
          id: spkId,
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
    });

    if (!spk) {
      return NextResponse.json(
        {
          success: false,
          error: "SPK not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: spk,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "SPK_NOT_FOUND_OR_DELETED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "SPK not found or already deleted.",
        },
        { status: 404 },
      );
    }

    console.error("PATCH SPK error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update SPK.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAuth();

  if (response) {
    return response;
  }

  const permission = requirePermission(user, "spk.delete");

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
        { status: 400 },
      );
    }

    const existing = await prisma.sPK.findFirst({
      where: {
        id: spkId,
        deletedAt: null,
      },
      select: {
        id: true,
        spkNumber: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: "SPK not found or already deleted.",
        },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const result = await tx.sPK.updateMany({
        where: {
          id: spkId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
          deletedById: user.id,
        },
      });

      if (result.count === 0) {
        throw new Error("SPK_ALREADY_DELETED");
      }

      await tx.activityLog.create({
        data: {
          userId: user.id,
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
      return NextResponse.json(
        {
          success: false,
          error: "SPK not found or already deleted.",
        },
        { status: 404 },
      );
    }

    console.error("DELETE SPK error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete SPK.",
      },
      { status: 500 },
    );
  }
}