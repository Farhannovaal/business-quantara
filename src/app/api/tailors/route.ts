
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

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  const permission = requirePermission(user, "tailor.view");
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
    const tailors = await prisma.tailor.findMany({
      where: superAdmin
        ? {}
        : { companyId: user.companyId! },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: tailors,
    });
  } catch (error) {
    console.error("GET /api/tailors error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load tailors",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireAuth();

  if (response) return response;

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  const permission = requirePermission(user, "tailor.manage");
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

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

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

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: "Tailor name is required",
        },
        { status: 400 },
      );
    }

    let companyId: number;

    if (superAdmin) {
      const requestedCompanyId = Number(body.companyId);

      if (
        body.companyId === undefined ||
        body.companyId === null ||
        body.companyId === "" ||
        !Number.isInteger(requestedCompanyId) ||
        requestedCompanyId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Super Admin harus memilih perusahaan yang valid.",
          },
          { status: 400 },
        );
      }

      companyId = requestedCompanyId;

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

    const existingTailor = await prisma.tailor.findUnique({
      where: {
        companyId_name: {
          companyId,
          name,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingTailor) {
      return NextResponse.json(
        {
          success: false,
          error: "Tailor name already exists",
        },
        { status: 409 },
      );
    }

    const tailor = await prisma.tailor.create({
      data: {
        companyId,
        name,
        isActive,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: tailor,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/tailors error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create tailor",
      },
      { status: 500 },
    );
  }
}
