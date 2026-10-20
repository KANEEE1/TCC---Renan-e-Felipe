"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Clock, Lock, MapPin, Plus, User } from "lucide-react";
import { api } from "@/lib/api";
import { MEETING_TYPES, toHHMM, type MeetingDTO } from "./meeting-types";

const TYPE_COLORS: Record<MeetingDTO["tipo"], string> = {
  AULAO: "bg-purple-50 text-purple-700 border-purple-200",
  SIMULADO: "bg-orange-50 text-orange-600 border-orange-200",
  REVISAO: "bg-blue-50 text-blue-700 border-blue-200"
};

function formatDate(data: string) {
  return new Date(`${data.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");
}

export function MeetingList() {
  const [meetings, setMeetings] = useState<MeetingDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<MeetingDTO[]>("/meetings")
      .then(setMeetings)
      .catch(() => setError("Não foi possível carregar as reuniões."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 px-5 pb-7 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white">Reuniões e Eventos</h1>
            <p className="mt-0.5 text-sm text-purple-200">Aulões, simulados e revisões</p>
          </div>
          <Link
            href="/meetings/add"
            aria-label="Nova reunião"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm transition-colors hover:bg-purple-50"
          >
            <Plus size={20} className="text-purple-600" />
          </Link>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-6 pt-4">
        {loading && <p className="text-center text-sm text-slate-400">Carregando...</p>}

        {!loading && error && <p className="text-center text-sm text-red-600">{error}</p>}

        {!loading && !error && meetings.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
            Nenhuma reunião ou evento cadastrado.
          </p>
        )}

        {meetings.map((meeting) => (
          <Link
            key={meeting.id}
            href={`/meetings/edit/${meeting.id}`}
            className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="min-w-0 flex-1 truncate text-slate-800">{meeting.titulo}</h3>
              <div className="flex shrink-0 items-center gap-2">
                {!meeting.permissoes.editar && (
                  <span title="Somente leitura" aria-label="Somente leitura" role="img">
                    <Lock size={14} className="text-slate-400" />
                  </span>
                )}
                <span className={`rounded-full border px-2 py-0.5 text-xs ${TYPE_COLORS[meeting.tipo]}`}>
                  {MEETING_TYPES.find((t) => t.backend === meeting.tipo)?.label ?? meeting.tipo}
                </span>
              </div>
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
              {meeting.criadoPor && (
                <span className="flex items-center gap-1">
                  <User size={12} /> por {meeting.criadoPor.name}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
