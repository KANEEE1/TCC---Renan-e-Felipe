"use client";

import { useEffect, useState } from "react";
import { BarChart2, BookOpen, ChevronDown, ChevronUp, Filter, Plus, Search, Star, Trophy, Users, X } from "lucide-react";

export interface SimuladoRecord {
  id: string;
  studentName: string;
  turma: string;
  subject: string;
  examName: string;
  date: string;
  grade: number | null;
  notes: string;
  createdAt: string;
}

const SUBJECTS = [
  "Matemática", "Física", "Química", "Biologia", "História",
  "Geografia", "Português", "Redação", "Inglês", "Filosofia",
  "Sociologia", "Literatura", "Geral (Todas as matérias)"
];

const TURMAS = ["Extensivo", "Intensivo", "Reta Final", "Medicina", "Engenharia", "Semi-extensivo"];

const STORAGE_KEY = "app_simulados";

function generateId(): string {
  return `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function gradeColor(g: number | null): string {
  if (g === null) return "text-slate-400";
  if (g >= 8) return "text-emerald-600";
  if (g >= 6) return "text-blue-600";
  if (g >= 4) return "text-orange-500";
  return "text-red-500";
}

function gradeBg(g: number | null): string {
  if (g === null) return "bg-slate-100";
  if (g >= 8) return "bg-emerald-50";
  if (g >= 6) return "bg-blue-50";
  if (g >= 4) return "bg-orange-50";
  return "bg-red-50";
}

function gradeLabel(g: number | null): string {
  if (g === null) return "–";
  if (g >= 9) return "Excelente";
  if (g >= 7) return "Bom";
  if (g >= 5) return "Regular";
  return "Insuficiente";
}

function avg(grades: (number | null)[]): string {
  const valid = grades.filter((g): g is number => g !== null);
  if (valid.length === 0) return "–";
  return (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1);
}

const EMPTY_FORM: Omit<SimuladoRecord, "id" | "createdAt"> = {
  studentName: "",
  turma: "",
  subject: "",
  examName: "",
  date: "",
  grade: null,
  notes: ""
};

export function SimuladoList() {
  const [records, setRecords] = useState<SimuladoRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [search, setSearch] = useState("");
  const [filterTurma, setFilterTurma] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRecords(JSON.parse(stored));
    } catch {
      // ignora storage indisponível/corrompido
    }
  }, []);

  const persist = (data: SimuladoRecord[]) => {
    setRecords(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const handleSave = () => {
    const newRecord: SimuladoRecord = {
      ...form,
      id: generateId(),
      createdAt: new Date().toISOString()
    };
    persist([newRecord, ...records]);
    setForm({ ...EMPTY_FORM });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    persist(records.filter((r) => r.id !== id));
  };

  const setGrade = (raw: string) => {
    if (raw === "") {
      setForm((f) => ({ ...f, grade: null }));
      return;
    }
    const v = parseFloat(raw);
    if (!isNaN(v)) setForm((f) => ({ ...f, grade: Math.min(10, Math.max(0, v)) }));
  };

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.studentName.toLowerCase().includes(q) || r.examName.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q) || r.turma.toLowerCase().includes(q);
    const matchTurma = !filterTurma || r.turma === filterTurma;
    const matchSubject = !filterSubject || r.subject === filterSubject;
    return matchSearch && matchTurma && matchSubject;
  });

  const byStudent = filtered.reduce<Record<string, SimuladoRecord[]>>((acc, r) => {
    const key = r.studentName || "(sem nome)";
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  const hasFilters = filterTurma || filterSubject || search;

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-5 pb-6 pt-5 text-white">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-white">Simulados</h1>
            <p className="mt-0.5 text-xs text-amber-100">Histórico de notas e desempenho</p>
          </div>
          <button type="button" onClick={() => setShowForm(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30">
            <Plus size={20} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: BookOpen, value: records.length, label: "Registros" },
            { icon: Users, value: new Set(records.map((r) => r.studentName || "(sem nome)")).size, label: "Alunos" },
            { icon: Star, value: avg(records.map((r) => r.grade)), label: "Média Geral" }
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-2xl border border-white/20 bg-white/15 p-3 text-center backdrop-blur-sm">
              <Icon className="mx-auto mb-1 text-white/80" size={18} />
              <p className="text-xl font-bold leading-tight text-white">{value}</p>
              <p className="mt-0.5 text-[10px] text-amber-100">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 px-4 pb-2 pt-4">
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
            <Search size={15} className="shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar aluno, matéria ou simulado..."
              className="flex-1 bg-transparent text-sm text-slate-700 focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}>
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 text-xs transition-colors ${
              hasFilters ? "border-orange-500 bg-orange-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Filter size={13} />
            Filtros
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-2">
            <select
              value={filterTurma}
              onChange={(e) => setFilterTurma(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none"
            >
              <option value="">Todas as turmas</option>
              {TURMAS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none"
            >
              <option value="">Todas as matérias</option>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-32 pt-2">
        {Object.keys(byStudent).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Trophy size={28} className="text-amber-400" />
            </div>
            <p className="text-sm text-slate-600">Nenhum simulado registrado</p>
            <p className="mt-1 text-xs text-slate-400">Toque em + para adicionar o primeiro</p>
            <button type="button" onClick={() => setShowForm(true)} className="mt-4 rounded-xl bg-orange-500 px-5 py-2 text-sm text-white transition-colors hover:bg-orange-600">
              Registrar nota
            </button>
          </div>
        )}

        {Object.entries(byStudent).map(([studentName, studentRecords]) => {
          const isExpanded = expandedStudent === studentName;
          const grades = studentRecords.map((r) => r.grade);
          const studentAvg = avg(grades);
          const turmas = [...new Set(studentRecords.map((r) => r.turma).filter(Boolean))];

          return (
            <div key={studentName} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setExpandedStudent(isExpanded ? null : studentName)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-rose-500">
                  <span className="text-sm font-bold text-white">{studentName.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-800">{studentName}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    {turmas.slice(0, 2).map((t) => (
                      <span key={t} className="text-xs text-slate-400">
                        {t}
                      </span>
                    ))}
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-slate-400">
                      {studentRecords.length} simulado{studentRecords.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-lg font-bold ${gradeColor(parseFloat(studentAvg) || null)}`}>{studentAvg}</div>
                  <p className="text-[10px] text-slate-400">média</p>
                </div>
                {isExpanded ? <ChevronUp size={16} className="ml-1 shrink-0 text-slate-400" /> : <ChevronDown size={16} className="ml-1 shrink-0 text-slate-400" />}
              </button>

              {isExpanded && (
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {studentRecords.map((r) => (
                    <div key={r.id} className="group flex items-center gap-3 px-4 py-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${gradeBg(r.grade)}`}>
                        <span className={`text-sm font-bold ${gradeColor(r.grade)}`}>{r.grade !== null ? r.grade.toFixed(1) : "–"}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-700">{r.examName || "Simulado"}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {r.subject && <span className="text-xs text-slate-400">{r.subject}</span>}
                          {r.turma && (
                            <>
                              <span className="text-xs text-slate-300">·</span>
                              <span className="text-xs text-slate-400">{r.turma}</span>
                            </>
                          )}
                          {r.date && (
                            <>
                              <span className="text-xs text-slate-300">·</span>
                              <span className="text-xs text-slate-400">
                                {new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                              </span>
                            </>
                          )}
                        </div>
                        {r.notes && <p className="mt-0.5 truncate text-xs italic text-slate-400">{r.notes}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`hidden text-xs group-hover:inline ${gradeColor(r.grade)}`}>{gradeLabel(r.grade)}</span>
                        <button type="button" onClick={() => handleDelete(r.id)} className="opacity-0 transition-opacity group-hover:opacity-100">
                          <X size={14} className="text-slate-400 hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {studentRecords.length > 1 && (
                    <div className="bg-slate-50 px-4 py-3">
                      <p className="mb-2 flex items-center gap-1 text-xs text-slate-400">
                        <BarChart2 size={11} /> Progresso
                      </p>
                      <div className="flex h-8 items-end gap-1">
                        {[...studentRecords].reverse().map((r) => {
                          const h = r.grade !== null ? (r.grade / 10) * 100 : 5;
                          return (
                            <div
                              key={r.id}
                              title={`${r.examName}: ${r.grade ?? "–"}`}
                              className={`flex-1 rounded-t transition-all ${
                                r.grade !== null && r.grade >= 8 ? "bg-emerald-400" : r.grade !== null && r.grade >= 6 ? "bg-blue-400" : r.grade !== null && r.grade >= 4 ? "bg-orange-400" : "bg-slate-200"
                              }`}
                              style={{ height: `${Math.max(h, 8)}%` }}
                            />
                          );
                        })}
                      </div>
                      <div className="mt-0.5 flex justify-between">
                        <span className="text-[9px] text-slate-300">mais antigo</span>
                        <span className="text-[9px] text-slate-300">mais recente</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <h2 className="text-slate-800">Registrar Nota de Simulado</h2>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm({ ...EMPTY_FORM });
                }}
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4 pb-8">
              <div>
                <label className="mb-1.5 block text-xs text-slate-500">
                  Nome do aluno <span className="text-slate-300">(opcional)</span>
                </label>
                <input
                  value={form.studentName}
                  onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))}
                  placeholder="Ex: João da Silva"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-slate-500">
                  Turma <span className="text-slate-300">(opcional)</span>
                </label>
                <select
                  value={form.turma}
                  onChange={(e) => setForm((f) => ({ ...f, turma: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="">Selecionar turma...</option>
                  {TURMAS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-slate-500">
                  Nome do simulado <span className="text-slate-300">(opcional)</span>
                </label>
                <input
                  value={form.examName}
                  onChange={(e) => setForm((f) => ({ ...f, examName: e.target.value }))}
                  placeholder="Ex: Simulado ENEM — Maio 2026"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs text-slate-500">
                    Matéria <span className="text-slate-300">(opcional)</span>
                  </label>
                  <select
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  >
                    <option value="">Selecionar...</option>
                    {SUBJECTS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-500">
                    Data <span className="text-slate-300">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-slate-500">
                  Nota (0–10) <span className="text-slate-300">(opcional)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={form.grade !== null ? form.grade : ""}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="Ex: 7.5"
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                  {form.grade !== null && (
                    <div className={`rounded-xl px-3 py-2 text-sm ${gradeBg(form.grade)}`}>
                      <span className={`font-semibold ${gradeColor(form.grade)}`}>{gradeLabel(form.grade)}</span>
                    </div>
                  )}
                </div>
                {form.grade !== null && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        form.grade >= 8 ? "bg-emerald-400" : form.grade >= 6 ? "bg-blue-400" : form.grade >= 4 ? "bg-orange-400" : "bg-red-400"
                      }`}
                      style={{ width: `${form.grade * 10}%` }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-slate-500">
                  Observações <span className="text-slate-300">(opcional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Ex: Dificuldade em questões de geometria..."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              <button
                type="button"
                onClick={handleSave}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 py-3.5 text-white shadow-md shadow-orange-200 transition-opacity hover:opacity-90"
              >
                <Trophy size={18} />
                Salvar Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-rose-500 shadow-lg shadow-orange-300 transition-transform hover:scale-105"
        >
          <Plus size={24} className="text-white" />
        </button>
      )}
    </div>
  );
}
