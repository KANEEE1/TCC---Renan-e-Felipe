"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Calendar, ChevronLeft, ChevronRight, Clock, Users } from "lucide-react";
import { useSchedule, type ScheduleItem } from "@/components/schedule/schedule-context";

const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const DAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex"];

const TYPE_COLORS: Record<string, string> = {
  aula: "bg-blue-100 text-blue-700 border-blue-200",
  plantao: "bg-purple-100 text-purple-700 border-purple-200",
  aulao: "bg-orange-100 text-orange-700 border-orange-200"
};
const TYPE_LABELS: Record<string, string> = { aula: "Aula", plantao: "Plantão", aulao: "Aulão" };

const AVATAR_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-700",
  "from-pink-500 to-rose-600",
  "from-indigo-500 to-blue-700",
  "from-teal-500 to-emerald-600",
  "from-orange-500 to-amber-600"
];
const HEADER_GRADIENTS = [
  "from-blue-600 to-indigo-700",
  "from-violet-600 to-purple-800",
  "from-pink-600 to-rose-700",
  "from-indigo-600 to-blue-700",
  "from-teal-600 to-emerald-700",
  "from-orange-600 to-amber-700"
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function calcHours(items: ScheduleItem[]): number {
  return items.reduce((sum, s) => {
    if (s.endTime && s.startTime) {
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      return sum + (eh * 60 + em - (sh * 60 + sm)) / 60;
    }
    return sum + s.duration;
  }, 0);
}

export function TeacherScheduleView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { schedules } = useSchedule();

  const allTeachers = useMemo(() => {
    const names = new Set(schedules.map((s) => s.teacher));
    return Array.from(names).sort();
  }, [schedules]);

  const [selectedTeacher, setSelectedTeacher] = useState(searchParams.get("teacher") || allTeachers[0] || "");
  const [activeDay, setActiveDay] = useState<number | null>(null);

  const teacherIdx = allTeachers.indexOf(selectedTeacher);

  const teacherItems = useMemo(() => schedules.filter((s) => s.teacher === selectedTeacher), [schedules, selectedTeacher]);

  const hoursPerWeek = useMemo(() => calcHours(teacherItems), [teacherItems]);
  const uniqueSubjects = useMemo(() => Array.from(new Set(teacherItems.map((s) => s.subject))), [teacherItems]);
  const uniqueClasses = useMemo(
    () => Array.from(new Set(teacherItems.map((s) => s.class).filter((c) => c !== "Todas"))),
    [teacherItems]
  );

  const itemsByDay = useMemo(() => {
    const map: Record<number, ScheduleItem[]> = {};
    for (let d = 0; d < 5; d++) {
      map[d] = teacherItems.filter((s) => s.day === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [teacherItems]);

  const prevTeacher = () => {
    if (teacherIdx > 0) {
      setSelectedTeacher(allTeachers[teacherIdx - 1]);
      setActiveDay(null);
    }
  };
  const nextTeacher = () => {
    if (teacherIdx < allTeachers.length - 1) {
      setSelectedTeacher(allTeachers[teacherIdx + 1]);
      setActiveDay(null);
    }
  };

  const gradient = HEADER_GRADIENTS[teacherIdx % HEADER_GRADIENTS.length];
  const avatarGradient = AVATAR_GRADIENTS[teacherIdx % AVATAR_GRADIENTS.length];
  const daysToShow = activeDay === null ? [0, 1, 2, 3, 4] : [activeDay];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
      <div className={`shrink-0 bg-gradient-to-br px-4 pb-6 pt-4 text-white ${gradient}`}>
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-white/80">Agenda por Professor</span>
          <Link href="/calendar" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30">
            <Calendar size={16} />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={prevTeacher}
            disabled={teacherIdx === 0}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex flex-1 flex-col items-center">
            <div className={`mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white/40 bg-gradient-to-br shadow-lg ${avatarGradient}`}>
              <span className="text-xl text-white">{getInitials(selectedTeacher)}</span>
            </div>
            <h2 className="text-white">{selectedTeacher}</h2>
            <p className="mt-0.5 text-xs text-white/60">
              {teacherIdx + 1} de {allTeachers.length} professores
            </p>
          </div>
          <button
            type="button"
            onClick={nextTeacher}
            disabled={teacherIdx === allTeachers.length - 1}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {[
            { icon: BookOpen, value: teacherItems.length, label: "Aulas/sem." },
            { icon: Clock, value: `${hoursPerWeek}h`, label: "Horas/sem." },
            { icon: Users, value: uniqueClasses.length, label: "Turmas" }
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-2xl border border-white/20 bg-white/15 p-3 text-center">
              <Icon className="mx-auto mb-1 text-white/70" size={17} />
              <p className="text-xl leading-tight text-white">{value}</p>
              <p className="mt-0.5 text-[10px] text-white/60">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex min-w-max gap-2">
          {allTeachers.map((name, idx) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setSelectedTeacher(name);
                setActiveDay(null);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all ${
                selectedTeacher === name
                  ? "border-violet-600 bg-violet-600 text-white shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-300"
              }`}
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br text-white ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]}`}
                style={{ fontSize: "7px" }}
              >
                {getInitials(name).slice(0, 1)}
              </div>
              {name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 gap-1.5 border-b border-slate-200 bg-white px-4 py-2">
        <button
          type="button"
          onClick={() => setActiveDay(null)}
          className={`flex-1 rounded-lg py-1.5 text-xs transition-all ${
            activeDay === null ? "bg-violet-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          Todos
        </button>
        {DAY_SHORT.map((label, idx) => {
          const count = itemsByDay[idx]?.length || 0;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveDay(activeDay === idx ? null : idx)}
              className={`relative flex-1 rounded-lg py-1.5 text-xs transition-all ${
                activeDay === idx ? "bg-violet-600 text-white shadow-sm" : count > 0 ? "text-slate-600 hover:bg-slate-100" : "text-slate-300"
              }`}
            >
              {label}
              {count > 0 && activeDay !== idx && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />}
            </button>
          );
        })}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-8">
        {teacherItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <div className="mb-3 text-5xl">📭</div>
            <p className="text-sm">Nenhum agendamento para {selectedTeacher.split(" ")[0]}</p>
          </div>
        ) : (
          daysToShow.map((dayIdx) => {
            const items = itemsByDay[dayIdx];
            if (!items || items.length === 0) return null;
            return (
              <div key={dayIdx}>
                {activeDay === null && (
                  <div className="mb-2.5 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-violet-400" />
                    <span className="text-xs uppercase tracking-wide text-slate-400">{DAY_NAMES[dayIdx]}</span>
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="text-xs text-slate-300">
                      {items.length} aula{items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                <div className="space-y-2.5">
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      href={`/schedule/edit/${item.id}`}
                      className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-stretch">
                        <div className={`w-1.5 shrink-0 rounded-l-2xl ${item.color}`} />
                        <div className="flex-1 p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm leading-tight text-slate-800">{item.subject}</p>
                              <p className="mt-0.5 text-xs text-slate-400">{item.class}</p>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${TYPE_COLORS[item.type]}`}>
                              {TYPE_LABELS[item.type]}
                            </span>
                          </div>
                          <div className="mt-2.5 flex items-center gap-3">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                              🕐 {item.startTime} – {item.endTime}
                            </span>
                            {item.room && <span className="text-xs text-slate-400">📍 {item.room}</span>}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })
        )}

        {uniqueSubjects.length > 0 && (
          <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">Disciplinas</p>
            <div className="flex flex-wrap gap-2">
              {uniqueSubjects.map((s) => (
                <span key={s} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
