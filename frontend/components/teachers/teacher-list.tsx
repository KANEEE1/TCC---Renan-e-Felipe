"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Calendar, Edit, Mail, Phone, Plus, Search, UserPlus } from "lucide-react";

const isCoordinator = true;

const AVATAR_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-700",
  "from-pink-500 to-rose-600",
  "from-teal-500 to-emerald-600"
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const TEACHERS = [
  { id: 1, name: "Ana Silva", email: "ana.silva@escola.com", phone: "(11) 98765-4321", subjects: ["Matemática", "Física"], status: "Ativo" },
  { id: 2, name: "Carlos Santos", email: "carlos.santos@escola.com", phone: "(11) 98765-4322", subjects: ["História", "Geografia"], status: "Ativo" },
  { id: 3, name: "Maria Oliveira", email: "maria.oliveira@escola.com", phone: "(11) 98765-4323", subjects: ["Português", "Literatura"], status: "Ativo" },
  { id: 4, name: "João Costa", email: "joao.costa@escola.com", phone: "(11) 98765-4324", subjects: ["Química", "Biologia"], status: "Ativo" }
];

export function TeacherList() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTeachers = TEACHERS.filter(
    (teacher) =>
      teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.subjects.some((subject) => subject.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 pt-5 pb-6 text-white">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h1 className="text-white">Professores</h1>
            <p className="mt-0.5 text-sm text-blue-200">Gerenciar equipe docente</p>
          </div>
          <div className="flex gap-2">
            {isCoordinator && (
              <Link
                href="/teachers/register"
                title="Cadastrar novo professor"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-white/20 transition-colors hover:bg-white/30"
              >
                <UserPlus size={18} className="text-white" />
              </Link>
            )}
            <Link
              href="/teachers/add"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm transition-colors hover:bg-blue-50"
            >
              <Plus size={20} className="text-blue-600" />
            </Link>
          </div>
        </div>

        {isCoordinator && (
          <Link
            href="/teachers/register"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/15 py-2.5 text-sm text-white transition-colors hover:bg-white/25"
          >
            <UserPlus size={16} />
            Cadastrar Acesso de Professor
          </Link>
        )}
      </div>

      <div className="-mt-3 mb-4 px-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar professor ou disciplina..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="mb-3 px-4">
        <p className="text-xs text-slate-400">{filteredTeachers.length} professor(es) encontrado(s)</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">
        {filteredTeachers.map((teacher, idx) => (
          <div key={teacher.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3 p-4 pb-3">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm ${AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]}`}
              >
                <span className="text-sm text-white">{getInitials(teacher.name)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="truncate text-slate-800">{teacher.name}</h3>
                  <span className="ml-2 shrink-0 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                    {teacher.status}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {teacher.subjects.map((subject) => (
                    <span key={subject} className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-50 px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Mail size={13} className="text-slate-300" />
                {teacher.email}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Phone size={13} className="text-slate-300" />
                {teacher.phone}
              </div>
            </div>

            <div className="grid grid-cols-3 border-t border-slate-100">
              <Link
                href={`/teachers/edit/${teacher.id}`}
                className="flex items-center justify-center gap-1.5 border-r border-slate-100 py-3 text-xs text-slate-500 transition-colors hover:bg-slate-50 hover:text-blue-600"
              >
                <Edit size={14} />
                Editar
              </Link>
              <Link
                href={`/teachers/schedule?teacher=${encodeURIComponent(teacher.name)}`}
                className="flex items-center justify-center gap-1.5 border-r border-slate-100 py-3 text-xs text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
              >
                <BookOpen size={14} />
                Agenda
              </Link>
              <Link
                href={`/teachers/${teacher.id}/availability`}
                className="flex items-center justify-center gap-1.5 py-3 text-xs text-slate-500 transition-colors hover:bg-purple-50 hover:text-purple-600"
              >
                <Calendar size={14} />
                Horários
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
