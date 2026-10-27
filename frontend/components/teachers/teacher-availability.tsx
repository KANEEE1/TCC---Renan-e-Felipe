"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { currentPeriodoLetivo } from "@/lib/periodo-letivo";
import { api, ApiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

// Semana no estilo de agenda: colunas por dia, linhas de 30 minutos entre START_HOUR e END_HOUR.
const DAYS = [
  { key: "SEGUNDA", short: "SEG" },
  { key: "TERCA", short: "TER" },
  { key: "QUARTA", short: "QUA" },
  { key: "QUINTA", short: "QUI" },
  { key: "SEXTA", short: "SEX" },
  { key: "SABADO", short: "SÁB" },
  { key: "DOMINGO", short: "DOM" }
];
// Date.getDay(): 0 = domingo.
const TODAY_INDEX = (new Date().getDay() + 6) % 7;

const START_HOUR = 6;
const END_HOUR = 23;
const SLOT_MINUTES = 30;
const SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const ROW_HEIGHT = 22;

const PERIODO_LETIVO = currentPeriodoLetivo();

interface AvailabilityEntry {
  id: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
  periodoLetivo: string;
}

interface Interval {
  inicio: string;
  fim: string;
  from: number;
  to: number;
}

type Grid = boolean[][];

function emptyGrid(): Grid {
  return DAYS.map(() => Array<boolean>(SLOTS).fill(false));
}

function toHHMM(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

function slotToTime(slot: number) {
  const minutes = START_HOUR * 60 + slot * SLOT_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function timeToSlot(time: string) {
  const [h, m] = time.split(":").map(Number);
  return Math.round((h * 60 + m - START_HOUR * 60) / SLOT_MINUTES);
}

// Junta meias-horas marcadas e consecutivas em intervalos (ex.: 08:00–12:00).
function intervalsOf(column: boolean[]): Interval[] {
  const result: Interval[] = [];
  let from = -1;
  for (let i = 0; i <= column.length; i++) {
    if (i < column.length && column[i]) {
      if (from === -1) from = i;
    } else if (from !== -1) {
      result.push({ from, to: i, inicio: slotToTime(from), fim: slotToTime(i) });
      from = -1;
    }
  }
  return result;
}

function formatHours(slots: number) {
  const minutes = slots * SLOT_MINUTES;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours}h` : `${hours}h30`;
}

export function TeacherAvailability({ teacherId }: { teacherId: string }) {
  const [teacherName, setTeacherName] = useState("");
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Só o próprio professor edita; os demais (inclusive a gestão) apenas consultam.
  const [canEdit, setCanEdit] = useState(false);

  const drag = useRef<{ day: number; from: number; mode: boolean; base: boolean[] } | null>(null);
  // Registrado no pointerdown: o evento de clique nem sempre informa se veio de toque (Safari antigo).
  const lastPointerType = useRef<string>("mouse");

  const load = useCallback(() => {
    api
      .get<AvailabilityEntry[]>(`/teachers/${teacherId}/availability`)
      .then((all) => {
        const current = all.filter((entry) => entry.periodoLetivo === PERIODO_LETIVO);
        const next = emptyGrid();
        for (const entry of current) {
          const day = DAYS.findIndex((d) => d.key === entry.diaSemana);
          if (day === -1) continue;
          const from = Math.max(0, timeToSlot(toHHMM(entry.horarioInicio)));
          const to = Math.min(SLOTS, timeToSlot(toHHMM(entry.horarioFim)));
          for (let i = from; i < to; i++) next[day][i] = true;
        }
        setEntries(current);
        setGrid(next);
        setDirty(false);
        setLoaded(true);
      })
      .catch(() => setError("Não foi possível carregar a disponibilidade."));
  }, [teacherId]);

  useEffect(() => {
    setCanEdit(getSessionUser()?.id === teacherId);
    api.get<{ name: string }>(`/teachers/${teacherId}`).then((t) => setTeacherName(t.name)).catch(() => {});
    load();
  }, [teacherId, load]);

  useEffect(() => {
    const stop = () => {
      drag.current = null;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const paint = (day: number, from: number, to: number, mode: boolean, base: boolean[]) => {
    const column = [...base];
    for (let i = Math.min(from, to); i <= Math.max(from, to); i++) column[i] = mode;
    setGrid((prev) => prev.map((col, index) => (index === day ? column : col)));
    setDirty(true);
    setSuccess(false);
  };

  // Mouse/caneta: clicar e arrastar na mesma coluna marca (ou desmarca, se começou num horário marcado).
  const handlePointerDown = (event: React.PointerEvent, day: number, slot: number) => {
    lastPointerType.current = event.pointerType;
    if (!canEdit || event.pointerType === "touch") return;
    event.preventDefault();
    const base = grid[day];
    drag.current = { day, from: slot, mode: !base[slot], base };
    paint(day, slot, slot, !base[slot], base);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const cell = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>(
      "[data-slot]"
    );
    if (!cell || Number(cell.dataset.day) !== current.day) return;
    paint(current.day, current.from, Number(cell.dataset.slot), current.mode, current.base);
  };

  // Toque: cada toque alterna meia hora, para não atrapalhar a rolagem da tela.
  const handleTap = (day: number, slot: number) => {
    if (!canEdit || lastPointerType.current !== "touch") return;
    paint(day, slot, slot, !grid[day][slot], grid[day]);
  };

  const clearAll = () => {
    setGrid(emptyGrid());
    setDirty(true);
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const desired = DAYS.flatMap((day, index) => intervalsOf(grid[index]).map((interval) => ({ dia: day.key, ...interval })));
    const sameInterval = (entry: AvailabilityEntry, item: (typeof desired)[number]) =>
      entry.diaSemana === item.dia && toHHMM(entry.horarioInicio) === item.inicio && toHHMM(entry.horarioFim) === item.fim;

    const toRemove = entries.filter((entry) => !desired.some((item) => sameInterval(entry, item)));
    const toCreate = desired.filter((item) => !entries.some((entry) => sameInterval(entry, item)));

    try {
      for (const entry of toRemove) {
        await api.delete(`/teachers/${teacherId}/availability/${entry.id}`);
      }
      for (const item of toCreate) {
        await api.post(`/teachers/${teacherId}/availability`, {
          diaSemana: item.dia,
          horarioInicio: item.inicio,
          horarioFim: item.fim,
          periodoLetivo: PERIODO_LETIVO
        });
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
      // Recarrega para refletir exatamente o que ficou gravado, inclusive após falha parcial.
      load();
    }
  };

  const totalSlots = grid.reduce((sum, column) => sum + column.filter(Boolean).length, 0);

  return (
    <div className="flex flex-1 flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <Link href="/teachers" aria-label="Voltar" className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100">
          <ArrowLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg text-slate-800">Disponibilidade</h1>
          <p className="truncate text-xs text-slate-500">
            {teacherName ? `${teacherName} · ` : ""}Semestre {PERIODO_LETIVO}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-blue-600">{formatHours(totalSlots)}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">por semana</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs text-slate-500">
        <p>
          {canEdit
            ? "Arraste (ou toque) para marcar os horários em que você pode dar aula. Toque num horário marcado para desmarcar."
            : "Somente o próprio professor pode alterar a disponibilidade."}
        </p>
        {canEdit && totalSlots > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-red-600"
          >
            <Trash2 size={14} /> Limpar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-36" onPointerMove={handlePointerMove}>
        <div className="sticky top-0 z-20 grid grid-cols-[44px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-white">
          <div />
          {DAYS.map((day, index) => (
            <div key={day.key} className="py-2 text-center">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  index === TODAY_INDEX ? "bg-blue-600 text-white" : "text-slate-500"
                }`}
              >
                {day.short}
              </span>
            </div>
          ))}
        </div>

        {!loaded && !error && <p className="py-10 text-center text-sm text-slate-400">Carregando...</p>}

        {loaded && (
          <div className="grid select-none grid-cols-[44px_repeat(7,minmax(0,1fr))]" style={{ touchAction: "pan-y" }}>
            <div className="relative">
              {Array.from({ length: SLOTS }, (_, slot) =>
                slot % 2 === 0 ? (
                  <div key={slot} className="relative" style={{ height: ROW_HEIGHT * 2 }}>
                    <span className="absolute -top-2 right-1.5 text-[10px] text-slate-400">{slotToTime(slot)}</span>
                  </div>
                ) : null
              )}
            </div>

            {DAYS.map((day, dayIndex) => (
              <div key={day.key} className="relative border-l border-slate-200">
                {Array.from({ length: SLOTS }, (_, slot) => (
                  <div
                    key={slot}
                    data-day={dayIndex}
                    data-slot={slot}
                    onPointerDown={(event) => handlePointerDown(event, dayIndex, slot)}
                    onClick={() => handleTap(dayIndex, slot)}
                    className={`${slot % 2 === 0 ? "border-t border-slate-200" : "border-t border-dashed border-slate-100"} ${
                      canEdit ? "cursor-pointer hover:bg-blue-50" : ""
                    }`}
                    style={{ height: ROW_HEIGHT }}
                  />
                ))}

                {intervalsOf(grid[dayIndex]).map((interval) => (
                  <div
                    key={interval.from}
                    className="pointer-events-none absolute left-0.5 right-0.5 overflow-hidden rounded-md bg-blue-600 px-1 py-0.5 text-[10px] leading-tight text-white shadow-sm"
                    style={{ top: interval.from * ROW_HEIGHT + 1, height: (interval.to - interval.from) * ROW_HEIGHT - 2 }}
                  >
                    <span className="block font-medium">{interval.inicio}</span>
                    {interval.to - interval.from > 1 && <span className="block opacity-90">{interval.fim}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {error && <p className="px-4 py-3 text-sm text-red-600">{error}</p>}
      </div>

      {canEdit && (
        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          {success && !dirty && <p className="mb-2 text-center text-sm text-emerald-600">Disponibilidade salva.</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex w-full items-center justify-center rounded-full bg-blue-600 py-3 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={20} className="mr-2" />
            {saving ? "Salvando..." : dirty ? "Salvar disponibilidade" : "Nenhuma alteração"}
          </button>
        </div>
      )}
    </div>
  );
}
