import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-auth";

export default async function HomePage() {
  const { user, response } = await requireAuth();

  if (response || !user) {
    redirect("/login");
  }

  const permissionCodes =
    user.role?.permissions.map(
      (rolePermission) =>
        rolePermission.permission.code,
    ) ?? [];

  if (permissionCodes.includes("dashboard.view")) {
    redirect("/dashboard");
  }

  if (permissionCodes.includes("qc.view")) {
    redirect("/qc");
  }

  if (permissionCodes.includes("spk.view")) {
    redirect("/operations/spk");
  }

  if (permissionCodes.includes("transaction.view")) {
    redirect("/operations/transactions");
  }

  if (permissionCodes.includes("tracking.view")) {
    redirect("/operations/tracking");
  }

  if (
    permissionCodes.includes(
      "tailor-billing.view",
    )
  ) {
    redirect("/master/tailor-billing");
  }

  if (permissionCodes.includes("product.view")) {
    redirect("/master/products");
  }

  if (permissionCodes.includes("tailor.view")) {
    redirect("/master/tailors");
  }

  if (permissionCodes.includes("employee.view")) {
    redirect("/master/employees");
  }

  if (permissionCodes.includes("scanner.view")) {
    redirect("/operations/scanner");
  }

  if (permissionCodes.includes("workflow.view")) {
    redirect("/automation/workflows");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">
          Tidak Ada Akses
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Akun Anda belum memiliki permission untuk
          mengakses modul Overpassion Operation.
        </p>

        <a
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Kembali ke Login
        </a>
      </div>
    </main>
  );
}