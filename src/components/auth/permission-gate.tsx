
"use client";

import {
  ReactNode,
  useEffect,
  useState,
} from "react";

type AuthUser = {
  id?: number | string;
  name?: string;
  email?: string;
  role?: {
    id?: number;
    name?: string;
  } | null;
  isSuperAdmin?: boolean;
  permissions?: string[];
};

type PermissionGateProps = {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export default function PermissionGate({
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkPermission() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) {
            setAllowed(false);
          }
          return;
        }

        const result = await response.json();

        const user = result?.data as AuthUser | undefined;

        if (!user) {
          if (!cancelled) {
            setAllowed(false);
          }
          return;
        }

        const roleName = user.role?.name?.trim().toLowerCase();

        if (
          user.isSuperAdmin === true ||
          roleName === "superadmin"
        ) {
          if (!cancelled) {
            setAllowed(true);
          }
          return;
        }

        if (roleName === "administrator") {
          if (!cancelled) {
            setAllowed(true);
          }
          return;
        }

        const permissions = Array.isArray(user.permissions)
          ? user.permissions
          : [];

        if (!cancelled) {
          setAllowed(permissions.includes(permission));
        }
      } catch (error) {
        console.error(
          "Failed to check permission:",
          error
        );

        if (!cancelled) {
          setAllowed(false);
        }
      }
    }

    checkPermission();

    return () => {
      cancelled = true;
    };
  }, [permission]);

  if (allowed === null) {
    return null;
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
