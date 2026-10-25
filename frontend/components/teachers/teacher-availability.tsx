"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Save } from "lucide-react";
import { currentPeriodoLetivo } from "@/lib/periodo-letivo";
import { api, ApiError } from "@/lib/api";

const TIME_SLOTS = [
  "07:00 - 08:00",
  "08:00 - 09:00",
  "09:00 - 10:00",
  "10:00 - 11:00",
  "11:00 - 12:00",
  "13:00 - 14:00",
  "14:00 - 15:00",
  "15:00 - 16:00",
  "16:00 - 17:00",
  "17:00 - 18:00"
];

const WEEK_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

const DIA_SEMANA: Record<string, string> = {
  Segunda: "SEGUNDA",
  "Terça": "TERCA",
  Quarta: "QUARTA",
  Quinta: "QUINTA",
  Sexta: "SEXTA"
};

const PERIODO_LETIVO = currentPeriodoLetivo();

interface AvailabilityEntry {
  id: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
}

function toHHMM(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

function slotKey(day: string, time: string) {
  return `${day}|${time}`;
}

function parseSlotKey(key: string) {
  const [day, time] = key.split("|");
  const [horarioInicio, horarioFim] = time.split(" - ");
  return { day, horarioInicio, horarioFim };
}

export function TeacherAvailability({ teacherId }: { teacherId: string }) {
  const [teacherName, setTeacherName] = useState("");
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get<{ name: string }>(`/teachers/${teacherId}`).then((t) => setTeacherName(t.name));
    api.get<AvailabilityEntry[]>(`/teachers/${teacherId}/availability`).then((entries) => {
      const next: Record<string, boolean> = {};
      const savedSlots = new Map<string, string>();
      for (const entry of entries) {
        const day = Object.keys(DIA_SEMANA).find((d) => DIA_SEMANA[d] === entry.diaSemana);
        if (!day) continue;
        const key = slotKey(day, `${toHHMM(entry.horarioInicio)} - ${toHHMM(entry.horarioFim)}`);
        next[key] = true;
        savedSlots.set(key, entry.id);
      }
      setAvailability(next);
      setSaved(savedSlots);
    });
  }, [teacherId]);

  const toggleSlot = (day: string, time: string) => {
    const key = slotKey(day, time);
    setSuccess(false);
    setAvailability((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const toCreate = Object.entries(availability)
      .filter(([key, isOn]) => isOn && !saved.has(key))
      .map(([key]) => key);
    const toRemove = [...saved.entries()].filter(([key]) => !availability[key]);
    const nextSaved = new Map(saved);

    try {
      for (const [key, id] of toRemove) {
        await api.delete(`/teachers/${teacherId}/availability/${id}`);
        nextSaved.delete(key);
      }
      for (const key of toCreate) {
        const { day, horarioInicio, horarioFim } = parseSlotKey(key);
        const created = await api.post<AvailabilityEntry>(`/teachers/${teacherId}/availability`, {
          diaSemana: DIA_SEMANA[day],
          horarioInicio,
          horarioFim,
          periodoLetivo: PERIODO_LETIVO
        });
        nextSaved.set(key, created.id);
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaved(nextSaved);
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-purple-600 p-4 text-white">
        <Link href="/teachers" className="mr-3">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1>Disponibilidade</h1>
          <p className="text-sm text-purple-100">{teacherName}</p>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 pb-32">
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="mb-4 text-sm text-gray-600">Selecione os horários disponíveis para o professor</p>

          <div className="min-w-max">
            <div className="mb-2 grid grid-cols-6 gap-2">
              <div className="w-24" />
              {WEEK_DAYS.map((day) => (
                <div key={day} className="p-2 text-center text-gray-700">
                  {day}
                </div>
              ))}
            </div>

            {TIME_SLOTS.map((time) => (
              <div key={time} className="mb-2 grid grid-cols-6 gap-2">
                <div className="flex w-24 items-center text-sm text-gray-600">{time}</div>
                {WEEK_DAYS.map((day) => {
                  const key = slotKey(day, time);
                  const isAvailable = availability[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSlot(day, time)}
                      className={`rounded-lg p-3 transition-all ${
                        isAvailable ? "bg-green-500 text-white" : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      {isAvailable && <Check size={20} className="mx-auto" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-blue-50 p-4">
          <h3 className="mb-2 text-blue-800">Legenda</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="mr-2 h-4 w-4 rounded bg-green-500" />
              <span className="text-sm text-gray-700">Disponível</span>
            </div>
            <div className="flex items-center">
              <div className="mr-2 h-4 w-4 rounded border border-gray-300 bg-gray-100" />
              <span className="text-sm text-gray-700">Indisponível</span>
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-3 text-sm text-green-700">Disponibilidade salva.</p>}
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex w-full items-center justify-center rounded-lg bg-purple-600 py-3 text-white transition-colors hover:bg-purple-700 disabled:opacity-60"
        >
          <Save size={20} className="mr-2" />
          {saving ? "Salvando..." : "Salvar Disponibilidade"}
        </button>
      </div>
    </div>
  );
}
