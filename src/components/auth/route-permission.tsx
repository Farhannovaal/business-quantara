import { ReactNode } from "react";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePermission } from "@/lib/auth/authorization";

type RoutePermissionProps = {
  permission: string;
  children: ReactNode;
};

export default async function RoutePermission({
  permission,
  children,
}: RoutePermissionProps) {
  const { user, response } = await requireAuth();

  if (response || !user) {
    return null;
  }

  const permissionCheck = requirePermission(
    user,
    permission,
  );

  if (permissionCheck.response) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-7 w-7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86 2.82 17a2 2 0 0 0 1.74 3h14.88a2 2 0 0 0 1.74-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              />
            </svg>
          </div>

          <h1 className="mt-5 text-xl font-bold text-slate-800">
            Access Denied
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Akun Anda tidak memiliki permission untuk
            mengakses halaman ini.
          </p>

          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
            Required: {permission}
          </p>

          <a
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Kembali
          </a>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}