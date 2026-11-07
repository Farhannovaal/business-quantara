
import { NextRequest, NextResponse } from "next/server";

import {
  requireAuth,
  type AuthenticatedUser,
} from "@/lib/auth/require-auth";

import {
  isSuperAdmin,
  requirePermission,
} from "@/lib/auth/authorization";

import {
  resolveTenant,
  requireActiveCompany,
  type TenantCompany,
} from "@/lib/auth/tenant";

/**
 * Cookie untuk menyimpan company aktif yang dipilih Superadmin.
 */
const ACTIVE_COMPANY_COOKIE = "active_company_id";

/**
 * Context passed to the actual route handler.
 */
export type ApiHandlerContext<TContext = unknown> = {
  request: NextRequest;
  user: AuthenticatedUser;
  tenant: TenantCompany | null;
  context: TContext;
};

/**
 * Resolve company ID for Superadmin.
 *
 * Regular users do not need to supply companyId.
 * Their tenant is derived from the authenticated user.
 */
export type CompanyIdResolver<TContext = unknown> = (args: {
  request: NextRequest;
  user: AuthenticatedUser;
  context: TContext;
}) =>
  | number
  | null
  | undefined
  | Promise<number | null | undefined>;

/**
 * Global API guard configuration.
 */
export type ApiGuardOptions<TContext = unknown> = {
  /**
   * Required permission code.
   *
   * Examples:
   * "product.create"
   * "transaction.cancel"
   *
   * Superadmin bypasses permission checks.
   */
  permission?: string;

  /**
   * Restrict endpoint to Superadmin.
   */
  superadminOnly?: boolean;

  /**
   * Require company context.
   *
   * "none":
   *   No company resolution.
   *
   * "required":
   *   Resolve tenant/company before executing handler.
   */
  tenant?: "none" | "required";

  /**
   * Require company status ACTIVE.
   *
   * Default: true when tenant = "required".
   */
  requireActiveCompany?: boolean;

  /**
   * Explicit company ID resolver.
   *
   * If provided, this takes priority over the active company cookie.
   * The resolved ID is still validated by the tenant resolver.
   */
  resolveCompanyId?: CompanyIdResolver<TContext>;
};

/**
 * Standard route handler.
 */
export type ApiHandler<TContext = unknown> = (
  args: ApiHandlerContext<TContext>
) => Promise<NextResponse>;

/**
 * Create a standardized API error response.
 */
function apiError(
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
 * Resolve active company ID from HttpOnly cookie.
 *
 * Only Superadmin can use this cookie.
 *
 * The cookie is treated as a selection hint, not as authorization.
 * The actual company is always validated against the database
 * through requireActiveCompany() or resolveTenant().
 *
 * Regular users always use their authenticated session company.
 */
function getActiveCompanyIdFromCookie(
  request: NextRequest,
  user: AuthenticatedUser
): number | undefined {
  if (!isSuperAdmin(user)) {
    return undefined;
  }

  const rawCompanyId = request.cookies.get(
    ACTIVE_COMPANY_COOKIE
  )?.value;

  if (!rawCompanyId) {
    return undefined;
  }

  const companyId = Number(rawCompanyId);

  if (
    !Number.isSafeInteger(companyId) ||
    companyId <= 0
  ) {
    return undefined;
  }

  return companyId;
}

/**
 * Centralized API authentication and authorization wrapper.
 *
 * Company resolution priority:
 *
 * 1. Explicit resolveCompanyId, if configured.
 * 2. Superadmin active company cookie.
 * 3. Regular user company from authenticated session.
 *
 * Usage:
 *
 * export const GET = withApiAuth(
 *   async ({ user, tenant }) => {
 *     // ...
 *   },
 *   {
 *     tenant: "required",
 *     permission: "product.view",
 *   }
 * );
 */
export function withApiAuth<TContext = unknown>(
  handler: ApiHandler<TContext>,
  options: ApiGuardOptions<TContext> = {}
) {
  return async (
    request: NextRequest,
    context: TContext
  ): Promise<NextResponse> => {
    try {
      /**
       * 1. Authentication
       */
      const auth = await requireAuth();

      if (auth.response || !auth.user) {
        return (
          auth.response ??
          apiError(
            "Authentication required.",
            401,
            "Unauthorized"
          )
        );
      }

      const user = auth.user;

      /**
       * 2. Superadmin-only validation
       */
      if (
        options.superadminOnly &&
        !isSuperAdmin(user)
      ) {
        return apiError(
          "This endpoint is restricted to Superadmin.",
          403,
          "Forbidden"
        );
      }

      /**
       * 3. Permission validation
       */
      if (options.permission) {
        const permission = requirePermission(
          user,
          options.permission
        );

        if (!permission.allowed) {
          return (
            permission.response ??
            apiError(
              "You do not have permission to perform this action.",
              403,
              "Forbidden"
            )
          );
        }
      }

      /**
       * 4. Tenant resolution
       */
      let tenant: TenantCompany | null = null;

      const tenantPolicy = options.tenant ?? "required";

      if (tenantPolicy === "required") {
        /**
         * Resolve company ID.
         *
         * Explicit resolver takes priority.
         * Otherwise, Superadmin uses active_company_id cookie.
         * Regular users use their authenticated session company.
         */
        const targetCompanyId = options.resolveCompanyId
          ? await options.resolveCompanyId({
              request,
              user,
              context,
            })
          : getActiveCompanyIdFromCookie(request, user);

        /**
         * 5. Company status validation
         */
        const requireActive =
          options.requireActiveCompany ?? true;

        const tenantResult = requireActive
          ? await requireActiveCompany(
              user,
              targetCompanyId
            )
          : await resolveTenant(
              user,
              targetCompanyId
            );

        if (
          tenantResult.response ||
          !tenantResult.company
        ) {
          return (
            tenantResult.response ??
            apiError(
              "Company context is unavailable.",
              403,
              "Forbidden"
            )
          );
        }

        tenant = tenantResult.company;
      }

      /**
       * 6. Execute actual route handler
       */
      return await handler({
        request,
        user,
        tenant,
        context,
      });
    } catch (error) {
      /**
       * Do not expose internal errors to API clients.
       */
      console.error("[API GUARD ERROR]", {
        method: request.method,
        pathname: request.nextUrl.pathname,
        error,
      });

      return apiError(
        "An unexpected server error occurred.",
        500,
        "Internal Server Error"
      );
    }
  };
}
