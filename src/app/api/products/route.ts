
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { withApiAuth } from "@/lib/auth/api-guard";

function parsePositiveInteger(
  value: string | null,
  fallback: number
): number | null {
  if (value === null) {
    return fallback;
  }

  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

/**
 * GET /api/products
 *
 * Superadmin:
 * - Mengambil produk dari company yang dipilih melalui active_company_id.
 *
 * Tenant:
 * - Mengambil produk dari company milik user yang login.
 */
export const GET = withApiAuth(
  async ({ request, tenant }) => {
    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          message: "Company context is unavailable.",
        },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;

    const page = parsePositiveInteger(
      searchParams.get("page"),
      1
    );

    const requestedLimit = parsePositiveInteger(
      searchParams.get("limit"),
      20
    );

    if (page === null || requestedLimit === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid pagination parameters.",
        },
        { status: 400 }
      );
    }

    const limit = Math.min(requestedLimit, 100);
    const search = searchParams.get("search")?.trim();

    const where: Prisma.ProductWhereInput = {
      companyId: tenant.id,

      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                },
              },
              {
                code: {
                  contains: search,
                },
              },
            ],
          }
        : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.product.count({
        where,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      company: {
        id: tenant.id,
        name: tenant.name,
        code: tenant.code,
      },
    });
  },
  {
    tenant: "required",
    requireActiveCompany: true,
    permission: "product.view",
  }
);

/**
 * POST /api/products
 *
 * Superadmin:
 * - Company ID otomatis diambil dari active_company_id.
 *
 * Tenant:
 * - Company ID otomatis diambil dari authenticated session.
 */
export const POST = withApiAuth(
  async ({ request, tenant }) => {
    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          message: "Company context is unavailable.",
        },
        { status: 403 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;

    if (
      typeof payload.code !== "string" ||
      typeof payload.name !== "string" ||
      !payload.code.trim() ||
      !payload.name.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Code and name are required.",
        },
        { status: 400 }
      );
    }

    const code = payload.code.trim();
    const name = payload.name.trim();

    try {
      const product = await prisma.product.create({
        data: {
          companyId: tenant.id,
          code,
          name,
        },
      });

      return NextResponse.json(
        {
          success: true,
          message: "Product created successfully.",
          data: product,
        },
        { status: 201 }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Product code already exists.",
          },
          { status: 409 }
        );
      }

      throw error;
    }
  },
  {
    tenant: "required",
    requireActiveCompany: true,
    permission: "product.create",
  }
);
