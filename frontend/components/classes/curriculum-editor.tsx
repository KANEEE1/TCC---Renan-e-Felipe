"use client";

import { useState } from "react";
import { BookOpen, Clock, Minus, Plus, Trash2 } from "lucide-react";

const DURATIONS = [45, 50, 60, 90, 100, 120, 150, 180];
const MIN_AULAS = 1;
const MAX_AULAS = 20;

export interface CurriculumDiscipline {
  id: string;
  nome: string;
}

export interface CargaRow {
  key: number;
  nome: string;
  aulasPorSemana: number;
  duracaoMinutos: number;
}

let nextKey = 0;

export function makeRow(nome: string, aulasPorSemana = 2, duracaoMinutos = 120): CargaRow {
  return { key: nextKey++, nome, aulasPorSemana, duracaoMinutos };
}

export function normalize(nome: string) {
  return nome.trim().replace(/\s+/g, " ").toLowerCase();
}

export function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}min`;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

// Monta o item de `disciplinas` do PUT/POST de turma: usa o id do catálogo quando a disciplina já existe.
export function toDisciplinasPayload(rows: CargaRow[], catalog: CurriculumDiscipline[]) {
  return rows.map((row) => {
    const match = catalog.find((d) => normalize(d.nome) === normalize(row.nome));
    return {
      ...(match ? { disciplinaId: match.id } : { nome: row.nome }),
      aulasPorSemana: row.aulasPorSemana,
      duracaoMinutos: row.duracaoMinutos
    };
  });
}

interface CurriculumEditorProps {
  rows: CargaRow[];
  onChange: (rows: CargaRow[]) => void;
  catalog: CurriculumDiscipline[];
  onError: (message: string | null) => void;
}

export function CurriculumEditor({ rows, onChange, catalog, onError }: CurriculumEditorProps) {
  const [newDiscipline, setNewDiscipline] = useState("");

  const added = new Set(rows.map((row) => normalize(row.nome)));
  const available = catalog.filter((d) => !added.has(normalize(d.nome)));
  const totalAulas = rows.reduce((sum, row) => sum + row.aulasPorSemana, 0);
  const totalMinutos = rows.reduce((sum, row) => sum + row.aulasPorSemana * row.duracaoMinutos, 0);

  const updateRow = (key: number, patch: Partial<CargaRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const addRow = (nome: string) => {
    onError(null);
    onChange([...rows, makeRow(nome)]);
  };

  const addNewDiscipline = () => {
    const nome = newDiscipline.trim().replace(/\s+/g, " ");
    if (!nome) return;
    if (added.has(normalize(nome))) {
      onError(`${nome} já está na turma.`);
      return;
    }
    const existing = catalog.find((d) => normalize(d.nome) === normalize(nome));
    addRow(existing?.nome ?? nome);
    setNewDiscipline("");
  };

  return (
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
                      onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
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
  );
}
