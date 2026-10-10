"use client";



import Link from "next/link";

import { usePathname, useRouter } from "next/navigation";

import { useEffect, useRef, useState } from "react";

import {

  Activity,

  BarChart3,

  ChevronDown,

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

  Users,

  Workflow,

  X,

} from "lucide-react";



type AuthUser = {

  id: number;

  name: string;

  email: string;

  status: string;

  role: { id: number; name: string } | null;

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

      { label: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard.view" },

      { label: "Report", href: "/reports/production", icon: BarChart3, permission: "report.view" },

      { label: "SPK", href: "/operations/spk", icon: ClipboardList, permission: "spk.view" },

      { label: "Transactions", href: "/operations/transactions", icon: Activity, permission: "transaction.view" },

      { label: "Tracking", href: "/operations/tracking", icon: BarChart3, permission: "tracking.view" },

      { label: "Field Scanner", href: "/operations/scanner", icon: ScanLine, permission: "scanner.view" },

      { label: "Scanner History", href: "/operations/scanner/history", icon: History, permission: "scanner.view" },

      { label: "Quality Control", href: "/qc", icon: ShieldCheck, permission: "qc.view" },

    ],

  },

  {

    title: "MASTER DATA",

    items: [

      { label: "Products", href: "/master/products", icon: Package, permission: "product.view" },

      { label: "Tailors", href: "/master/tailors", icon: Users, permission: "tailor.view" },

      { label: "Employees", href: "/master/employees", icon: Users, permission: "employee.view" },

      { label: "Tailor Rates", href: "/master/tailor-rates", icon: CircleDollarSign, permission: "tailor-rate.view" },

      { label: "Tailor Billing", href: "/master/tailor-billing", icon: CircleDollarSign, permission: "tailor-billing.view" },

    ],

  },

  {

    title: "AUTOMATION",

    items: [

      { label: "Workflows", href: "/automation/workflows", icon: Workflow, permission: "workflow.view" },

      { label: "Business Rules", href: "/automation/rules", icon: Settings, permission: "rule.view" },

    ],

  },

];



const mobileItems = [

  { label: "Home", href: "/", icon: LayoutDashboard, permission: "dashboard.view" },

  { label: "Report", href: "/reports/production", icon: BarChart3, permission: "report.view" },

  { label: "SPK", href: "/operations/spk", icon: ClipboardList, permission: "spk.view" },

  { label: "Transaction", href: "/operations/transactions", icon: Activity, permission: "transaction.view" },

  { label: "Tracking", href: "/operations/tracking", icon: BarChart3, permission: "tracking.view" },

  { label: "QC", href: "/qc", icon: ShieldCheck, permission: "qc.view" },

  { label: "Billing", href: "/master/tailor-billing", icon: CircleDollarSign, permission: "tailor-billing.view" },

  { label: "Scanner", href: "/operations/scanner", icon: ScanLine, permission: "scanner.view" },

];



function isActivePath(pathname: string, href: string) {

  if (href === "/") return pathname === "/";

  return pathname === href || pathname.startsWith(`${href}/`);

}



function initials(name?: string) {

  return (name || "User")

    .trim()

    .split(/\s+/)

    .slice(0, 2)

    .map((part) => part[0]?.toUpperCase() || "")

    .join("");

}



export default function AppShell({ children }: { children: React.ReactNode }) {

  const pathname = usePathname();

  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const [authLoading, setAuthLoading] = useState(true);

  const userMenuRef = useRef<HTMLDivElement>(null);



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

        if (!response.ok || !result?.authenticated || !result?.user) {

          setAuthUser(null);

          return;

        }

        setAuthUser(result.user);

      } catch (error) {

        console.error("[AppShell] Failed to load auth:", error);

        if (!cancelled) setAuthUser(null);

      } finally {

        if (!cancelled) setAuthLoading(false);

      }

    }



    void loadAuthUser();

    return () => {

      cancelled = true;

    };

  }, []);



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

      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {

        setUserMenuOpen(false);

      }

    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);

  }, []);



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


  if (pathname === "/login") return <>{children}</>;



  const permissions = authUser?.permissions ?? [];

  const hasPermission = (permission: string) => permissions.includes(permission);

  const visibleGroups = menuGroups

    .map((group) => ({

      ...group,

      items: group.items.filter((item) => hasPermission(item.permission)),

    }))

    .filter((group) => group.items.length > 0);

  const visibleMobileItems = mobileItems.filter((item) => hasPermission(item.permission));



  return (

    <div className="min-h-screen bg-[#080808] text-white">

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/10 bg-[#111010] shadow-2xl shadow-black/30 xl:flex">

        <Link href="/" className="flex h-20 items-center gap-3 border-b border-white/10 px-6">

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-600 via-red-800 to-[#651b24] text-sm font-black tracking-wide text-white shadow-lg shadow-red-950/40">

            OV

          </div>

          <div className="min-w-0">

            <p className="truncate text-sm font-bold tracking-[0.12em] text-white">OVERPASSION</p>

            <p className="mt-1 text-[10px] font-semibold tracking-[0.24em] text-neutral-500">OPERATION SYSTEM</p>

          </div>

        </Link>



        <div className="flex-1 space-y-7 overflow-y-auto px-3 py-6">

          {visibleGroups.map((group) => (

            <section key={group.title}>

              <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.22em] text-neutral-500">

                {group.title}

              </p>

              <nav className="space-y-1">

                {group.items.map((item) => {

                  const active = isActivePath(pathname, item.href);

                  const Icon = item.icon;

                  return (

                    <Link

                      key={item.href}

                      href={item.href}

                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${

                        active

                          ? "bg-gradient-to-r from-rose-800 via-red-900 to-[#651b24] text-white shadow-lg shadow-red-950/30"

                          : "text-neutral-400 hover:bg-white/[0.06] hover:text-rose-200"

                      }`}

                    >

                      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-rose-100" : "text-neutral-500 group-hover:text-rose-300"}`} />

                      <span className="flex-1">{item.label}</span>

                      {active && <ChevronRight className="h-4 w-4 text-rose-200" />}

                    </Link>

                  );

                })}

              </nav>

            </section>

          ))}

        </div>



        <div className="border-t border-white/10 p-4 space-y-3">
          {/* User profile and logout CTA — visible on desktop */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar name={authUser?.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {authLoading ? "Loading user..." : authUser?.name || "User"}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {authUser?.role?.name || authUser?.email || "Account"}
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
              <span>{loggingOut ? "Signing out..." : "Logout"}</span>
            </button>
          </div>
          <div className="rounded-2xl border border-rose-900/30 bg-gradient-to-br from-rose-950/40 to-[#151010] p-4">

            <div className="mb-2 flex items-center gap-2">

              <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.7)]" />

              <span className="text-xs font-semibold text-rose-100">System Operational</span>

            </div>

            <p className="text-[11px] leading-relaxed text-neutral-500">

              Operation system is running and ready to use.

            </p>

          </div>

        </div>

      </aside>




      <div className="min-h-screen xl:pl-64">

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#111010]/95 px-4 shadow-lg shadow-black/10 backdrop-blur-xl xl:hidden">

          <div className="flex items-center gap-3">

            <button

              type="button"

              onClick={() => setMobileMenuOpen(true)}

              aria-label="Open navigation menu"

              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-neutral-200 transition hover:bg-white/[0.08]"

            >

              <Menu className="h-5 w-5" />

            </button>

            <Link href="/" className="flex items-center gap-2.5">

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 via-red-800 to-[#651b24] text-xs font-black text-white">

                OV

              </div>

              <div>

                <p className="text-xs font-bold tracking-[0.1em] text-white">OVERPASSION</p>

                <p className="text-[9px] font-semibold tracking-[0.18em] text-neutral-500">OPERATIONS</p>

              </div>

            </Link>

          </div>



          <div className="relative" ref={userMenuRef}>

            <button

              type="button"

              onClick={() => setUserMenuOpen((open) => !open)}

              aria-label="Open user menu"

              className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-900/50 bg-rose-950/40 text-xs font-bold text-rose-100 transition hover:bg-rose-900/40"

            >

              {authUser ? initials(authUser.name) : <Users className="h-4 w-4" />}

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

        </header>



        <main className="min-h-[calc(100vh-4rem)] bg-[#080808]">{children}</main>

      </div>



      {mobileMenuOpen && (

        <div className="fixed inset-0 z-50 xl:hidden">

          <button

            type="button"

            aria-label="Close navigation overlay"

            onClick={() => setMobileMenuOpen(false)}

            className="absolute inset-0 h-full w-full bg-black/75 backdrop-blur-sm"

          />

          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-white/10 bg-[#111010] shadow-2xl shadow-black/60">

            <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">

              <Link href="/" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-600 via-red-800 to-[#651b24] text-sm font-black text-white">

                  BO

                </div>

                <div>

                  <p className="text-sm font-bold tracking-[0.1em] text-white">OVERPASSION</p>

                  <p className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-neutral-500">OPERATION SYSTEM</p>

                </div>

              </Link>

              <button

                type="button"

                aria-label="Close navigation menu"

                onClick={() => setMobileMenuOpen(false)}

                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-neutral-300 transition hover:bg-white/[0.06]"

              >

                <X className="h-5 w-5" />

              </button>

            </div>



            <div className="flex-1 space-y-7 overflow-y-auto px-3 py-6">

              {visibleGroups.map((group) => (

                <section key={group.title}>

                  <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.22em] text-neutral-500">

                    {group.title}

                  </p>

                  <nav className="space-y-1">

                    {group.items.map((item) => {

                      const active = isActivePath(pathname, item.href);

                      const Icon = item.icon;

                      return (

                        <Link

                          key={item.href}

                          href={item.href}

                          onClick={() => setMobileMenuOpen(false)}

                          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${

                            active

                              ? "bg-gradient-to-r from-rose-800 via-red-900 to-[#651b24] text-white shadow-lg shadow-red-950/30"

                              : "text-neutral-400 hover:bg-white/[0.06] hover:text-rose-200"

                          }`}

                        >

                          <Icon className={`h-[18px] w-[18px] ${active ? "text-rose-100" : "text-neutral-500"}`} />

                          <span className="flex-1">{item.label}</span>

                          {active && <ChevronRight className="h-4 w-4 text-rose-200" />}

                        </Link>

                      );

                    })}

                  </nav>

                </section>

              ))}

            </div>



            <div className="border-t border-white/10 p-4">

              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">

                <UserAvatar name={authUser?.name} />

                <div className="min-w-0 flex-1">

                  <p className="truncate text-sm font-semibold text-white">

                    {authLoading ? "Loading user..." : authUser?.name || "User"}

                  </p>

                  <p className="truncate text-xs text-neutral-500">{authUser?.role?.name || "Account"}</p>

                </div>

                <button

                  type="button"

                  onClick={handleLogout}

                  disabled={loggingOut}

                  aria-label="Logout"

                  className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-50"

                >

                  <LogOut className="h-4 w-4" />

                  <span>{loggingOut ? "Signing out..." : "Logout"}</span>

                </button>

              </div>

            </div>

          </aside>

        </div>

      )}



      {visibleMobileItems.length > 0 && (

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#111010]/95 px-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2 shadow-[0_-12px_35px_rgba(0,0,0,0.25)] backdrop-blur-xl xl:hidden">

          <div className="mx-auto flex max-w-xl items-stretch justify-around gap-1">

            {visibleMobileItems.slice(0, 5).map((item) => (

              <MobileNavItem key={item.href} {...item} active={isActivePath(pathname, item.href)} />

            ))}

            <button

              type="button"

              onClick={() => setMobileMenuOpen(true)}

              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-neutral-500 transition hover:text-rose-200"

            >

              <Menu className="h-[18px] w-[18px]" />

              <span className="max-w-full truncate text-[10px] font-medium">More</span>

            </button>

          </div>

        </nav>

      )}

      <div className="h-20 xl:hidden" />

    </div>

  );

}



function UserAvatar({ name }: { name?: string }) {

  return (

    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-900/50 bg-gradient-to-br from-rose-950 to-[#251114] text-xs font-bold text-rose-100 ring-2 ring-rose-950/40">

      {initials(name)}

    </div>

  );

}



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

    <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#171313] shadow-2xl shadow-black/50">

      <div className="border-b border-white/10 p-4">

        <div className="flex items-center gap-3">

          <UserAvatar name={user?.name} />

          <div className="min-w-0">

            <p className="truncate text-sm font-semibold text-white">

              {authLoading ? "Loading user..." : user?.name || "User"}

            </p>

            <p className="truncate text-xs text-neutral-500">{user?.email || "No email available"}</p>

          </div>

        </div>

        <div className="mt-3 inline-flex max-w-full items-center rounded-full border border-rose-900/40 bg-rose-950/40 px-2.5 py-1 text-[10px] font-semibold text-rose-200">

          <span className="truncate">{user?.role?.name || "Account"}</span>

        </div>

      </div>

      <button

        type="button"

        onClick={onLogout}

        disabled={loggingOut}

        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-neutral-300 transition hover:bg-rose-950/40 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"

      >

        <LogOut className="h-4 w-4" />

        {loggingOut ? "Signing out..." : "Logout"}

      </button>

    </div>

  );

}



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

        active ? "text-rose-300" : "text-neutral-500 hover:text-rose-200"

      }`}

    >

      <span className={`flex h-7 w-10 items-center justify-center rounded-xl transition ${active ? "bg-rose-950/60" : ""}`}>

        <Icon className="h-[18px] w-[18px]" />

      </span>

      <span className="max-w-full truncate text-[10px] font-medium">{label}</span>

    </Link>

  );

}
