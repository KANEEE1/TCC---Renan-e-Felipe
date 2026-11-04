"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

type Status = "confirming" | "done" | "error";

export function ConfirmEmailCard() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("confirming");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Link incompleto. Confira se copiou o link inteiro do e-mail.");
      return;
    }

    api
      .post("/auth/confirm-email", { token })
      .then(() => setStatus("done"))
      .catch((err) => {
        setStatus("error");
        setError(err instanceof ApiError ? err.message : "Não foi possível confirmar o e-mail.");
      });
  }, [token]);

  return (
    <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
      {status === "confirming" && <p className="text-slate-500">Confirmando seu e-mail...</p>}

      {status === "done" && (
        <>
          <p className="font-semibold text-slate-900">E-mail confirmado.</p>
          <p className="mt-1 text-sm text-slate-500">Já pode entrar normalmente.</p>
        </>
      )}

      {status === "error" && (
        <>
          <p className="font-semibold text-slate-900">Não deu certo</p>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
        </>
      )}

      {status !== "confirming" && (
        <Link
          href="/login-professor"
          className="mt-6 block rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white transition hover:opacity-90"
        >
          Ir para o login
        </Link>
      )}
    </div>
  );
}
