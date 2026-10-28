"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Tag, User, Users, X } from "lucide-react";
import { useSchedule, type ScheduleItem } from "@/components/schedule/schedule-context";
import { api } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

type ViewMode = "day" | "week" | "month";

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
// Semana começando na segunda, como os índices de ScheduleItem.day (0 = segunda ... 6 = domingo).
const DAY_SHORT = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const DAY_FULL = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"];
const VIEW_LABELS: Record<ViewMode, string> = { day: "Dia", week: "Semana", month: "Mês" };
const TYPE_LABELS: Record<string, string> = { aula: "Aula", plantao: "Plantão", aulao: "Aulão" };

const HOUR_HEIGHT = 52;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TOTAL_HEIGHT = 24 * HOUR_HEIGHT;

function minutesOf(time: string) {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function weekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - weekdayIndex(d));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// "YYYY-MM-DD" da data local, para comparar com o período da grade sem problemas de fuso.
function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Semanas completas (segunda a domingo) que cobrem o mês inteiro.
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((weekdayIndex(first) + daysInMonth) / 7);
  const start = startOfWeek(first);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

// Aulas que se sobrepõem no mesmo dia ficam lado a lado, como no Google Agenda.
function layoutDay(events: ScheduleItem[]) {
  const sorted = [...events].sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime) || minutesOf(b.endTime) - minutesOf(a.endTime));
  const placed: { event: ScheduleItem; column: number; columns: number }[] = [];
  let cluster: typeof placed = [];
  let clusterEnd = -1;
  let columnEnds: number[] = [];

  const closeCluster = () => {
    for (const item of cluster) item.columns = columnEnds.length;
    cluster = [];
    columnEnds = [];
  };

  for (const event of sorted) {
    const start = minutesOf(event.startTime);
    const end = Math.max(minutesOf(event.endTime), start + 15);
    if (start >= clusterEnd) closeCluster();
    let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[column] = end;
    }
    const item = { event, column, columns: 1 };
    cluster.push(item);
    placed.push(item);
    clusterEnd = Math.max(clusterEnd, end);
  }
  closeCluster();
  return placed;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function CalendarView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { schedules } = useSchedule();
  const now = useNow();

  // A agenda sempre abre na semana de hoje.
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  // Filtros combináveis: turma e professor, ambos por id. Ficam na URL (?class=&teacher=).
  const [selectedClass, setSelectedClass] = useState<string>(searchParams.get("class") || "all");
  const [selectedTeacher, setSelectedTeacher] = useState<string>(searchParams.get("teacher") || "all");

  // Para professores (sem papel de gestão), a agenda abre filtrada nas próprias aulas, salvo filtro na URL.
  // Feito após montar porque a sessão fica no navegador (localStorage).
  useEffect(() => {
    if (searchParams.get("teacher")) return;
    const user = getSessionUser();
    if (user && user.roles.includes("PROFESSOR") && !user.roles.includes("GESTAO")) setSelectedTeacher(user.id);
    // Só na abertura da tela.
  }, []);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const classes = useMemo(
    () => [...new Map(schedules.map((s) => [s.classId, s.class]))].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
    [schedules]
  );
  const ofClass = useMemo(
    () => (selectedClass === "all" ? schedules : schedules.filter((s) => s.classId === selectedClass)),
    [schedules, selectedClass]
  );
  // Com uma turma escolhida, só aparecem os professores que dão aula nela.
  // Nome do professor vindo pela URL (ex.: botão "Agenda" na lista de professores) que ainda não tem aulas.
  const [extraTeacher, setExtraTeacher] = useState<[string, string] | null>(null);
  const teachers = useMemo(() => {
    const list = [...new Map(ofClass.map((s) => [s.teacherId, s.teacher]))];
    if (extraTeacher && !list.some(([id]) => id === extraTeacher[0])) list.push(extraTeacher);
    return list.sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [ofClass, extraTeacher]);
  const filtered = useMemo(
    () => (selectedTeacher === "all" ? ofClass : ofClass.filter((s) => s.teacherId === selectedTeacher)),
    [ofClass, selectedTeacher]
  );

  useEffect(() => {
    if (selectedTeacher === "all" || schedules.some((s) => s.teacherId === selectedTeacher)) return;
    let cancelled = false;
    api
      .get<{ id: string; name: string }>(`/teachers/${selectedTeacher}`)
      .then((teacher) => !cancelled && setExtraTeacher([teacher.id, teacher.name]))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedTeacher, schedules]);

  const selectedTeacherName = teachers.find(([id]) => id === selectedTeacher)?.[1];
  const teacherWithoutLessons = selectedTeacher !== "all" && !!selectedTeacherName && filtered.length === 0;
  // A aula se repete toda semana, mas só dentro do período da grade da turma.
  const eventsOn = (date: Date) => {
    const key = dateKey(date);
    return filtered.filter(
      (s) => s.day === weekdayIndex(date) && (!s.periodStart || s.periodStart <= key) && (!s.periodEnd || s.periodEnd >= key)
    );
  };

  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const visibleDays = viewMode === "day" ? [cursor] : weekDays;

  // Nas visões de dia e semana, rola até pouco antes da hora atual (como o Google Agenda).
  useEffect(() => {
    if (viewMode === "month" || !scrollRef.current) return;
    scrollRef.current.scrollTop = Math.max(0, (new Date().getHours() - 1) * HOUR_HEIGHT);
  }, [viewMode]);

  const applyFilters = (classId: string, teacher: string) => {
    setSelectedClass(classId);
    setSelectedTeacher(teacher);
    const params = new URLSearchParams();
    if (classId !== "all") params.set("class", classId);
    if (teacher !== "all") params.set("teacher", teacher);
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  };

  const handleClassSelect = (classId: string) => {
    // Mantém o professor só se ele também dá aula na nova turma.
    const keepsTeacher =
      selectedTeacher === "all" || classId === "all" || schedules.some((s) => s.classId === classId && s.teacherId === selectedTeacher);
    applyFilters(classId, keepsTeacher ? selectedTeacher : "all");
  };

  const handleTeacherSelect = (teacherId: string) => applyFilters(selectedClass, teacherId);

  const move = (direction: 1 | -1) => {
    const d = new Date(cursor);
    if (viewMode === "day") d.setDate(d.getDate() + direction);
    else if (viewMode === "week") d.setDate(d.getDate() + 7 * direction);
    else d.setMonth(d.getMonth() + direction, 1);
    setCursor(d);
  };

  const goToday = () => {
    setCursor(new Date());
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, (new Date().getHours() - 1) * HOUR_HEIGHT);
  };

  const openDay = (date: Date) => {
    setCursor(date);
    setViewMode("day");
  };

  const title = (() => {
    if (viewMode === "month" || viewMode === "day") {
      return `${MONTH_NAMES[cursor.getMonth()]} de ${cursor.getFullYear()}`;
    }
    const [first, last] = [weekDays[0], weekDays[6]];
    if (first.getMonth() === last.getMonth()) return `${MONTH_NAMES[first.getMonth()]} de ${first.getFullYear()}`;
    return `${MONTH_NAMES[first.getMonth()].slice(0, 3)} – ${MONTH_NAMES[last.getMonth()].slice(0, 3)} de ${last.getFullYear()}`;
  })();

  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;

  const timeGrid = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 border-b border-slate-200 bg-white">
        <div className="w-12 shrink-0" />
        {visibleDays.map((day) => {
          const today = isSameDay(day, now);
          return (
            <button
              key={day.toDateString()}
              type="button"
              onClick={() => openDay(day)}
              className={`flex flex-1 flex-col items-center py-2 ${viewMode === "day" ? "items-start pl-3" : ""}`}
            >
              <span className={`text-[11px] font-medium tracking-wide ${today ? "text-blue-600" : "text-slate-500"}`}>
                {DAY_SHORT[weekdayIndex(day)]}
              </span>
              <span
                className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-lg ${
                  today ? "bg-blue-600 text-white" : "text-slate-800 hover:bg-slate-100"
                }`}
              >
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-white">
        <div className="relative flex" style={{ height: TOTAL_HEIGHT }}>
          <div className="relative w-12 shrink-0">
            {HOURS.slice(1).map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-slate-400" style={{ top: h * HOUR_HEIGHT }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {visibleDays.map((day) => {
            const today = isSameDay(day, now);
            return (
              <div key={day.toDateString()} className="relative flex-1 border-l border-slate-200">
                {HOURS.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: h * HOUR_HEIGHT }} />
                ))}

                {layoutDay(eventsOn(day)).map(({ event, column, columns }) => {
                  const start = minutesOf(event.startTime);
                  const end = Math.max(minutesOf(event.endTime), start + 15);
                  const height = ((end - start) / 60) * HOUR_HEIGHT;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedEvent(event)}
                      className={`absolute overflow-hidden rounded-md border border-white px-1.5 py-0.5 text-left text-white shadow-sm transition hover:brightness-110 ${event.color}`}
                      style={{
                        top: (start / 60) * HOUR_HEIGHT + 1,
                        height: height - 2,
                        left: `calc(${(column / columns) * 100}% + 2px)`,
                        width: `calc(${100 / columns}% - 4px)`
                      }}
                    >
                      <span className="block truncate text-[11px] font-semibold leading-tight">{event.subject}</span>
                      {height >= 34 && (
                        <span className="block truncate text-[10px] leading-tight opacity-90">
                          {event.startTime} – {event.endTime}
                        </span>
                      )}
                      {height >= 52 && (
                        <span className="block truncate text-[10px] leading-tight opacity-80">
                          {viewMode === "day" ? `${event.teacher} · ${event.class}` : event.class}
                        </span>
                      )}
                    </button>
                  );
                })}

                {today && (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
                    <div className="relative h-0.5 bg-red-500">
                      <span className="absolute -left-1.5 -top-[5px] h-3 w-3 rounded-full bg-red-500" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const monthView = (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {DAY_SHORT.map((label) => (
          <div key={label} className="py-2 text-center text-[11px] font-medium text-slate-500">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {monthGrid(cursor.getFullYear(), cursor.getMonth()).map((date) => {
          const inMonth = date.getMonth() === cursor.getMonth();
          const today = isSameDay(date, now);
          const events = eventsOn(date).sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <button
              key={date.toDateString()}
              type="button"
              onClick={() => openDay(date)}
              className="min-h-[88px] border-b border-r border-slate-100 p-1 text-left transition-colors hover:bg-slate-50"
            >
              <span
                className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  today ? "bg-blue-600 font-semibold text-white" : inMonth ? "text-slate-700" : "text-slate-300"
                }`}
              >
                {date.getDate()}
              </span>
              <span className="block space-y-0.5">
                {events.slice(0, 3).map((event) => (
                  <span
                    key={event.id}
                    className={`block truncate rounded px-1 text-[10px] leading-4 text-white ${event.color} ${inMonth ? "" : "opacity-50"}`}
                  >
                    {event.startTime} {event.subject}
                  </span>
                ))}
                {events.length > 3 && <span className="block px-1 text-[10px] text-slate-500">+{events.length - 3} mais</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full flex-col bg-white">
      <header className="shrink-0 border-b border-slate-200 bg-white px-3 pb-2 pt-3">
        <div className="flex items-center gap-1">
          <h1 className="mr-1 text-xl text-slate-800">Agenda</h1>
          <button
            type="button"
            onClick={goToday}
            className="ml-auto rounded-full border border-slate-300 px-3.5 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => router.push("/teachers/schedule")}
            aria-label="Agenda dos professores"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100"
          >
            <Users size={18} />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Anterior"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Próximo"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
          >
            <ChevronRight size={20} />
          </button>
          <span className="ml-1 truncate text-base capitalize text-slate-700">{title}</span>

          <div className="ml-auto flex shrink-0 rounded-full bg-slate-100 p-0.5">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-full px-3 py-1 text-xs transition-all ${
                  viewMode === mode ? "bg-white font-medium text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {VIEW_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        {classes.length > 0 && (
          <div className="-mx-3 mt-2 overflow-x-auto px-3">
            <div className="flex min-w-max items-center gap-1.5">
              <span className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">Turma</span>
              {[["all", "Todas"] as [string, string], ...classes].map(([id, name]) => {
                const active = selectedClass === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleClassSelect(id)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                      active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {id === "all" ? <BookOpen size={12} /> : null}
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {teachers.length > 0 && (
          <div className="-mx-3 mt-1.5 overflow-x-auto px-3">
            <div className="flex min-w-max items-center gap-1.5">
              <span className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">Professor</span>
              {[["all", "Todos"] as [string, string], ...teachers].map(([id, name]) => {
                const active = selectedTeacher === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleTeacherSelect(id)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                      active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {id === "all" ? (
                      <Users size={12} />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[7px] text-slate-700">
                        {initials(name)}
                      </span>
                    )}
                    {id === "all" ? name : name.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {teacherWithoutLessons && (
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {selectedTeacherName} ainda não tem aulas{selectedClass !== "all" ? " nesta turma" : " na grade"}.
          </p>
        )}
      </header>

      {viewMode === "month" ? monthView : timeGrid}

      <button
        type="button"
        onClick={() => router.push("/schedule/create")}
        aria-label="Nova aula"
        className="absolute bottom-5 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-lg ring-1 ring-slate-200 transition hover:shadow-xl"
      >
        <Plus size={28} />
      </button>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSelectedEvent(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-t-3xl bg-white pb-6 shadow-2xl sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-end px-3 pt-3">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                aria-label="Fechar"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex gap-4 px-6">
              <span className={`mt-1.5 h-4 w-4 shrink-0 rounded ${selectedEvent.color}`} />
              <div className="min-w-0">
                <h2 className="text-xl text-slate-800">{selectedEvent.subject}</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Toda {DAY_FULL[selectedEvent.day]} · {selectedEvent.startTime} – {selectedEvent.endTime}
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-3 px-6 text-sm text-slate-700">
              <li className="flex items-center gap-4">
                <Clock size={18} className="shrink-0 text-slate-400" />
                {selectedEvent.duration % 1 === 0 ? `${selectedEvent.duration}h` : `${Math.round(selectedEvent.duration * 60)} min`} de aula
              </li>
              <li className="flex items-center gap-4">
                <User size={18} className="shrink-0 text-slate-400" />
                {selectedEvent.teacher}
              </li>
              <li className="flex items-center gap-4">
                <BookOpen size={18} className="shrink-0 text-slate-400" />
                {selectedEvent.class}
              </li>
              {selectedEvent.room && (
                <li className="flex items-center gap-4">
                  <MapPin size={18} className="shrink-0 text-slate-400" />
                  {selectedEvent.room}
                </li>
              )}
              {TYPE_LABELS[selectedEvent.type] && (
                <li className="flex items-center gap-4">
                  <Tag size={18} className="shrink-0 text-slate-400" />
                  {TYPE_LABELS[selectedEvent.type]}
                </li>
              )}
            </ul>
            <div className="mt-6 flex justify-end gap-2 px-6">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => router.push(`/schedule/edit/${selectedEvent.id}`)}
                className="rounded-full bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700"
              >
                Editar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
