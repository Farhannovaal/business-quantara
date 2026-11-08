import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function getPrismaErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
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
    const { id } = await context.params;
    const rateId = Number(id);

    if (!Number.isSafeInteger(rateId) || rateId <= 0) {
      return NextResponse.json(
        { success: false, error: "ID tarif tidak valid." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const existing = await prisma.tailorRate.findUnique({
      where: { id: rateId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Tarif tidak ditemukan." },
        { status: 404 },
      );
    }

    const data: {
      rate?: number;
      effectiveTo?: Date | null;
      isActive?: boolean;
    } = {};

    if (body.rate !== undefined) {
      const rate = Number(body.rate);
      if (!Number.isFinite(rate) || rate <= 0) {
        return NextResponse.json(
          { success: false, error: "Tarif harus lebih besar dari 0." },
          { status: 400 },
        );
      }
      data.rate = rate;
    }

    if (body.effectiveTo !== undefined) {
      if (body.effectiveTo === null || body.effectiveTo === "") {
        data.effectiveTo = null;
      } else {
        const effectiveTo = new Date(body.effectiveTo);
        if (Number.isNaN(effectiveTo.getTime())) {
          return NextResponse.json(
            { success: false, error: "Tanggal akhir tarif tidak valid." },
            { status: 400 },
          );
        }
        if (effectiveTo < existing.effectiveFrom) {
          return NextResponse.json(
            {
              success: false,
              error: "Tanggal akhir tidak boleh sebelum tanggal mulai.",
            },
            { status: 400 },
          );
        }
        data.effectiveTo = effectiveTo;
      }
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json(
          { success: false, error: "Status tarif tidak valid." },
          { status: 400 },
        );
      }
      data.isActive = body.isActive;
    }

    const nextEffectiveTo =
      data.effectiveTo !== undefined ? data.effectiveTo : existing.effectiveTo;
    const nextIsActive =
      data.isActive !== undefined ? data.isActive : existing.isActive;

    if (nextIsActive) {
      const overlappingRate = await prisma.tailorRate.findFirst({
        where: {
          id: { not: rateId },
          tailorId: existing.tailorId,
          productId: existing.productId,
          isActive: true,
          effectiveFrom: {
            lte: nextEffectiveTo ?? new Date("9999-12-31T23:59:59.999Z"),
          },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: existing.effectiveFrom } },
          ],
        },
        select: { id: true },
      });

      if (overlappingRate) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Periode tarif bertabrakan dengan tarif lain yang masih aktif.",
          },
          { status: 409 },
        );
      }
    }

    const updated = await prisma.tailorRate.update({
      where: { id: rateId },
      data,
      include: {
        tailor: { select: { id: true, name: true } },
        product: { select: { id: true, code: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Tarif berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    console.error("Update tailor rate error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui tarif penjahit." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
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
    const { id } = await context.params;
    const rateId = Number(id);

    if (!Number.isSafeInteger(rateId) || rateId <= 0) {
      return NextResponse.json(
        { success: false, error: "ID tarif tidak valid." },
        { status: 400 },
      );
    }

    const existing = await prisma.tailorRate.findUnique({
      where: { id: rateId },
      include: {
        tailor: { select: { name: true } },
        product: { select: { code: true, name: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Tarif tidak ditemukan." },
        { status: 404 },
      );
    }

    const action = request.nextUrl.searchParams.get("action");

    if (action === "permanent") {
      try {
        await prisma.tailorRate.delete({
          where: { id: rateId },
        });

        return NextResponse.json({
          success: true,
          message: "Tarif berhasil dihapus secara permanen.",
        });
      } catch (deleteError) {
        const code = getPrismaErrorCode(deleteError);
        if (code === "P2003" || code === "P2014") {
          return NextResponse.json(
            {
              success: false,
              error:
                "Tarif tidak dapat dihapus karena masih digunakan oleh data transaksi atau memiliki relasi. Nonaktifkan tarif sebagai gantinya.",
            },
            { status: 409 },
          );
        }
        throw deleteError;
      }
    }

    if (action && action !== "deactivate") {
      return NextResponse.json(
        { success: false, error: "Aksi penghapusan tidak valid." },
        { status: 400 },
      );
    }

    if (!existing.isActive) {
      return NextResponse.json({
        success: true,
        message: "Tarif sudah dalam status nonaktif.",
        data: existing,
      });
    }

    const updated = await prisma.tailorRate.update({
      where: { id: rateId },
      data: { isActive: false },
      include: {
        tailor: { select: { id: true, name: true } },
        product: { select: { id: true, code: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Tarif berhasil dinonaktifkan.",
      data: updated,
    });
  } catch (error) {
    console.error("Delete tailor rate error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memproses tarif penjahit." },
      { status: 500 },
    );
  }
}
