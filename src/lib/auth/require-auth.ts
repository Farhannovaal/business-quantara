
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

/**
 * Shared Prisma include for authenticated user.
 */
const authenticatedUserInclude = {
  company: true,
  role: {
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  },
  permissionOverrides: {
    include: {
      permission: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

/**
 * Type derived from Prisma.
 */
export type AuthenticatedUser = Prisma.UserGetPayload<{
  include: typeof authenticatedUserInclude;
}>;

/**
 * Load authenticated user from DB session.
 */
export async function getAuthenticatedUser(): Promise<
  AuthenticatedUser | null
> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
    include: authenticatedUserInclude,
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  return user;
}

/**
 * Validate user, role, and tenant relationship.
 */
export function validateUserTenantIdentity(
  user: AuthenticatedUser
): boolean {
  if (!user.role) {
    return false;
  }

  if (isSuperAdmin(user)) {
    return (
      user.companyId === null &&
      user.role.companyId === null &&
      user.company === null
    );
  }

  if (
    user.companyId === null ||
    user.company === null
  ) {
    return false;
  }

  if (user.role.companyId !== user.companyId) {
    return false;
  }

  if (user.company.id !== user.companyId) {
    return false;
  }

  return true;
}

/**
 * Require authentication.
 *
 * Company status is intentionally checked separately
 * through requireActiveCompany().
 */
export async function requireAuth(): Promise<{
  user: AuthenticatedUser | null;
  response: NextResponse | null;
}> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          message: "Authentication required.",
        },
        { status: 401 }
      ),
    };
  }

  if (!validateUserTenantIdentity(user)) {
    return {
      user: null,
      response: NextResponse.json(
        {
          success: false,
          error: "Forbidden",
          message: "Invalid user, role, or company configuration.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    response: null,
  };
}
