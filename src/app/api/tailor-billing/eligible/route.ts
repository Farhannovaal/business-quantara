import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";
import { calculateTailorBilling } from "@/lib/tailor-billing/calculator";

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
    const spks = await prisma.sPK.findMany({
      where: {
        status: {
          not: "CANCELLED",
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const results = [];

    for (const spk of spks) {
      try {
        const summary = await calculateTailorBilling(spk.id);

        if (summary.billableQuantity > 0) {
          results.push(summary);
        }
      } catch (error) {
        /*
         * SPK tanpa tarif tidak membuat seluruh halaman gagal.
         * Nanti UI bisa menunjukkan bahwa tarif belum tersedia.
         */
        console.warn(
          `Skip billing calculation for SPK ${spk.id}:`,
          error,
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Get eligible tailor billing error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil data SPK yang dapat ditagihkan.",
      },
      { status: 500 },
    );
  }
}