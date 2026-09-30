import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";

import { calculateTailorBilling } from "@/lib/tailor-billing/calculator";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
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

    const spkId = Number(id);

    if (!Number.isInteger(spkId) || spkId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ID SPK tidak valid.",
        },
        {
          status: 400,
        },
      );
    }

    const data =
      await calculateTailorBilling(spkId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "Tailor billing calculation error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menghitung tagihan penjahit.",
      },
      {
        status: 500,
      },
    );
  }
}