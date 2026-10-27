
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

function isSuperAdmin(user: {
  role?: { name?: string | null } | null;
}) {
  return user.role?.name?.toLowerCase() === "superadmin";
}

export async function GET() {
  const { user, response } = await requireAuth();

  if (response) return response;

  const permission = requirePermission(user, "product.view");
  if (permission.response) return permission.response;

  const superAdmin = isSuperAdmin(user);

  if (!superAdmin && user.companyId == null) {
    return NextResponse.json(
      {
        success: false,
        error: "User belum terhubung dengan perusahaan.",
      },
      { status: 403 },
    );
  }

  try {
    const products = await prisma.product.findMany({
      where: superAdmin
        ? {}
        : { companyId: user.companyId! },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("GET /api/products error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load products",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireAuth();

  if (response) return response;

  const permission = requirePermission(user, "product.manage");
  if (permission.response) return permission.response;

  const superAdmin = isSuperAdmin(user);

  if (!superAdmin && user.companyId == null) {
    return NextResponse.json(
      {
        success: false,
        error: "User belum terhubung dengan perusahaan.",
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body",
        },
        { status: 400 },
      );
    }

    if (
      typeof body.code !== "string" ||
      typeof body.name !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Product code and name must be strings",
        },
        { status: 400 },
      );
    }

    const code = body.code.trim();
    const name = body.name.trim();

    if (!code || !name) {
      return NextResponse.json(
        {
          success: false,
          error: "Product code and name are required",
        },
        { status: 400 },
      );
    }

    let isActive = true;

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json(
          {
            success: false,
            error: "isActive must be a boolean",
          },
          { status: 400 },
        );
      }

      isActive = body.isActive;
    }

    let companyId: number;

    if (superAdmin) {
      if (
        typeof body.companyId !== "string" ||
        !body.companyId.trim()
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Super Admin harus memilih perusahaan.",
          },
          { status: 400 },
        );
      }

      companyId = body.companyId.trim();

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      });

      if (!company) {
        return NextResponse.json(
          {
            success: false,
            error: "Perusahaan tidak ditemukan.",
          },
          { status: 404 },
        );
      }
    } else {
      companyId = user.companyId!;
    }

    const existingProduct = await prisma.product.findUnique({
      where: {
        companyId_code: {
          companyId,
          code,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingProduct) {
      return NextResponse.json(
        {
          success: false,
          error: "Product code already exists",
        },
        { status: 409 },
      );
    }

    const product = await prisma.product.create({
      data: {
        companyId,
        code,
        name,
        isActive,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: product,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/products error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create product",
      },
      { status: 500 },
    );
  }
}
