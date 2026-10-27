"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@/components/icons/arrow-left-icon";
import { EyeIcon, EyeOffIcon } from "@/components/icons/eye-icon";
import { RoleBadge } from "@/components/login/role-badge";
import { api, ApiError } from "@/lib/api";
import { saveSession, type SessionUser } from "@/lib/auth";

const inputClass =
  "rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100";

export function FirstAccessCard() {
  const router = useRouter();
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<{ disponivel: boolean }>("/auth/setup")
      .then((status) => setDisponivel(status.disponivel))
      .catch(() => setError("Não foi possível conectar ao servidor. Tente novamente."));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);

    try {
      const { token, user } = await api.post<{ token: string; user: SessionUser }>("/auth/setup", {
        name: name.trim(),
        email: email.trim(),
        celular: celular.trim() || undefined,
        password
      });
      saveSession(token, user);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDisponivel(false);
      } else {
        setError(
          err instanceof ApiError && err.status === 400
            ? "Verifique os dados informados."
            : "Não foi possível criar a conta. Tente novamente."
        );
      }
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
      <RoleBadge label="Gestão" accent="purple" />

      {disponivel === null && !error && <p className="mt-6 text-center text-sm text-slate-400">Carregando...</p>}

      {disponivel === false && (
        <div className="mt-6 text-center text-sm text-slate-600">
          <p>A gestão deste cursinho já foi cadastrada.</p>
          <Link href="/login-gestao" className="mt-2 inline-block font-semibold text-purple-600 hover:text-purple-700">
            Ir para o login da gestão
          </Link>
        </div>
      )}

      {disponivel === null && error && <p className="mt-6 text-center text-sm text-red-600">{error}</p>}

      {disponivel && (
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <p className="text-sm text-slate-500">Crie a conta de quem vai coordenar o cursinho.</p>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-slate-900">Nome</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" required className={inputClass} />
          </label>

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
            <span className="font-semibold text-slate-900">
              Celular <span className="font-normal text-slate-400">(opcional)</span>
            </span>
            <input
              type="tel"
              value={celular}
              onChange={(event) => setCelular(event.target.value)}
              placeholder="(11) 90000-0000"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-slate-900">Senha</span>
            <span className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo de 8 caracteres"
                required
                className={`w-full pr-10 ${inputClass}`}
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

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-slate-900">Confirmar senha</span>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repita a senha"
              required
              className={inputClass}
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Criando conta..." : "Criar conta e entrar"}
          </button>
        </form>
      )}

      <Link
        href="/"
        className="mt-4 flex items-center justify-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-600"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Voltar
      </Link>
    </div>
  );
}
