"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, Edit, MapPin, Plus, Search, Users } from "lucide-react";

const SHIFT_COLORS: Record<string, string> = {
  Manhã: "bg-amber-50 text-amber-700 border-amber-200",
  Tarde: "bg-orange-50 text-orange-600 border-orange-200",
  Noite: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Integral: "bg-blue-50 text-blue-700 border-blue-200"
};

const CARD_ACCENTS = [
  "from-teal-500 to-emerald-600",
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-orange-500 to-amber-500",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-teal-600"
];

const CLASSES = [
  { id: 1, name: "Extensivo — Manhã", year: "Extensivo", shift: "Manhã", students: 45, coordinator: "Ana Silva", room: "Sala 101" },
  { id: 2, name: "Extensivo — Noite", year: "Extensivo", shift: "Noite", students: 52, coordinator: "Carlos Santos", room: "Sala 102" },
  { id: 3, name: "Intensivo — Integral", year: "Intensivo", shift: "Integral", students: 38, coordinator: "Maria Oliveira", room: "Sala 201" },
  { id: 4, name: "Semi-Intensivo — Tarde", year: "Semi-Intensivo", shift: "Tarde", students: 40, coordinator: "João Costa", room: "Sala 202" },
  { id: 5, name: "Reta Final ENEM", year: "Reta Final", shift: "Manhã", students: 35, coordinator: "Ana Silva", room: "Sala 301" },
  { id: 6, name: "Medicina — Específicas", year: "Específicas", shift: "Tarde", students: 28, coordinator: "Carlos Santos", room: "Sala 302" }
];

export function ClassList() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClasses = CLASSES.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.year.toLowerCase().includes(searchTerm.toLowerCase()));

  const totalStudents = CLASSES.reduce((sum, c) => sum + c.students, 0);

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-teal-600 to-emerald-700 px-5 pb-7 pt-5 text-white">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-white">Turmas</h1>
            <p className="mt-0.5 text-sm text-teal-200">Gerenciar turmas e alunos</p>
          </div>
          <Link href="/classes/add" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm transition-colors hover:bg-teal-50">
            <Plus size={20} className="text-teal-600" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/20 bg-white/15 p-3.5 text-center">
            <Calendar size={18} className="mx-auto mb-1 text-teal-200" />
            <p className="text-2xl text-white">{CLASSES.length}</p>
            <p className="text-xs text-white/60">Turmas</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/15 p-3.5 text-center">
            <Users size={18} className="mx-auto mb-1 text-teal-200" />
            <p className="text-2xl text-white">{totalStudents}</p>
            <p className="text-xs text-white/60">Alunos Total</p>
          </div>
        </div>
      </div>

      <div className="-mt-3 mb-4 px-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar turma..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
      </div>

      <div className="mb-3 px-4">
        <p className="text-xs text-slate-400">{filteredClasses.length} turma(s) encontrada(s)</p>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-6">
        {filteredClasses.map((cls, idx) => (
          <div key={cls.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <div className={`h-1.5 rounded-t-2xl bg-gradient-to-r ${CARD_ACCENTS[idx % CARD_ACCENTS.length]}`} />
            <div className="p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-slate-800">{cls.name}</h3>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${SHIFT_COLORS[cls.shift] || "border-slate-200 bg-slate-100 text-slate-600"}`}>{cls.shift}</span>
                    <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                      <MapPin size={10} /> {cls.room}
                    </span>
                  </div>
                </div>
                <div className={`ml-3 shrink-0 rounded-xl bg-gradient-to-br px-3 py-2 text-center ${CARD_ACCENTS[idx % CARD_ACCENTS.length]}`}>
                  <p className="text-lg leading-tight text-white">{cls.students}</p>
                  <p className="text-[10px] text-white/70">alunos</p>
                </div>
              </div>

              <div className="mb-4 flex items-center gap-1.5 text-xs text-slate-400">
                <Users size={12} className="text-slate-300" />
                <span>Coordenador:</span>
                <span className="text-slate-600">{cls.coordinator}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/classes/edit/${cls.id}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs text-slate-500 transition-colors hover:bg-teal-50 hover:text-teal-600"
                >
                  <Edit size={13} /> Editar
                </Link>
                <Link
                  href={`/classes/${cls.id}/assign-students`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                >
                  <Users size={13} /> Alunos
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
