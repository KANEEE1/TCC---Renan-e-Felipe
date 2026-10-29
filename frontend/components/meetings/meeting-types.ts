export type EventType = "REUNIAO" | "SIMULADO" | "AULAO" | "AULA";

// Paleta própria dos tipos de evento (tons claros com borda), distinta das cores sólidas das disciplinas.
// As classes ficam por extenso para o Tailwind enxergá-las.
export const EVENT_TYPES: {
  value: EventType;
  label: string;
  block: string;
  chip: string;
  chipActive: string;
  dot: string;
}[] = [
  {
    value: "REUNIAO",
    label: "Reunião",
    block: "border-indigo-500 bg-indigo-100 text-indigo-900",
    chip: "border-indigo-200 text-indigo-700 hover:bg-indigo-50",
    chipActive: "border-indigo-500 bg-indigo-100 text-indigo-800",
    dot: "bg-indigo-500"
  },
  {
    value: "SIMULADO",
    label: "Simulado",
    block: "border-orange-500 bg-orange-100 text-orange-900",
    chip: "border-orange-200 text-orange-700 hover:bg-orange-50",
    chipActive: "border-orange-500 bg-orange-100 text-orange-800",
    dot: "bg-orange-500"
  },
  {
    value: "AULAO",
    label: "Aulão",
    block: "border-fuchsia-500 bg-fuchsia-100 text-fuchsia-900",
    chip: "border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-50",
    chipActive: "border-fuchsia-500 bg-fuchsia-100 text-fuchsia-800",
    dot: "bg-fuchsia-500"
  },
  {
    value: "AULA",
    label: "Aula comum",
    block: "border-teal-500 bg-teal-100 text-teal-900",
    chip: "border-teal-200 text-teal-700 hover:bg-teal-50",
    chipActive: "border-teal-500 bg-teal-100 text-teal-800",
    dot: "bg-teal-500"
  }
];

export function eventTypeOf(tipo: EventType) {
  return EVENT_TYPES.find((t) => t.value === tipo) ?? EVENT_TYPES[0];
}

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
  tipo: EventType;
  data: string;
  horarioInicio: string;
  horarioFim: string;
  local: string | null;
  descricao: string | null;
  turmas: { id: string; nome: string }[];
  participantes: { userId: string; name: string; status: ParticipationStatus }[];
  meuStatus: ParticipationStatus | null;
  criadoPorId: string | null;
  criadoPor: { id: string; name: string } | null;
  permissoes: { editar: boolean; excluir: boolean; responder: boolean };
}

export function toHHMM(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}
