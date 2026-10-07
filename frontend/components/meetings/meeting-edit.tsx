"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Save, Trash2, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";

const MEETING_TYPES = [
  { value: "aulao", label: "Aulão", backend: "AULAO" },
  { value: "simulado", label: "Simulado", backend: "SIMULADO" },
  { value: "revisao", label: "Revisão", backend: "REVISAO" }
] as const;

type MeetingType = (typeof MEETING_TYPES)[number]["value"];

const AVAILABLE_PARTICIPANTS = ["Ana Silva", "Carlos Santos", "Maria Oliveira", "João Costa", "Pedro Lima", "Direção Escolar", "Equipe Pedagógica", "Todos os alunos"];

const TIMES = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00"
];

interface MeetingDTO {
  titulo: string;
  tipo: "AULAO" | "SIMULADO" | "REVISAO";
  data: string;
  horarioInicio: string;
  horarioFim: string;
  local: string | null;
  descricao: string | null;
  participantes: string[];
}

function toHHMM(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

const EMPTY = { title: "", type: "aulao" as MeetingType, date: "", startTime: "", endTime: "", location: "", description: "", participants: [] as string[] };

export function MeetingEdit({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [formData, setFormData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<MeetingDTO>(`/meetings/${meetingId}`)
      .then((m) => {
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
      .catch(() => setError("Reunião não encontrada."))
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
      await api.put(`/meetings/${meetingId}`, {
        titulo: formData.title,
        tipo: typeEntry.backend,
        data: formData.date,
        horarioInicio: formData.startTime,
        horarioFim: formData.endTime,
        local: formData.location || undefined,
        descricao: formData.description || undefined,
        participantes: formData.participants
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;
    await api.delete(`/meetings/${meetingId}`);
    router.push("/dashboard");
  };

  if (loading) {
    return <div className="flex flex-1 items-center justify-center bg-gray-50 text-gray-400">Carregando...</div>;
  }

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-purple-600 p-4 text-white">
        <Link href="/dashboard" className="mr-3">
          <ArrowLeft size={24} />
        </Link>
        <h1>Editar Evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 pb-32">
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

        <button
          type="button"
          onClick={handleDelete}
          className="mb-4 flex w-full items-center justify-center rounded-lg bg-red-50 py-3 text-red-600 transition-colors hover:bg-red-100"
        >
          <Trash2 size={20} className="mr-2" />
          Excluir Evento
        </button>

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center rounded-lg bg-purple-600 py-3 text-white transition-colors hover:bg-purple-700 disabled:opacity-60"
          >
            <Save size={20} className="mr-2" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
