"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";

interface AulaDTO {
  id: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
  disciplina: { nome: string };
  turma: { id: string; nome: string };
  professor: { name: string };
}

interface PresencaDTO {
  aulaId: string;
  data: string;
  presente: boolean;
  aula: { disciplina: { nome: string }; turma: { nome: string } };
}

const COLORS = ["bg-blue-500", "bg-emerald-500", "bg-orange-400", "bg-purple-500", "bg-teal-500"];

function toHHMM(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

function todayDiaSemana() {
  const names = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
  return names[new Date().getDay()];
}

function statusFor(start: string, end: string) {
  const now = new Date();
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (nowHHMM < toHHMM(start)) return "agendada";
  if (nowHHMM > toHHMM(end)) return "concluída";
  return "pendente";
}

export function AttendanceList() {
  const [todayLessons, setTodayLessons] = useState<AulaDTO[]>([]);
  const [allPresences, setAllPresences] = useState<PresencaDTO[]>([]);

  useEffect(() => {
    api.get<AulaDTO[]>("/schedule/weekly").then((aulas) => {
      setTodayLessons(aulas.filter((a) => a.diaSemana === todayDiaSemana()));
    });
    api.get<PresencaDTO[]>("/attendance").then(setAllPresences).catch(() => setAllPresences([]));
  }, []);

  const todayDateStr = new Date().toISOString().slice(0, 10);

  const todayClasses = todayLessons.map((lesson) => {
    const status = statusFor(lesson.horarioInicio, lesson.horarioFim);
    const presencesForLesson = allPresences.filter((p) => p.aulaId === lesson.id && p.data.slice(0, 10) === todayDateStr);
    const present = presencesForLesson.filter((p) => p.presente).length;
    const absent = presencesForLesson.filter((p) => !p.presente).length;
    const total = presencesForLesson.length;
    return { lesson, status, present, absent, total };
  });

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
            {todayClasses.map(({ lesson, status, present, absent, total }, idx) => (
              <div key={lesson.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex">
                  <div className={`w-1.5 shrink-0 rounded-l-2xl ${COLORS[idx % COLORS.length]}`} />
                  <div className="flex-1 p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-slate-800">{lesson.disciplina.nome}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {lesson.turma.nome} · {toHHMM(lesson.horarioInicio)} – {toHHMM(lesson.horarioFim)}
                        </p>
                        <p className="text-xs text-slate-400">{lesson.professor.name}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{status}</span>
                    </div>

                    {status === "concluída" && total > 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle size={13} /> {present} presentes
                            </span>
                            <span className="flex items-center gap-1 text-rose-500">
                              <XCircle size={13} /> {absent} ausentes
                            </span>
                          </div>
                          <span className="text-xs text-slate-600">{Math.round((present / total) * 100)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((present / total) * 100)}%` }} />
                        </div>
                      </div>
                    ) : status !== "agendada" ? (
                      <Link
                        href={`/attendance/mark/${lesson.id}`}
                        className="block w-full rounded-xl bg-emerald-600 py-2.5 text-center text-sm text-white transition-colors hover:bg-emerald-700"
                      >
                        Marcar Presença
                      </Link>
                    ) : (
                      <div className="w-full cursor-not-allowed rounded-xl bg-slate-100 py-2.5 text-center text-sm text-slate-400">Aula Futura</div>
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
