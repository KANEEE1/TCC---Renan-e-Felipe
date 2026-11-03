"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, BookOpen, ClipboardList, Edit, Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

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

interface Indicadores {
  alunoId: string;
  frequenciaPercentual: number | null;
  mediaSimuladosPercentual: number | null;
}

const formatPercent = (v: number | null) => (v === null ? "—" : `${Math.round(v)}%`);

// Frequência abaixo disso sinaliza risco (badge vermelha).
const FREQUENCIA_MINIMA = 75;

const SORT_OPTIONS = [
  { value: "nome", label: "Nome (A–Z)" },
  { value: "media-desc", label: "Maior média" },
  { value: "media-asc", label: "Menor média" },
  { value: "freq-desc", label: "Maior frequência" },
  { value: "freq-asc", label: "Menor frequência" }
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["value"];

interface Student {
  id: string;
  nome: string;
  numero: string | null;
  matriculas: { turma: { id: string; nome: string } }[];
}

export function StudentList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<{ id: string; nome: string }[]>([]);
  // Filtro por turma (id), combinado com a busca por texto.
  const [selectedClass, setSelectedClass] = useState("all");
  const [indicadores, setIndicadores] = useState<Map<string, Indicadores>>(new Map());
  const [sortBy, setSortBy] = useState<SortKey>("nome");
  // Cadastrar e editar alunos é da gestão; professores só consultam.
  const [isManagement, setIsManagement] = useState(false);

  useEffect(() => {
    setIsManagement(!!getSessionUser()?.roles.includes("GESTAO"));
    api.get<Student[]>("/students").then(setStudents).catch(() => setStudents([]));
    api
      .get<{ id: string; nome: string }[]>("/classes")
      .then((list) => setClasses([...list].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))))
      .catch(() => setClasses([]));
    api
      .get<Indicadores[]>("/students/indicadores")
      .then((list) => setIndicadores(new Map(list.map((i) => [i.alunoId, i]))))
      .catch(() => setIndicadores(new Map()));
  }, []);

  const withClass = students.map((s) => ({ ...s, className: s.matriculas[0]?.turma.nome ?? "Sem turma" }));

  const filtered = withClass.filter(
    (s) =>
      (selectedClass === "all" || s.matriculas.some((m) => m.turma.id === selectedClass)) &&
      (s.nome.toLowerCase().includes(searchTerm.toLowerCase()) || s.className.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Sem o dado ordenado ("—") vai sempre para o fim; empate por nome.
  const sortField = sortBy.startsWith("media") ? "mediaSimuladosPercentual" : "frequenciaPercentual";
  const sortDir = sortBy.endsWith("asc") ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    const nameOrder = a.nome.localeCompare(b.nome, "pt-BR");
    if (sortBy === "nome") return nameOrder;
    const va = indicadores.get(a.id)?.[sortField] ?? null;
    const vb = indicadores.get(b.id)?.[sortField] ?? null;
    if (va === null || vb === null) return va === vb ? nameOrder : va === null ? 1 : -1;
    return (va - vb) * sortDir || nameOrder;
  });

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-700 px-5 pb-7 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white">Alunos</h1>
            <p className="mt-0.5 text-sm text-indigo-200">Alunos matriculados</p>
          </div>
          {isManagement && (
            <Link href="/students/add" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm transition-colors hover:bg-indigo-50">
              <Plus size={20} className="text-indigo-600" />
            </Link>
          )}
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

      {classes.length > 0 && (
        <div className="mb-3 overflow-x-auto px-4">
          <div className="flex min-w-max items-center gap-1.5">
            <span className="w-12 shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">Turma</span>
            {[{ id: "all", nome: "Todas" }, ...classes].map(({ id, nome }) => {
              const active = selectedClass === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedClass(id)}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                    active ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {id === "all" ? <BookOpen size={12} /> : null}
                  {nome}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3 px-4">
        <p className="text-xs text-slate-400">{filtered.length} aluno(s) encontrado(s)</p>
        <label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Ordenar por
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-normal normal-case tracking-normal text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-6">
        {sorted.map((student, idx) => {
          const ind = indicadores.get(student.id);
          const emRisco = ind?.frequenciaPercentual != null && ind.frequenciaPercentual < FREQUENCIA_MINIMA;
          return (
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
                {/* Indicadores do aluno, no formato da turma; frequência abaixo do mínimo fica vermelha. */}
                <div className="flex shrink-0 gap-1.5">
                  {[
                    { value: formatPercent(ind?.frequenciaPercentual ?? null), label: "frequência", color: emRisco ? "from-red-500 to-rose-600" : "from-sky-500 to-blue-600" },
                    { value: formatPercent(ind?.mediaSimuladosPercentual ?? null), label: "notas", color: "from-orange-500 to-amber-500" }
                  ].map(({ value, label, color }) => (
                    <div key={label} className={`rounded-xl bg-gradient-to-br px-2 py-1.5 text-center ${color}`}>
                      <p className="text-lg leading-tight text-white">{value}</p>
                      <p className="text-[10px] text-white/70">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {student.numero && <p className="mb-3 text-xs text-slate-400">Nº {student.numero}</p>}

              <div className={`grid gap-2 ${isManagement ? "grid-cols-3" : "grid-cols-2"}`}>
                {isManagement && (
                  <Link
                    href={`/students/edit/${student.id}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Edit size={13} /> Editar
                  </Link>
                )}
                <Link
                  href={`/attendance/report/${student.id}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs text-slate-500 transition-colors hover:bg-purple-50 hover:text-purple-600"
                >
                  <BarChart3 size={13} /> Frequência
                </Link>
                <Link
                  href={`/students/${student.id}/notas`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                >
                  <ClipboardList size={13} /> Notas
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
