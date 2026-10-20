export const MEETING_TYPES = [
  { value: "aulao", label: "Aulão", backend: "AULAO" },
  { value: "simulado", label: "Simulado", backend: "SIMULADO" },
  { value: "revisao", label: "Revisão", backend: "REVISAO" }
] as const;

export type MeetingType = (typeof MEETING_TYPES)[number]["value"];

export type ParticipationStatus = "PENDENTE" | "CONFIRMADO" | "RECUSADO";

export const STATUS_LABELS: Record<ParticipationStatus, string> = {
  PENDENTE: "Pendente",
  CONFIRMADO: "Confirmado",
  RECUSADO: "Recusado"
};

export const STATUS_COLORS: Record<ParticipationStatus, string> = {
  PENDENTE: "bg-slate-100 text-slate-600",
  CONFIRMADO: "bg-green-100 text-green-700",
  RECUSADO: "bg-red-100 text-red-700"
};

export interface MeetingDTO {
  id: string;
  titulo: string;
  tipo: "AULAO" | "SIMULADO" | "REVISAO";
  data: string;
  horarioInicio: string;
  horarioFim: string;
  local: string | null;
  descricao: string | null;
  participantes: { userId: string; name: string; status: ParticipationStatus }[];
  meuStatus: ParticipationStatus | null;
  criadoPorId: string | null;
  criadoPor: { id: string; name: string } | null;
  permissoes: { editar: boolean; excluir: boolean; responder: boolean };
}

export function toHHMM(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}
