
import { NextResponse } from "next/server";
import { CompanyStatus } from "@prisma/client";

import type { AuthenticatedUser } from "@/lib/auth/require-auth";
import { isSuperAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

export type TenantCompany = {
  id: number;
  name: string;
  code: string;
  slug: string;
  status: CompanyStatus;
};

export type ResolveTenantResult = {
  company: TenantCompany | null;
  companyId: number | null;
  response: NextResponse | null;
};

export type ActiveTenantResult =
  ResolveTenantResult & {
    allowed: boolean;
  };

function tenantError(
  message: string,
  status: number,
  error: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      message,
    },
    { status }
  );
}

/**
 * Resolve tenant from authenticated user.
 *
 * Regular users:
 * - companyId comes from the authenticated user.
 * - Cannot switch tenant.
 *
 * Superadmin:
 * - Must explicitly select a company.
 */
export async function resolveTenant(
  user: AuthenticatedUser,
  targetCompanyId?: number | null
): Promise<ResolveTenantResult> {
  let companyId: number;

  if (isSuperAdmin(user)) {
    if (
      targetCompanyId === undefined ||
      targetCompanyId === null ||
      !Number.isSafeInteger(targetCompanyId) ||
      targetCompanyId <= 0
    ) {
      return {
        company: null,
        companyId: null,
        response: tenantError(
          "A valid companyId is required for Superadmin.",
          400,
          "Bad Request"
        ),
      };
    }

    companyId = targetCompanyId;
  } else {
    if (
      user.companyId === null ||
      user.companyId <= 0
    ) {
      return {
        company: null,
        companyId: null,
        response: tenantError(
          "User does not belong to a company.",
          403,
          "Forbidden"
        ),
      };
    }

    if (
      targetCompanyId !== undefined &&
      targetCompanyId !== null &&
      (
        !Number.isSafeInteger(targetCompanyId) ||
        targetCompanyId !== user.companyId
      )
    ) {
      return {
        company: null,
        companyId: null,
        response: tenantError(
          "You cannot access another company.",
          403,
          "Forbidden"
        ),
      };
    }

    companyId = user.companyId;
  }

  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
    select: {
      id: true,
      name: true,
      code: true,
      slug: true,
      status: true,
    },
  });

  if (!company) {
    return {
      company: null,
      companyId: null,
      response: tenantError(
        "Company not found.",
        404,
        "Not Found"
      ),
    };
  }

  return {
    company,
    companyId: company.id,
    response: null,
  };
}

/**
 * Require company status ACTIVE.
 */
export async function requireActiveCompany(
  user: AuthenticatedUser,
  targetCompanyId?: number | null
): Promise<ActiveTenantResult> {
  const resolved = await resolveTenant(
    user,
    targetCompanyId
  );

  if (resolved.response || !resolved.company) {
    return {
      ...resolved,
      allowed: false,
    };
  }

  if (resolved.company.status !== "ACTIVE") {
    const isSuspended =
      resolved.company.status === "SUSPENDED";

    return {
      ...resolved,
      allowed: false,
      response: tenantError(
        isSuspended
          ? "This company is currently suspended."
          : "This company is currently inactive.",
        403,
        "Company Inactive"
      ),
    };
  }

  return {
    ...resolved,
    allowed: true,
    response: null,
  };
}

/**
 * Tenant filter for Prisma queries.
 *
 * IMPORTANT:
 * An empty filter for Superadmin means all companies.
 * Use only when cross-company access is intentional.
 */
export function getTenantWhere(
  user: AuthenticatedUser
): { companyId?: number } {
  if (isSuperAdmin(user)) {
    return {};
  }

  if (
    user.companyId === null ||
    user.companyId <= 0
  ) {
    throw new Error("Tenant company context is missing.");
  }

  return {
    companyId: user.companyId,
  };
}

/**
 * Explicit company filter.
 */
export function getCompanyWhere(
  companyId: number
): { companyId: number } {
  if (
    !Number.isSafeInteger(companyId) ||
    companyId <= 0
  ) {
    throw new Error("Invalid companyId.");
  }

  return { companyId };
}
