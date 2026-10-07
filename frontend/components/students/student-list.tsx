"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Edit, Mail, Phone, Plus, Search } from "lucide-react";
import { api } from "@/lib/api";

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

interface Student {
  id: string;
  nome: string;
  numero: string | null;
  email: string | null;
  telefone: string | null;
  matriculas: { turma: { nome: string } }[];
}

export function StudentList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    api.get<Student[]>("/students").then(setStudents).catch(() => setStudents([]));
  }, []);

  const withClass = students.map((s) => ({ ...s, className: s.matriculas[0]?.turma.nome ?? "Sem turma" }));

  const filtered = withClass.filter(
    (s) => s.nome.toLowerCase().includes(searchTerm.toLowerCase()) || s.className.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const total = students.length;
  const withClassCount = withClass.filter((s) => s.className !== "Sem turma").length;
  const withoutClassCount = total - withClassCount;

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
            { value: withClassCount, label: "Com turma", bg: "bg-emerald-500/30" },
            { value: withoutClassCount, label: "Sem turma", bg: "bg-amber-400/30" }
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
        {filtered.map((student, idx) => (
          <div key={student.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <div className="p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]}`}>
                  <span className="text-sm text-white">{getInitials(student.nome)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-800">{student.nome}</p>
                    <span className="mt-0.5 inline-block rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">{student.className}</span>
                  </div>
                </div>
              </div>

              <div className="mb-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Mail size={12} className="text-slate-300" />
                  {student.email ?? "—"}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Phone size={12} className="text-slate-300" />
                  {student.telefone ?? "—"}
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
        ))}
      </div>
    </div>
  );
}
