export type SimuladoEstado = "CONFIGURACAO_PENDENTE" | "AGENDADO" | "EM_CORRECAO" | "ENVIADO" | "ENCERRADO";

export interface SimuladoResumo {
  id: string;
  titulo: string;
  data: string;
  horarioInicio: string;
  horarioFim: string;
  local: string | null;
  turmas: { id: string; nome: string }[];
  corretores: { userId: string; name: string }[];
  prazoCorrecao: string | null;
  pontuacaoMaxima: number | null;
  estado: SimuladoEstado;
  lancados: number;
  total: number;
  // Média das notas ("Não presente" fica de fora; o zero automático entra); null sem notas.
  media: number | null;
  correcaoEnviadaEm: string | null;
  correcaoEnviadaPor: { id: string; name: string } | null;
  correcaoEncerradaEm: string | null;
}

export interface SimuladoAluno {
  alunoId: string;
  nome: string;
  valor: number | null;
  ausente: boolean;
  // Zero dado pelo sistema porque o prazo venceu sem correção.
  automatica: boolean;
  lancado: boolean;
}

export interface SimuladoDetalhe extends SimuladoResumo {
  turmasComAlunos: { id: string; nome: string; media: number | null; alunos: SimuladoAluno[] }[];
  permissoes: { lancar: boolean; enviar: boolean };
}

// "dd/mm" de uma data "YYYY-MM-DD".
export const diaMes = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

export const formatarNota = (valor: number) => valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function estadoLabel(s: Pick<SimuladoResumo, "estado" | "lancados" | "total" | "prazoCorrecao">) {
  switch (s.estado) {
    case "CONFIGURACAO_PENDENTE":
      return "Configuração pendente";
    case "AGENDADO":
      return "Agendado";
    case "EM_CORRECAO":
      return `Em correção · ${s.lancados}/${s.total}${s.prazoCorrecao ? ` · até ${diaMes(s.prazoCorrecao)}` : ""}`;
    case "ENVIADO":
      return "Enviado";
    case "ENCERRADO":
      return "Encerrado pelo prazo";
  }
}

export const ESTADO_STYLE: Record<SimuladoEstado, string> = {
  CONFIGURACAO_PENDENTE: "bg-amber-100 text-amber-800",
  AGENDADO: "bg-blue-100 text-blue-700",
  EM_CORRECAO: "bg-orange-100 text-orange-700",
  ENVIADO: "bg-emerald-100 text-emerald-700",
  ENCERRADO: "bg-slate-200 text-slate-700"
};
