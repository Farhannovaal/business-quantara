import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const user = auth.user;
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (!hasPermission(user, "tailor-rate.view")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  try {
    const rates = await prisma.tailorRate.findMany({
      include: {
        tailor: { select: { id: true, name: true } },
        product: { select: { id: true, code: true, name: true } },
      },
      orderBy: [
        { tailor: { name: "asc" } },
        { product: { name: "asc" } },
        { effectiveFrom: "desc" },
      ],
    });

    return NextResponse.json({ success: true, data: rates });
  } catch (error) {
    console.error("Get tailor rates error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data tarif penjahit." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const user = auth.user;
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (!hasPermission(user, "tailor-rate.manage")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const tailorId = Number(body.tailorId);
    const effectiveFrom = body.effectiveFrom
      ? new Date(body.effectiveFrom)
      : new Date();
    const effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;

    // Tetap kompatibel dengan payload lama (productId + rate),
    // sekaligus menerima payload bulk (items: [{ productId, rate }]).
    const items: { productId: number; rate: number }[] = Array.isArray(body.items)
      ? body.items.map((item: { productId: unknown; rate: unknown }) => ({
          productId: Number(item.productId),
          rate: Number(item.rate),
        }))
      : [{ productId: Number(body.productId), rate: Number(body.rate) }];

    if (!Number.isInteger(tailorId) || tailorId <= 0) {
      return NextResponse.json(
        { success: false, error: "Penjahit tidak valid." },
        { status: 400 },
      );
    }

    if (!items.length) {
      return NextResponse.json(
        { success: false, error: "Pilih minimal satu produk." },
        { status: 400 },
      );
    }

    if (
      items.some(
        (item) =>
          !Number.isInteger(item.productId) ||
          item.productId <= 0 ||
          !Number.isFinite(item.rate) ||
          item.rate <= 0,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Pastikan semua produk valid dan tarif lebih besar dari 0.",
        },
        { status: 400 },
      );
    }

    const productIds = items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      return NextResponse.json(
        { success: false, error: "Produk yang sama tidak boleh dipilih dua kali." },
        { status: 400 },
      );
    }

    if (Number.isNaN(effectiveFrom.getTime())) {
      return NextResponse.json(
        { success: false, error: "Tanggal mulai tarif tidak valid." },
        { status: 400 },
      );
    }
    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) {
      return NextResponse.json(
        { success: false, error: "Tanggal akhir tarif tidak valid." },
        { status: 400 },
      );
    }
    if (effectiveTo && effectiveTo < effectiveFrom) {
      return NextResponse.json(
        { success: false, error: "Tanggal akhir tidak boleh sebelum tanggal mulai." },
        { status: 400 },
      );
    }

    const [tailor, products] = await Promise.all([
      prisma.tailor.findUnique({ where: { id: tailorId } }),
      prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, code: true, name: true },
      }),
    ]);

    if (!tailor || !tailor.isActive) {
      return NextResponse.json(
        { success: false, error: "Penjahit tidak ditemukan atau tidak aktif." },
        { status: 400 },
      );
    }
    if (products.length !== productIds.length) {
      return NextResponse.json(
        { success: false, error: "Ada produk yang tidak ditemukan atau tidak aktif." },
        { status: 400 },
      );
    }

    const maxDate = new Date("9999-12-31T23:59:59.999Z");

    const created = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of items) {
        const conflict = await tx.tailorRate.findFirst({
          where: {
            tailorId,
            productId: item.productId,
            isActive: true,
            effectiveFrom: { lte: effectiveTo ?? maxDate },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: effectiveFrom } },
            ],
          },
          select: { id: true },
        });

        if (conflict) {
          const product = products.find((entry) => entry.id === item.productId);
          throw new Error(
            `Periode tarif bertabrakan untuk produk ${product?.code ?? item.productId} - ${product?.name ?? ""}.`,
          );
        }

        const rate = await tx.tailorRate.create({
          data: {
            tailorId,
            productId: item.productId,
            rate: item.rate,
            isActive: true,
            effectiveFrom,
            effectiveTo,
          },
          include: {
            tailor: { select: { id: true, name: true } },
            product: { select: { id: true, code: true, name: true } },
          },
        });
        results.push(rate);
      }

      return results;
    });

    return NextResponse.json(
      {
        success: true,
        message: `${created.length} tarif berhasil ditambahkan.`,
        data: created,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create tailor rates error:", error);
    const message = error instanceof Error ? error.message : "Gagal membuat tarif penjahit.";
    const isConflict = message.startsWith("Periode tarif bertabrakan");
    return NextResponse.json(
      { success: false, error: message },
      { status: isConflict ? 409 : 500 },
    );
  }
}
