import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { user, response } = await requireAuth();
  if (response) return response;

  const permission = requirePermission(user, "activity.view");
  if (permission.response) return permission.response;

  try {
    const { id } = await context.params;
    const transactionId = Number(id);

    if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
      return NextResponse.json(
        { success: false, error: "ID transaksi tidak valid." },
        { status: 400 },
      );
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, transactionNumber: true },
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaksi tidak ditemukan." },
        { status: 404 },
      );
    }

    const logs = await prisma.activityLog.findMany({
      where: {
        entityType: "Transaction",
        entityId: String(transactionId),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: logs,
      transaction,
    });
  } catch (error) {
    console.error("GET transaction activity error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil riwayat aktivitas transaksi." },
      { status: 500 },
    );
  }
}
