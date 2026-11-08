
import { NextRequest, NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";
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

const ALLOWED_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PAID",
  "CANCELLED",
] as const;

export const GET = withApiAuth(
  async ({ request, tenant }) => {
    const companyId = tenant!.id;

    try {
      const { searchParams } = (request as NextRequest).nextUrl;

      const status = searchParams.get("status");
      const tailorIdParam = searchParams.get("tailorId");
      const search = searchParams.get("search")?.trim();

      const tailorId =
        tailorIdParam !== null ? Number(tailorIdParam) : null;

      if (
        tailorIdParam !== null &&
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

      if (
        status &&
        !ALLOWED_STATUSES.includes(
          status as (typeof ALLOWED_STATUSES)[number],
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
          companyId,

          items: {
            some: {
              spk: {
                companyId,
                deletedAt: null,
              },
            },
          },

          ...(status
            ? {
                status: status as (typeof ALLOWED_STATUSES)[number],
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

          items: {
            where: {
              spk: {
                companyId,
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
  },
  {
    tenant: "required",
    permission: "tailor-billing.view",
  },
);

export const POST = withApiAuth(
  async ({ request, user, tenant }) => {
    const companyId = tenant!.id;

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

      if (!Array.isArray(payload.items) || payload.items.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Items tagihan tidak valid.",
          },
          { status: 400 },
        );
      }

      const rawItems = payload.items as TailorBillRawItem[];

      const items: TailorBillInputItem[] = rawItems.map((item) => ({
        spkId: Number(item.spkId),
        productId: Number(item.productId),
        quantity: Number(item.quantity),
      }));

      const invalidItem = items.some(
        (item) =>
          !Number.isSafeInteger(item.spkId) ||
          item.spkId <= 0 ||
          !Number.isSafeInteger(item.productId) ||
          item.productId <= 0 ||
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0,
      );

      if (invalidItem) {
        return NextResponse.json(
          {
            success: false,
            error: "Data item tagihan tidak valid.",
          },
          { status: 400 },
        );
      }

      // Pastikan penjahit berasal dari perusahaan aktif.
      const tailor = await prisma.tailor.findFirst({
        where: {
          id: tailorId,
          companyId,
        },
        select: {
          id: true,
        },
      });

      if (!tailor) {
        return NextResponse.json(
          {
            success: false,
            error: "Penjahit tidak ditemukan pada perusahaan aktif.",
          },
          { status: 404 },
        );
      }

      // Pastikan seluruh SPK berasal dari perusahaan aktif
      // dan belum di-soft-delete.
      const spkIds = [...new Set(items.map((item) => item.spkId))];

      const validSpks = await prisma.sPK.findMany({
        where: {
          id: {
            in: spkIds,
          },
          companyId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (validSpks.length !== spkIds.length) {
        return NextResponse.json(
          {
            success: false,
            error: "Terdapat SPK yang tidak valid atau bukan milik perusahaan aktif.",
          },
          { status: 400 },
        );
      }

      // Pastikan seluruh produk berasal dari perusahaan aktif.
      const productIds = [
        ...new Set(items.map((item) => item.productId)),
      ];

      const validProducts = await prisma.product.findMany({
        where: {
          id: {
            in: productIds,
          },
          companyId,
        },
        select: {
          id: true,
        },
      });

      if (validProducts.length !== productIds.length) {
        return NextResponse.json(
          {
            success: false,
            error: "Terdapat produk yang tidak valid atau bukan milik perusahaan aktif.",
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
        companyId,
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
  },
  {
    tenant: "required",
    permission: "tailor-billing.create",
  },
);
