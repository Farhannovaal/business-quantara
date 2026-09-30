"use client";

import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError(
        "Email dan password wajib diisi."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(
          result.message ||
            "Email atau password salah."
        );
        return;
      }

      /*
       * Login berhasil.
       *
       * Gunakan full page navigation supaya:
       * - AppShell dibuat ulang
       * - authUser dibuat ulang
       * - /api/auth/me dipanggil ulang
       * - permission user terbaru dimuat
       * - tidak ada state user sebelumnya yang tertinggal
       */
      window.location.href = "/";
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      setError(
        "Tidak dapat terhubung ke server."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">

        {/* ======================================================
            LEFT
            ====================================================== */}

        <section className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 lg:flex">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

          <div className="absolute -bottom-40 -left-32 h-[30rem] w-[30rem] rounded-full bg-violet-400/20 blur-3xl" />

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">

            {/* BRAND */}

            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>

                <div>
                  <p className="text-lg font-bold tracking-tight text-white">
                    Business Operation
                  </p>

                  <p className="text-sm text-indigo-100">
                    Operations Platform
                  </p>
                </div>
              </div>
            </div>

            {/* HERO */}

            <div className="max-w-xl">
              <div className="mb-6 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-indigo-50 backdrop-blur">
                Business Operations System
              </div>

              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl">
                Manage your operations
                <br />
                in one place.
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-indigo-100">
                Kelola SPK, transaksi, production
                tracking, master data, workflow,
                dan business rules dalam satu
                platform terintegrasi.
              </p>
            </div>

            {/* FOOTER */}

            <div className="text-sm text-indigo-200">
              Business Operation Platform
            </div>
          </div>
        </section>

        {/* ======================================================
            RIGHT
            ====================================================== */}

        <section className="flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">

            {/* MOBILE LOGO */}

            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>

              <div>
                <p className="font-bold text-slate-900">
                  Business Operation
                </p>

                <p className="text-xs text-slate-500">
                  Operations Platform
                </p>
              </div>
            </div>

            {/* HEADER */}

            <div className="mb-8">
              <p className="mb-2 text-sm font-semibold text-indigo-600">
                Welcome back
              </p>

              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Sign in
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Masuk untuk melanjutkan ke
                Business Operation.
              </p>
            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              {/* EMAIL */}

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Email
                </label>

                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    placeholder="admin@business.local"
                    disabled={loading}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                </div>
              </div>

              {/* PASSWORD */}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>
                </div>

                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    placeholder="Masukkan password"
                    disabled={loading}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value
                      )
                    }
                    disabled={loading}
                    aria-label={
                      showPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* ERROR */}

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              {/* SUBMIT */}

              <button
                type="submit"
                disabled={loading}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:from-indigo-700 hover:to-violet-700 hover:shadow-indigo-600/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in

                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            {/* FOOTER */}

            <div className="mt-8 border-t border-slate-200 pt-6 text-center">
              <p className="text-xs text-slate-400">
                Business Operation Platform
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}