"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, GraduationCap, MapPin, Search, Users, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { EVENT_TYPES, toHHMM, type EventType, type MeetingDTO } from "@/components/meetings/meeting-types";

interface Option {
  id: string;
  name: string;
}

interface ClassOption {
  id: string;
  nome: string;
}

interface Props {
  // Em modo edição, o evento existente; sem ele, cria um novo.
  event?: MeetingDTO | null;
  // Data inicial ao criar (o dia em foco na agenda).
  defaultDate: Date;
  onClose: () => void;
  onSaved: () => void;
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function EventDialog({ event, defaultDate, onClose, onSaved }: Props) {
  const isEdit = !!event;

  const [title, setTitle] = useState(event?.titulo ?? "");
  const [type, setType] = useState<EventType>(event?.tipo ?? "REUNIAO");
  const [date, setDate] = useState(event ? event.data.slice(0, 10) : toDateInput(defaultDate));
  // Padrão: próximo horário cheio, com 1h de duração.
  const nextHour = Math.min(new Date().getHours() + 1, 22);
  const [startTime, setStartTime] = useState(event ? toHHMM(event.horarioInicio) : `${pad(nextHour)}:00`);
  const [endTime, setEndTime] = useState(event ? toHHMM(event.horarioFim) : `${pad(nextHour + 1)}:00`);
  const [location, setLocation] = useState(event?.local ?? "");
  const [participantIds, setParticipantIds] = useState<string[]>(event?.participantes.map((p) => p.userId) ?? []);
  const [classIds, setClassIds] = useState<string[]>(event?.turmas.map((t) => t.id) ?? []);

  const [users, setUsers] = useState<Option[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Option[]>("/meetings/participant-options").then(setUsers).catch(() => setError("Não foi possível carregar os professores."));
    api.get<ClassOption[]>("/classes").then(setClasses).catch(() => setError("Não foi possível carregar as turmas."));
  }, []);

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? event?.participantes.find((p) => p.userId === id)?.name ?? "...";
  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => !participantIds.includes(u.id) && u.name.toLowerCase().includes(term)).slice(0, 6);
  }, [users, participantIds, search]);

  const toggleClass = (id: string) => setClassIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const handleSave = async () => {
    if (saving) return;
    if (!title.trim()) return setError("Informe um título.");
    if (!date) return setError("Informe a data.");
    if (!startTime || !endTime || endTime <= startTime) return setError("O horário de término deve ser depois do início.");

    setError(null);
    setSaving(true);
    try {
      const payload = {
        titulo: title.trim(),
        tipo: type,
        data: date,
        horarioInicio: startTime,
        horarioFim: endTime,
        local: location.trim() || undefined,
        participanteIds: participantIds,
        turmaIds: classIds
      };
      if (event) await api.put(`/meetings/${event.id}`, payload);
      else await api.post("/meetings", payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar o evento.");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || deleting || !confirm("Tem certeza que deseja excluir este evento?")) return;
    setError(null);
    setDeleting(true);
    try {
      await api.delete(`/meetings/${event.id}`);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível excluir o evento.");
      setDeleting(false);
    }
  };

  const inputClass = "rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Editar evento" : "Novo evento"}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end px-3 pt-3">
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 pb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Adicionar título"
            autoFocus
            className="w-full border-0 border-b border-slate-200 pb-2 text-2xl text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
          />

          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${type === t.value ? t.chipActive : t.chip}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Clock size={18} className="shrink-0 text-slate-400" />
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" className={inputClass} />
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="Início" className={inputClass} />
              <span className="text-slate-400">–</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="Fim" className={inputClass} />
            </div>
          </div>

          <div className="flex items-start gap-4">
            <Users size={18} className="mt-2.5 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              {participantIds.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {participantIds.map((id) => (
                    <span key={id} className="flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-3 pr-1.5 text-xs text-blue-700">
                      {userName(id)}
                      <button
                        type="button"
                        onClick={() => setParticipantIds((prev) => prev.filter((p) => p !== id))}
                        aria-label={`Remover ${userName(id)}`}
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
                  placeholder="Adicionar professores"
                  className={`${inputClass} w-full pl-9`}
                />
              </div>
              {search.trim() && (
                <ul className="mt-1 overflow-hidden rounded-lg border border-slate-200">
                  {suggestions.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Ninguém encontrado.</li>}
                  {suggestions.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setParticipantIds((prev) => [...prev, u.id]);
                          setSearch("");
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {u.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex items-start gap-4">
            <GraduationCap size={18} className="mt-1.5 shrink-0 text-slate-400" />
            <div className="flex flex-1 flex-wrap gap-1.5">
              {classes.length === 0 && <span className="py-1 text-sm text-slate-400">Turmas (opcional)</span>}
              {classes.map((c) => {
                const active = classIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleClass(c.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {c.nome}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <MapPin size={18} className="shrink-0 text-slate-400" />
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Adicionar local" className={`${inputClass} flex-1`} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 px-6 py-4">
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || deleting}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
