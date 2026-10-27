"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";

// Datas "YYYY-MM-DD" são tratadas sem fuso (split), nunca via new Date(string).
export function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatIsoDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatPeriodo(inicio: string, fim: string) {
  return `${formatIsoDate(inicio)} – ${formatIsoDate(fim)}`;
}

function weeksBetween(inicio: string, fim: string) {
  const days = Math.round((parseIsoDate(fim).getTime() - parseIsoDate(inicio).getTime()) / 86400000) + 1;
  return Math.max(1, Math.ceil(days / 7));
}

interface PeriodPickerProps {
  inicio: string | null;
  fim: string | null;
  onChange: (inicio: string | null, fim: string | null) => void;
}

function DateField({
  label,
  value,
  min,
  onChange
}: {
  label: string;
  value: string | null;
  min?: string;
  onChange: (value: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <label
      className="group flex cursor-pointer flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-4 transition-colors focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100 hover:border-teal-300"
      // Abre o seletor nativo ao tocar em qualquer parte do campo (onde o navegador suporta).
      onClick={() => inputRef.current?.showPicker?.()}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        <CalendarDays size={14} className="text-teal-600" />
        {label}
      </span>
      <input
        ref={inputRef}
        type="date"
        lang="pt-BR"
        value={value ?? ""}
        min={min}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full bg-transparent text-lg font-semibold text-slate-800 outline-none [color-scheme:light]"
      />
      <span className="text-xs text-slate-400">{value ? formatIsoDate(value) : "Selecione a data"}</span>
    </label>
  );
}

export function PeriodPicker({ inicio, fim, onChange }: PeriodPickerProps) {
  const invalido = Boolean(inicio && fim && fim < inicio);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <DateField label="Data inicial" value={inicio} onChange={(value) => onChange(value, fim)} />
        <DateField label="Data final" value={fim} min={inicio ?? undefined} onChange={(value) => onChange(inicio, value)} />
      </div>

      {invalido ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">A data final deve ser igual ou posterior à inicial.</p>
      ) : inicio && fim ? (
        <p className="rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
          A grade vale de <strong>{formatPeriodo(inicio, fim)}</strong> · {weeksBetween(inicio, fim)} semanas
        </p>
      ) : (
        <p className="text-sm text-slate-400">Escolha a data inicial e a final da grade.</p>
      )}
    </div>
  );
}
