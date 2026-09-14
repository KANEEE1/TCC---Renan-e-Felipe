import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";

const TODAY_CLASSES = [
  { id: 1, subject: "Matemática", class: "Extensivo — Manhã", time: "08:00 – 10:00", teacher: "Ana Silva", totalStudents: 45, present: 42, absent: 3, status: "concluída", color: "bg-blue-500" },
  { id: 2, subject: "Física", class: "Intensivo", time: "10:30 – 12:30", teacher: "Ana Silva", totalStudents: 38, present: null, absent: null, status: "pendente", color: "bg-emerald-500" },
  { id: 3, subject: "Redação", class: "Reta Final", time: "14:00 – 16:00", teacher: "Maria Oliveira", totalStudents: 35, present: null, absent: null, status: "agendada", color: "bg-orange-400" }
];

const RECENT_CLASSES = [
  { id: 4, subject: "História", class: "Extensivo — Noite", date: "28/04/2026", totalStudents: 52, present: 48, absent: 4 },
  { id: 5, subject: "Química", class: "Medicina", date: "28/04/2026", totalStudents: 28, present: 27, absent: 1 }
];

const STATUS_STYLE: Record<string, string> = {
  concluída: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pendente: "bg-amber-100 text-amber-700 border-amber-200",
  agendada: "bg-slate-100 text-slate-500 border-slate-200"
};

export function AttendanceList() {
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
            <p className="text-2xl text-white">94%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-emerald-300" style={{ width: "94%" }} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/15 p-3.5">
            <div className="mb-1 flex items-center gap-2">
              <XCircle size={16} className="text-rose-300" />
              <span className="text-xs text-white/70">Taxa de Ausência</span>
            </div>
            <p className="text-2xl text-white">6%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-rose-400" style={{ width: "6%" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-6">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-blue-500" />
            <h2 className="text-slate-700">Aulas de Hoje</h2>
            <span className="ml-1 text-xs text-slate-400">Seg, 04 Mai</span>
          </div>

          <div className="space-y-2.5">
            {TODAY_CLASSES.map((cls) => (
              <div key={cls.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex">
                  <div className={`w-1.5 shrink-0 rounded-l-2xl ${cls.color}`} />
                  <div className="flex-1 p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-slate-800">{cls.subject}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {cls.class} · {cls.time}
                        </p>
                        <p className="text-xs text-slate-400">{cls.teacher}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[cls.status]}`}>{cls.status}</span>
                    </div>

                    {cls.status === "concluída" ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle size={13} /> {cls.present} presentes
                            </span>
                            <span className="flex items-center gap-1 text-rose-500">
                              <XCircle size={13} /> {cls.absent} ausentes
                            </span>
                          </div>
                          <span className="text-xs text-slate-600">{Math.round((cls.present! / cls.totalStudents) * 100)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((cls.present! / cls.totalStudents) * 100)}%` }} />
                        </div>
                      </div>
                    ) : cls.status === "pendente" ? (
                      <Link href={`/attendance/mark/${cls.id}`} className="block w-full rounded-xl bg-emerald-600 py-2.5 text-center text-sm text-white transition-colors hover:bg-emerald-700">
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

          <div className="space-y-2.5 pb-4">
            {RECENT_CLASSES.map((cls) => {
              const pct = Math.round((cls.present / cls.totalStudents) * 100);
              return (
                <div key={cls.id} className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="text-sm text-slate-800">{cls.subject}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {cls.class} · {cls.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm ${pct >= 90 ? "text-emerald-600" : pct >= 75 ? "text-amber-600" : "text-rose-500"}`}>{pct}%</p>
                      <p className="text-xs text-slate-400">
                        {cls.present}/{cls.totalStudents}
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
