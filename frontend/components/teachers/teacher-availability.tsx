"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { currentPeriodoLetivo } from "@/lib/periodo-letivo";
import { api, ApiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import {
  DAYS,
  SLOTS,
  WeekGrid,
  emptyGrid,
  formatHours,
  intervalsOf,
  slotToApiTime,
  timeToSlot,
  type Grid
} from "@/components/schedule/week-grid";

const PERIODO_LETIVO = currentPeriodoLetivo();

interface AvailabilityEntry {
  id: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
  periodoLetivo: string;
}

function toHHMM(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
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

  const handleGridChange = (next: Grid) => {
    setGrid(next);
    setDirty(true);
    setSuccess(false);
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

    const desired = DAYS.flatMap((day, index) =>
      intervalsOf(grid[index]).map((interval) => ({ dia: day.key, inicio: interval.inicio, fim: slotToApiTime(interval.to) }))
    );
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
    <div className="flex h-full flex-col bg-white">
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
            : "Disponibilidade informada pelo professor. Somente ele pode alterá-la."}
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

      <WeekGrid
        value={grid}
        onChange={handleGridChange}
        readOnly={!canEdit}
        ready={loaded}
        className="flex-1 pb-36"
      >
        {!loaded && !error && <p className="py-10 text-center text-sm text-slate-400">Carregando...</p>}
        {error && <p className="px-4 py-3 text-sm text-red-600">{error}</p>}
      </WeekGrid>

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
