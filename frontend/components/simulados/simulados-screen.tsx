"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, GraduationCap, Trophy } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { ESTADO_STYLE, estadoLabel, formatarNota, type SimuladoResumo } from "./simulado-types";

function formatDate(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

// Simulados são eventos da agenda (tipo Simulado); aqui ficam a correção e as notas.
export function SimuladosScreen() {
  const [simulados, setSimulados] = useState<SimuladoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManagement, setIsManagement] = useState(false);

  useEffect(() => {
    setIsManagement(!!getSessionUser()?.roles.includes("GESTAO"));
    api
      .get<SimuladoResumo[]>("/simulados")
      .then(setSimulados)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Não foi possível carregar os simulados."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-5 pb-7 pt-5 text-white">
        <h1 className="text-white">Simulados</h1>
        <p className="mt-0.5 text-sm text-orange-100">Correção e notas dos simulados</p>
      </div>

      <div className="space-y-3 px-4 py-4">
        {isManagement && (
          <p className="flex items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-xs text-orange-800">
            <CalendarDays size={16} className="shrink-0" />
            <span>
              Para criar um simulado, crie um evento do tipo Simulado na{" "}
              <Link href="/calendar" className="underline">
                agenda
              </Link>
              .
            </span>
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-center text-sm text-slate-400">Carregando...</p>}
        {!loading && !error && simulados.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
            Nenhum simulado ainda.
          </p>
        )}

        {simulados.map((s) => (
          <Link
            key={s.id}
            href={`/simulados/${s.id}`}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Trophy size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-800">{s.titulo}</p>
              <p className="mt-0.5 truncate text-xs capitalize text-slate-500">
                {formatDate(s.data)} · {s.horarioInicio}–{s.horarioFim}
              </p>
              {s.turmas.length > 0 && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
                  <GraduationCap size={12} className="shrink-0" />
                  {s.turmas.map((t) => t.nome).join(", ")}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${ESTADO_STYLE[s.estado]}`}>{estadoLabel(s)}</span>
                {s.media !== null && (
                  <span className="text-xs text-slate-500">
                    Média {formatarNota(s.media)}
                    {s.pontuacaoMaxima !== null ? ` / ${formatarNota(s.pontuacaoMaxima)}` : ""}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
