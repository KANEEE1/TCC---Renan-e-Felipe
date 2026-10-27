"use client";

import { useEffect, useRef } from "react";

// Semana no estilo de agenda: colunas por dia, linhas de 30 minutos entre START_HOUR e END_HOUR.
export const DAYS = [
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

const START_HOUR = 0;
const END_HOUR = 24;
// Ao abrir, a grade rola até este horário (como o Google Agenda), sem esconder a madrugada.
const SCROLL_TO_HOUR = 7;
export const SLOT_MINUTES = 30;
export const SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const ROW_HEIGHT = 22;

export interface Interval {
  inicio: string;
  fim: string;
  from: number;
  to: number;
}

export type Grid = boolean[][];

export interface WeekGridEvent {
  day: number;
  from: number;
  to: number;
  title: string;
  subtitle?: string;
  color: string;
}

export function emptyGrid(): Grid {
  return DAYS.map(() => Array<boolean>(SLOTS).fill(false));
}

export function slotToTime(slot: number) {
  const minutes = START_HOUR * 60 + slot * SLOT_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// O banco guarda horário do dia (sem "24:00"): o fim da última meia-hora é gravado como 23:59.
export function slotToApiTime(slot: number) {
  return slot === SLOTS ? "23:59" : slotToTime(slot);
}

export function timeToSlot(time: string) {
  const [h, m] = time.split(":").map(Number);
  return Math.round((h * 60 + m - START_HOUR * 60) / SLOT_MINUTES);
}

// Junta meias-horas marcadas e consecutivas em intervalos (ex.: 08:00–12:00).
export function intervalsOf(column: boolean[]): Interval[] {
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

export function formatHours(slots: number) {
  const minutes = slots * SLOT_MINUTES;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours}h` : `${hours}h30`;
}

interface WeekGridProps {
  value: Grid;
  onChange?: (grid: Grid) => void;
  readOnly?: boolean;
  // Quando informado, a grade mostra estes blocos em vez da seleção (prévia).
  events?: WeekGridEvent[];
  // Falso enquanto os dados carregam: o cabeçalho aparece, o corpo não.
  ready?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function WeekGrid({ value, onChange, readOnly = false, events, ready = true, className = "", children }: WeekGridProps) {
  const editable = !readOnly && !!onChange;
  const drag = useRef<{ day: number; from: number; mode: boolean; base: boolean[] } | null>(null);
  // Registrado no pointerdown: o evento de clique nem sempre informa se veio de toque (Safari antigo).
  const lastPointerType = useRef<string>("mouse");
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledOnce = useRef(false);

  useEffect(() => {
    if (!ready || scrolledOnce.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = SCROLL_TO_HOUR * (60 / SLOT_MINUTES) * ROW_HEIGHT;
    scrolledOnce.current = true;
  }, [ready]);

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
    onChange?.(value.map((col, index) => (index === day ? column : col)));
  };

  // Mouse/caneta: clicar e arrastar na mesma coluna marca (ou desmarca, se começou num horário marcado).
  const handlePointerDown = (event: React.PointerEvent, day: number, slot: number) => {
    lastPointerType.current = event.pointerType;
    if (!editable || event.pointerType === "touch") return;
    event.preventDefault();
    const base = value[day];
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
    if (!editable || lastPointerType.current !== "touch") return;
    paint(day, slot, slot, !value[day][slot], value[day]);
  };

  return (
    <div ref={scrollRef} className={`overflow-y-auto ${className}`} onPointerMove={handlePointerMove}>
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

      {ready && (
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
                    editable ? "cursor-pointer hover:bg-blue-50" : ""
                  }`}
                  style={{ height: ROW_HEIGHT }}
                />
              ))}

              {events
                ? events
                    .filter((event) => event.day === dayIndex)
                    .map((event, index) => (
                      <div
                        key={`${event.from}-${index}`}
                        className="pointer-events-none absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1 py-0.5 text-[10px] leading-tight text-white shadow-sm"
                        style={{
                          top: event.from * ROW_HEIGHT + 1,
                          height: (event.to - event.from) * ROW_HEIGHT - 2,
                          backgroundColor: event.color
                        }}
                      >
                        <span className="block truncate font-semibold">{event.title}</span>
                        {event.subtitle && <span className="block truncate opacity-90">{event.subtitle}</span>}
                      </div>
                    ))
                : intervalsOf(value[dayIndex]).map((interval) => (
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

      {children}
    </div>
  );
}
