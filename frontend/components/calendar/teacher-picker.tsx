"use client";

import { useMemo, useState } from "react";
import { Check, Search, Sparkles, X } from "lucide-react";

export interface PickerTeacher {
  id: string;
  name: string;
  ativo: boolean;
  disciplinas: { id: string; nome: string }[];
}

interface Props {
  teachers: PickerTeacher[];
  // Matéria da aula/aulão; sem ela (reunião, simulado) há uma lista única, sem recomendações.
  subject?: { id: string; nome: string } | null;
  mode: "single" | "multiple";
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  // professorId -> motivo pelo qual não deveria ser escolhido (recusou, indisponível na data).
  unavailable?: Record<string, string>;
  // Pessoas que não são professores (ex.: gestão) mas podem ser convidadas; só no modo "multiple".
  extraPeople?: { id: string; name: string }[];
  // Nomes de selecionados que não estão em nenhuma lista (ex.: participante já salvo).
  nameFallback?: (id: string) => string | undefined;
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-800",
  "bg-cyan-100 text-cyan-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-lime-100 text-lime-800"
];

function colorOf(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

interface Row {
  id: string;
  name: string;
  teaches: boolean;
  inactive: boolean;
  reason?: string;
}

export function TeacherPicker({ teachers, subject, mode, selectedIds, onChange, unavailable = {}, extraPeople = [], nameFallback }: Props) {
  const [search, setSearch] = useState("");
  const multiple = mode === "multiple";

  const { recommended, others } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows: Row[] = [];
    for (const t of teachers) {
      if (!t.ativo && !selectedIds.includes(t.id)) continue;
      rows.push({
        id: t.id,
        name: t.name,
        teaches: !!subject && t.ativo && t.disciplinas.some((d) => d.id === subject.id),
        inactive: !t.ativo,
        reason: unavailable[t.id]
      });
    }
    const teacherIds = new Set(teachers.map((t) => t.id));
    for (const p of extraPeople) {
      if (!teacherIds.has(p.id)) rows.push({ id: p.id, name: p.name, teaches: false, inactive: false, reason: unavailable[p.id] });
    }
    const visible = rows.filter((r) => r.name.toLowerCase().includes(term)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return {
      recommended: visible.filter((r) => r.teaches && !r.reason),
      others: visible.filter((r) => !(r.teaches && !r.reason))
    };
  }, [teachers, extraPeople, subject, unavailable, selectedIds, search]);

  const toggle = (id: string) => {
    if (multiple) onChange(selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]);
    else onChange([id]);
  };

  const nameOf = (id: string) =>
    teachers.find((t) => t.id === id)?.name ?? extraPeople.find((p) => p.id === id)?.name ?? nameFallback?.(id) ?? "...";

  const renderRow = (r: Row) => {
    const selected = selectedIds.includes(r.id);
    return (
      <li key={r.id} role="option" aria-selected={selected}>
        <button
          type="button"
          onClick={() => toggle(r.id)}
          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
            selected ? "border-blue-300 bg-blue-50" : "border-transparent hover:bg-slate-50"
          } ${r.reason && !selected ? "opacity-70" : ""}`}
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${colorOf(r.id)}`}>{initialsOf(r.name)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-slate-800">{r.name}</span>
            <span className="mt-0.5 flex flex-wrap gap-1">
              {r.teaches && subject && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">Leciona {subject.nome}</span>
              )}
              {r.reason && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">{r.reason}</span>}
              {r.inactive && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Inativo</span>}
            </span>
          </span>
          {multiple ? (
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
              }`}
            >
              {selected && <Check size={14} />}
            </span>
          ) : (
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-blue-600" : "border-slate-300"}`}>
              {selected && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
            </span>
          )}
        </button>
      </li>
    );
  };

  const heading = "px-1 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-slate-500";

  return (
    <div className="min-w-0 flex-1">
      {multiple && selectedIds.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedIds.map((id) => (
            <span key={id} className="flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-3 pr-1.5 text-xs text-blue-700">
              {nameOf(id)}
              <button
                type="button"
                onClick={() => onChange(selectedIds.filter((s) => s !== id))}
                aria-label={`Remover ${nameOf(id)}`}
                className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-blue-100"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar professor"
          aria-label="Buscar professor"
          className="w-full rounded-lg bg-slate-100 py-2 pl-9 pr-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div role="listbox" aria-label="Professores" aria-multiselectable={multiple} className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
        {subject && (
          <section>
            <h3 className={`${heading} flex items-center gap-1 text-emerald-700`}>
              <Sparkles size={12} /> Recomendados
              <span className="font-normal normal-case tracking-normal text-slate-400">· Lecionam {subject.nome}</span>
            </h3>
            {recommended.length === 0 ? (
              <p className="px-2 py-2 text-sm text-slate-400">
                {search.trim() ? "Nenhum recomendado encontrado." : `Nenhum professor disponível leciona ${subject.nome}.`}
              </p>
            ) : (
              <ul className="space-y-0.5">{recommended.map(renderRow)}</ul>
            )}
          </section>
        )}
        <section>
          {subject && <h3 className={heading}>Outros professores</h3>}
          {others.length === 0 ? (
            <p className="px-2 py-2 text-sm text-slate-400">Ninguém encontrado.</p>
          ) : (
            <ul className="space-y-0.5">{others.map(renderRow)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}
