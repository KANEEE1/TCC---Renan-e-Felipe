"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { EyeIcon, EyeOffIcon } from "@/components/icons/eye-icon";
import { api, ApiError } from "@/lib/api";

type Status = "form" | "done" | "error";

export function ResetPasswordCard() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>(token ? "form" : "error");
  const [error, setError] = useState<string | null>(token ? null : "Link incompleto. Confira se copiou o link inteiro do e-mail.");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (novaSenha.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (novaSenha !== confirmacao) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/reset-password", { token, novaSenha });
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "done") {
    return (
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
        <p className="font-semibold text-slate-900">Senha redefinida.</p>
        <p className="mt-1 text-sm text-slate-500">Já pode entrar com a nova senha.</p>
        <Link
          href="/login-professor"
          className="mt-6 block rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white transition hover:opacity-90"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
        <p className="font-semibold text-slate-900">Não deu certo</p>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
        <Link
          href="/esqueci-senha"
          className="mt-6 block rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white transition hover:opacity-90"
        >
          Pedir um novo link
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-slate-900">Nova senha</span>
          <span className="relative flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              value={novaSenha}
              onChange={(event) => setNovaSenha(event.target.value)}
              placeholder="Mínimo de 8 caracteres"
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-10 text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 text-slate-400 transition hover:text-slate-600"
              aria-label={showPassword ? "Ocultar senhas" : "Mostrar senhas"}
            >
              {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-slate-900">Confirmar nova senha</span>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
            placeholder="Repita a nova senha"
            required
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Redefinindo..." : "Redefinir senha"}
        </button>
      </form>
    </div>
  );
}
