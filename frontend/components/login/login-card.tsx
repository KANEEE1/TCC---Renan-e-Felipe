"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@/components/icons/arrow-left-icon";
import { EyeIcon, EyeOffIcon } from "@/components/icons/eye-icon";
import { LoginIcon } from "@/components/icons/login-icon";
import type { Accent } from "@/components/ui/accent";
import { RoleBadge } from "./role-badge";

type LoginCardProps = {
  roleLabel: string;
  accent: Accent;
};

export function LoginCard({ roleLabel, accent }: LoginCardProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    router.push("/dashboard");
  };

  return (
    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
      <RoleBadge label={roleLabel} accent={accent} />

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-slate-900">E-mail</span>
          <input
            type="email"
            placeholder="seu@email.com"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-slate-900">Senha</span>
          <span className="relative flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
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

        <button
          type="submit"
          className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white transition hover:opacity-90"
        >
          <LoginIcon className="h-5 w-5" />
          Entrar
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
