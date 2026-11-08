
import { NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "active_company_id";

// GET: Mengambil company yang terakhir dipilih Super Admin.
export const GET = withApiAuth(
  async ({ request }) => {
    const rawCompanyId =
      request.cookies.get(COOKIE_NAME)?.value;

    const companyId = rawCompanyId
      ? Number(rawCompanyId)
      : null;

    if (
      !companyId ||
      !Number.isSafeInteger(companyId) ||
      companyId <= 0
    ) {
      return NextResponse.json({
        success: true,
        data: {
          companyId: null,
          company: null,
        },
      });
    }

    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        code: true,
        slug: true,
        status: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        companyId: company?.id ?? null,
        company,
      },
    });
  },
  {
    superadminOnly: true,
    tenant: "none",
  }
);

// POST: Menyimpan company pilihan Super Admin.
export const POST = withApiAuth(
  async ({ request }) => {
    const body = await request.json().catch(() => null);

    const companyId = Number(body?.companyId);

    if (
      !Number.isSafeInteger(companyId) ||
      companyId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid company ID.",
        },
        { status: 400 }
      );
    }

    const company = await prisma.company.findUnique({
      where: {
        id: companyId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          message: "Company not found.",
        },
        { status: 404 }
      );
    }

    if (company.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Company is not active.",
        },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "Active company updated.",
      data: company,
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: String(company.id),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  },
  {
    superadminOnly: true,
    tenant: "none",
  }
);
