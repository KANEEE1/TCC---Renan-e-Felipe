export const DIAS_SEMANA = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"] as const;

export const DIA_LABELS: Record<string, string> = {
  SEGUNDA: "Segunda",
  TERCA: "Terça",
  QUARTA: "Quarta",
  QUINTA: "Quinta",
  SEXTA: "Sexta",
  SABADO: "Sábado",
  DOMINGO: "Domingo"
};

export interface AbsenceDTO {
  id: string;
  data: string;
  motivo: string | null;
  aula: {
    diaSemana: string;
    horarioInicio: string;
    horarioFim: string;
    turma: { id: string; nome: string };
    disciplina: { id: string; nome: string };
    professor: { id: string; name: string };
  };
  registradoPor: { id: string; name: string };
  substituicao: { id: string; status: "PENDENTE" | "ACEITA" | "RECUSADA"; substituto: { id: string; name: string } } | null;
  permissoes: { cancelar: boolean };
}

export const SUBSTITUICAO_STATUS_LABELS = { PENDENTE: "Pendente", ACEITA: "Aceita", RECUSADA: "Recusada" } as const;

export function toHHMM(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

export function weekdayOf(date: string) {
  return DIAS_SEMANA[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];
}
