
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, response } = await requireAuth();

  if (response) return response;

  const permission = requirePermission(user, "product.view");
  if (permission.response) return permission.response;

  if (user.companyId == null) {
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
      where: {
        companyId: user.companyId,
      },
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

  if (user.companyId == null) {
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

    if (!code || !name) {
      return NextResponse.json(
        {
          success: false,
          error: "Product code and name are required",
        },
        { status: 400 },
      );
    }

    const existingProduct = await prisma.product.findUnique({
      where: {
        companyId_code: {
          companyId: user.companyId,
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
        companyId: user.companyId,
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
