
import { NextResponse } from "next/server";

import { withApiAuth } from "@/lib/auth/api-guard";
import { getEffectivePermissions } from "@/lib/auth/authorization";

export const GET = withApiAuth(
  async ({ user }) => {
    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,

        company: user.company
          ? {
              id: user.company.id,
              name: user.company.name,
              code: user.company.code,
              slug: user.company.slug,
              status: user.company.status,
            }
          : null,

        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
            }
          : null,

        isSuperAdmin:
          user.role?.name.trim().toLowerCase() ===
          "superadmin",

        permissions: getEffectivePermissions(user),
      },
    });
  },
  {
    tenant: "none",
  }
);
