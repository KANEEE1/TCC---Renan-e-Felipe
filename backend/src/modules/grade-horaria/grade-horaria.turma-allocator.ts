import { DIAS_SEMANA, toHHMM, toMinutes, type JanelaDisponibilidade } from "./grade-horaria.allocator.js";

export type MotivoTurma = "SEM_PROFESSOR" | "SEM_DISPONIBILIDADE" | "CONFLITO";

export interface PedidoTurma {
  disciplinaId: string;
  quantidade: number;
  duracaoMinutos: number;
  professoresElegiveis: string[];
}

export interface JanelaTurmaHorario {
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
}

export interface OcupacaoProfessor {
  professorId: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
}

export interface PropostaTurma {
  disciplinaId: string;
  professorId: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
}

export interface NaoAlocadoTurma {
  disciplinaId: string;
  faltantes: number;
  motivo: MotivoTurma;
}

const PASSO_MINUTOS = 30;

interface Intervalo {
  dia: string;
  ini: number;
  fim: number;
}

function sobrepoe(a: Intervalo, b: Intervalo) {
  return a.dia === b.dia && a.ini < b.fim && b.ini < a.fim;
}

function diaOrder(dia: string) {
  return DIAS_SEMANA.indexOf(dia as (typeof DIAS_SEMANA)[number]);
}

function porDiaEInicio(a: Intervalo, b: Intervalo) {
  return diaOrder(a.dia) - diaOrder(b.dia) || a.ini - b.ini;
}

// "23:59" é o fim do dia gravado no banco (que não aceita 24:00): vale 1440 min para caber a última meia-hora.
const FIM_DO_DIA = 24 * 60;

function fimEmMinutos(horario: string) {
  return horario === "23:59" ? FIM_DO_DIA : toMinutes(horario);
}

function fimEmHHMM(minutos: number) {
  return minutos >= FIM_DO_DIA ? "23:59" : toHHMM(minutos);
}

function toIntervalo(item: { diaSemana: string; horarioInicio: string; horarioFim: string }): Intervalo {
  return { dia: item.diaSemana, ini: toMinutes(item.horarioInicio), fim: fimEmMinutos(item.horarioFim) };
}

// Candidatos estáticos: cabem inteiros numa janela da turma e numa disponibilidade do professor.
function candidatosEstaticos(duracao: number, janelas: Intervalo[], disponibilidades: Intervalo[]) {
  const candidatos: Intervalo[] = [];
  for (const janela of janelas) {
    for (const disp of disponibilidades) {
      if (disp.dia !== janela.dia) continue;
      const ini = Math.max(janela.ini, disp.ini);
      const fim = Math.min(janela.fim, disp.fim);
      const primeiro = Math.ceil(ini / PASSO_MINUTOS) * PASSO_MINUTOS;
      for (let inicio = primeiro; inicio + duracao <= fim; inicio += PASSO_MINUTOS) {
        candidatos.push({ dia: janela.dia, ini: inicio, fim: inicio + duracao });
      }
    }
  }
  const unicos = new Map(candidatos.map((c) => [`${c.dia}:${c.ini}`, c]));
  return [...unicos.values()].sort(porDiaEInicio);
}

interface Estado {
  turma: Intervalo[];
  professores: Map<string, Intervalo[]>;
}

function clonar(estado: Estado): Estado {
  return {
    turma: [...estado.turma],
    professores: new Map([...estado.professores].map(([id, lista]) => [id, [...lista]]))
  };
}

function estaLivre(estado: Estado, professorId: string, candidato: Intervalo) {
  return (
    !estado.turma.some((i) => sobrepoe(i, candidato)) &&
    !(estado.professores.get(professorId) ?? []).some((i) => sobrepoe(i, candidato))
  );
}

// Aloca até `max` aulas com um professor: 1ª passada uma por dia (dias já usados pela disciplina excluídos), 2ª sem restrição.
function colocar(
  estado: Estado,
  professorId: string,
  candidatos: Intervalo[],
  max: number,
  diasUsados: Set<string>,
  passadas: boolean[]
) {
  const colocados: Intervalo[] = [];
  for (const umaPorDia of passadas) {
    for (const candidato of candidatos) {
      if (colocados.length >= max) return colocados;
      if (umaPorDia && diasUsados.has(candidato.dia)) continue;
      if (!estaLivre(estado, professorId, candidato)) continue;
      colocados.push(candidato);
      diasUsados.add(candidato.dia);
      estado.turma.push(candidato);
      estado.professores.set(professorId, [...(estado.professores.get(professorId) ?? []), candidato]);
    }
  }
  return colocados;
}

export function allocateTurma(
  pedidos: PedidoTurma[],
  janelasTurma: JanelaTurmaHorario[],
  disponibilidades: JanelaDisponibilidade[],
  ocupacoes: OcupacaoProfessor[]
) {
  const janelas = janelasTurma.map(toIntervalo);
  const dispPorProfessor = new Map<string, Intervalo[]>();
  for (const disp of disponibilidades) {
    dispPorProfessor.set(disp.professorId, [...(dispPorProfessor.get(disp.professorId) ?? []), toIntervalo(disp)]);
  }

  const estado: Estado = { turma: [], professores: new Map() };
  const cargaBase = new Map<string, number>();
  for (const ocupacao of ocupacoes) {
    estado.professores.set(ocupacao.professorId, [
      ...(estado.professores.get(ocupacao.professorId) ?? []),
      toIntervalo(ocupacao)
    ]);
    cargaBase.set(ocupacao.professorId, (cargaBase.get(ocupacao.professorId) ?? 0) + 1);
  }
  const alocadasPorProfessor = new Map<string, number>();
  const carga = (id: string) => (cargaBase.get(id) ?? 0) + (alocadasPorProfessor.get(id) ?? 0);

  const estaticos = (pedido: PedidoTurma) =>
    new Map(
      pedido.professoresElegiveis.map((id) => [
        id,
        candidatosEstaticos(pedido.duracaoMinutos, janelas, dispPorProfessor.get(id) ?? [])
      ])
    );

  const ordenados = pedidos
    .map((pedido) => {
      const candidatos = estaticos(pedido);
      const total = [...candidatos.values()].reduce((soma, lista) => soma + lista.length, 0);
      return { pedido, candidatos, total };
    })
    .sort((a, b) => a.total - b.total);

  const propostas: PropostaTurma[] = [];
  const naoAlocados: NaoAlocadoTurma[] = [];

  for (const { pedido, candidatos, total } of ordenados) {
    let faltam = pedido.quantidade;
    const diasUsados = new Set<string>();
    const usados = new Set<string>();

    while (faltam > 0) {
      const restantes = pedido.professoresElegiveis.filter((id) => !usados.has(id));
      if (restantes.length === 0) break;

      // A cobertura é medida com as mesmas passadas da colocação, para que "quem cobre mais" seja de fato
      // quem fica com mais aulas (preferindo um único professor). Em empate, vence quem espalha mais por
      // dias diferentes e, depois, quem tem menor carga.
      const cobertura = (id: string, passadas: boolean[]) =>
        colocar(clonar(estado), id, candidatos.get(id) ?? [], faltam, new Set(diasUsados), passadas).length;
      const avaliacoes = restantes.map((id) => ({ id, cobertura: cobertura(id, [true, false]), espalhadas: cobertura(id, [true]) }));

      avaliacoes.sort(
        (a, b) =>
          b.cobertura - a.cobertura || b.espalhadas - a.espalhadas || carga(a.id) - carga(b.id) || a.id.localeCompare(b.id)
      );
      const melhor = avaliacoes[0];
      if (melhor.cobertura === 0) break;

      usados.add(melhor.id);
      const colocados = colocar(estado, melhor.id, candidatos.get(melhor.id) ?? [], faltam, diasUsados, [true, false]);
      alocadasPorProfessor.set(melhor.id, (alocadasPorProfessor.get(melhor.id) ?? 0) + colocados.length);
      faltam -= colocados.length;
      for (const c of colocados) {
        propostas.push({
          disciplinaId: pedido.disciplinaId,
          professorId: melhor.id,
          diaSemana: c.dia,
          horarioInicio: toHHMM(c.ini),
          horarioFim: fimEmHHMM(c.fim)
        });
      }
    }

    if (faltam > 0) {
      const motivo: MotivoTurma =
        pedido.professoresElegiveis.length === 0 ? "SEM_PROFESSOR" : total === 0 ? "SEM_DISPONIBILIDADE" : "CONFLITO";
      naoAlocados.push({ disciplinaId: pedido.disciplinaId, faltantes: faltam, motivo });
    }
  }

  propostas.sort(
    (a, b) => diaOrder(a.diaSemana) - diaOrder(b.diaSemana) || a.horarioInicio.localeCompare(b.horarioInicio)
  );
  return { propostas, naoAlocados };
}
