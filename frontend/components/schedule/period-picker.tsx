"use client";

import { useEffect, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import "react-day-picker/style.css";

// Datas "YYYY-MM-DD" são tratadas sem fuso (split), nunca via new Date(string).
export function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

export function PeriodPicker({ inicio, fim, onChange }: PeriodPickerProps) {
  const [months, setMonths] = useState(1);
  const year = new Date().getFullYear();

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setMonths(query.matches ? 2 : 1);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const shortcuts = [
    { label: "1º semestre", from: `${year}-01-01`, to: `${year}-06-30` },
    { label: "2º semestre", from: `${year}-07-01`, to: `${year}-12-31` },
    { label: "Ano inteiro", from: `${year}-01-01`, to: `${year}-12-31` }
  ];

  const selected: DateRange | undefined = inicio
    ? { from: parseIsoDate(inicio), to: fim ? parseIsoDate(fim) : undefined }
    : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {shortcuts.map((s) => {
          const active = inicio === s.from && fim === s.to;
          return (
            <button
              key={s.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(s.from, s.to)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-teal-400"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-center overflow-x-auto [--rdp-accent-background-color:#ccfbf1] [--rdp-accent-color:#0d9488] [--rdp-range_middle-color:#134e4a] [--rdp-selected-border:2px_solid_#0d9488]">
        <DayPicker
          mode="range"
          locale={ptBR}
          numberOfMonths={months}
          defaultMonth={inicio ? parseIsoDate(inicio) : new Date()}
          selected={selected}
          onSelect={(range) => onChange(range?.from ? toIsoDate(range.from) : null, range?.to ? toIsoDate(range.to) : null)}
        />
      </div>

      <p className="text-center text-sm text-gray-600">
        {inicio && fim ? (
          <>
            <strong className="text-teal-700">{formatPeriodo(inicio, fim)}</strong> · {weeksBetween(inicio, fim)} semana
            {weeksBetween(inicio, fim) !== 1 ? "s" : ""}
          </>
        ) : (
          "Selecione a data de início e a de fim."
        )}
      </p>
    </div>
  );
}
