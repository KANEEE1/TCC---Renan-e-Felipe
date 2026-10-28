"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";

export interface TodayItem {
  aula: {
    id: string;
    horarioInicio: string;
    horarioFim: string;
    disciplina: { id: string; nome: string };
    turma: { id: string; nome: string };
    professor: { id: string; name: string };
  };
  status: "AGUARDANDO" | "ABERTA" | "ENCERRADA";
  registrada: boolean;
  automatica: boolean;
  responsavel: boolean;
  podeRegistrar: boolean;
  presentes: number;
  total: number;
}

interface PresencaDTO {
  aulaId: string;
  data: string;
  presente: boolean;
  aula: { disciplina: { nome: string }; turma: { nome: string } };
}

const COLORS = ["bg-blue-500", "bg-emerald-500", "bg-orange-400", "bg-purple-500", "bg-teal-500"];

export function AttendanceList() {
  const [todayClasses, setTodayClasses] = useState<TodayItem[]>([]);
  const [allPresences, setAllPresences] = useState<PresencaDTO[]>([]);

  useEffect(() => {
    api.get<TodayItem[]>("/attendance/today").then(setTodayClasses).catch(() => setTodayClasses([]));
    api.get<PresencaDTO[]>("/attendance").then(setAllPresences).catch(() => setAllPresences([]));
  }, []);

  const todayDateStr = new Date().toISOString().slice(0, 10);

  const recentClasses = useMemo(() => {
    const groups = new Map<string, { subject: string; class: string; date: string; present: number; total: number }>();
    for (const p of allPresences) {
      const date = p.data.slice(0, 10);
      if (date === todayDateStr) continue;
      const key = `${p.aulaId}-${date}`;
      const g = groups.get(key) ?? { subject: p.aula.disciplina.nome, class: p.aula.turma.nome, date, present: 0, total: 0 };
      g.total += 1;
      if (p.presente) g.present += 1;
      groups.set(key, g);
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[1].date.localeCompare(a[1].date))
      .slice(0, 5)
      .map(([key, value]) => ({ id: key, ...value }));
  }, [allPresences, todayDateStr]);

  const overallTotal = allPresences.length;
  const overallPresent = allPresences.filter((p) => p.presente).length;
  const presenceRate = overallTotal === 0 ? 0 : Math.round((overallPresent / overallTotal) * 100);

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 pb-7 pt-5 text-white">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-white">Presença</h1>
            <p className="mt-0.5 text-sm text-emerald-200">Controle de frequência</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <CheckCircle size={20} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/20 bg-white/15 p-3.5">
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-200" />
              <span className="text-xs text-white/70">Taxa de Presença</span>
            </div>
            <p className="text-2xl text-white">{presenceRate}%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-emerald-300" style={{ width: `${presenceRate}%` }} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/15 p-3.5">
            <div className="mb-1 flex items-center gap-2">
              <XCircle size={16} className="text-rose-300" />
              <span className="text-xs text-white/70">Taxa de Ausência</span>
            </div>
            <p className="text-2xl text-white">{100 - presenceRate}%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-rose-400" style={{ width: `${100 - presenceRate}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-6">
        <Link
          href="/attendance/summary"
          className="block w-full rounded-xl border border-emerald-200 bg-white py-2.5 text-center text-sm text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          Relatório de frequência
        </Link>
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-blue-500" />
            <h2 className="text-slate-700">Aulas de Hoje</h2>
            <span className="ml-1 text-xs text-slate-400">
              {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
            </span>
          </div>

          {todayClasses.length === 0 && <p className="text-sm text-slate-400">Nenhuma aula hoje.</p>}

          <div className="space-y-2.5">
            {todayClasses.map(({ aula, status, registrada, automatica, responsavel, podeRegistrar, presentes, total }, idx) => (
              <div key={aula.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex">
                  <div className={`w-1.5 shrink-0 rounded-l-2xl ${COLORS[idx % COLORS.length]}`} />
                  <div className="flex-1 p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-slate-800">{aula.disciplina.nome}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {aula.turma.nome} · {aula.horarioInicio} – {aula.horarioFim}
                        </p>
                        <p className="text-xs text-slate-400">{aula.professor.name}</p>
                      </div>
                    </div>

                    {status === "AGUARDANDO" && (
                      <div className="w-full rounded-xl bg-slate-100 py-2.5 text-center text-sm text-slate-400">Abre às {aula.horarioInicio}</div>
                    )}
                    {status === "ABERTA" &&
                      (podeRegistrar ? (
                        <Link
                          href={`/attendance/mark/${aula.id}`}
                          className="block w-full rounded-xl bg-emerald-600 py-2.5 text-center text-sm text-white transition-colors hover:bg-emerald-700"
                        >
                          Registrar presença
                        </Link>
                      ) : (
                        <div className="w-full rounded-xl bg-slate-100 py-2.5 text-center text-sm text-slate-500">
                          {responsavel ? "Em andamento" : "Somente o professor responsável registra"}
                        </div>
                      ))}
                    {status === "ENCERRADA" && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">
                            Encerrada · {registrada ? "Presença registrada" : automatica ? "Presença automática (todos presentes)" : "Sem registro"}
                          </span>
                          {total > 0 && (
                            <span className="text-slate-600">
                              {presentes}/{total}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-purple-500" />
            <h2 className="text-slate-700">Aulas Recentes</h2>
          </div>

          {recentClasses.length === 0 && <p className="text-sm text-slate-400">Nenhum histórico ainda.</p>}

          <div className="space-y-2.5 pb-4">
            {recentClasses.map((cls) => {
              const pct = Math.round((cls.present / cls.total) * 100);
              return (
                <div key={cls.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="text-sm text-slate-800">{cls.subject}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {cls.class} · {new Date(cls.date).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm ${pct >= 90 ? "text-emerald-600" : pct >= 75 ? "text-amber-600" : "text-rose-500"}`}>{pct}%</p>
                      <p className="text-xs text-slate-400">
                        {cls.present}/{cls.total}
                      </p>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${pct >= 90 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
