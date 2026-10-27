"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock, Minus, Plus, Save, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";

const SHIFTS = ["Manhã", "Tarde", "Noite", "Integral"];
const DURATIONS = [45, 50, 60, 90, 100, 120, 150, 180];
const MIN_AULAS = 1;
const MAX_AULAS = 20;

interface ClassDetail {
  nome: string;
  turno: string | null;
  sala: string | null;
  coordenador: string | null;
  cargas?: { aulasPorSemana: number; duracaoMinutos: number; disciplina: { id: string; nome: string } }[];
}

interface Discipline {
  id: string;
  nome: string;
}

interface CargaRow {
  key: number;
  nome: string;
  aulasPorSemana: number;
  duracaoMinutos: number;
}

function normalize(nome: string) {
  return nome.trim().replace(/\s+/g, " ").toLowerCase();
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}min`;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-teal-500";

type ClassFormProps = {
  isEdit?: boolean;
  classId?: string;
};

const EMPTY = { name: "", shift: "", room: "", coordinator: "" };

export function ClassForm({ isEdit = false, classId }: ClassFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<Discipline[]>([]);
  const [rows, setRows] = useState<CargaRow[]>([]);
  const [newDiscipline, setNewDiscipline] = useState("");
  const nextKey = useRef(0);
  // Na edição, só libera o envio depois de carregar a matriz; senão o PUT apagaria as cargas.
  const [loaded, setLoaded] = useState(!isEdit);

  const makeRow = (nome: string, aulasPorSemana = 2, duracaoMinutos = 120): CargaRow => ({
    key: nextKey.current++,
    nome,
    aulasPorSemana,
    duracaoMinutos
  });

  useEffect(() => {
    api.get<Discipline[]>("/disciplinas").then(setCatalog).catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (!isEdit || !classId) return;
    api
      .get<ClassDetail>(`/classes/${classId}`)
      .then((cls) => {
        setFormData({
          name: cls.nome,
          shift: cls.turno ?? "",
          room: cls.sala ?? "",
          coordinator: cls.coordenador ?? ""
        });
        setRows((cls.cargas ?? []).map((carga) => makeRow(carga.disciplina.nome, carga.aulasPorSemana, carga.duracaoMinutos)));
        setLoaded(true);
      })
      .catch(() => setError("Não foi possível carregar a turma."));
  }, [isEdit, classId]);

  const added = new Set(rows.map((row) => normalize(row.nome)));
  const available = catalog.filter((d) => !added.has(normalize(d.nome)));
  const totalAulas = rows.reduce((sum, row) => sum + row.aulasPorSemana, 0);
  const totalMinutos = rows.reduce((sum, row) => sum + row.aulasPorSemana * row.duracaoMinutos, 0);

  const updateRow = (key: number, patch: Partial<CargaRow>) =>
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const addRow = (nome: string) => {
    setError(null);
    setRows((prev) => [...prev, makeRow(nome)]);
  };

  const addNewDiscipline = () => {
    const nome = newDiscipline.trim().replace(/\s+/g, " ");
    if (!nome) return;
    if (added.has(normalize(nome))) {
      setError(`${nome} já está na turma.`);
      return;
    }
    const existing = catalog.find((d) => normalize(d.nome) === normalize(nome));
    addRow(existing?.nome ?? nome);
    setNewDiscipline("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const disciplinas = rows.map((row) => {
      const match = catalog.find((d) => normalize(d.nome) === normalize(row.nome));
      return {
        ...(match ? { disciplinaId: match.id } : { nome: row.nome }),
        aulasPorSemana: row.aulasPorSemana,
        duracaoMinutos: row.duracaoMinutos
      };
    });

    setLoading(true);

    // anoLetivo não aparece na tela: a turma é do ano corrente.
    const payload = {
      nome: formData.name,
      anoLetivo: new Date().getFullYear(),
      turno: formData.shift || undefined,
      sala: formData.room || undefined,
      coordenador: formData.coordinator || undefined,
      disciplinas
    };

    try {
      if (isEdit && classId) {
        await api.put(`/classes/${classId}`, payload);
      } else {
        await api.post("/classes", payload);
      }
      router.push("/classes");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-teal-600 p-4 text-white">
        <Link href="/classes" className="mr-3" aria-label="Voltar">
          <ArrowLeft size={24} />
        </Link>
        <h1>{isEdit ? "Editar Turma" : "Nova Turma"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-4 pb-32">
        <section className="space-y-4 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold text-gray-800">Informações da turma</h2>

          <div>
            <label className="mb-2 block text-sm text-gray-700">Nome da turma</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputClass}
              placeholder="Ex: Extensivo - Manhã"
              required
            />
          </div>

          <div>
            <span className="mb-2 block text-sm text-gray-700">Turno</span>
            <div className="grid grid-cols-4 gap-2">
              {SHIFTS.map((shift) => {
                const active = formData.shift === shift;
                return (
                  <button
                    key={shift}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFormData({ ...formData, shift: active ? "" : shift })}
                    className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                      active ? "border-teal-600 bg-teal-600 text-white" : "border-gray-300 bg-white text-gray-700 hover:border-teal-400"
                    }`}
                  >
                    {shift}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-gray-700">
                Sala <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                className={inputClass}
                placeholder="Ex: Sala 201"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-gray-700">
                Coordenador <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={formData.coordinator}
                onChange={(e) => setFormData({ ...formData, coordinator: e.target.value })}
                className={inputClass}
                placeholder="Nome do responsável"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl bg-white p-4 shadow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-800">Disciplinas da turma</h2>
              <p className="mt-0.5 text-xs text-gray-500">Usadas para gerar a grade horária.</p>
            </div>
            {rows.length > 0 && (
              <div className="shrink-0 rounded-lg bg-teal-50 px-3 py-1.5 text-right text-xs text-teal-800">
                <p className="font-semibold">
                  {totalAulas} aula{totalAulas !== 1 ? "s" : ""}/semana
                </p>
                <p>{formatHours(totalMinutos)} por semana</p>
              </div>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
              <BookOpen size={20} className="mx-auto mb-1 text-gray-400" />
              Nenhuma disciplina adicionada ainda.
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => {
                const durations = DURATIONS.includes(row.duracaoMinutos)
                  ? DURATIONS
                  : [...DURATIONS, row.duracaoMinutos].sort((a, b) => a - b);
                const isNew = !catalog.some((d) => normalize(d.nome) === normalize(row.nome));
                return (
                  <li key={row.key} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-800">{row.nome}</p>
                        {isNew && <p className="text-xs text-teal-600">Nova: será adicionada ao catálogo</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                        aria-label={`Remover ${row.nome}`}
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateRow(row.key, { aulasPorSemana: row.aulasPorSemana - 1 })}
                          disabled={row.aulasPorSemana <= MIN_AULAS}
                          aria-label="Menos uma aula"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-20 text-center text-sm text-gray-800">
                          {row.aulasPorSemana} aula{row.aulasPorSemana !== 1 ? "s" : ""}/sem
                        </span>
                        <button
                          type="button"
                          onClick={() => updateRow(row.key, { aulasPorSemana: row.aulasPorSemana + 1 })}
                          disabled={row.aulasPorSemana >= MAX_AULAS}
                          aria-label="Mais uma aula"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <label className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Clock size={14} className="text-gray-400" />
                        <select
                          value={row.duracaoMinutos}
                          onChange={(e) => updateRow(row.key, { duracaoMinutos: Number(e.target.value) })}
                          aria-label={`Duração da aula de ${row.nome}`}
                          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          {durations.map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {formatHours(minutes)} por aula
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {available.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Adicionar do catálogo</p>
              <div className="flex flex-wrap gap-2">
                {available.map((discipline) => (
                  <button
                    key={discipline.id}
                    type="button"
                    onClick={() => addRow(discipline.nome)}
                    className="flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm text-teal-700 transition-colors hover:bg-teal-100"
                  >
                    <Plus size={14} /> {discipline.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              {catalog.length === 0 ? "Adicionar disciplina" : "Outra disciplina"}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDiscipline}
                onChange={(e) => setNewDiscipline(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addNewDiscipline();
                  }
                }}
                placeholder="Ex: Atualidades"
                aria-label="Nome da nova disciplina"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={addNewDiscipline}
                disabled={!newDiscipline.trim()}
                className="flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-sm text-white hover:bg-teal-700 disabled:opacity-50"
              >
                <Plus size={16} /> Adicionar
              </button>
            </div>
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button
            type="submit"
            disabled={loading || !loaded}
            className="flex w-full items-center justify-center rounded-lg bg-teal-600 py-3 text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
          >
            <Save size={20} className="mr-2" />
            {loading ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Turma"}
          </button>
        </div>
      </form>
    </div>
  );
}
