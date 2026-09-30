"use client";

import {
  ReactNode,
  useEffect,
  useState,
} from "react";

type AuthUser = {
  role?: {
    name: string;
  } | null;
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
  const [allowed, setAllowed] =
    useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkPermission() {
      try {
        const response = await fetch(
          "/api/auth/me",
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          if (!cancelled) {
            setAllowed(false);
          }

          return;
        }

        const result =
          await response.json();

        const user =
          result?.user as AuthUser | undefined;

        const permissions =
          user?.permissions ?? [];

        const roleName =
          user?.role?.name?.toLowerCase();

        /*
         * Administrator memiliki seluruh permission.
         */
        if (
          roleName === "administrator"
        ) {
          if (!cancelled) {
            setAllowed(true);
          }

          return;
        }

        if (!cancelled) {
          setAllowed(
            permissions.includes(
              permission
            )
          );
        }
      } catch {
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

  /*
   * Jangan menampilkan action sebelum
   * permission selesai diperiksa.
   */
  if (allowed === null) {
    return null;
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}