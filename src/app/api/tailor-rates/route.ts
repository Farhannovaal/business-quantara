
import { NextRequest, NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

function parseDateInput(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  // HTML date input menghasilkan YYYY-MM-DD.
  // Simpan awal hari berdasarkan kalender Asia/Jakarta.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00+07:00`)
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getJakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const GET = withApiAuth(
  async ({ tenant }) => {
    const companyId = tenant!.id;

    try {
      const rates = await prisma.tailorRate.findMany({
        where: {
          companyId,
        },
        include: {
          tailor: {
            select: {
              id: true,
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
        },
        orderBy: [
          { tailor: { name: "asc" } },
          { product: { name: "asc" } },
          { effectiveFrom: "desc" },
        ],
      });

      return NextResponse.json({
        success: true,
        data: rates,
      });
    } catch (error) {
      console.error("Get tailor rates error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Gagal mengambil data tarif penjahit.",
        },
        { status: 500 }
      );
    }
  },
  {
    tenant: "required",
    permission: "tailor-rate.view",
  }
);

export const POST = withApiAuth(
  async ({ tenant, request }) => {
    const companyId = tenant!.id;

    try {
      const body = await request.json();

      const tailorId = Number(body.tailorId);

      const effectiveFrom = body.effectiveFrom
        ? parseDateInput(body.effectiveFrom)
        : parseDateInput(getJakartaToday());

      const effectiveTo = body.effectiveTo
        ? parseDateInput(body.effectiveTo)
        : null;

      // Mendukung payload bulk dan payload lama.
      const items: {
        productId: number;
        rate: number;
      }[] = Array.isArray(body.items)
        ? body.items.map(
            (item: {
              productId: unknown;
              rate: unknown;
            }) => ({
              productId: Number(item.productId),
              rate: Number(item.rate),
            })
          )
        : [
            {
              productId: Number(body.productId),
              rate: Number(body.rate),
            },
          ];

      // Validasi penjahit.
      if (!Number.isSafeInteger(tailorId) || tailorId <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Penjahit tidak valid.",
          },
          { status: 400 }
        );
      }

      // Validasi produk.
      if (!items.length) {
        return NextResponse.json(
          {
            success: false,
            error: "Pilih minimal satu produk.",
          },
          { status: 400 }
        );
      }

      if (
        items.some(
          (item) =>
            !Number.isSafeInteger(item.productId) ||
            item.productId <= 0 ||
            !Number.isFinite(item.rate) ||
            item.rate <= 0
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Pastikan semua produk valid dan tarif lebih besar dari 0.",
          },
          { status: 400 }
        );
      }

      // Cegah produk yang sama dimasukkan dua kali.
      const productIds = items.map((item) => item.productId);

      if (new Set(productIds).size !== productIds.length) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Produk yang sama tidak boleh dipilih dua kali.",
          },
          { status: 400 }
        );
      }

      // Validasi periode tarif.
      if (!effectiveFrom) {
        return NextResponse.json(
          {
            success: false,
            error: "Tanggal mulai tarif tidak valid.",
          },
          { status: 400 }
        );
      }

      if (body.effectiveTo && !effectiveTo) {
        return NextResponse.json(
          {
            success: false,
            error: "Tanggal akhir tarif tidak valid.",
          },
          { status: 400 }
        );
      }

      if (effectiveTo && effectiveTo < effectiveFrom) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Tanggal akhir tidak boleh sebelum tanggal mulai.",
          },
          { status: 400 }
        );
      }

      // Pastikan penjahit dan seluruh produk milik tenant aktif.
      const [tailor, products] = await Promise.all([
        prisma.tailor.findFirst({
          where: {
            id: tailorId,
            companyId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
          },
        }),

        prisma.product.findMany({
          where: {
            id: {
              in: productIds,
            },
            companyId,
            isActive: true,
          },
          select: {
            id: true,
            code: true,
            name: true,
          },
        }),
      ]);

      if (!tailor) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Penjahit tidak ditemukan atau tidak aktif pada perusahaan ini.",
          },
          { status: 400 }
        );
      }

      if (products.length !== productIds.length) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Ada produk yang tidak ditemukan atau tidak aktif pada perusahaan ini.",
          },
          { status: 400 }
        );
      }

      const maxDate = new Date(
        "9999-12-31T23:59:59.999Z"
      );

      // Simpan seluruh tarif secara atomik.
      const created = await prisma.$transaction(
        async (tx) => {
          const results = [];

          for (const item of items) {
            // Cek bentrok periode dalam tenant yang sama.
            const conflict = await tx.tailorRate.findFirst({
              where: {
                companyId,
                tailorId,
                productId: item.productId,
                isActive: true,
                effectiveFrom: {
                  lte: effectiveTo ?? maxDate,
                },
                OR: [
                  {
                    effectiveTo: null,
                  },
                  {
                    effectiveTo: {
                      gte: effectiveFrom,
                    },
                  },
                ],
              },
              select: {
                id: true,
              },
            });

            if (conflict) {
              const product = products.find(
                (entry) => entry.id === item.productId
              );

              throw new Error(
                `Periode tarif bertabrakan untuk produk ${
                  product?.code ?? item.productId
                } - ${product?.name ?? ""}.`
              );
            }

            const rate = await tx.tailorRate.create({
              data: {
                companyId,
                tailorId,
                productId: item.productId,
                rate: item.rate,
                isActive: true,
                effectiveFrom,
                effectiveTo,
              },
              include: {
                tailor: {
                  select: {
                    id: true,
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
              },
            });

            results.push(rate);
          }

          return results;
        }
      );

      return NextResponse.json(
        {
          success: true,
          message: `${created.length} tarif berhasil ditambahkan.`,
          data: created,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Create tailor rates error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Gagal membuat tarif penjahit.";

      const isConflict = message.startsWith(
        "Periode tarif bertabrakan"
      );

      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        {
          status: isConflict ? 409 : 500,
        }
      );
    }
  },
  {
    tenant: "required",
    permission: "tailor-rate.manage",
  }
);
