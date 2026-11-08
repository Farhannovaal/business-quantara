
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/authorization";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UserRole = {
  name?: string | null;
} | string | null | undefined;

/**
 * Memeriksa apakah user memiliki role Admin,
 * Administrator, atau Superadmin.
 */
function isAdminOrSuperadmin(user: {
  role?: UserRole;
}) {
  const roleName =
    typeof user.role === "string"
      ? user.role
      : user.role?.name ?? "";

  const normalizedRole = roleName
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, "");

  return [
    "ADMIN",
    "ADMINISTRATOR",
    "SUPERADMIN",
  ].includes(normalizedRole);
}

/**
 * GET /api/tailor-billing/[id]
 *
 * Mengambil detail tagihan.
 */
export async function GET(
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

  // Permission untuk melihat detail tagihan.
  if (!hasPermission(user, "tailor-billing.view")) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      { status: 403 },
    );
  }

  if (!user.companyId) {
    return NextResponse.json(
      {
        success: false,
        error: "Perusahaan aktif tidak ditemukan.",
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

    const bill = await prisma.tailorBill.findFirst({
      where: {
        id: billId,
        companyId: user.companyId,
        isDeleted: false,
      },
      include: {
        tailor: true,

        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        items: {
          include: {
            spk: {
              include: {
                tailor: true,
                items: {
                  include: {
                    product: true,
                  },
                },
              },
            },
            product: true,
          },
          orderBy: {
            id: "asc",
          },
        },
      },
    });

    if (!bill) {
      return NextResponse.json(
        {
          success: false,
          error: "Tagihan tidak ditemukan.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: bill,
    });
  } catch (error) {
    console.error(
      "Get tailor bill detail error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil detail tagihan.",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/tailor-billing/[id]
 *
 * DRAFT / CANCELLED:
 * Hard delete.
 *
 * SUBMITTED / PAID:
 * Soft delete (isDeleted = true).
 *
 * Hanya Admin, Administrator, dan Superadmin.
 */
export async function DELETE(
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

  // Hanya Admin, Administrator, dan Superadmin.
  if (!isAdminOrSuperadmin(user)) {
    const detectedRole =
      typeof user.role === "string"
        ? user.role
        : user.role?.name ?? null;

    console.warn(
      "[TAILOR BILL DELETE] Access denied:",
      {
        userId: user.id,
        role: detectedRole,
      },
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Hanya Admin atau Superadmin yang dapat menghapus tagihan.",
      },
      { status: 403 },
    );
  }

  if (!user.companyId) {
    return NextResponse.json(
      {
        success: false,
        error: "Perusahaan aktif tidak ditemukan.",
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

    const result = await prisma.$transaction(
      async (tx) => {
        // Pastikan tagihan berada di perusahaan user
        // dan belum pernah dihapus.
        const bill = await tx.tailorBill.findFirst({
          where: {
            id: billId,
            companyId: user.companyId,
            isDeleted: false,
          },
          select: {
            id: true,
            billNumber: true,
            status: true,
          },
        });

        if (!bill) {
          return {
            notFound: true as const,
          };
        }

        // DRAFT dan CANCELLED: hard delete.
        if (
          bill.status === "DRAFT" ||
          bill.status === "CANCELLED"
        ) {
          await tx.tailorBill.delete({
            where: {
              id: bill.id,
            },
          });

          return {
            notFound: false as const,
            billNumber: bill.billNumber,
            status: bill.status,
            deleteType: "HARD_DELETE" as const,
          };
        }

        // SUBMITTED dan PAID: soft delete.
        if (
          bill.status === "SUBMITTED" ||
          bill.status === "PAID"
        ) {
          await tx.tailorBill.update({
            where: {
              id: bill.id,
            },
            data: {
              isDeleted: true,
            },
          });

          return {
            notFound: false as const,
            billNumber: bill.billNumber,
            status: bill.status,
            deleteType: "SOFT_DELETE" as const,
          };
        }

        throw new Error(
          `Status tagihan tidak dikenali: ${bill.status}`,
        );
      },
    );

    if (result.notFound) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tagihan tidak ditemukan atau sudah dihapus.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        result.deleteType === "HARD_DELETE"
          ? "Tagihan berhasil dihapus permanen."
          : "Tagihan berhasil disembunyikan.",
      data: {
        id: billId,
        billNumber: result.billNumber,
        status: result.status,
        deleteType: result.deleteType,
      },
    });
  } catch (error) {
    console.error(
      "Delete tailor bill error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Gagal menghapus tagihan.",
      },
      { status: 500 },
    );
  }
}
