import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withApiAuth } from "@/lib/auth/api-guard";

export const GET = withApiAuth(
  async () => {
    const companies = await prisma.company.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: companies,
    });
  },
  {
    superadminOnly: true,
    tenant: "none",
  }
);