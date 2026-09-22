"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { useSchedule, type ScheduleItem } from "@/components/schedule/schedule-context";

type ViewMode = "month" | "week" | "day";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex"];
const DAY_LABELS_MONTH = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DAY_FULL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

const HOUR_HEIGHT = 64;
const START_HOUR = 7;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

const TYPE_LABELS: Record<string, string> = { aula: "Aula", plantao: "Plantão", aulao: "Aulão" };

const AVATAR_GRADIENTS = [
  "from-blue-500 to-blue-700",
  "from-violet-500 to-purple-700",
  "from-pink-500 to-rose-600",
  "from-indigo-500 to-indigo-700",
  "from-teal-500 to-teal-700",
  "from-orange-500 to-orange-600",
  "from-red-500 to-red-700",
  "from-emerald-500 to-emerald-700"
];

function parseMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getEventStyle(item: ScheduleItem) {
  const startMin = parseMinutes(item.startTime) - START_HOUR * 60;
  const endMin = item.endTime ? parseMinutes(item.endTime) - START_HOUR * 60 : startMin + item.duration * 60;
  const top = Math.max(0, (startMin / 60) * HOUR_HEIGHT);
  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 28);
  return { top, height };
}

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(date: Date): Date[] {
  const monday = getWeekMonday(date);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const paddingBefore = startDow === 0 ? 6 : startDow - 1;
  const days: { date: Date; isCurrentMonth: boolean }[] = [];
  for (let i = paddingBefore; i > 0; i--) {
    days.push({ date: new Date(year, month, 1 - i), isCurrentMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  while (days.length % 7 !== 0 || days.length < 35) {
    const nextD = days.length - paddingBefore - lastDay.getDate() + 1;
    days.push({ date: new Date(year, month + 1, nextD), isCurrentMonth: false });
  }
  return days;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function jsDateToSchedDay(date: Date): number | null {
  const jd = date.getDay();
  if (jd === 0 || jd === 6) return null;
  return jd - 1;
}

const TODAY = new Date(2026, 4, 4);
function isToday(d: Date) {
  return isSameDay(d, TODAY);
}

export function CalendarView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { schedules } = useSchedule();

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date(TODAY));
  const [selectedDay, setSelectedDay] = useState<Date>(new Date(TODAY));
  const [selectedTeacher, setSelectedTeacher] = useState<string>(searchParams.get("teacher") || "all");
  const [selectedEvent, setSelectedEvent] = useState<ScheduleItem | null>(null);

  const allTeachers = useMemo(() => {
    const names = new Set(schedules.map((s) => s.teacher));
    return Array.from(names).sort();
  }, [schedules]);

  const filtered = useMemo(() => {
    if (selectedTeacher === "all") return schedules;
    return schedules.filter((s) => s.teacher === selectedTeacher);
  }, [schedules, selectedTeacher]);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const monthGrid = useMemo(() => getMonthGrid(currentDate.getFullYear(), currentDate.getMonth()), [currentDate]);

  const handleTeacherSelect = (name: string) => {
    setSelectedTeacher(name);
    const params = new URLSearchParams();
    if (name !== "all") params.set("teacher", name);
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  };

  const prev = () => {
    const d = new Date(currentDate);
    if (viewMode === "month") d.setMonth(d.getMonth() - 1);
    else if (viewMode === "week") d.setDate(d.getDate() - 7);
    else {
      d.setDate(d.getDate() - 1);
      setSelectedDay(d);
    }
    setCurrentDate(d);
  };

  const next = () => {
    const d = new Date(currentDate);
    if (viewMode === "month") d.setMonth(d.getMonth() + 1);
    else if (viewMode === "week") d.setDate(d.getDate() + 7);
    else {
      d.setDate(d.getDate() + 1);
      setSelectedDay(d);
    }
    setCurrentDate(d);
  };

  const goToday = () => {
    setCurrentDate(new Date(TODAY));
    setSelectedDay(new Date(TODAY));
  };

  const headerTitle = useMemo(() => {
    if (viewMode === "month") return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (viewMode === "week") {
      const [first, last] = [weekDays[0], weekDays[4]];
      if (first.getMonth() === last.getMonth()) return `${first.getDate()}–${last.getDate()} ${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
      return `${first.getDate()} ${MONTH_NAMES[first.getMonth()].slice(0, 3)} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()].slice(0, 3)} ${last.getFullYear()}`;
    }
    return `${selectedDay.getDate()} de ${MONTH_NAMES[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`;
  }, [viewMode, currentDate, weekDays, selectedDay]);

  const getEventsForDayIndex = (dayIdx: number) => filtered.filter((s) => s.day === dayIdx);
  const getEventsForDate = (date: Date) => {
    const sd = jsDateToSchedDay(date);
    if (sd === null) return [];
    return filtered.filter((s) => s.day === sd);
  };

  const getTeacherInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const monthView = (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      <div className="mb-1 grid grid-cols-7 px-0.5">
        {DAY_LABELS_MONTH.map((l) => (
          <div key={l} className="py-1 text-center text-xs text-slate-400">
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {monthGrid.map(({ date, isCurrentMonth }, idx) => {
          const events = getEventsForDate(date);
          const today = isToday(date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          return (
            <div
              key={idx}
              onClick={() => {
                if (!isWeekend) {
                  setSelectedDay(date);
                  setCurrentDate(date);
                  setViewMode("day");
                }
              }}
              className={`min-h-[70px] border-b border-r border-slate-100 p-1.5 transition-colors last:border-r-0 ${
                !isCurrentMonth ? "bg-slate-50/70" : isWeekend ? "bg-slate-50" : "cursor-pointer hover:bg-blue-50/40"
              }`}
            >
              <div
                className={`mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                  today ? "bg-blue-600 text-white shadow-sm" : isCurrentMonth ? "text-slate-700" : "text-slate-300"
                }`}
              >
                {date.getDate()}
              </div>
              <div className="space-y-0.5">
                {events.slice(0, 2).map((ev) => (
                  <div key={ev.id} className={`${ev.color} truncate rounded px-1 py-0.5 text-[9px] leading-tight text-white`}>
                    {ev.startTime} {ev.subject}
                  </div>
                ))}
                {events.length > 2 && <div className="text-[9px] text-blue-500">+{events.length - 2}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const weekView = (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 border-b border-slate-200 bg-white">
        <div className="w-10 shrink-0 border-r border-slate-100" />
        {weekDays.map((day, idx) => {
          const today = isToday(day);
          return (
            <div
              key={idx}
              onClick={() => {
                setSelectedDay(day);
                setCurrentDate(day);
                setViewMode("day");
              }}
              className="flex-1 cursor-pointer border-r border-slate-100 py-2.5 text-center transition-colors last:border-r-0 hover:bg-slate-50"
            >
              <div className="text-xs uppercase tracking-wide text-slate-400">{DAY_LABELS[idx]}</div>
              <div
                className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                  today ? "bg-blue-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="relative flex" style={{ height: `${TOTAL_HEIGHT}px` }}>
          <div className="relative w-10 shrink-0 border-r border-slate-100">
            {HOURS.map((h) => (
              <div key={h} className="absolute right-2 -translate-y-2.5 text-[10px] text-slate-300" style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}>
                {h}h
              </div>
            ))}
          </div>
          {weekDays.map((_, dayIdx) => {
            const events = getEventsForDayIndex(dayIdx);
            return (
              <div key={dayIdx} className="relative flex-1 border-r border-slate-100 last:border-r-0">
                {HOURS.map((h) => (
                  <div key={h} className="absolute w-full border-t border-slate-100" style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }} />
                ))}
                {HOURS.map((h) => (
                  <div key={`half-${h}`} className="absolute w-full border-t border-slate-50" style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
                ))}
                {events.map((ev) => {
                  const { top, height } = getEventStyle(ev);
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className={`absolute ${ev.color} cursor-pointer overflow-hidden rounded-lg text-white shadow-sm transition-opacity hover:opacity-90`}
                      style={{ top: `${top + 1}px`, height: `${height - 2}px`, left: "3px", right: "3px" }}
                    >
                      <div className="px-1.5 py-1">
                        <div className="truncate text-[11px] leading-tight">{ev.subject}</div>
                        <div className="truncate text-[10px] opacity-80">
                          {ev.startTime}–{ev.endTime}
                        </div>
                        {height > 52 && <div className="truncate text-[10px] opacity-70">{ev.teacher}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const sd = jsDateToSchedDay(selectedDay);
  const dayEvents = sd !== null ? filtered.filter((s) => s.day === sd).sort((a, b) => a.startTime.localeCompare(b.startTime)) : [];
  const isDayWeekend = selectedDay.getDay() === 0 || selectedDay.getDay() === 6;

  const dayView = (
    <div className="flex-1 overflow-y-auto bg-white">
      {(dayEvents.length === 0 || isDayWeekend) && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
          <div className="mb-3 text-5xl">📭</div>
          <p className="text-sm text-slate-400">{isDayWeekend ? "Sem aulas nos fins de semana" : "Nenhum agendamento neste dia"}</p>
        </div>
      )}
      {!isDayWeekend && (
        <div className="relative flex" style={{ height: `${TOTAL_HEIGHT}px` }}>
          <div className="relative w-10 shrink-0 border-r border-slate-100">
            {HOURS.map((h) => (
              <div key={h} className="absolute right-2 -translate-y-2.5 text-[10px] text-slate-300" style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}>
                {h}h
              </div>
            ))}
          </div>
          <div className="relative flex-1">
            {HOURS.map((h) => (
              <div key={h} className="absolute w-full border-t border-slate-100" style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }} />
            ))}
            {dayEvents.map((ev) => {
              const { top, height } = getEventStyle(ev);
              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className={`absolute ${ev.color} cursor-pointer overflow-hidden rounded-xl text-white shadow-md transition-opacity hover:opacity-90`}
                  style={{ top: `${top + 1}px`, height: `${height - 2}px`, left: "8px", right: "8px" }}
                >
                  <div className="p-3">
                    <div className="truncate text-sm">{ev.subject}</div>
                    <div className="text-xs opacity-90">
                      {ev.startTime} – {ev.endTime}
                    </div>
                    {height > 60 && (
                      <div className="text-xs opacity-75">
                        {ev.teacher} · {ev.class}
                      </div>
                    )}
                    {height > 80 && ev.room && <div className="text-xs opacity-65">{ev.room}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
      <div className="shrink-0 bg-gradient-to-r from-violet-600 to-purple-700 px-4 pb-3 pt-4 text-white">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
            >
              <ChevronLeft size={18} />
            </button>
            <div>
              <h1 className="leading-tight text-white">Calendário</h1>
              <p className="text-xs text-purple-200">{headerTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToday}
              className="rounded-full border border-white/20 bg-white/20 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/30"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => router.push("/teachers/schedule")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
            >
              <Users size={16} />
            </button>
            <button
              type="button"
              onClick={() => router.push("/schedule/create")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm transition-colors hover:bg-white/90"
            >
              <Plus size={16} className="text-violet-600" />
            </button>
          </div>
        </div>

        <div className="flex rounded-xl bg-white/15 p-0.5">
          {(["month", "week", "day"] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className={`flex-1 rounded-[10px] py-1.5 text-sm transition-all ${
                viewMode === m ? "bg-white text-violet-700 shadow-sm" : "text-white/80 hover:text-white"
              }`}
            >
              {m === "month" ? "Mês" : m === "week" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <button type="button" onClick={prev} className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100">
          <ChevronLeft size={18} className="text-slate-500" />
        </button>
        <span className="text-sm text-slate-600">{headerTitle}</span>
        <button type="button" onClick={next} className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100">
          <ChevronRight size={18} className="text-slate-500" />
        </button>
      </div>

      <div className="shrink-0 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex min-w-max gap-2">
          <button
            type="button"
            onClick={() => handleTeacherSelect("all")}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all ${
              selectedTeacher === "all" ? "border-violet-600 bg-violet-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:border-violet-300"
            }`}
          >
            <Users size={12} />
            Todos
          </button>
          {allTeachers.map((name, idx) => (
            <button
              key={name}
              type="button"
              onClick={() => handleTeacherSelect(name)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all ${
                selectedTeacher === name ? "border-violet-600 bg-violet-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:border-violet-300"
              }`}
            >
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]}`}
                style={{ fontSize: "7px" }}
              >
                {getTeacherInitials(name)}
              </div>
              {name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {viewMode === "month" && monthView}
        {viewMode === "week" && weekView}
        {viewMode === "day" && dayView}
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setSelectedEvent(null)}>
          <div className="w-full max-w-lg rounded-t-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-1 mt-3 h-1 w-10 rounded-full bg-slate-200" />
            <div className={`mx-4 my-4 ${selectedEvent.color} rounded-2xl p-4`}>
              <p className="text-lg leading-tight text-white">{selectedEvent.subject}</p>
              <p className="mt-1 text-sm text-white/80">
                {selectedEvent.startTime} – {selectedEvent.endTime}
              </p>
            </div>
            <div className="space-y-0 px-4 pb-2">
              {[
                ["Professor", selectedEvent.teacher],
                ["Turma", selectedEvent.class],
                ["Tipo", TYPE_LABELS[selectedEvent.type]],
                ["Sala", selectedEvent.room],
                ["Dia", DAY_FULL[selectedEvent.day]]
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b border-slate-100 py-2.5 last:border-0">
                    <span className="text-sm text-slate-400">{label}</span>
                    <span className="text-sm text-slate-700">{value}</span>
                  </div>
                ))}
            </div>
            <div className="flex gap-3 px-4 pb-8 pt-2">
              <button
                type="button"
                onClick={() => router.push(`/schedule/edit/${selectedEvent.id}`)}
                className="flex-1 rounded-xl bg-violet-600 py-3 text-sm text-white shadow-sm transition-colors hover:bg-violet-700"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm text-slate-600 transition-colors hover:bg-slate-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
