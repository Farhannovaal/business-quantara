"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  Activity,
  BarChart3,
  ChevronDown,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  ScanLine,
  Settings,
  UserCircle,
  Users,
  Workflow,
  CircleDot,
} from "lucide-react";

type AuthUser = {
  id: number;
  name: string;
  email: string;
  status: string;

  role: {
    id: number;
    name: string;
  } | null;

  permissions: string[];
};

type MenuItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  permission: string;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    title: "OPERATIONS",

    items: [
      {
        label: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        permission: "dashboard.view",
      },

      {
        label: "SPK",
        href: "/operations/spk",
        icon: ClipboardList,
        permission: "spk.view",
      },

      {
        label: "Transactions",
        href: "/operations/transactions",
        icon: Activity,
        permission: "transaction.view",
      },

      {
        label: "Tracking",
        href: "/operations/tracking",
        icon: BarChart3,
        permission: "tracking.view",
      },

      {
        label: "Field Scanner",
        href: "/operations/scanner",
        icon: ScanLine,
        permission: "scanner.view",
      },

      {
        label: "Scanner History",
        href: "/operations/scanner/history",
        icon: History,
        permission: "scanner.view",
      },
    ],
  },

  {
    title: "MASTER DATA",

    items: [
      {
        label: "Products",
        href: "/master/products",
        icon: Package,
        permission: "product.view",
      },

      {
        label: "Tailors",
        href: "/master/tailors",
        icon: Users,
        permission: "tailor.view",
      },

      {
        label: "Employees",
        href: "/master/employees",
        icon: Users,
        permission: "employee.view",
      },
    ],
  },

  {
    title: "AUTOMATION",

    items: [
      {
        label: "Workflows",
        href: "/automation/workflows",
        icon: Workflow,
        permission: "workflow.view",
      },

      {
        label: "Business Rules",
        href: "/automation/rules",
        icon: Settings,
        permission: "rule.view",
      },
    ],
  },
];

/*
 * ============================================================
 * ACTIVE PATH
 * ============================================================
 *
 * Contoh:
 *
 * pathname:
 * /operations/scanner/history
 *
 * Kedua route berikut bisa match:
 *
 * /operations/scanner
 * /operations/scanner/history
 *
 * Fungsi ini tetap dipakai untuk menentukan
 * apakah sebuah route merupakan kandidat active.
 * Nanti kita pilih kandidat paling spesifik
 * menggunakan activeHref.
 */
function isActivePath(
  pathname: string,
  href: string,
) {
  if (href === "/") {
    return pathname === "/";
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const [userMenuOpen, setUserMenuOpen] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [authUser, setAuthUser] =
    useState<AuthUser | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const userMenuRef =
    useRef<HTMLDivElement>(null);

  /*
   * ==========================================================
   * LOAD AUTH USER
   * ==========================================================
   */

  useEffect(() => {
    let cancelled = false;

    async function loadAuthUser() {
      try {
        const response = await fetch(
          "/api/auth/me",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        );

        const result =
          await response.json();

        console.log(
          "[AppShell] auth:",
          result,
        );

        if (cancelled) {
          return;
        }

        if (
          !response.ok ||
          !result?.authenticated ||
          !result?.user
        ) {
          setAuthUser(null);
          return;
        }

        setAuthUser(result.user);
      } catch (error) {
        console.error(
          "[AppShell] Failed to load auth:",
          error,
        );

        if (!cancelled) {
          setAuthUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }

    loadAuthUser();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * ==========================================================
   * CLOSE USER MENU WHEN CLICKING OUTSIDE
   * ==========================================================
   */

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent,
    ) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(
          event.target as Node,
        )
      ) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

  /*
   * ==========================================================
   * LOGOUT
   * ==========================================================
   */

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      const response = await fetch(
        "/api/auth/logout",
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error(
          "Logout failed",
        );
      }

      /*
       * Clear client auth state.
       */
      setAuthUser(null);
      setUserMenuOpen(false);

      /*
       * Full page navigation supaya
       * AppShell dibuat ulang ketika
       * user login kembali.
       */
      window.location.href = "/login";
    } catch (error) {
      console.error(
        "Logout error:",
        error,
      );

      setLoggingOut(false);

      alert(
        "Logout gagal. Silakan coba lagi.",
      );
    }
  }

  /*
   * ==========================================================
   * PUBLIC / AUTH PAGE
   * ==========================================================
   */

  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  /*
   * ==========================================================
   * CHECK PERMISSION
   * ==========================================================
   */

  function canAccess(
    permission: string,
  ) {
    /*
     * Selama auth masih loading,
     * jangan filter menu dulu.
     */
    if (authLoading) {
      return true;
    }

    /*
     * Kalau auth gagal,
     * jangan sembunyikan navigation.
     *
     * Backend tetap menjadi security layer.
     */
    if (!authUser) {
      return true;
    }

    /*
     * Administrator memiliki seluruh akses.
     */
    if (
      authUser.role?.name
        ?.toLowerCase() ===
      "administrator"
    ) {
      return true;
    }

    return authUser.permissions.includes(
      permission,
    );
  }

  /*
   * ==========================================================
   * APPLICATION SHELL
   * ==========================================================
   */

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ======================================================
          SIDEBAR
          ====================================================== */}

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-slate-200/80 bg-white shadow-xl shadow-slate-200/30 xl:flex">
        {/* BRAND */}

        <div className="flex h-20 shrink-0 items-center border-b border-slate-100 px-5">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-black text-white shadow-lg shadow-indigo-200">
              BO
            </div>

            <div>
              <p className="text-sm font-bold tracking-tight text-slate-800">
                Business Operation
              </p>

              <p className="text-[11px] font-medium text-slate-400">
                Operations Platform
              </p>
            </div>
          </Link>
        </div>

        {/* NAVIGATION */}

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {menuGroups.map((group) => {
            /*
             * Ambil menu yang boleh dilihat
             * oleh user.
             */
            const visibleItems =
              group.items.filter(
                (item) =>
                  canAccess(
                    item.permission,
                  ),
              );

            /*
             * ==================================================
             * FIND MOST SPECIFIC ACTIVE ROUTE
             * ==================================================
             *
             * Contoh:
             *
             * pathname:
             * /operations/scanner/history
             *
             * Kandidat:
             *
             * /operations/scanner
             * /operations/scanner/history
             *
             * Kita pilih href terpanjang.
             */

            const activeHref =
              visibleItems
                .filter((item) =>
                  isActivePath(
                    pathname,
                    item.href,
                  ),
                )
                .sort(
                  (a, b) =>
                    b.href.length -
                    a.href.length,
                )[0]?.href;

            /*
             * Kalau group tidak punya menu
             * yang bisa diakses user,
             * jangan tampilkan group.
             */
            if (
              !authLoading &&
              authUser &&
              visibleItems.length === 0
            ) {
              return null;
            }

            return (
              <div
                key={group.title}
                className="mb-7"
              >
                <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.16em] text-slate-400">
                  {group.title}
                </p>

                <div className="space-y-1">
                  {visibleItems.map(
                    (item) => {
                      const Icon =
                        item.icon;

                      /*
                       * HANYA href yang paling
                       * spesifik yang active.
                       */
                      const active =
                        item.href ===
                        activeHref;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            active
                              ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200"
                              : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                              active
                                ? "bg-white/15"
                                : "bg-slate-50 group-hover:bg-white"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>

                          <span>
                            {item.label}
                          </span>

                          {active && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </Link>
                      );
                    },
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        {/* SYSTEM STATUS */}

        <div className="mx-3 mb-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
              <CircleDot className="h-3.5 w-3.5" />
            </span>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                System
              </p>

              <p className="text-xs font-semibold text-indigo-700">
                Operational
              </p>
            </div>
          </div>
        </div>

        {/* USER MENU */}

        <div
          ref={userMenuRef}
          className="relative shrink-0 border-t border-slate-100 p-3"
        >
          <button
            type="button"
            onClick={() =>
              setUserMenuOpen(
                (open) => !open,
              )
            }
            aria-expanded={
              userMenuOpen
            }
            className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition ${
              userMenuOpen
                ? "bg-indigo-50"
                : "hover:bg-slate-50"
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200">
              {authUser?.name
                ? authUser.name
                    .split(" ")
                    .map(
                      (part) =>
                        part.charAt(
                          0,
                        ),
                    )
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "US"}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                {authUser?.name ??
                  "User"}
              </p>

              <p className="truncate text-xs text-slate-400">
                {authUser?.email ?? ""}
              </p>
            </div>

            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                userMenuOpen
                  ? "rotate-180"
                  : ""
              }`}
            />
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-[calc(100%-8px)] left-3 right-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
              {/* PROFILE */}

              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-3 text-left opacity-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
                  <UserCircle className="h-4 w-4 text-slate-500" />
                </span>

                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Profile
                  </p>

                  <p className="text-[11px] text-slate-400">
                    Coming soon
                  </p>
                </div>
              </button>

              <div className="mx-3 border-t border-slate-100" />

              {/* LOGOUT */}

              <button
                type="button"
                onClick={
                  handleLogout
                }
                disabled={loggingOut}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
                  <LogOut className="h-4 w-4" />
                </span>

                <span>
                  {loggingOut
                    ? "Logging out..."
                    : "Logout"}
                </span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN */}

      <main className="min-h-screen pb-20 xl:ml-64 xl:pb-0">
        {children}
      </main>
    </div>
  );
}