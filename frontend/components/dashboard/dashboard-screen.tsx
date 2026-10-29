"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, CalendarCheck, CalendarDays, ChevronRight, Clock, LogOut, MapPin, Plus, User, Users, Video, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import { todayInSaoPaulo } from "@/lib/date";
import { eventTypeOf, type MeetingDTO } from "@/components/meetings/meeting-types";

interface DashboardSummary {
  stats: { turmas: number; aulasHoje: number; auloesHoje: number };
  todayActivities: {
    id: string;
    subject: string;
    class: string;
    teacher: string;
    tipo: string;
    time: string;
    endTime: string;
    status: "agendada" | "em andamento" | "concluída";
  }[];
  upcomingSimulados: { id: string; nome: string; data: string }[];
}

// Item da coluna "Próximas atividades": eventos da agenda e simulados, ordenados por data.
interface UpcomingItem {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  dot: string;
  time?: string;
  place?: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  "em andamento": "bg-emerald-100 text-emerald-700",
  agendada: "bg-blue-50 text-blue-700",
  "concluída": "bg-slate-100 text-slate-500"
};

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const UPCOMING_LIMIT = 6;

function formatTime(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function DashboardScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [events, setEvents] = useState<MeetingDTO[]>([]);
  const [userName, setUserName] = useState("");
  // Vazio até /auth/me responder, para professores não verem por um instante as ferramentas do gestor.
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    api.get<DashboardSummary>("/dashboard/summary").then(setSummary).catch(() => setSummary(null));
    api.get<MeetingDTO[]>("/meetings").then(setEvents).catch(() => setEvents([]));
    api
      .get<{ name: string; roles: ("GESTAO" | "PROFESSOR")[] }>("/auth/me")
      .then((me) => {
        setUserName(me.name);
        setUserRole(me.roles.includes("GESTAO") ? "gestão" : "professor");
      })
      .catch(() => {});
  }, []);

  const handleLogout = (event: React.MouseEvent) => {
    event.preventDefault();
    clearSession();
    router.push("/");
  };

  const today = todayInSaoPaulo();
  const activities = summary?.todayActivities ?? [];
  const upcomingItems: UpcomingItem[] = [
    ...events
      .filter((event) => event.data.slice(0, 10) >= today)
      .map((event) => {
        const type = eventTypeOf(event.tipo);
        return {
          id: `evento-${event.id}`,
          date: event.data.slice(0, 10),
          title: event.titulo,
          subtitle: type.label,
          dot: type.dot,
          time: `${formatTime(event.horarioInicio)} – ${formatTime(event.horarioFim)}`,
          place: event.local
        };
      }),
    ...(summary?.upcomingSimulados ?? []).map((simulado) => ({
      id: `simulado-${simulado.id}`,
      date: simulado.data.slice(0, 10),
      title: simulado.nome,
      subtitle: "Simulado (notas)",
      dot: "bg-orange-500"
    }))
  ];
  const upcoming = upcomingItems
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
    .slice(0, UPCOMING_LIMIT);

  const stats = [
    { icon: BookOpen, value: summary?.stats.aulasHoje ?? 0, label: "Aulas hoje", color: "bg-blue-100 text-blue-600" },
    { icon: Users, value: summary?.stats.turmas ?? 0, label: "Turmas", color: "bg-emerald-100 text-emerald-600" },
    { icon: Video, value: summary?.stats.auloesHoje ?? 0, label: "Aulões hoje", color: "bg-fuchsia-100 text-fuchsia-600" }
  ];

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 px-5 pb-14 pt-6 text-white">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-blue-100">{greeting()} 👋</p>
            <h1 className="mt-0.5 truncate text-2xl font-semibold capitalize text-white">{userName || " "}</h1>
            <p className="mt-1 text-sm capitalize text-blue-100">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              {userRole && <span className="ml-2 rounded-full bg-white/20 px-2.5 py-0.5 text-xs text-white">{userRole}</span>}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/profile/edit"
              aria-label="Meu perfil"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
            >
              <User size={18} />
            </Link>
            <Link
              href="/"
              onClick={handleLogout}
              aria-label="Sair"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
            >
              <LogOut size={18} />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto -mt-10 max-w-5xl space-y-6 px-4 pb-8">
        <div className="grid grid-cols-3 gap-3">
          {stats.map(({ icon: Icon, value, label, color }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center shadow-md sm:flex-row sm:gap-3 sm:p-4 sm:text-left">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
                <Icon size={20} />
              </span>
              <div>
                <p className="text-2xl font-semibold leading-none text-slate-800">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-5">
          <section className="md:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-slate-800">
                <CalendarCheck size={18} className="text-blue-600" /> Resumo do dia
              </h2>
              <Link href="/calendar" className="flex items-center gap-0.5 text-xs text-blue-600 hover:underline">
                Abrir agenda <ChevronRight size={14} />
              </Link>
            </div>

            {activities.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
                <CalendarDays size={28} className="text-slate-300" />
                <p className="text-sm text-slate-500">Nenhuma aula hoje.</p>
              </div>
            ) : (
              <ol className="space-y-2.5">
                {activities.map((activity) => {
                  const live = activity.status === "em andamento";
                  return (
                    <li
                      key={activity.id}
                      className={`flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ${live ? "ring-2 ring-emerald-400" : "border border-slate-100"}`}
                    >
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-sm font-semibold text-slate-800">{formatTime(activity.time)}</p>
                        <p className="text-xs text-slate-400">{formatTime(activity.endTime)}</p>
                      </div>
                      <div className="h-10 w-px shrink-0 bg-slate-200" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{activity.subject}</p>
                        <p className="truncate text-xs text-slate-500">
                          {activity.class} · {activity.teacher}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs capitalize ${STATUS_STYLE[activity.status] ?? "bg-slate-100 text-slate-500"}`}>
                        {activity.status}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <div className="space-y-6 md:col-span-2">
            {userRole === "gestão" && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
                  <Zap size={18} className="text-violet-600" /> Ferramentas do gestor
                </h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
                  <Link
                    href="/schedule/smart-builder"
                    className="group flex items-center gap-3 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 p-4 text-white shadow-md transition hover:shadow-lg"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                      <Zap size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-tight">Grade inteligente</span>
                      <span className="hidden text-xs text-violet-100 sm:block">Gerar a grade de uma turma</span>
                    </span>
                    <ChevronRight size={16} className="hidden shrink-0 opacity-70 transition group-hover:translate-x-0.5 md:block" />
                  </Link>
                  <Link
                    href="/schedule/create"
                    className="group flex items-center gap-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white shadow-md transition hover:shadow-lg"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                      <Plus size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-tight">Criar agendamento</span>
                      <span className="hidden text-xs text-blue-100 sm:block">Adicionar uma aula à grade</span>
                    </span>
                    <ChevronRight size={16} className="hidden shrink-0 opacity-70 transition group-hover:translate-x-0.5 md:block" />
                  </Link>
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
                <CalendarDays size={18} className="text-purple-600" /> Próximas atividades
              </h2>
              {upcoming.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
                  <CalendarDays size={24} className="text-slate-300" />
                  <p className="text-sm text-slate-500">Nenhuma atividade agendada.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm">
                  {upcoming.map((item) => {
                    const [, month, day] = item.date.split("-");
                    return (
                      <li key={item.id} className="flex items-center gap-3 p-3.5">
                        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50">
                          <span className="text-base font-semibold leading-none text-slate-800">{day}</span>
                          <span className="mt-0.5 text-[10px] leading-none text-slate-400">{MONTHS[Number(month) - 1]}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
                          <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <span className={`h-2 w-2 rounded-full ${item.dot}`} /> {item.subtitle}
                            </span>
                            {item.time && (
                              <span className="flex items-center gap-1">
                                <Clock size={11} /> {item.time}
                              </span>
                            )}
                            {item.place && (
                              <span className="flex min-w-0 items-center gap-1">
                                <MapPin size={11} /> <span className="truncate">{item.place}</span>
                              </span>
                            )}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
