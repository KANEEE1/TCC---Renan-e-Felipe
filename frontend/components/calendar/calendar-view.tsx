"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, BookOpen, ChevronLeft, ChevronRight, Clock, GraduationCap, MapPin, Plus, Tag, User, UserX, Users, X } from "lucide-react";
import { useSchedule, type ScheduleItem } from "@/components/schedule/schedule-context";
import { api } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { EventDialog } from "@/components/calendar/event-dialog";
import { LessonDialog, type LessonOccurrence } from "@/components/calendar/lesson-dialog";
import { eventTypeOf, STATUS_COLORS, STATUS_LABELS, toHHMM, type MeetingDTO } from "@/components/meetings/meeting-types";

type ViewMode = "day" | "week" | "month";

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
// Semana começando na segunda, como os índices de ScheduleItem.day (0 = segunda ... 6 = domingo).
const DAY_SHORT = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const DAY_FULL = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"];
const VIEW_LABELS: Record<ViewMode, string> = { day: "Dia", week: "Semana", month: "Mês" };
const TYPE_LABELS: Record<string, string> = { aula: "Aula", plantao: "Plantão", aulao: "Aulão" };

// Aulas que o professor avisou que não vai conseguir dar (por enquanto só visual, guardado neste navegador).
const DECLINED_KEY = "agenda-nao-vou-participar";
const DECLINED_COLOR = "bg-slate-400";

function loadDeclined(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DECLINED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveDeclined(keys: Set<string>) {
  try {
    localStorage.setItem(DECLINED_KEY, JSON.stringify([...keys]));
  } catch {
    // Sem armazenamento disponível: a marcação vale só enquanto a tela estiver aberta.
  }
}

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
function layoutDay<T extends { startTime: string; endTime: string }>(events: T[]) {
  const sorted = [...events].sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime) || minutesOf(b.endTime) - minutesOf(a.endTime));
  const placed: { event: T; column: number; columns: number }[] = [];
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

// Uma aula numa data: `event` já traz data, horário e professor efetivos (com a exceção aplicada); `series` é a aula
// semanal original. `dataOriginal` (dia da série) identifica a ocorrência, mesmo se ela foi movida de dia.
interface Occurrence {
  key: string;
  event: ScheduleItem;
  series: ScheduleItem;
  dataOriginal: string;
  date: Date;
  alterada: boolean;
}

// O que a agenda desenha: aulas semanais e eventos pontuais, com o mesmo layout de sobreposição.
type Entry =
  | { kind: "lesson"; id: string; startTime: string; endTime: string; occurrence: Occurrence }
  | { kind: "meeting"; id: string; startTime: string; endTime: string; meeting: MeetingDTO };

function lessonOccurrenceOf(occurrence: Occurrence): LessonOccurrence {
  const { event } = occurrence;
  return {
    dataOriginal: occurrence.dataOriginal,
    data: dateKey(occurrence.date),
    startTime: event.startTime,
    endTime: event.endTime,
    teacherId: event.teacherId,
    teacher: event.teacher
  };
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

  // Sessão e marcações "não vou participar": lidas após montar (ficam no navegador).
  const [session, setSession] = useState<{ id: string; isManagement: boolean } | null>(null);
  const [declined, setDeclined] = useState<Set<string>>(new Set());
  useEffect(() => {
    const user = getSessionUser();
    if (user) setSession({ id: user.id, isManagement: user.roles.includes("GESTAO") });
    setDeclined(loadDeclined());
  }, []);
  const isDeclined = (occurrence: Occurrence) => declined.has(occurrence.key);
  const colorOf = (occurrence: Occurrence) => (isDeclined(occurrence) ? DECLINED_COLOR : occurrence.event.color);

  // A aula aberta no painel é uma ocorrência (aula + data), para saber se é futura e se foi marcada.
  const [selected, setSelected] = useState<Occurrence | null>(null);
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Occurrence | null>(null);
  const selectedEvent = selected?.event ?? null;
  const setSelectedEvent = (value: null) => {
    setSelected(value);
    setConfirmingDecline(false);
  };
  const scrollRef = useRef<HTMLDivElement>(null);

  // Eventos pontuais (reuniões, simulados, aulões...). O painel guarda só o id para refletir recargas (ex.: RSVP).
  const [meetings, setMeetings] = useState<MeetingDTO[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ event: MeetingDTO | null } | null>(null);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId) ?? null;

  const [loadError, setLoadError] = useState(false);
  const loadMeetings = () =>
    api
      .get<MeetingDTO[]>("/meetings")
      .then((list) => {
        setMeetings(list);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  useEffect(() => {
    loadMeetings();
  }, []);

  // Link direto para um evento (?event=<id>, ex.: aviso de convite no início): abre a agenda na data dele
  // com o painel do evento aberto, uma única vez.
  const eventParam = searchParams.get("event");
  const openedFromLink = useRef(false);
  useEffect(() => {
    if (!eventParam || openedFromLink.current) return;
    const meeting = meetings.find((m) => m.id === eventParam);
    if (!meeting) return;
    openedFromLink.current = true;
    setCursor(new Date(`${meeting.data.slice(0, 10)}T00:00:00`));
    setSelectedMeetingId(meeting.id);
  }, [meetings, eventParam]);

  const classes = useMemo(
    () =>
      [
        ...new Map([
          ...schedules.map((s) => [s.classId, s.class] as [string, string]),
          ...meetings.flatMap((m) => m.turmas.map((t) => [t.id, t.nome] as [string, string]))
        ])
      ].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
    [schedules, meetings]
  );
  const ofClass = useMemo(
    () => (selectedClass === "all" ? schedules : schedules.filter((s) => s.classId === selectedClass)),
    [schedules, selectedClass]
  );
  // Com uma turma escolhida, só aparecem os professores que dão aula nela.
  // Nome do professor vindo pela URL (ex.: botão "Agenda" na lista de professores) que ainda não tem aulas.
  const [extraTeacher, setExtraTeacher] = useState<[string, string] | null>(null);
  const meetingsOfClass = useMemo(
    () => (selectedClass === "all" ? meetings : meetings.filter((m) => m.turmas.some((t) => t.id === selectedClass))),
    [meetings, selectedClass]
  );
  const teachers = useMemo(() => {
    const list = [
      ...new Map([
        ...ofClass.flatMap((s) => [
          [s.teacherId, s.teacher] as [string, string],
          ...s.excecoes.flatMap((e) => (e.teacherId && e.teacher ? [[e.teacherId, e.teacher] as [string, string]] : []))
        ]),
        ...meetingsOfClass.flatMap((m) => m.participantes.map((p) => [p.userId, p.name] as [string, string]))
      ])
    ];
    if (extraTeacher && !list.some(([id]) => id === extraTeacher[0])) list.push(extraTeacher);
    return list.sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [ofClass, meetingsOfClass, extraTeacher]);
  const filtered = useMemo(
    () =>
      selectedTeacher === "all"
        ? ofClass
        : ofClass.filter((s) => s.teacherId === selectedTeacher || s.excecoes.some((e) => !e.cancelada && e.teacherId === selectedTeacher)),
    [ofClass, selectedTeacher]
  );
  const filteredMeetings = useMemo(
    () => (selectedTeacher === "all" ? meetingsOfClass : meetingsOfClass.filter((m) => m.participantes.some((p) => p.userId === selectedTeacher))),
    [meetingsOfClass, selectedTeacher]
  );

  useEffect(() => {
    if (selectedTeacher === "all" || schedules.some((s) => s.teacherId === selectedTeacher) || teachers.some(([id]) => id === selectedTeacher)) return;
    let cancelled = false;
    api
      .get<{ id: string; name: string }>(`/teachers/${selectedTeacher}`)
      .then((teacher) => !cancelled && setExtraTeacher([teacher.id, teacher.name]))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedTeacher, schedules, teachers]);

  const selectedTeacherName = teachers.find(([id]) => id === selectedTeacher)?.[1];
  const teacherWithoutLessons = selectedTeacher !== "all" && !!selectedTeacherName && filtered.length === 0 && filteredMeetings.length === 0;
  // A aula se repete toda semana, mas só dentro do período da grade da turma (verificado na data original).
  // Exceções: ocorrência cancelada some; ocorrência movida aparece na data efetiva, com horário e professor efetivos.
  const eventsOn = (date: Date): Occurrence[] => {
    const key = dateKey(date);
    const out: Occurrence[] = [];
    for (const series of filtered) {
      const originals = new Set(series.excecoes.filter((e) => e.dataOriginal === key || e.data === key).map((e) => e.dataOriginal));
      if (series.day === weekdayIndex(date)) originals.add(key);
      for (const dataOriginal of originals) {
        if ((series.periodStart && dataOriginal < series.periodStart) || (series.periodEnd && dataOriginal > series.periodEnd)) continue;
        const exception = series.excecoes.find((e) => e.dataOriginal === dataOriginal);
        if (exception?.cancelada || (exception?.data ?? dataOriginal) !== key) continue;
        const startTime = exception?.startTime ?? series.startTime;
        const endTime = exception?.endTime ?? series.endTime;
        const teacherId = exception?.teacherId ?? series.teacherId;
        if (selectedTeacher !== "all" && teacherId !== selectedTeacher) continue;
        out.push({
          key: `${series.id}|${dataOriginal}`,
          series,
          dataOriginal,
          date,
          alterada: exception !== undefined,
          event: {
            ...series,
            day: weekdayIndex(date),
            startTime,
            endTime,
            duration: (minutesOf(endTime) - minutesOf(startTime)) / 60,
            teacherId,
            teacher: exception?.teacher ?? series.teacher
          }
        });
      }
    }
    return out;
  };

  const entriesOn = (date: Date): Entry[] => {
    const key = dateKey(date);
    return [
      ...eventsOn(date).map(
        (occurrence): Entry => ({ kind: "lesson", id: occurrence.key, startTime: occurrence.event.startTime, endTime: occurrence.event.endTime, occurrence })
      ),
      ...filteredMeetings
        .filter((m) => m.data.slice(0, 10) === key)
        .map((meeting): Entry => ({ kind: "meeting", id: `m-${meeting.id}`, startTime: toHHMM(meeting.horarioInicio), endTime: toHHMM(meeting.horarioFim), meeting }))
    ];
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
      selectedTeacher === "all" ||
      classId === "all" ||
      schedules.some((s) => s.classId === classId && s.teacherId === selectedTeacher) ||
      meetings.some((m) => m.turmas.some((t) => t.id === classId) && m.participantes.some((p) => p.userId === selectedTeacher));
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

                {layoutDay(entriesOn(day)).map(({ event: entry, column, columns }) => {
                  const start = minutesOf(entry.startTime);
                  const end = Math.max(minutesOf(entry.endTime), start + 15);
                  const height = ((end - start) / 60) * HOUR_HEIGHT;
                  const position = {
                    top: (start / 60) * HOUR_HEIGHT + 1,
                    height: height - 2,
                    left: `calc(${(column / columns) * 100}% + 2px)`,
                    width: `calc(${100 / columns}% - 4px)`
                  };
                  if (entry.kind === "meeting") {
                    const type = eventTypeOf(entry.meeting.tipo);
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedMeetingId(entry.meeting.id)}
                        className={`absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left shadow-sm transition hover:brightness-95 ${type.block}`}
                        style={position}
                      >
                        <span className="block truncate text-[11px] font-semibold leading-tight">{entry.meeting.titulo}</span>
                        {height >= 34 && (
                          <span className="block truncate text-[10px] leading-tight opacity-80">
                            {type.label} · {entry.startTime} – {entry.endTime}
                          </span>
                        )}
                      </button>
                    );
                  }
                  const event = entry.occurrence.event;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelected(entry.occurrence)}
                      className={`absolute overflow-hidden rounded-md border border-white px-1.5 py-0.5 text-left text-white shadow-sm transition hover:brightness-110 ${colorOf(entry.occurrence)}`}
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
          const events = entriesOn(date).sort((a, b) => a.startTime.localeCompare(b.startTime));
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
                {events.slice(0, 3).map((entry) =>
                  entry.kind === "meeting" ? (
                    <span
                      key={entry.id}
                      className={`block truncate rounded border-l-2 px-1 text-[10px] leading-4 ${eventTypeOf(entry.meeting.tipo).block} ${inMonth ? "" : "opacity-50"}`}
                    >
                      {entry.startTime} {entry.meeting.titulo}
                    </span>
                  ) : (
                    <span
                      key={entry.id}
                      className={`block truncate rounded px-1 text-[10px] leading-4 text-white ${colorOf(entry.occurrence)} ${inMonth ? "" : "opacity-50"}`}
                    >
                      {entry.startTime} {entry.occurrence.event.subject}
                    </span>
                  )
                )}
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

        {loadError && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Não foi possível carregar os eventos.</p>}

        {teacherWithoutLessons && (
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {selectedTeacherName} ainda não tem aulas{selectedClass !== "all" ? " nesta turma" : " na grade"}.
          </p>
        )}
      </header>

      {viewMode === "month" ? monthView : timeGrid}

      {session?.isManagement && (
        <button
          type="button"
          onClick={() => setDialog({ event: null })}
          aria-label="Novo evento"
          className="absolute bottom-5 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-lg ring-1 ring-slate-200 transition hover:shadow-xl"
        >
          <Plus size={28} />
        </button>
      )}

      {dialog && (
        <EventDialog
          event={dialog.event}
          defaultDate={cursor}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            setSelectedMeetingId(null);
            loadMeetings();
          }}
        />
      )}

      {selectedMeeting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSelectedMeetingId(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white pb-6 shadow-2xl sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-end px-3 pt-3">
              <button
                type="button"
                onClick={() => setSelectedMeetingId(null)}
                aria-label="Fechar"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex gap-4 px-6">
              <span className={`mt-1.5 h-4 w-4 shrink-0 rounded ${eventTypeOf(selectedMeeting.tipo).dot}`} />
              <div className="min-w-0">
                <h2 className="break-words text-xl text-slate-800">{selectedMeeting.titulo}</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {new Date(`${selectedMeeting.data.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit"
                  })}{" "}
                  · {toHHMM(selectedMeeting.horarioInicio)} – {toHHMM(selectedMeeting.horarioFim)}
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-3 px-6 text-sm text-slate-700">
              <li className="flex items-center gap-4">
                <Tag size={18} className="shrink-0 text-slate-400" />
                {eventTypeOf(selectedMeeting.tipo).label}
              </li>
              {selectedMeeting.local && (
                <li className="flex items-center gap-4">
                  <MapPin size={18} className="shrink-0 text-slate-400" />
                  {selectedMeeting.local}
                </li>
              )}
              {selectedMeeting.turmas.length > 0 && (
                <li className="flex items-center gap-4">
                  <GraduationCap size={18} className="shrink-0 text-slate-400" />
                  {selectedMeeting.turmas.map((t) => t.nome).join(", ")}
                </li>
              )}
              {selectedMeeting.participantes.length > 0 && (
                <li className="flex items-start gap-4">
                  <Users size={18} className="mt-0.5 shrink-0 text-slate-400" />
                  <ul className="min-w-0 flex-1 space-y-1.5">
                    {selectedMeeting.participantes.map((p) => (
                      <li key={p.userId} className="flex items-center justify-between gap-2">
                        <span className="truncate">{p.name}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </ul>
            {meetingError && <p className="mx-6 mt-4 text-sm text-red-600">{meetingError}</p>}
            {selectedMeeting.permissoes.editar && (
              <div className="mt-6 flex justify-end gap-2 px-6">
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Tem certeza que deseja excluir este evento?")) return;
                    setMeetingError(null);
                    try {
                      await api.delete(`/meetings/${selectedMeeting.id}`);
                      setSelectedMeetingId(null);
                      loadMeetings();
                    } catch {
                      setMeetingError("Não foi possível excluir o evento.");
                    }
                  }}
                  className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Excluir
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ event: selectedMeeting })}
                  className="rounded-full bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700"
                >
                  Editar
                </button>
              </div>
            )}
            {selectedMeeting.permissoes.responder && (
              <div className="mt-6 grid grid-cols-2 gap-2 px-6">
                {(["CONFIRMADO", "RECUSADO"] as const).map((status) => {
                  const active = selectedMeeting.meuStatus === status;
                  const yes = status === "CONFIRMADO";
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={responding}
                      onClick={async () => {
                        setResponding(true);
                        setMeetingError(null);
                        try {
                          await api.put(`/meetings/${selectedMeeting.id}/rsvp`, { status });
                          await loadMeetings();
                        } catch {
                          setMeetingError("Não foi possível registrar sua resposta.");
                        } finally {
                          setResponding(false);
                        }
                      }}
                      className={`rounded-full py-2.5 text-sm transition-colors disabled:opacity-60 ${
                        active
                          ? yes
                            ? "bg-green-600 text-white"
                            : "bg-red-600 text-white"
                          : yes
                            ? "bg-green-50 text-green-700 hover:bg-green-100"
                            : "bg-red-50 text-red-700 hover:bg-red-100"
                      }`}
                    >
                      {yes ? "Vou" : "Não vou"}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {editingLesson && (
        <LessonDialog
          lesson={editingLesson.series}
          occurrence={lessonOccurrenceOf(editingLesson)}
          onClose={() => setEditingLesson(null)}
          onSaved={() => {
            setEditingLesson(null);
            setSelectedEvent(null);
          }}
        />
      )}

      {selected && selectedEvent && (
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
              <span className={`mt-1.5 h-4 w-4 shrink-0 rounded ${colorOf(selected)}`} />
              <div className="min-w-0">
                <h2 className="text-xl text-slate-800">{selectedEvent.subject}</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  <span className="capitalize">{DAY_FULL[selectedEvent.day]}</span>,{" "}
                  {selected.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · {selectedEvent.startTime} –{" "}
                  {selectedEvent.endTime}
                </p>
                <p className="text-xs text-slate-400">Repete toda {DAY_FULL[selected.series.day]}</p>
                {selected.alterada && (
                  <span className="mt-1.5 inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700">Alterada nesta data</span>
                )}
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
            {(() => {
              // Gestão: Fechar/Editar. Professor: só o X; na própria aula futura, pode avisar que não vai participar.
              if (session?.isManagement) {
                return (
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
                      onClick={() => setEditingLesson(selected)}
                      className="rounded-full bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700"
                    >
                      Editar
                    </button>
                  </div>
                );
              }

              const isOwn = session?.id === selectedEvent.teacherId;
              if (!isOwn) return null;

              if (isDeclined(selected)) {
                return (
                  <p className="mx-6 mt-6 flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                    <UserX size={16} className="shrink-0" /> Você informou que não vai conseguir participar desta aula.
                  </p>
                );
              }

              const [h, m] = selectedEvent.startTime.split(":").map(Number);
              const startsAt = new Date(selected.date);
              startsAt.setHours(h, m, 0, 0);
              if (startsAt <= new Date()) return null;

              if (confirmingDecline) {
                return (
                  <div className="mx-6 mt-6 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                      <div>
                        <p className="font-medium text-slate-800">Tem certeza?</p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          Você está informando que não vai conseguir dar a aula de {selectedEvent.subject} em{" "}
                          {selected.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}.
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingDecline(false)}
                        className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = new Set(declined);
                          next.add(selected.key);
                          setDeclined(next);
                          saveDeclined(next);
                          setConfirmingDecline(false);
                        }}
                        className="rounded-full bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600"
                      >
                        Sim, não vou participar
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="mt-6 px-6">
                  <button
                    type="button"
                    onClick={() => setConfirmingDecline(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <UserX size={16} /> Não vou conseguir participar
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
