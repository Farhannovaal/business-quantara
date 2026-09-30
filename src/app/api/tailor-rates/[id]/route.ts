import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
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
    const { id } = await context.params;

    const rateId = Number(id);

    if (!Number.isInteger(rateId) || rateId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ID tarif tidak valid.",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const existing = await prisma.tailorRate.findUnique({
      where: {
        id: rateId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: "Tarif tidak ditemukan.",
        },
        { status: 404 },
      );
    }

    /*
     * Untuk menjaga histori tarif,
     * kita tidak mengubah tailor/product/effectiveFrom
     * pada record lama.
     *
     * Yang bisa diubah:
     * - rate
     * - effectiveTo
     * - isActive
     */

    const data: {
      rate?: number;
      effectiveTo?: Date | null;
      isActive?: boolean;
    } = {};

    if (body.rate !== undefined) {
      const rate = Number(body.rate);

      if (!Number.isFinite(rate) || rate <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Tarif harus lebih besar dari 0.",
          },
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
            {
              success: false,
              error: "Tanggal akhir tarif tidak valid.",
            },
            { status: 400 },
          );
        }

        if (effectiveTo < existing.effectiveFrom) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Tanggal akhir tidak boleh sebelum tanggal mulai.",
            },
            { status: 400 },
          );
        }

        data.effectiveTo = effectiveTo;
      }
    }

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    /*
     * Jika periode / status berubah, cek kembali overlap.
     */
    const nextEffectiveTo =
      data.effectiveTo !== undefined
        ? data.effectiveTo
        : existing.effectiveTo;

    const nextIsActive =
      data.isActive !== undefined
        ? data.isActive
        : existing.isActive;

    if (nextIsActive) {
      const overlappingRate = await prisma.tailorRate.findFirst({
        where: {
          id: {
            not: rateId,
          },
          tailorId: existing.tailorId,
          productId: existing.productId,
          isActive: true,

          effectiveFrom: {
            lte:
              nextEffectiveTo ??
              new Date("9999-12-31T23:59:59.999Z"),
          },

          OR: [
            {
              effectiveTo: null,
            },
            {
              effectiveTo: {
                gte: existing.effectiveFrom,
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
              "Periode tarif bertabrakan dengan tarif lain yang masih aktif.",
          },
          { status: 409 },
        );
      }
    }

    const updated = await prisma.tailorRate.update({
      where: {
        id: rateId,
      },
      data,
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

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update tailor rate error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal memperbarui tarif penjahit.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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
    const { id } = await context.params;

    const rateId = Number(id);

    if (!Number.isInteger(rateId) || rateId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ID tarif tidak valid.",
        },
        { status: 400 },
      );
    }

    const existing = await prisma.tailorRate.findUnique({
      where: {
        id: rateId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: "Tarif tidak ditemukan.",
        },
        { status: 404 },
      );
    }

    /*
     * Jangan hard delete.
     * Histori tarif harus tetap ada.
     */
    const updated = await prisma.tailorRate.update({
      where: {
        id: rateId,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Deactivate tailor rate error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal menonaktifkan tarif penjahit.",
      },
      { status: 500 },
    );
  }
}