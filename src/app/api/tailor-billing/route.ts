import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";
import { createTailorBill } from "@/lib/tailor-billing/service";

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
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const tailorIdParam = searchParams.get("tailorId");
    const search = searchParams.get("search")?.trim();

    const tailorId = tailorIdParam
      ? Number(tailorIdParam)
      : null;

    if (
      tailorIdParam &&
      (!Number.isInteger(tailorId) || tailorId! <= 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "ID penjahit tidak valid.",
        },
        { status: 400 },
      );
    }

    const bills = await prisma.tailorBill.findMany({
      where: {
        ...(status
          ? {
              status: status as
                | "DRAFT"
                | "SUBMITTED"
                | "PAID"
                | "CANCELLED",
            }
          : {}),

        ...(tailorId
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

        items: {
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
    const body = await request.json();

    const tailorId = Number(body.tailorId);

    if (!Number.isInteger(tailorId) || tailorId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Penjahit tidak valid.",
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.items)) {
      return NextResponse.json(
        {
          success: false,
          error: "Items tagihan tidak valid.",
        },
        { status: 400 },
      );
    }

    const items = body.items.map(
      (item: {
        spkId: number | string;
        quantity: number | string;
      }) => ({
        spkId: Number(item.spkId),
        quantity: Number(item.quantity),
      }),
    );

    const notes =
      typeof body.notes === "string"
        ? body.notes.trim() || null
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
      {
        status: 201,
      },
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
      {
        status: 400,
      },
    );
  }
}