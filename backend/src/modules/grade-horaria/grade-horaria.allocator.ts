export const DIAS_SEMANA = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"] as const;

export type MotivoNaoAlocado = "SEM_DISPONIBILIDADE" | "JANELA_INSUFICIENTE" | "CONFLITO";

export interface PedidoAlocacao {
  professorId: string;
  turmaId: string;
  quantidade: number;
  duracaoMinutos: number;
}

export interface JanelaDisponibilidade {
  professorId: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
}

export interface Ocupacao {
  professorId: string;
  turmaId: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
}

export interface PropostaAlocacao {
  pedidoIndex: number;
  professorId: string;
  turmaId: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
}

export interface NaoAlocado {
  pedidoIndex: number;
  faltantes: number;
  motivo: MotivoNaoAlocado;
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toHHMM(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function diaOrder(dia: string) {
  return DIAS_SEMANA.indexOf(dia as (typeof DIAS_SEMANA)[number]);
}

export function overlaps(aIni: string, aFim: string, bIni: string, bFim: string) {
  return aIni < bFim && bIni < aFim;
}

export function allocate(
  pedidos: PedidoAlocacao[],
  disponibilidades: JanelaDisponibilidade[],
  ocupacoes: Ocupacao[]
) {
  const ocupadas = [...ocupacoes];
  const propostas: PropostaAlocacao[] = [];
  const naoAlocados: NaoAlocado[] = [];

  pedidos.forEach((pedido, pedidoIndex) => {
    const janelas = disponibilidades
      .filter((janela) => janela.professorId === pedido.professorId)
      .sort((a, b) => diaOrder(a.diaSemana) - diaOrder(b.diaSemana) || a.horarioInicio.localeCompare(b.horarioInicio));

    const candidatos: { diaSemana: string; horarioInicio: string; horarioFim: string }[] = [];
    for (const janela of janelas) {
      const fim = toMinutes(janela.horarioFim);
      for (let inicio = toMinutes(janela.horarioInicio); inicio + pedido.duracaoMinutos <= fim; inicio += pedido.duracaoMinutos) {
        candidatos.push({
          diaSemana: janela.diaSemana,
          horarioInicio: toHHMM(inicio),
          horarioFim: toHHMM(inicio + pedido.duracaoMinutos)
        });
      }
    }

    const aceitos = new Set<number>();
    const diasUsados = new Set<string>();

    const isLivre = (candidato: (typeof candidatos)[number]) =>
      !ocupadas.some(
        (ocupacao) =>
          ocupacao.diaSemana === candidato.diaSemana &&
          (ocupacao.professorId === pedido.professorId || ocupacao.turmaId === pedido.turmaId) &&
          overlaps(candidato.horarioInicio, candidato.horarioFim, ocupacao.horarioInicio, ocupacao.horarioFim)
      );

    for (const umaPorDia of [true, false]) {
      candidatos.forEach((candidato, index) => {
        if (aceitos.size >= pedido.quantidade || aceitos.has(index)) return;
        if (umaPorDia && diasUsados.has(candidato.diaSemana)) return;
        if (!isLivre(candidato)) return;

        aceitos.add(index);
        diasUsados.add(candidato.diaSemana);
        ocupadas.push({ professorId: pedido.professorId, turmaId: pedido.turmaId, ...candidato });
        propostas.push({ pedidoIndex, professorId: pedido.professorId, turmaId: pedido.turmaId, ...candidato });
      });
    }

    const faltantes = pedido.quantidade - aceitos.size;
    if (faltantes > 0) {
      const motivo: MotivoNaoAlocado =
        janelas.length === 0 ? "SEM_DISPONIBILIDADE" : candidatos.length === 0 ? "JANELA_INSUFICIENTE" : "CONFLITO";
      naoAlocados.push({ pedidoIndex, faltantes, motivo });
    }
  });

  return { propostas, naoAlocados };
}
