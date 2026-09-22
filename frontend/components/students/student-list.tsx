"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Edit, Mail, Phone, Plus, Search } from "lucide-react";

const AVATAR_GRADIENTS = [
  "from-blue-400 to-indigo-500",
  "from-emerald-400 to-teal-500",
  "from-violet-400 to-purple-600",
  "from-rose-400 to-pink-600",
  "from-amber-400 to-orange-500",
  "from-teal-400 to-cyan-600"
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const STUDENTS = [
  { id: 1, name: "Ana Beatriz Santos", number: "01", class: "Extensivo — Manhã", email: "ana.beatriz@email.com", phone: "(11) 98765-1111", attendance: 95 },
  { id: 2, name: "Bruno Oliveira Costa", number: "02", class: "Intensivo — Integral", email: "bruno.oliveira@email.com", phone: "(11) 98765-2222", attendance: 92 },
  { id: 3, name: "Carla Maria Silva", number: "03", class: "Extensivo — Noite", email: "carla.maria@email.com", phone: "(11) 98765-3333", attendance: 90 },
  { id: 4, name: "Daniel Ferreira Lima", number: "04", class: "Semi-Intensivo — Tarde", email: "daniel.ferreira@email.com", phone: "(11) 98765-4444", attendance: 88 },
  { id: 5, name: "Elena Rodrigues Souza", number: "05", class: "Reta Final ENEM", email: "elena.rodrigues@email.com", phone: "(11) 98765-5555", attendance: 97 }
];

function getAttBadge(pct: number) {
  if (pct >= 90) return { bg: "bg-emerald-100 text-emerald-700 border-emerald-200", bar: "bg-emerald-500" };
  if (pct >= 75) return { bg: "bg-amber-100 text-amber-700 border-amber-200", bar: "bg-amber-400" };
  return { bg: "bg-rose-100 text-rose-600 border-rose-200", bar: "bg-rose-500" };
}

export function StudentList() {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = STUDENTS.filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.class.toLowerCase().includes(searchTerm.toLowerCase()));

  const total = STUDENTS.length;
  const good = STUDENTS.filter((s) => s.attendance >= 90).length;
  const warn = STUDENTS.filter((s) => s.attendance >= 75 && s.attendance < 90).length;

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-700 px-5 pb-7 pt-5 text-white">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-white">Alunos</h1>
            <p className="mt-0.5 text-sm text-indigo-200">Alunos matriculados</p>
          </div>
          <Link href="/students/add" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm transition-colors hover:bg-indigo-50">
            <Plus size={20} className="text-indigo-600" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { value: total, label: "Total", bg: "bg-white/15" },
            { value: good, label: "≥ 90%", bg: "bg-emerald-500/30" },
            { value: warn, label: "75–89%", bg: "bg-amber-400/30" }
          ].map(({ value, label, bg }) => (
            <div key={label} className={`${bg} rounded-2xl border border-white/20 p-3 text-center`}>
              <p className="text-2xl leading-tight text-white">{value}</p>
              <p className="mt-0.5 text-xs text-white/70">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="-mt-3 mb-4 px-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar aluno ou turma..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      <div className="mb-3 px-4">
        <p className="text-xs text-slate-400">{filtered.length} aluno(s) encontrado(s)</p>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-6">
        {filtered.map((student, idx) => {
          const { bg: attBg, bar: attBar } = getAttBadge(student.attendance);
          return (
            <div key={student.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <div className="p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]}`}>
                    <span className="text-sm text-white">{getInitials(student.name)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-800">{student.name}</p>
                        <span className="mt-0.5 inline-block rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">{student.class}</span>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${attBg}`}>{student.attendance}%</span>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>Frequência</span>
                    <span>{student.attendance}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${attBar}`} style={{ width: `${student.attendance}%` }} />
                  </div>
                </div>

                <div className="mb-3 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Mail size={12} className="text-slate-300" />
                    {student.email}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Phone size={12} className="text-slate-300" />
                    {student.phone}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/students/edit/${student.id}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Edit size={13} /> Editar
                  </Link>
                  <Link
                    href={`/attendance/report/${student.id}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs text-slate-500 transition-colors hover:bg-purple-50 hover:text-purple-600"
                  >
                    <BarChart3 size={13} /> Frequência
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
