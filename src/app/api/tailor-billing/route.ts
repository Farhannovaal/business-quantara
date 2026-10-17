
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";
import { createTailorBill } from "@/lib/tailor-billing/service";

type TailorBillInputItem = {
  spkId: number;
  productId: number;
  quantity: number;
};

type TailorBillRawItem = {
  spkId: number | string;
  productId: number | string;
  quantity: number | string;
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth();

  if (auth.response) {
    return auth.response;
  }

  const user = auth.user;

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  if (!hasPermission(user, "tailor-billing.view")) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = request.nextUrl;

    const status = searchParams.get("status");
    const tailorIdParam = searchParams.get("tailorId");
    const search = searchParams.get("search")?.trim();

    const tailorId = tailorIdParam
      ? Number(tailorIdParam)
      : null;

    if (
      tailorIdParam &&
      (!Number.isSafeInteger(tailorId) || tailorId! <= 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "ID penjahit tidak valid.",
        },
        { status: 400 },
      );
    }

    const allowedStatuses = [
      "DRAFT",
      "SUBMITTED",
      "PAID",
      "CANCELLED",
    ] as const;

    if (
      status &&
      !allowedStatuses.includes(
        status as (typeof allowedStatuses)[number],
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Status tagihan tidak valid.",
        },
        { status: 400 },
      );
    }

    const bills = await prisma.tailorBill.findMany({
      where: {
        // Tagihan operasional harus memiliki minimal satu
        // item dari SPK yang belum di-soft-delete.
        items: {
          some: {
            spk: {
              deletedAt: null,
            },
          },
        },

        ...(status
          ? {
              status: status as
                | "DRAFT"
                | "SUBMITTED"
                | "PAID"
                | "CANCELLED",
            }
          : {}),

        ...(tailorId !== null
          ? {
              tailorId,
            }
          : {}),

        ...(search
          ? {
              OR: [
                {
                  billNumber: {
                    contains: search,
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
      },

      include: {
        tailor: {
          select: {
            id: true,
            name: true,
          },
        },

        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        // Jangan tampilkan item dari SPK yang sudah dihapus.
        items: {
          where: {
            spk: {
              deletedAt: null,
            },
          },

          select: {
            id: true,
            spkId: true,
            productId: true,
            quantity: true,
            rate: true,
            amount: true,

            spk: {
              select: {
                id: true,
                spkNumber: true,
              },
            },

            product: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: bills,
    });
  } catch (error) {
    console.error("Get tailor bills error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil data tagihan penjahit.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();

  if (auth.response) {
    return auth.response;
  }

  const user = auth.user;

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  if (!hasPermission(user, "tailor-billing.create")) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      { status: 403 },
    );
  }

  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("tailorId" in body) ||
      !("items" in body)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Data tagihan tidak valid.",
        },
        { status: 400 },
      );
    }

    const payload = body as {
      tailorId: number | string;
      items: unknown;
      notes?: unknown;
    };

    const tailorId = Number(payload.tailorId);

    if (
      !Number.isSafeInteger(tailorId) ||
      tailorId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Penjahit tidak valid.",
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(payload.items)) {
      return NextResponse.json(
        {
          success: false,
          error: "Items tagihan tidak valid.",
        },
        { status: 400 },
      );
    }

    const rawItems = payload.items as TailorBillRawItem[];

    const items: TailorBillInputItem[] = rawItems.map(
      (item: TailorBillRawItem) => ({
        spkId: Number(item.spkId),
        productId: Number(item.productId),
        quantity: Number(item.quantity),
      }),
    );

    const invalidItem = items.some(
      (item: TailorBillInputItem) =>
        !Number.isSafeInteger(item.spkId) ||
        item.spkId <= 0 ||
        !Number.isSafeInteger(item.productId) ||
        item.productId <= 0 ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0,
    );

    if (invalidItem || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Data item tagihan tidak valid.",
        },
        { status: 400 },
      );
    }

    const notes =
      typeof payload.notes === "string"
        ? payload.notes.trim() || null
        : null;

    const bill = await createTailorBill(
      {
        tailorId,
        items,
        notes,
      },
      user.id,
    );

    return NextResponse.json(
      {
        success: true,
        data: bill,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create tailor bill error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal membuat tagihan penjahit.",
      },
      { status: 400 },
    );
  }
}
