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

const userRole = "gestão";
const userName = "Usuário";

const STATS = [
  { icon: BookOpen, value: "12", label: "Aulas Hoje" },
  { icon: Users, value: "6", label: "Turmas" },
  { icon: Video, value: "2", label: "Aulões" }
];

const TODAY_ACTIVITIES = [
  { id: 1, title: "Matemática", subtitle: "Extensivo Manhã", time: "08:00", end: "09:30", status: "em andamento", color: "bg-blue-500" },
  { id: 2, title: "Física", subtitle: "Intensivo", time: "10:00", end: "11:30", status: "próxima", color: "bg-emerald-500" },
  { id: 3, title: "Plantão de Exatas", subtitle: "Todas as turmas", time: "14:00", end: "16:00", status: "agendado", color: "bg-purple-500" },
  { id: 4, title: "Aulão de Redação", subtitle: "ENEM", time: "16:30", end: "18:00", status: "agendado", color: "bg-orange-500" }
];

const UPCOMING_ACTIVITIES = [
  { id: 1, title: "Simulado ENEM", date: "05", month: "MAI", time: "08:00", color: "bg-red-500" },
  { id: 2, title: "Aulão de Química", date: "08", month: "MAI", time: "14:00", color: "bg-blue-500" },
  { id: 3, title: "Revisão Geral — Humanas", date: "10", month: "MAI", time: "09:00", color: "bg-purple-500" }
];

const STATUS_STYLE: Record<string, string> = {
  "em andamento": "bg-emerald-100 text-emerald-700",
  "próxima": "bg-blue-100 text-blue-700",
  agendado: "bg-slate-100 text-slate-600"
};

export function DashboardScreen() {
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
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
            >
              <LogOut size={17} />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {STATS.map(({ icon: Icon, value, label }) => (
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
            <span className="text-xs text-slate-400">Segunda, 04 Mai</span>
          </div>

          <div className="space-y-2.5">
            {TODAY_ACTIVITIES.map((activity) => (
              <div key={activity.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-stretch">
                  <div className={`w-1.5 rounded-l-2xl ${activity.color}`} />
                  <div className="flex flex-1 items-center justify-between p-3.5">
                    <div>
                      <p className="text-sm leading-tight text-slate-800">{activity.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {activity.subtitle} · {activity.time}–{activity.end}
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
            {UPCOMING_ACTIVITIES.map((activity) => (
              <div key={activity.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ${activity.color}`}>
                  <span className="text-[15px] font-bold leading-none text-white">{activity.date}</span>
                  <span className="mt-0.5 text-[9px] leading-none text-white/80">{activity.month}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-800">{activity.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">às {activity.time}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-300" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
