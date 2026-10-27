"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

// Só aparece enquanto o cursinho ainda não tem nenhum gestor cadastrado.
export function FirstAccessLink() {
  const [disponivel, setDisponivel] = useState(false);

  useEffect(() => {
    api
      .get<{ disponivel: boolean }>("/auth/setup")
      .then((status) => setDisponivel(status.disponivel))
      .catch(() => setDisponivel(false));
  }, []);

  if (!disponivel) return null;

  return (
    <p className="mt-6 text-center text-sm text-slate-500">
      Primeiro acesso do cursinho?{" "}
      <Link href="/primeiro-acesso" className="font-semibold text-purple-600 transition hover:text-purple-700">
        Cadastre a gestão
      </Link>
    </p>
  );
}
