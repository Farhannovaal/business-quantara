
import { requirePermission } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function isSuperAdmin(user: {
  role?: { name?: string | null } | null;
}) {
  return user.role?.name?.toLowerCase() === "superadmin";
}

function jsonError(error: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status },
  );
}

function parseCompanyId(value: string | null): number | null {
  if (!value) return null;

  const companyId = Number(value);

  if (!Number.isInteger(companyId) || companyId <= 0) {
    return null;
  }

  return companyId;
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth();

  if (response) return response;
  if (!user) return jsonError("Unauthorized.", 401);

  const permission = requirePermission(user, "workflow.view");
  if (permission.response) return permission.response;

  try {
    const superAdmin = isSuperAdmin(user);
    const companyIdParam =
      request.nextUrl.searchParams.get("companyId");

    let companyId: number;

    if (superAdmin) {
      // Daftar perusahaan digunakan oleh dropdown Superadmin.
      const companies = await prisma.company.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      // Belum memilih perusahaan: tampilkan daftar perusahaan dahulu.
      if (!companyIdParam) {
        return NextResponse.json({
          success: true,
          isSuperAdmin: true,
          companies,
          data: [],
        });
      }

      const parsedCompanyId = parseCompanyId(companyIdParam);

      if (!parsedCompanyId) {
        return jsonError("Company ID tidak valid.", 400);
      }

      const company = await prisma.company.findUnique({
        where: {
          id: parsedCompanyId,
        },
        select: {
          id: true,
        },
      });

      if (!company) {
        return jsonError("Company tidak ditemukan.", 404);
      }

      companyId = parsedCompanyId;

      const workflows = await prisma.workflow.findMany({
        where: {
          companyId,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          _count: {
            select: {
              steps: true,
              rules: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        isSuperAdmin: true,
        companies,
        selectedCompanyId: companyId,
        data: workflows,
      });
    }

    // Tenant hanya boleh mengakses perusahaan dari session.
    if (user.companyId == null) {
      return jsonError(
        "User belum terhubung dengan perusahaan.",
        403,
      );
    }

    companyId = user.companyId;

    const workflows = await prisma.workflow.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            steps: true,
            rules: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      isSuperAdmin: false,
      data: workflows,
    });
  } catch (error) {
    console.error("GET /api/workflows error:", error);

    return jsonError("Failed to load workflows", 500);
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireAuth();

  if (response) return response;
  if (!user) return jsonError("Unauthorized.", 401);

  const permission = requirePermission(user, "workflow.manage");
  if (permission.response) return permission.response;

  try {
    const body = await request.json();
    const superAdmin = isSuperAdmin(user);

    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "").trim();

    const description =
      body.description == null
        ? null
        : String(body.description).trim();

    const isActive = body.isActive !== false;

    if (!name) {
      return jsonError("Workflow name is required", 400);
    }

    if (!code) {
      return jsonError("Workflow code is required", 400);
    }

    let companyId: number;

    if (superAdmin) {
      const parsedCompanyId = Number(body.companyId);

      if (
        !Number.isInteger(parsedCompanyId) ||
        parsedCompanyId <= 0
      ) {
        return jsonError(
          "Superadmin harus menentukan companyId.",
          400,
        );
      }

      const company = await prisma.company.findUnique({
        where: {
          id: parsedCompanyId,
        },
        select: {
          id: true,
        },
      });

      if (!company) {
        return jsonError("Company tidak ditemukan.", 404);
      }

      companyId = parsedCompanyId;
    } else {
      if (user.companyId == null) {
        return jsonError(
          "User belum terhubung dengan perusahaan.",
          403,
        );
      }

      // Jangan mengambil companyId dari body untuk tenant.
      companyId = user.companyId;
    }

    const duplicate = await prisma.workflow.findFirst({
      where: {
        companyId,
        OR: [{ name }, { code }],
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      return jsonError(
        "Workflow name or code already exists in this company.",
        409,
      );
    }

    const workflow = await prisma.workflow.create({
      data: {
        companyId,
        name,
        code,
        description,
        isActive,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: workflow,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/workflows error:", error);

    return jsonError("Failed to create workflow", 500);
  }
}
