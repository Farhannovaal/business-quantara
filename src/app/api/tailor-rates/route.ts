import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";

export async function GET() {
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

  if (!hasPermission(user, "tailor-rate.view")) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      { status: 403 },
    );
  }

  try {
    const rates = await prisma.tailorRate.findMany({
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
        {
          tailor: {
            name: "asc",
          },
        },
        {
          product: {
            name: "asc",
          },
        },
        {
          effectiveFrom: "desc",
        },
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

  if (!hasPermission(user, "tailor-rate.manage")) {
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
    const productId = Number(body.productId);
    const rate = Number(body.rate);

    const effectiveFrom = body.effectiveFrom
      ? new Date(body.effectiveFrom)
      : new Date();

    const effectiveTo = body.effectiveTo
      ? new Date(body.effectiveTo)
      : null;

    if (!Number.isInteger(tailorId) || tailorId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Penjahit tidak valid.",
        },
        { status: 400 },
      );
    }

    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Produk tidak valid.",
        },
        { status: 400 },
      );
    }

    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Tarif harus lebih besar dari 0.",
        },
        { status: 400 },
      );
    }

    if (Number.isNaN(effectiveFrom.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: "Tanggal mulai tarif tidak valid.",
        },
        { status: 400 },
      );
    }

    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: "Tanggal akhir tarif tidak valid.",
        },
        { status: 400 },
      );
    }

    if (effectiveTo && effectiveTo < effectiveFrom) {
      return NextResponse.json(
        {
          success: false,
          error: "Tanggal akhir tidak boleh sebelum tanggal mulai.",
        },
        { status: 400 },
      );
    }

    const [tailor, product] = await Promise.all([
      prisma.tailor.findUnique({
        where: { id: tailorId },
      }),
      prisma.product.findUnique({
        where: { id: productId },
      }),
    ]);

    if (!tailor || !tailor.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "Penjahit tidak ditemukan atau tidak aktif.",
        },
        { status: 400 },
      );
    }

    if (!product || !product.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "Produk tidak ditemukan atau tidak aktif.",
        },
        { status: 400 },
      );
    }

    /*
     * Cegah periode tarif bertabrakan.
     *
     * Existing:
     * [existingFrom, existingTo]
     *
     * New:
     * [effectiveFrom, effectiveTo]
     */
    const overlappingRate = await prisma.tailorRate.findFirst({
      where: {
        tailorId,
        productId,
        isActive: true,

        effectiveFrom: {
          lte: effectiveTo ?? new Date("9999-12-31T23:59:59.999Z"),
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
    });

    if (overlappingRate) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Periode tarif bertabrakan dengan tarif yang sudah ada.",
        },
        { status: 409 },
      );
    }

    const created = await prisma.tailorRate.create({
      data: {
        tailorId,
        productId,
        rate,
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

    return NextResponse.json(
      {
        success: true,
        data: created,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create tailor rate error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal membuat tarif penjahit.",
      },
      { status: 500 },
    );
  }
}