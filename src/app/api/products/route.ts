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

    const code = String(body.code ?? "").trim();
    const name = String(body.name ?? "").trim();
    const isActive = body.isActive !== false;

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