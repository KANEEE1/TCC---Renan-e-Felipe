"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, Edit, Plus, Sparkles, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";

const VESTIBULAR_DISCIPLINES = [
  "Matemática",
  "Português",
  "Redação",
  "Literatura",
  "Física",
  "Química",
  "Biologia",
  "História",
  "Geografia",
  "Filosofia",
  "Sociologia",
  "Inglês"
];

interface Discipline {
  id: string;
  nome: string;
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function DisciplineList() {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setDisciplines(await api.get<Discipline[]>("/disciplinas"));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Não foi possível carregar as disciplinas."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      return true;
    } catch (err) {
      setError(errorMessage(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    if (await run(() => api.post("/disciplinas", { nome: newName }), "Não foi possível adicionar a disciplina.")) {
      setNewName("");
    }
  };

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return;
    if (await run(() => api.put(`/disciplinas/${id}`, { nome: editingName }), "Não foi possível renomear a disciplina.")) {
      setEditingId(null);
    }
  };

  const handleRemove = async (discipline: Discipline) => {
    if (!window.confirm(`Remover a disciplina "${discipline.nome}"?`)) return;
    await run(() => api.delete(`/disciplinas/${discipline.id}`), "Não foi possível remover a disciplina.");
  };

  const handleSeed = () =>
    run(() => api.post("/disciplinas/lote", { nomes: VESTIBULAR_DISCIPLINES }), "Não foi possível adicionar as disciplinas.");

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-teal-600 to-emerald-700 px-5 pb-7 pt-5 text-white">
        <h1 className="text-white">Disciplinas</h1>
        <p className="mt-0.5 text-sm text-teal-200">Catálogo de disciplinas do cursinho</p>
      </div>

      <form onSubmit={handleAdd} className="-mt-3 mb-4 flex gap-2 px-4">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nova disciplina"
          aria-label="Nova disciplina"
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          aria-label="Adicionar disciplina"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-60"
        >
          <Plus size={20} />
        </button>
      </form>

      {error && <p className="mb-3 px-4 text-sm text-red-600">{error}</p>}

      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-6">
        {loading && <p className="text-center text-sm text-slate-400">Carregando...</p>}

        {!loading && disciplines.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
            <BookOpen size={28} className="mb-2 text-slate-300" />
            <p className="mb-4 text-sm text-slate-500">Nenhuma disciplina cadastrada.</p>
            <button
              type="button"
              onClick={handleSeed}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
            >
              <Sparkles size={16} /> Adicionar disciplinas do vestibular
            </button>
          </div>
        )}

        {disciplines.map((discipline) => (
          <div key={discipline.id} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            {editingId === discipline.id ? (
              <>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleRename(discipline.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                  aria-label="Nome da disciplina"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <button
                  type="button"
                  onClick={() => handleRename(discipline.id)}
                  disabled={busy || !editingName.trim()}
                  aria-label="Salvar nome"
                  className="rounded-lg p-2 text-teal-600 transition-colors hover:bg-teal-50 disabled:opacity-60"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  aria-label="Cancelar"
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-slate-800">{discipline.nome}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(discipline.id);
                    setEditingName(discipline.nome);
                  }}
                  aria-label={`Renomear ${discipline.nome}`}
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-teal-50 hover:text-teal-600"
                >
                  <Edit size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(discipline)}
                  disabled={busy}
                  aria-label={`Remover ${discipline.nome}`}
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-60"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
