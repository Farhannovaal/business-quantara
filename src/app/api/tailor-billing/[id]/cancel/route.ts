import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";
import { cancelTailorBill } from "@/lib/tailor-billing/status-service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
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
      { status: 401 },
    );
  }

  if (!hasPermission(user, "tailor-billing.update")) {
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
    const billId = Number(id);

    if (!Number.isInteger(billId) || billId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ID tagihan tidak valid.",
        },
        { status: 400 },
      );
    }

    const bill = await cancelTailorBill(
      billId,
      user.id,
    );

    return NextResponse.json({
      success: true,
      data: bill,
      message: `Tagihan ${bill.billNumber} berhasil dibatalkan.`,
    });
  } catch (error) {
    console.error("Cancel tailor bill error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal membatalkan tagihan.",
      },
      { status: 400 },
    );
  }
}