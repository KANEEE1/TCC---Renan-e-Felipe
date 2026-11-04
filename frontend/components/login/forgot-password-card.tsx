"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons/arrow-left-icon";
import { api } from "@/lib/api";

export function ForgotPasswordCard() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
    } finally {
      // Sempre mostra a mesma mensagem, exista ou não o e-mail, para não revelar quais contas existem.
      setLoading(false);
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
        <p className="font-semibold text-slate-900">Verifique seu e-mail.</p>
        <p className="mt-1 text-sm text-slate-500">
          Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha. O link expira em 1 hora.
        </p>
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
      <p className="text-sm text-slate-500">Informe o e-mail da sua conta e enviaremos um link para redefinir a senha.</p>

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

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Enviar link"}
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
