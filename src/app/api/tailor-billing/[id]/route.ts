import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
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
      {
        status: 401,
      },
    );
  }

  if (!hasPermission(user, "tailor-billing.view")) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const { id } = await context.params;

    const billId = Number(id);

    if (
      !Number.isInteger(billId) ||
      billId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "ID tagihan tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    const bill =
      await prisma.tailorBill.findUnique({
        where: {
          id: billId,
        },

        include: {
          tailor: true,

          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },

          items: {
            include: {
              /*
               * SPK sekarang tidak memiliki
               * product langsung.
               *
               * Product untuk billing sudah
               * tersimpan langsung di
               * TailorBillItem.product.
               */
              spk: {
                include: {
                  tailor: true,

                  items: {
                    include: {
                      product: true,
                    },
                  },
                },
              },

              product: true,
            },

            orderBy: {
              id: "asc",
            },
          },
        },
      });

    if (!bill) {
      return NextResponse.json(
        {
          success: false,
          error: "Tagihan tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      success: true,
      data: bill,
    });
  } catch (error) {
    console.error(
      "Get tailor bill detail error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Gagal mengambil detail tagihan.",
      },
      {
        status: 500,
      },
    );
  }
}