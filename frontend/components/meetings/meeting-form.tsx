"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Lock, Save, Trash2, User, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { MEETING_TYPES, toHHMM, type MeetingDTO, type MeetingType } from "./meeting-types";

const AVAILABLE_PARTICIPANTS = ["Ana Silva", "Carlos Santos", "Maria Oliveira", "João Costa", "Pedro Lima", "Direção Escolar", "Equipe Pedagógica", "Todos os alunos"];

const TIMES = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00"
];

const EMPTY = { title: "", type: "aulao" as MeetingType, date: "", startTime: "", endTime: "", location: "", description: "", participants: [] as string[] };

export function MeetingForm({ meetingId }: { meetingId?: string }) {
  const router = useRouter();
  const isEdit = !!meetingId;
  const [formData, setFormData] = useState(EMPTY);
  const [meeting, setMeeting] = useState<MeetingDTO | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meetingId) return;
    api
      .get<MeetingDTO>(`/meetings/${meetingId}`)
      .then((m) => {
        setMeeting(m);
        const typeEntry = MEETING_TYPES.find((t) => t.backend === m.tipo);
        setFormData({
          title: m.titulo,
          type: typeEntry?.value ?? "aulao",
          date: m.data.slice(0, 10),
          startTime: toHHMM(m.horarioInicio),
          endTime: toHHMM(m.horarioFim),
          location: m.local ?? "",
          description: m.descricao ?? "",
          participants: m.participantes
        });
      })
      .catch((err) => setError(err instanceof ApiError && err.status === 404 ? "Reunião não encontrada." : "Não foi possível carregar a reunião."))
      .finally(() => setLoading(false));
  }, [meetingId]);

  const toggleParticipant = (participant: string) => {
    setFormData((prev) => ({
      ...prev,
      participants: prev.participants.includes(participant) ? prev.participants.filter((p) => p !== participant) : [...prev.participants, participant]
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const typeEntry = MEETING_TYPES.find((t) => t.value === formData.type)!;
      const payload = {
        titulo: formData.title,
        tipo: typeEntry.backend,
        data: formData.date,
        horarioInicio: formData.startTime,
        horarioFim: formData.endTime,
        local: formData.location || undefined,
        descricao: formData.description || undefined,
        participantes: formData.participants
      };
      if (meetingId) {
        await api.put(`/meetings/${meetingId}`, payload);
      } else {
        await api.post("/meetings", payload);
      }
      router.push("/meetings");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || !confirm("Tem certeza que deseja excluir este evento?")) return;
    setError(null);
    setDeleting(true);
    try {
      await api.delete(`/meetings/${meetingId}`);
      router.push("/meetings");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível excluir.");
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex flex-1 items-center justify-center bg-gray-50 text-gray-400">Carregando...</div>;
  }

  const canEdit = meeting?.permissoes.editar ?? true;
  const canDelete = meeting?.permissoes.excluir ?? false;

  const header = (
    <div className="flex items-center bg-purple-600 p-4 text-white">
      <Link href="/meetings" className="mr-3">
        <ArrowLeft size={24} />
      </Link>
      <h1>{!isEdit ? "Novo Evento" : canEdit ? "Editar Evento" : "Detalhes do Evento"}</h1>
    </div>
  );

  if (isEdit && !meeting) {
    return (
      <div className="flex flex-1 flex-col bg-gray-50">
        {header}
        <p className="p-4 text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      {header}

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 pb-32">
        {meeting && (
          <div className="mb-4 space-y-3">
            <p className="flex items-center text-sm text-gray-500">
              <User size={16} className="mr-2" />
              {meeting.criadoPor ? `Criado por ${meeting.criadoPor.name}` : "Criador não registrado"}
            </p>
            {!canEdit && (
              <div className="flex items-start rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <Lock size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                <span>Somente quem criou o evento ou a gestão pode editá-lo.</span>
              </div>
            )}
          </div>
        )}

        <fieldset disabled={!canEdit} className="min-w-0">
          <div className="mb-4 space-y-4 rounded-lg bg-white p-4 shadow">
            <div>
              <label className="mb-2 block text-gray-700">Título do Evento</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Ex: Aulão de Química"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Tipo de Evento</label>
              <div className="grid grid-cols-3 gap-2">
                {MEETING_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.value })}
                    className={`rounded-lg p-3 text-sm transition-colors ${formData.type === type.value ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-900 hover:bg-gray-200"}`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Data</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-gray-700">Hora Início</label>
                <select
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Selecione</option>
                  {TIMES.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-gray-700">Hora Fim</label>
                <select
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Selecione</option>
                  {TIMES.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Local</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Ex: Sala de Reuniões"
              />
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Descreva os objetivos e conteúdo do evento..."
                rows={4}
              />
            </div>
          </div>

          <div className="mb-4 rounded-lg bg-white p-4 shadow">
            <div className="mb-3 flex items-center">
              <Users className="mr-2 text-purple-600" size={20} />
              <h3 className="text-gray-800">Participantes ({formData.participants.length})</h3>
            </div>

            <div className="space-y-2">
              {AVAILABLE_PARTICIPANTS.map((participant) => (
                <label
                  key={participant}
                  className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                    formData.participants.includes(participant) ? "border-purple-500 bg-purple-50" : "border-gray-300 bg-white hover:bg-gray-50"
                  }`}
                >
                  <input type="checkbox" checked={formData.participants.includes(participant)} onChange={() => toggleParticipant(participant)} className="mr-3" />
                  <span className="text-gray-800">{participant}</span>
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <div className="mb-4 rounded-lg bg-blue-50 p-4">
          <div className="flex items-start">
            <Calendar className="mr-3 mt-1 flex-shrink-0 text-blue-600" size={20} />
            <div>
              <h4 className="text-blue-800">Informações do Evento</h4>
              <div className="mt-2 space-y-1 text-sm text-blue-700">
                <p>Data: {formData.date ? new Date(`${formData.date}T00:00:00`).toLocaleDateString("pt-BR") : "-"}</p>
                <p>
                  Horário: {formData.startTime} - {formData.endTime}
                </p>
                <p>Local: {formData.location || "-"}</p>
                <p>Participantes: {formData.participants.length} pessoa(s)</p>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="mb-4 flex w-full items-center justify-center rounded-lg bg-red-50 py-3 text-red-600 transition-colors hover:bg-red-100 disabled:opacity-60"
          >
            <Trash2 size={20} className="mr-2" />
            {deleting ? "Excluindo..." : "Excluir Evento"}
          </button>
        )}

        {canEdit && (
          <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center rounded-lg bg-purple-600 py-3 text-white transition-colors hover:bg-purple-700 disabled:opacity-60"
            >
              <Save size={20} className="mr-2" />
              {saving ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Evento"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
