"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

// Alteração de uma única data da aula semanal: cancelada, ou movida/alterada (data, horário e professor efetivos).
export interface ScheduleException {
  // Data original da ocorrência (o dia da série) e data efetiva; ambas "YYYY-MM-DD".
  dataOriginal: string;
  cancelada: boolean;
  data: string | null;
  startTime: string | null;
  endTime: string | null;
  teacherId: string | null;
  teacher: string | null;
}

export interface ScheduleItem {
  id: string;
  day: number;
  startTime: string;
  endTime: string;
  duration: number;
  subject: string;
  subjectId: string;
  class: string;
  classId: string;
  teacher: string;
  teacherId: string;
  room: string;
  color: string;
  type: "aula" | "plantao" | "aulao";
  // Período da grade da turma ("YYYY-MM-DD"); a aula só acontece entre essas datas. Ausente = sem restrição.
  periodStart?: string | null;
  periodEnd?: string | null;
  excecoes: ScheduleException[];
}

interface ExcecaoDTO {
  dataOriginal: string;
  cancelada: boolean;
  data: string | null;
  horarioInicio: string | null;
  horarioFim: string | null;
  professor: { id: string; name: string } | null;
}

interface AulaDTO {
  id: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
  sala: string | null;
  tipo: "AULA" | "PLANTAO" | "AULAO";
  turma: { id: string; nome: string; gradeInicio?: string | null; gradeFim?: string | null };
  disciplina: { id: string; nome: string };
  professor: { id: string; name: string };
  excecoes?: ExcecaoDTO[];
}

// Índice do dia na semana começando na segunda (0) até o domingo (6).
const DAY_TO_INDEX: Record<string, number> = { SEGUNDA: 0, TERCA: 1, QUARTA: 2, QUINTA: 3, SEXTA: 4, SABADO: 5, DOMINGO: 6 };
const INDEX_TO_DAY = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"];
// Uma cor por disciplina (todas as aulas da mesma matéria com a mesma cor), atribuída na ordem alfabética das
// disciplinas: com até 12 matérias, nenhuma repete cor.
const COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-cyan-600",
  "bg-fuchsia-500",
  "bg-lime-600",
  "bg-red-500"
];

function colorsBySubject(aulas: AulaDTO[]) {
  const subjects = [...new Map(aulas.map((aula) => [aula.disciplina.id, aula.disciplina.nome]))].sort((a, b) =>
    a[1].localeCompare(b[1], "pt-BR")
  );
  return new Map(subjects.map(([id], index) => [id, COLORS[index % COLORS.length]]));
}

function toHHMM(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

function durationOf(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

function fromAula(aula: AulaDTO, color: string): ScheduleItem {
  const startTime = toHHMM(aula.horarioInicio);
  const endTime = toHHMM(aula.horarioFim);
  return {
    id: aula.id,
    day: DAY_TO_INDEX[aula.diaSemana] ?? 0,
    startTime,
    endTime,
    duration: durationOf(startTime, endTime),
    subject: aula.disciplina.nome,
    subjectId: aula.disciplina.id,
    class: aula.turma.nome,
    classId: aula.turma.id,
    teacher: aula.professor.name,
    teacherId: aula.professor.id,
    room: aula.sala ?? "",
    color,
    periodStart: aula.turma.gradeInicio?.slice(0, 10) ?? null,
    periodEnd: aula.turma.gradeFim?.slice(0, 10) ?? null,
    type: aula.tipo.toLowerCase() as ScheduleItem["type"],
    excecoes: (aula.excecoes ?? []).map((e) => ({
      dataOriginal: e.dataOriginal.slice(0, 10),
      cancelada: e.cancelada,
      data: e.data?.slice(0, 10) ?? null,
      startTime: e.horarioInicio,
      endTime: e.horarioFim,
      teacherId: e.professor?.id ?? null,
      teacher: e.professor?.name ?? null
    }))
  };
}

interface ScheduleContextType {
  schedules: ScheduleItem[];
  loading: boolean;
  refresh: () => Promise<void>;
  addSchedule: (item: Omit<ScheduleItem, "id" | "duration" | "color" | "excecoes">) => Promise<void>;
  updateSchedule: (id: string, patch: Partial<Omit<ScheduleItem, "id" | "excecoes">>) => Promise<void>;
  removeSchedule: (id: string) => Promise<void>;
  // Altera ou cancela só uma data da aula ("Esta aula"); dataOriginal é o dia da série ("YYYY-MM-DD").
  updateOccurrence: (id: string, dataOriginal: string, patch: { data: string; startTime: string; endTime: string; teacherId: string }) => Promise<void>;
  cancelOccurrence: (id: string, dataOriginal: string) => Promise<void>;
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const aulas = await api.get<AulaDTO[]>("/schedule/weekly");
      const colors = colorsBySubject(aulas);
      setSchedules(aulas.map((aula) => fromAula(aula, colors.get(aula.disciplina.id) ?? COLORS[0])));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const addSchedule = async (item: Omit<ScheduleItem, "id" | "duration" | "color" | "excecoes">) => {
    await api.post("/schedule", {
      turmaId: item.classId,
      disciplinaId: item.subjectId,
      professorId: item.teacherId,
      diaSemana: INDEX_TO_DAY[item.day],
      horarioInicio: item.startTime,
      horarioFim: item.endTime,
      sala: item.room || undefined,
      tipo: item.type.toUpperCase()
    });
    await refresh();
  };

  const updateSchedule = async (id: string, patch: Partial<Omit<ScheduleItem, "id" | "excecoes">>) => {
    await api.put(`/schedule/${id}`, {
      turmaId: patch.classId,
      disciplinaId: patch.subjectId,
      professorId: patch.teacherId,
      diaSemana: patch.day !== undefined ? INDEX_TO_DAY[patch.day] : undefined,
      horarioInicio: patch.startTime,
      horarioFim: patch.endTime,
      // Campo de sala esvaziado remove a sala; undefined mantém a atual.
      sala: patch.room === undefined ? undefined : patch.room || null,
      tipo: patch.type ? patch.type.toUpperCase() : undefined
    });
    await refresh();
  };

  const removeSchedule = async (id: string) => {
    await api.delete(`/schedule/${id}`);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const updateOccurrence: ScheduleContextType["updateOccurrence"] = async (id, dataOriginal, patch) => {
    await api.put(`/schedule/${id}/ocorrencias/${dataOriginal}`, {
      data: patch.data,
      horarioInicio: patch.startTime,
      horarioFim: patch.endTime,
      professorId: patch.teacherId
    });
    await refresh();
  };

  const cancelOccurrence = async (id: string, dataOriginal: string) => {
    await api.delete(`/schedule/${id}/ocorrencias/${dataOriginal}`);
    await refresh();
  };

  return (
    <ScheduleContext.Provider
      value={{ schedules, loading, refresh, addSchedule, updateSchedule, removeSchedule, updateOccurrence, cancelOccurrence }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
}
