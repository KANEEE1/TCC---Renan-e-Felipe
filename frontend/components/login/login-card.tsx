"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@/components/icons/arrow-left-icon";
import { EyeIcon, EyeOffIcon } from "@/components/icons/eye-icon";
import { LoginIcon } from "@/components/icons/login-icon";
import type { Accent } from "@/components/ui/accent";
import { api, ApiError } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { RoleBadge } from "./role-badge";

type LoginCardProps = {
  roleLabel: string;
  accent: Accent;
};

export function LoginCard({ roleLabel, accent }: LoginCardProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { token, user } = await api.post<{ token: string; user: { id: string; email: string; roles: ("GESTAO" | "PROFESSOR")[] } }>(
        "/auth/login",
        { email, password }
      );
      saveSession(token, user);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
      <RoleBadge label={roleLabel} accent={accent} />

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-slate-900">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            required
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-slate-900">Senha</span>
          <span className="relative flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-10 text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 text-slate-400 transition hover:text-slate-600"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          <LoginIcon className="h-5 w-5" />
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <Link
        href="/"
        className="mt-4 flex items-center justify-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-600"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Trocar perfil
      </Link>
    </div>
  );
}
