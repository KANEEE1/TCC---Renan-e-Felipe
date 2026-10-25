export const MEETING_TYPES = [
  { value: "aulao", label: "Aulão", backend: "AULAO" },
  { value: "simulado", label: "Simulado", backend: "SIMULADO" },
  { value: "revisao", label: "Revisão", backend: "REVISAO" }
] as const;

export type MeetingType = (typeof MEETING_TYPES)[number]["value"];

export interface MeetingDTO {
  id: string;
  titulo: string;
  tipo: "AULAO" | "SIMULADO" | "REVISAO";
  data: string;
  horarioInicio: string;
  horarioFim: string;
  local: string | null;
  descricao: string | null;
  participantes: string[];
  criadoPorId: string | null;
  criadoPor: { id: string; name: string } | null;
  permissoes: { editar: boolean; excluir: boolean };
}

export function toHHMM(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}
