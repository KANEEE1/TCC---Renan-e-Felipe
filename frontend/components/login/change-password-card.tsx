"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons/arrow-left-icon";
import { EyeIcon, EyeOffIcon } from "@/components/icons/eye-icon";
import { api, ApiError } from "@/lib/api";

const inputClass =
  "rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";

export function ChangePasswordCard() {
  const [email, setEmail] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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

    if (novaSenha === senhaAtual) {
      setError("A nova senha deve ser diferente da atual.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/change-password", { email: email.trim(), senhaAtual, novaSenha });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("E-mail ou senha atual incorretos.");
      } else if (err instanceof ApiError && err.status === 403) {
        setError(err.message);
      } else {
        setError("Não foi possível trocar a senha. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
        <p className="font-semibold text-slate-900">Senha alterada.</p>
        <p className="mt-1 text-sm text-slate-500">Entre com a nova senha.</p>
        <Link
          href="/login-professor"
          className="mt-6 block rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white transition hover:opacity-90"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-slate-900">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            required
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-slate-900">Senha atual</span>
          <span className="relative flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              value={senhaAtual}
              onChange={(event) => setSenhaAtual(event.target.value)}
              placeholder="••••••••"
              required
              className={`w-full pr-10 ${inputClass}`}
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
          <span className="font-semibold text-slate-900">Nova senha</span>
          <input
            type={showPassword ? "text" : "password"}
            value={novaSenha}
            onChange={(event) => setNovaSenha(event.target.value)}
            placeholder="Mínimo de 8 caracteres"
            required
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-slate-900">Confirmar nova senha</span>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
            placeholder="Repita a nova senha"
            required
            className={inputClass}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Trocando..." : "Trocar senha"}
        </button>
      </form>

      <Link
        href="/login-professor"
        className="mt-4 flex items-center justify-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-600"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Voltar ao login
      </Link>
    </div>
  );
}
