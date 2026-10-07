"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  LogOut,
  Plus,
  Trophy,
  User,
  UserPlus,
  Users,
  Video,
  Zap
} from "lucide-react";
import { api } from "@/lib/api";
import { clearSession } from "@/lib/auth";

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

const STATUS_STYLE: Record<string, string> = {
  "em andamento": "bg-emerald-100 text-emerald-700",
  agendada: "bg-blue-100 text-blue-700",
  "concluída": "bg-slate-100 text-slate-600"
};

const ACTIVITY_COLORS = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-orange-500", "bg-rose-500"];
const UPCOMING_COLORS = ["bg-red-500", "bg-blue-500", "bg-purple-500", "bg-emerald-500"];

function formatTime(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export function DashboardScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [userName, setUserName] = useState("Usuário");
  const [userRole, setUserRole] = useState("gestão");

  useEffect(() => {
    api.get<DashboardSummary>("/dashboard/summary").then(setSummary).catch(() => setSummary(null));
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

  const stats = [
    { icon: BookOpen, value: String(summary?.stats.aulasHoje ?? 0), label: "Aulas Hoje" },
    { icon: Users, value: String(summary?.stats.turmas ?? 0), label: "Turmas" },
    { icon: Video, value: String(summary?.stats.auloesHoje ?? 0), label: "Aulões" }
  ];

  return (
    <div className="flex-1 bg-slate-50">
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 px-5 pt-5 pb-8 text-white">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="mb-0.5 text-sm text-blue-200">Bem-vindo de volta 👋</p>
            <h1 className="capitalize text-white">{userName}</h1>
            <span className="mt-1 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs capitalize text-white/90">
              {userRole}
            </span>
          </div>
          <div className="flex gap-2">
            <Link
              href="/profile/edit"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
            >
              <User size={17} />
            </Link>
            <Link
              href="/"
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
            >
              <LogOut size={17} />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {stats.map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-2xl border border-white/20 bg-white/15 p-3 text-center backdrop-blur-sm">
              <Icon className="mx-auto mb-1 text-white/80" size={20} />
              <p className="text-2xl leading-tight text-white">{value}</p>
              <p className="mt-0.5 text-xs text-blue-100">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="-mt-4 mb-5 px-4">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/schedule/create"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-md transition-shadow hover:shadow-lg"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600">
              <Plus size={20} className="text-white" />
            </div>
            <span className="text-sm leading-tight text-slate-700">Criar Agendamento</span>
          </Link>
          <Link
            href="/attendance"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-md transition-shadow hover:shadow-lg"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600">
              <BookOpen size={20} className="text-white" />
            </div>
            <span className="text-sm leading-tight text-slate-700">Marcar Presença</span>
          </Link>
          <Link
            href="/calendar"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-md transition-shadow hover:shadow-lg"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600">
              <CalendarDays size={20} className="text-white" />
            </div>
            <span className="text-sm leading-tight text-slate-700">Ver Calendário</span>
          </Link>
          <Link
            href="/teachers/register"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-md transition-shadow hover:shadow-lg"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
              <UserPlus size={20} className="text-white" />
            </div>
            <span className="text-sm leading-tight text-slate-700">Cadastrar Professor</span>
          </Link>
        </div>
      </div>

      <div className="mb-5 px-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-4 w-1 rounded-full bg-violet-400" />
          <span className="text-xs text-slate-500">Ferramentas do gestor</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/schedule/smart-builder"
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 p-4 text-left shadow-md transition-shadow hover:shadow-lg"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-sm leading-tight text-white">Grade Inteligente</span>
          </Link>
          <Link
            href="/simulados"
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 p-4 text-left shadow-md transition-shadow hover:shadow-lg"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Trophy size={20} className="text-white" />
            </div>
            <span className="text-sm leading-tight text-white">Simulados</span>
          </Link>
        </div>
      </div>

      <div className="space-y-5 px-4 pb-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-blue-500" />
              <h2 className="text-slate-700">Resumo do Dia</h2>
            </div>
            <span className="text-xs text-slate-400">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}
            </span>
          </div>

          <div className="space-y-2.5">
            {(summary?.todayActivities ?? []).length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
                Nenhuma aula hoje.
              </p>
            )}
            {(summary?.todayActivities ?? []).map((activity, index) => (
              <div key={activity.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-stretch">
                  <div className={`w-1.5 rounded-l-2xl ${ACTIVITY_COLORS[index % ACTIVITY_COLORS.length]}`} />
                  <div className="flex flex-1 items-center justify-between p-3.5">
                    <div>
                      <p className="text-sm leading-tight text-slate-800">{activity.subject}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {activity.class} · {formatTime(activity.time)}–{formatTime(activity.endTime)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[activity.status] ?? "bg-slate-100 text-slate-500"}`}>
                      {activity.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-purple-500" />
              <h2 className="text-slate-700">Próximas Atividades</h2>
            </div>
            <Link href="/calendar" className="flex items-center gap-0.5 text-xs text-blue-600">
              Ver tudo <ChevronRight size={13} />
            </Link>
          </div>

          <div className="space-y-2.5">
            {(summary?.upcomingSimulados ?? []).length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
                Nenhum simulado agendado.
              </p>
            )}
            {(summary?.upcomingSimulados ?? []).map((simulado, index) => {
              const date = new Date(simulado.data);
              return (
                <div key={simulado.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ${UPCOMING_COLORS[index % UPCOMING_COLORS.length]}`}>
                    <span className="text-[15px] font-bold leading-none text-white">{String(date.getUTCDate()).padStart(2, "0")}</span>
                    <span className="mt-0.5 text-[9px] leading-none text-white/80">{MONTHS[date.getUTCMonth()]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-800">{simulado.nome}</p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-300" />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
