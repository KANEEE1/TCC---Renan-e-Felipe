"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { api } from "@/lib/api";

export interface TodayItem {
  // "AULA": aula da grade; "EVENTO": aula comum (evento) que exige presença. Em EVENTO, aula.id é o id do evento.
  kind: "AULA" | "EVENTO";
  eventoId?: string;
  titulo?: string;
  aula: {
    id: string;
    horarioInicio: string;
    horarioFim: string;
    disciplina: { id: string; nome: string };
    turmas: { id: string; nome: string }[];
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
  aulaId: string | null;
  reuniaoId: string | null;
  data: string;
  presente: boolean;
  aula: { disciplina: { nome: string }; turma: { nome: string } } | null;
  reuniao: { disciplina: { nome: string } | null } | null;
  turma: { nome: string } | null;
}

// Rota de registro: a aula da grade usa o id da aula; a aula comum com presença usa "evento-<id>".
export const markHref = (item: Pick<TodayItem, "kind" | "eventoId" | "aula">) =>
  `/attendance/mark/${item.kind === "EVENTO" ? `evento-${item.eventoId}` : item.aula.id}`;

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
    const groups = new Map<string, { subject: string; classes: Set<string>; date: string; present: number; total: number }>();
    for (const p of allPresences) {
      const date = p.data.slice(0, 10);
      if (date === todayDateStr) continue;
      const key = `${p.aulaId ?? p.reuniaoId}-${date}`;
      const g = groups.get(key) ?? {
        subject: (p.aula?.disciplina ?? p.reuniao?.disciplina)?.nome ?? "Aula",
        classes: new Set<string>(),
        date,
        present: 0,
        total: 0
      };
      // Aula comum pode ter várias turmas.
      const turma = (p.aula?.turma ?? p.turma)?.nome;
      if (turma) g.classes.add(turma);
      g.total += 1;
      if (p.presente) g.present += 1;
      groups.set(key, g);
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[1].date.localeCompare(a[1].date))
      .slice(0, 5)
      .map(([key, { classes, ...value }]) => ({ id: key, class: Array.from(classes).join(", "), ...value }));
  }, [allPresences, todayDateStr]);


  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 pb-6 pt-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <CheckCircle size={22} />
          </div>
          <div>
            <h1 className="text-white">Presença</h1>
            <p className="mt-0.5 text-sm text-emerald-100">Registre aqui a presença dos alunos nas aulas de hoje.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-6">
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
            {todayClasses.map((item, idx) => {
              const { aula, status, registrada, automatica, responsavel, podeRegistrar, presentes, total } = item;
              return (
              <div key={`${item.kind}-${aula.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex">
                  <div className={`w-1.5 shrink-0 rounded-l-2xl ${COLORS[idx % COLORS.length]}`} />
                  <div className="flex-1 p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-slate-800">
                          {aula.disciplina.nome}
                          {item.kind === "EVENTO" && item.titulo ? ` · ${item.titulo}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {aula.turmas.map((t) => t.nome).join(", ")} · {aula.horarioInicio} – {aula.horarioFim}
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
                          href={markHref(item)}
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
              );
            })}
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
