"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, GraduationCap, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { EventDialog } from "@/components/calendar/event-dialog";
import { eventTypeOf, STATUS_COLORS, STATUS_LABELS, toHHMM, type MeetingDTO } from "./meeting-types";

function formatDate(data: string) {
  return new Date(`${data.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");
}

// As rotas /meetings/add e /meetings/edit/[id] renderizam esta lista com o diálogo já aberto.
export function MeetingList({ initialMode, editId }: { initialMode?: "add" | "edit"; editId?: string }) {
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManagement, setIsManagement] = useState(false);
  const [dialog, setDialog] = useState<{ event: MeetingDTO | null } | null>(initialMode === "add" ? { event: null } : null);
  const [opened, setOpened] = useState(false);

  const load = useCallback(
    () =>
      api
        .get<MeetingDTO[]>("/meetings")
        .then(setMeetings)
        .catch(() => setError("Não foi possível carregar os eventos."))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
    const user = getSessionUser();
    setIsManagement(!!user && user.roles.includes("GESTAO"));
  }, [load]);

  useEffect(() => {
    if (initialMode !== "edit" || opened || loading) return;
    const found = meetings.find((m) => m.id === editId);
    if (found) setDialog({ event: found });
    setOpened(true);
  }, [initialMode, editId, meetings, loading, opened]);

  const closeDialog = () => {
    setDialog(null);
    if (initialMode) router.replace("/meetings");
  };

  const respond = async (id: string, status: "CONFIRMADO" | "RECUSADO") => {
    try {
      await api.put(`/meetings/${id}/rsvp`, { status });
      await load();
    } catch {
      setError("Não foi possível registrar sua resposta.");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;
    try {
      await api.delete(`/meetings/${id}`);
      await load();
    } catch {
      setError("Não foi possível excluir o evento.");
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 px-5 pb-7 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white">Eventos</h1>
            <p className="mt-0.5 text-sm text-purple-200">Reuniões, simulados, aulões e aulas</p>
          </div>
          {isManagement && (
            <button
              type="button"
              onClick={() => setDialog({ event: null })}
              aria-label="Novo evento"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm transition-colors hover:bg-purple-50"
            >
              <Plus size={20} className="text-purple-600" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-6 pt-4">
        {loading && <p className="text-center text-sm text-slate-400">Carregando...</p>}

        {!loading && error && <p className="text-center text-sm text-red-600">{error}</p>}

        {!loading && !error && meetings.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
            Nenhum evento cadastrado.
          </p>
        )}

        {meetings.map((meeting) => {
          const type = eventTypeOf(meeting.tipo);
          return (
            <div key={meeting.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="min-w-0 flex-1 truncate text-slate-800">{meeting.titulo}</h3>
                <span className={`shrink-0 rounded-full border-l-4 px-2 py-0.5 text-xs ${type.block}`}>{type.label}</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> {formatDate(meeting.data)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {toHHMM(meeting.horarioInicio)}–{toHHMM(meeting.horarioFim)}
                </span>
                {meeting.local && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} /> {meeting.local}
                  </span>
                )}
                {meeting.turmas.length > 0 && (
                  <span className="flex items-center gap-1">
                    <GraduationCap size={12} /> {meeting.turmas.map((t) => t.nome).join(", ")}
                  </span>
                )}
                {meeting.meuStatus && (
                  <span className={`rounded-full px-2 py-0.5 ${STATUS_COLORS[meeting.meuStatus]}`}>Minha presença: {STATUS_LABELS[meeting.meuStatus]}</span>
                )}
              </div>

              {(meeting.permissoes.responder || meeting.permissoes.editar) && (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  {meeting.permissoes.responder && (
                    <>
                      <button
                        type="button"
                        onClick={() => respond(meeting.id, "CONFIRMADO")}
                        className={`rounded-full px-4 py-1.5 text-xs ${meeting.meuStatus === "CONFIRMADO" ? "bg-green-600 text-white" : "bg-green-50 text-green-700 hover:bg-green-100"}`}
                      >
                        Vou
                      </button>
                      <button
                        type="button"
                        onClick={() => respond(meeting.id, "RECUSADO")}
                        className={`rounded-full px-4 py-1.5 text-xs ${meeting.meuStatus === "RECUSADO" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"}`}
                      >
                        Não vou
                      </button>
                    </>
                  )}
                  {meeting.permissoes.editar && (
                    <>
                      <button
                        type="button"
                        onClick={() => setDialog({ event: meeting })}
                        aria-label="Editar evento"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(meeting.id)}
                        aria-label="Excluir evento"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dialog && (
        <EventDialog
          event={dialog.event}
          defaultDate={new Date()}
          onClose={closeDialog}
          onSaved={() => {
            closeDialog();
            load();
          }}
        />
      )}
    </div>
  );
}
