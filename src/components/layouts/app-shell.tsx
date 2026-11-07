

"use client";

import Link from "next/link";

import ThemeToggle from "@/components/theme-toggle";

import {

  usePathname,

  useRouter,

  useSearchParams,

} from "next/navigation";

import { useCallback, useEffect, useRef, useState } from "react";

import {

  Activity,

  BarChart3,

  Bell,

  ChevronRight,

  CircleDollarSign,

  ClipboardList,

  History,

  LayoutDashboard,

  LogOut,

  Menu,

  Package,

  ScanLine,

  Settings,

  ShieldCheck,

  UserCog,

  Users,

  Workflow,

  Zap,

  X,

  Building2,

} from "lucide-react";

type Company = {

  id: number;

  name: string;

  code: string;

  slug: string;

  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";

};

type AuthUser = {

  id: number;

  name: string;

  email: string;

  status: string;

  company?: {

    id: number;

    name: string;

    code?: string;

    slug?: string;

    status?: string;

  } | null;

  role: {

    id: number;

    name: string;

  } | null;

  isSuperAdmin: boolean;

  permissions: string[];

};

type MenuItem = {

  label: string;

  href: string;

  icon: React.ComponentType<{ className?: string }>;

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

        label: "Report",

        href: "/reports/production",

        icon: BarChart3,

        permission: "report.view",

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

      {

        label: "Quality Control",

        href: "/qc",

        icon: ShieldCheck,

        permission: "qc.view",

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

      {

        label: "Tailor Rates",

        href: "/master/tailor-rates",

        icon: CircleDollarSign,

        permission: "tailor-rate.view",

      },

      {

        label: "Tailor Billing",

        href: "/master/tailor-billing",

        icon: CircleDollarSign,

        permission: "tailor-billing.view",

      },

      {

        label: "User Management",

        href: "/settings/users",

        icon: UserCog,

        permission: "user.view",

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

      {

        label: "Notification Settings",

        href: "/notifications",

        icon: Bell,

        permission: "notification.view",

      },

      {

        label: "Notification Events",

        href: "/notifications/events",

        icon: Zap,

        permission: "notification.view",

      },

    ],

  },

];

const mobileItems: MenuItem[] = [

  {

    label: "Home",

    href: "/",

    icon: LayoutDashboard,

    permission: "dashboard.view",

  },

  {

    label: "Report",

    href: "/reports/production",

    icon: BarChart3,

    permission: "report.view",

  },

  {

    label: "SPK",

    href: "/operations/spk",

    icon: ClipboardList,

    permission: "spk.view",

  },

  {

    label: "Transaction",

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

    label: "QC",

    href: "/qc",

    icon: ShieldCheck,

    permission: "qc.view",

  },

  {

    label: "Billing",

    href: "/master/tailor-billing",

    icon: CircleDollarSign,

    permission: "tailor-billing.view",

  },

  {

    label: "Scanner",

    href: "/operations/scanner",

    icon: ScanLine,

    permission: "scanner.view",

  },

  {

    label: "Notification",

    href: "/notifications",

    icon: Bell,

    permission: "notification.view",

  },

  {

    label: "Events",

    href: "/notifications/events",

    icon: Zap,

    permission: "notification.view",

  },

];

function getActiveHref(

  pathname: string,

  items: MenuItem[],

): string | null {

  const matches = items.filter(({ href }) =>

    href === "/"

      ? pathname === "/"

      : pathname === href || pathname.startsWith(`${href}/`),

  );

  return (

    matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ??

    null

  );

}

function initials(name?: string) {

  return (name || "User")

    .trim()

    .split(/\s+/)

    .slice(0, 2)

    .map((part) => part[0]?.toUpperCase() || "")

    .join("");

}

export default function AppShell({

  children,

}: {

  children: React.ReactNode;

}) {

  const pathname = usePathname();

  const router = useRouter();

  const searchParams = useSearchParams();

  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const userMenuRef = useRef<HTMLDivElement>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const [authLoading, setAuthLoading] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);

  const [companiesLoading, setCompaniesLoading] = useState(false);

  const [companyError, setCompanyError] = useState("");
  const [changingCompany, setChangingCompany] = useState(false);

  const isSuperAdmin = authUser?.isSuperAdmin === true;

  const selectedCompanyId = searchParams.get("companyId") ?? "";

  const selectedCompany = companies.find(

    (company) => String(company.id) === selectedCompanyId,

  );

  const activeCompanies = companies.filter(

    (company) => company.status === "ACTIVE",

  );

  // ------------------------------------------------------------

  // AUTHENTICATION

  // ------------------------------------------------------------

  useEffect(() => {

    let cancelled = false;

    async function loadAuthUser() {

      try {

        const response = await fetch("/api/auth/me", {

          method: "GET",

          credentials: "include",

          cache: "no-store",

        });

        const result = await response.json();

        if (cancelled) return;

        const user = result?.data ?? result?.user ?? null;

        if (!response.ok || !user || !user.id) {

          setAuthUser(null);

          return;

        }

        const normalizedUser: AuthUser = {

          ...user,

          isSuperAdmin:

            user.isSuperAdmin === true ||

            user.role?.name?.trim().toLowerCase() === "superadmin",

          permissions: Array.isArray(user.permissions)

            ? user.permissions

            : [],

        };

        setAuthUser(normalizedUser);

      } catch (error) {

        console.error("[AppShell] Failed to load auth:", error);

        if (!cancelled) {

          setAuthUser(null);

        }

      } finally {

        if (!cancelled) {

          setAuthLoading(false);

        }

      }

    }

    void loadAuthUser();

    return () => {

      cancelled = true;

    };

  }, []);

  // ------------------------------------------------------------

  // LOAD COMPANIES FOR SUPERADMIN

  // ------------------------------------------------------------

  useEffect(() => {

    if (authLoading || !isSuperAdmin) {

      setCompanies([]);

      setCompaniesLoading(false);

      return;

    }

    let cancelled = false;

    async function loadCompanies() {

      setCompaniesLoading(true);

      setCompanyError("");

      try {

        const response = await fetch("/api/companies", {

          method: "GET",

          credentials: "include",

          cache: "no-store",

        });

        const result = await response.json();

        if (!response.ok || !result.success) {

          throw new Error(

            result.error || "Gagal mengambil daftar company.",

          );

        }

        if (!cancelled) {

          setCompanies(

            Array.isArray(result.data) ? result.data : [],

          );

        }

      } catch (error) {

        console.error("[AppShell] Failed to load companies:", error);

        if (!cancelled) {

          setCompanyError(

            error instanceof Error

              ? error.message

              : "Gagal mengambil daftar company.",

          );

        }

      } finally {

        if (!cancelled) {

          setCompaniesLoading(false);

        }

      }

    }

    void loadCompanies();

    return () => {

      cancelled = true;

    };

  }, [authLoading, isSuperAdmin]);

  // ------------------------------------------------------------

  // NAVIGATION STATE

  // ------------------------------------------------------------

  useEffect(() => {

    setMobileMenuOpen(false);

    setUserMenuOpen(false);

  }, [pathname]);

  useEffect(() => {

    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";

    return () => {

      document.body.style.overflow = "";

    };

  }, [mobileMenuOpen]);

  useEffect(() => {

    function handleClickOutside(event: MouseEvent) {

      const target = event.target as Node;

      if (

        userMenuRef.current &&

        !userMenuRef.current.contains(target)

      ) {

        setUserMenuOpen(false);

      }

      if (

        mobileMenuRef.current &&

        !mobileMenuRef.current.contains(target)

      ) {

        // Mobile menu is closed through its overlay/button.

      }

    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {

      document.removeEventListener("mousedown", handleClickOutside);

    };

  }, []);

  // ------------------------------------------------------------

  // COMPANY SELECTION

  // ------------------------------------------------------------

const handleCompanyChange = async (companyId: string) => {
    if (!companyId || changingCompany) return;

    setChangingCompany(true);
    setCompanyError("");

    try {
      const response = await fetch("/api/auth/active-company", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: Number(companyId),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to change company."
        );
      }

      const params = new URLSearchParams(searchParams.toString());
      params.set("companyId", companyId);

      const query = params.toString();

      router.replace(query ? `${pathname}?${query}` : pathname);
      router.refresh();
    } catch (error) {
      console.error("[AppShell] Change company failed:", error);

      setCompanyError(
        error instanceof Error
          ? error.message
          : "Failed to change company."
      );
    } finally {
      setChangingCompany(false);
    }
  };

  // Keep companyId in every internal navigation link.

  const getCompanyHref = useCallback(

    (href: string) => {

      if (!isSuperAdmin || !selectedCompanyId) {

        return href;

      }

      const [path, queryString] = href.split("?");

      const params = new URLSearchParams(queryString ?? "");

      params.set("companyId", selectedCompanyId);

      return `${path}?${params.toString()}`;

    },

    [isSuperAdmin, selectedCompanyId],

  );

  // ------------------------------------------------------------

  // LOGOUT

  // ------------------------------------------------------------

  async function handleLogout() {

    if (loggingOut) return;

    setLoggingOut(true);

    try {

      await fetch("/api/auth/logout", {

        method: "POST",

        credentials: "include",

      });

    } catch (error) {

      console.error("[AppShell] Logout request failed:", error);

    } finally {

      setAuthUser(null);

      setUserMenuOpen(false);

      setMobileMenuOpen(false);

      router.replace("/login");

      router.refresh();

      setLoggingOut(false);

    }

  }

  // ------------------------------------------------------------

  // PERMISSIONS

  // ------------------------------------------------------------

  if (pathname === "/login") {

    return <>{children}</>;

  }

  const permissions = authUser?.permissions ?? [];

  const hasPermission = (permission: string) =>

    isSuperAdmin || permissions.includes(permission);

  const visibleGroups = menuGroups

    .map((group) => ({

      ...group,

      items: group.items.filter((item) =>

        hasPermission(item.permission),

      ),

    }))

    .filter((group) => group.items.length > 0);

  const visibleMobileItems = mobileItems.filter((item) =>

    hasPermission(item.permission),

  );

  const activeMobileHref = getActiveHref(

    pathname,

    visibleMobileItems,

  );

  // ------------------------------------------------------------

  // COMPANY SELECTOR

  // ------------------------------------------------------------

  const companySelector = (

    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 shadow-sm sm:px-6 xl:px-8">

      <div className="flex min-w-0 items-center gap-3">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">

          <Building2 className="h-5 w-5" />

        </div>

        <div className="min-w-0">

          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">

            Active Workspace

          </p>

          <p className="truncate text-sm font-semibold text-foreground">

            {selectedCompany?.name ?? "Select a company"}

          </p>

        </div>

      </div>

      <div className="w-full sm:w-72">

        <select

          value={selectedCompanyId}

          onChange={(event) =>

            handleCompanyChange(event.target.value)

          }

          disabled={companiesLoading || changingCompany}

          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-rose-500 disabled:cursor-not-allowed disabled:opacity-60"

        >

          <option value="">

            {companiesLoading

              ? "Loading companies..."

              : "-- Select Company --"}

          </option>

          {activeCompanies.map((company) => (

            <option key={company.id} value={String(company.id)}>

              {company.name} ({company.code})

            </option>

          ))}

        </select>

      </div>

    </div>

  );

  // ------------------------------------------------------------

  // COMPANY ACCESS GUARD

  // ------------------------------------------------------------

  const companySelectionRequired =

    isSuperAdmin &&

    !companiesLoading &&

    (!selectedCompanyId || !selectedCompany);

  const companySelectionContent = (

    <div className="flex min-h-[60vh] items-center justify-center p-6">

      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">

        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">

          <Building2 className="h-8 w-8" />

        </div>

        <h2 className="text-xl font-bold text-foreground">

          Select a Company

        </h2>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">

          Pilih company yang ingin kamu kelola. Seluruh data

          operasional akan ditampilkan berdasarkan company tersebut.

        </p>

        {companyError && (

          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">

            {companyError}

          </p>

        )}

        {companiesLoading ? (

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">

            <span className="h-4 w-4 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />

            Loading company list...

          </div>

        ) : (

          <>

            <select

              value=""

              onChange={(event) =>

                handleCompanyChange(event.target.value)

              }

              className="mt-6 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-rose-500"

            >

              <option value="">-- Select Company --</option>

              {activeCompanies.map((company) => (

                <option

                  key={company.id}

                  value={String(company.id)}

                >

                  {company.name} ({company.code})

                </option>

              ))}

            </select>

            {activeCompanies.length === 0 && !companyError && (

              <p className="mt-3 text-xs text-muted-foreground">

                Belum ada company aktif yang tersedia.

              </p>

            )}

          </>

        )}

      </div>

    </div>

  );

  // ------------------------------------------------------------

  // MAIN LAYOUT

  // ------------------------------------------------------------

  return (

    <div className="min-h-screen bg-background text-foreground">

      {/* DESKTOP SIDEBAR */}

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card shadow-xl shadow-black/5 dark:shadow-black/30 xl:flex">

        <Link

          href={getCompanyHref("/")}

          className="flex h-20 items-center gap-3 border-b border-border px-6"

        >

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-600 via-red-800 to-[#651b24] text-sm font-black tracking-wide text-white shadow-lg shadow-red-950/40">

            OV

          </div>

          <div className="min-w-0">

            <p className="truncate text-sm font-bold tracking-[0.12em] text-foreground">

              OVERPASSION

            </p>

            <p className="mt-1 text-[10px] font-semibold tracking-[0.24em] text-muted-foreground">

              OPERATION SYSTEM

            </p>

          </div>

        </Link>

        <div className="flex-1 space-y-7 overflow-y-auto px-3 py-6">

          {visibleGroups.map((group) => (

            <section key={group.title}>

              <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.22em] text-muted-foreground">

                {group.title}

              </p>

              <nav className="space-y-1">

                {group.items.map((item) => {

                  const active =

                    getActiveHref(pathname, group.items) ===

                    item.href;

                  const Icon = item.icon;

                  return (

                    <Link

                      key={item.href}

                      href={getCompanyHref(item.href)}

                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${

                        active

                          ? "bg-gradient-to-r from-rose-800 via-red-900 to-[#651b24] text-white shadow-lg shadow-red-950/30"

                          : "text-muted-foreground hover:bg-muted hover:text-rose-600 dark:hover:text-rose-300"

                      }`}

                    >

                      <Icon

                        className={`h-[18px] w-[18px] shrink-0 ${

                          active

                            ? "text-rose-100"

                            : "text-muted-foreground group-hover:text-rose-600 dark:group-hover:text-rose-300"

                        }`}

                      />

                      <span className="flex-1">{item.label}</span>

                      {active && (

                        <ChevronRight className="h-4 w-4 text-rose-200" />

                      )}

                    </Link>

                  );

                })}

              </nav>

            </section>

          ))}

        </div>

        <div className="space-y-3 border-t border-border p-4">

          <div className="flex items-center justify-between gap-3 px-1">

            <span className="text-sm font-medium text-muted-foreground">

              Appearance

            </span>

            <ThemeToggle />

          </div>

          <div className="rounded-2xl border border-border bg-muted/50 p-3">

            <div className="flex min-w-0 items-center gap-3">

              <UserAvatar name={authUser?.name} />

              <div className="min-w-0 flex-1">

                <p className="truncate text-sm font-semibold text-foreground">

                  {authLoading

                    ? "Loading user..."

                    : authUser?.name || "User"}

                </p>

                <p className="truncate text-xs text-muted-foreground">

                  {authUser?.role?.name ||

                    authUser?.email ||

                    "Account"}

                </p>

              </div>

            </div>

            <button

              type="button"

              onClick={handleLogout}

              disabled={loggingOut}

              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-900/50 bg-rose-950/40 px-3 py-2.5 text-sm font-semibold text-rose-200 transition hover:border-rose-700 hover:bg-rose-900/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"

            >

              <LogOut className="h-4 w-4" />

              <span>

                {loggingOut ? "Signing out..." : "Logout"}

              </span>

            </button>

          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/30 dark:bg-gradient-to-br dark:from-rose-950/40 dark:to-[#151010]">

            <div className="mb-2 flex items-center gap-2">

              <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.7)]" />

              <span className="text-xs font-semibold text-rose-800 dark:text-rose-100">

                System Operational

              </span>

            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">

              Operation system is running and ready to use.

            </p>

          </div>

        </div>

      </aside>

      {/* MAIN CONTENT */}

      <div className="min-h-screen xl:pl-64">

        {/* MOBILE HEADER */}

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 shadow-lg shadow-black/10 backdrop-blur-xl xl:hidden">

          <div className="flex items-center gap-3">

            <button

              type="button"

              onClick={() => setMobileMenuOpen(true)}

              aria-label="Open navigation menu"

              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-foreground transition hover:bg-muted/70"

            >

              <Menu className="h-5 w-5" />

            </button>

            <Link

              href={getCompanyHref("/")}

              className="flex items-center gap-2.5"

            >

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 via-red-800 to-[#651b24] text-xs font-black text-white">

                OV

              </div>

              <div>

                <p className="text-xs font-bold tracking-[0.1em] text-foreground">

                  OVERPASSION

                </p>

                <p className="text-[9px] font-semibold tracking-[0.18em] text-muted-foreground">

                  OPERATIONS

                </p>

              </div>

            </Link>

          </div>

          <div className="flex items-center gap-2">

            <ThemeToggle />

            <div className="relative" ref={userMenuRef}>

              <button

                type="button"

                onClick={() =>

                  setUserMenuOpen((open) => !open)

                }

                aria-label="Open user menu"

                className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-900/50 bg-rose-950/40 text-xs font-bold text-rose-100 transition hover:bg-rose-900/40"

              >

                {authUser ? (

                  initials(authUser.name)

                ) : (

                  <Users className="h-4 w-4" />

                )}

              </button>

              {userMenuOpen && (

                <UserMenu

                  user={authUser}

                  authLoading={authLoading}

                  loggingOut={loggingOut}

                  onLogout={handleLogout}

                />

              )}

            </div>

          </div>

        </header>

        <main className="min-h-[calc(100vh-4rem)] bg-background">

          {isSuperAdmin && companySelector}

          {isSuperAdmin ? (

            companySelectionRequired ? (

              companySelectionContent

            ) : companiesLoading ? (

              <div className="flex min-h-[50vh] items-center justify-center">

                <p className="text-sm text-muted-foreground">

                  Loading company data...

                </p>

              </div>

            ) : (

              children

            )

          ) : (

            children

          )}

        </main>

      </div>

      {/* MOBILE NAVIGATION DRAWER */}

      {mobileMenuOpen && (

        <div className="fixed inset-0 z-50 xl:hidden">

          <button

            type="button"

            aria-label="Close navigation overlay"

            onClick={() => setMobileMenuOpen(false)}

            className="absolute inset-0 h-full w-full bg-black/75 backdrop-blur-sm"

          />

          <aside

            ref={mobileMenuRef}

            className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-border bg-card shadow-2xl shadow-black/10 dark:shadow-black/60"

          >

            <div className="flex h-20 items-center justify-between border-b border-border px-5">

              <Link

                href={getCompanyHref("/")}

                className="flex items-center gap-3"

                onClick={() => setMobileMenuOpen(false)}

              >

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-600 via-red-800 to-[#651b24] text-sm font-black text-white">

                  OV

                </div>

                <div>

                  <p className="text-sm font-bold tracking-[0.1em] text-foreground">

                    OVERPASSION

                  </p>

                  <p className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">

                    OPERATION SYSTEM

                  </p>

                </div>

              </Link>

              <button

                type="button"

                aria-label="Close navigation menu"

                onClick={() => setMobileMenuOpen(false)}

                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground transition hover:bg-muted"

              >

                <X className="h-5 w-5" />

              </button>

            </div>

            {/* COMPANY SELECTOR MOBILE */}

            {isSuperAdmin && (

              <div className="border-b border-border p-4">

                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">

                  Active Company

                </label>

                <select

                  value={selectedCompanyId}

                  onChange={(event) => {

                    handleCompanyChange(event.target.value);

                    setMobileMenuOpen(false);

                  }}

                  disabled={companiesLoading || changingCompany}

                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-rose-500"

                >

                  <option value="">-- Select Company --</option>

                  {activeCompanies.map((company) => (

                    <option

                      key={company.id}

                      value={String(company.id)}

                    >

                      {company.name}

                    </option>

                  ))}

                </select>

              </div>

            )}

            <div className="flex-1 space-y-7 overflow-y-auto px-3 py-6">

              {visibleGroups.map((group) => (

                <section key={group.title}>

                  <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.22em] text-muted-foreground">

                    {group.title}

                  </p>

                  <nav className="space-y-1">

                    {group.items.map((item) => {

                      const active =

                        getActiveHref(pathname, group.items) ===

                        item.href;

                      const Icon = item.icon;

                      return (

                        <Link

                          key={item.href}

                          href={getCompanyHref(item.href)}

                          onClick={() => setMobileMenuOpen(false)}

                          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${

                            active

                              ? "bg-gradient-to-r from-rose-800 via-red-900 to-[#651b24] text-white shadow-lg shadow-red-950/30"

                              : "text-muted-foreground hover:bg-muted hover:text-rose-600 dark:hover:text-rose-300"

                          }`}

                        >

                          <Icon

                            className={`h-[18px] w-[18px] ${

                              active

                                ? "text-rose-100"

                                : "text-muted-foreground"

                            }`}

                          />

                          <span className="flex-1">{item.label}</span>

                          {active && (

                            <ChevronRight className="h-4 w-4 text-rose-200" />

                          )}

                        </Link>

                      );

                    })}

                  </nav>

                </section>

              ))}

            </div>

            <div className="space-y-3 border-t border-border p-4">

              <div className="flex items-center justify-between gap-3 px-1">

                <span className="text-sm font-medium text-muted-foreground">

                  Appearance

                </span>

                <ThemeToggle />

              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/50 p-3">

                <UserAvatar name={authUser?.name} />

                <div className="min-w-0 flex-1">

                  <p className="truncate text-sm font-semibold text-foreground">

                    {authLoading

                      ? "Loading user..."

                      : authUser?.name || "User"}

                  </p>

                  <p className="truncate text-xs text-muted-foreground">

                    {authUser?.role?.name || "Account"}

                  </p>

                </div>

                <button

                  type="button"

                  onClick={handleLogout}

                  disabled={loggingOut}

                  aria-label="Logout"

                  className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-50"

                >

                  <LogOut className="h-4 w-4" />

                  <span>

                    {loggingOut ? "Signing out..." : "Logout"}

                  </span>

                </button>

              </div>

            </div>

          </aside>

        </div>

      )}

      {/* MOBILE BOTTOM NAVIGATION */}

      {visibleMobileItems.length > 0 && (

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2 shadow-[0_-12px_35px_rgba(0,0,0,0.25)] backdrop-blur-xl xl:hidden">

          <div className="mx-auto flex max-w-xl items-stretch justify-around gap-1">

            {visibleMobileItems.slice(0, 5).map((item) => (

              <MobileNavItem

                key={item.href}

                {...item}

                href={getCompanyHref(item.href)}

                active={activeMobileHref === item.href}

              />

            ))}

            <button

              type="button"

              onClick={() => setMobileMenuOpen(true)}

              aria-label="Open mobile menu"

              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-muted-foreground transition hover:text-rose-600 dark:hover:text-rose-300"

            >

              <Menu className="h-[18px] w-[18px]" />

              <span className="max-w-full truncate text-[10px] font-medium">

                More

              </span>

            </button>

          </div>

        </nav>

      )}

      <div className="h-20 xl:hidden" />

    </div>

  );

}

// ------------------------------------------------------------

// USER AVATAR

// ------------------------------------------------------------

function UserAvatar({ name }: { name?: string }) {

  return (

    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-900/50 bg-gradient-to-br from-rose-950 to-[#251114] text-xs font-bold text-rose-100 ring-2 ring-rose-950/40">

      {initials(name)}

    </div>

  );

}

// ------------------------------------------------------------

// USER MENU

// ------------------------------------------------------------

function UserMenu({

  user,

  authLoading,

  loggingOut,

  onLogout,

}: {

  user: AuthUser | null;

  authLoading: boolean;

  loggingOut: boolean;

  onLogout: () => void;

}) {

  return (

    <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/10 dark:shadow-black/50">

      <div className="border-b border-border p-4">

        <div className="flex items-center gap-3">

          <UserAvatar name={user?.name} />

          <div className="min-w-0">

            <p className="truncate text-sm font-semibold text-foreground">

              {authLoading ? "Loading user..." : user?.name || "User"}

            </p>

            <p className="truncate text-xs text-muted-foreground">

              {user?.email || "No email available"}

            </p>

          </div>

        </div>

        <div className="mt-3 inline-flex max-w-full items-center rounded-full border border-rose-900/40 bg-rose-950/40 px-2.5 py-1 text-[10px] font-semibold text-rose-200">

          <span className="truncate">

            {user?.role?.name || "Account"}

          </span>

        </div>

      </div>

      <button

        type="button"

        onClick={onLogout}

        disabled={loggingOut}

        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-muted-foreground transition hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"

      >

        <LogOut className="h-4 w-4" />

        {loggingOut ? "Signing out..." : "Logout"}

      </button>

    </div>

  );

}

// ------------------------------------------------------------

// MOBILE NAV ITEM

// ------------------------------------------------------------

function MobileNavItem({

  href,

  icon: Icon,

  label,

  active,

}: {

  href: string;

  icon: React.ComponentType<{ className?: string }>;

  label: string;

  active: boolean;

}) {

  return (

    <Link

      href={href}

      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition ${

        active

          ? "text-rose-600 dark:text-rose-300"

          : "text-muted-foreground hover:text-rose-600 dark:hover:text-rose-200"

      }`}

    >

      <span

        className={`flex h-7 w-10 items-center justify-center rounded-xl transition ${

          active ? "bg-rose-100 dark:bg-rose-950/60" : ""

        }`}

      >

        <Icon className="h-[18px] w-[18px]" />

      </span>

      <span className="max-w-full truncate text-[10px] font-medium">

        {label}

      </span>

    </Link>

  );

}
