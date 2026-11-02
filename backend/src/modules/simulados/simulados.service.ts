import { Prisma } from "@prisma/client";
import { hasRole, type Actor } from "../../shared/auth.js";
import { agora } from "../../shared/clock.js";
import { HttpError } from "../../shared/http.js";
import { formatTimeHHMM, parseDateOnly, timeOfDayInSaoPaulo, todayInSaoPaulo } from "../../shared/time.js";
import { isoDate } from "../grade-horaria/ocorrencias.js";
import { turmaPorAluno } from "../matriculas/vigencia.js";
import type { LancarNotasInput } from "./simulados.schemas.js";
import type { SimuladoRow, SimuladosRepository } from "./simulados.repository.js";

export type EstadoSimulado = "CONFIGURACAO_PENDENTE" | "AGENDADO" | "EM_CORRECAO" | "ENVIADO" | "ENCERRADO";

export interface CorrecaoPendente {
  eventoId: string;
  titulo: string;
  data: string;
  horarioInicio: string;
  horarioFim: string;
  prazoCorrecao: string;
  lancados: number;
  total: number;
}

export interface AvisoEncerramento {
  id: string;
  tipo: "SIMULADO";
  titulo: string;
  turma: string | null;
  data: string;
  horarioInicio: string;
  horarioFim: string;
  eventoId: string;
  prazoCorrecao: string | null;
  zerados: number;
}

interface AlunoDoSimulado {
  alunoId: string;
  nome: string;
  turmaId: string;
}

type Nota = SimuladoRow["notasSimulado"][number];

const configurado = (s: SimuladoRow) =>
  s.pontuacaoMaxima !== null && s.prazoCorrecao !== null && s.turmas.length > 0 && s.corretores.length > 0;

// A correção abre quando o simulado termina (data + horário de término, em SP).
function terminou(s: Pick<SimuladoRow, "data" | "horarioFim">, now: Date) {
  const hoje = todayInSaoPaulo(now);
  const data = isoDate(s.data);
  return data < hoje || (data === hoje && formatTimeHHMM(s.horarioFim) <= timeOfDayInSaoPaulo(now));
}

// O prazo vale até o fim do dia (SP).
const prazoVencido = (s: Pick<SimuladoRow, "prazoCorrecao">, now: Date) => !!s.prazoCorrecao && isoDate(s.prazoCorrecao) < todayInSaoPaulo(now);

function estadoDe(s: SimuladoRow, now: Date): EstadoSimulado {
  if (s.correcaoEnviadaEm) return "ENVIADO";
  if (s.correcaoEncerradaEm) return "ENCERRADO";
  if (!configurado(s)) return "CONFIGURACAO_PENDENTE";
  return terminou(s, now) ? "EM_CORRECAO" : "AGENDADO";
}

// Alunos das turmas com matrícula vigente na data, mais quem já tem nota (o histórico não some se a matrícula mudar).
function alunosDoSimulado(s: SimuladoRow) {
  const nomes = new Map<string, string>();
  for (const turma of s.turmas) for (const m of turma.matriculas) nomes.set(m.alunoId, m.aluno.nome);
  const alunos = new Map<string, AlunoDoSimulado>();
  for (const [alunoId, turmaId] of turmaPorAluno(s.turmas, isoDate(s.data))) {
    alunos.set(alunoId, { alunoId, nome: nomes.get(alunoId) ?? "", turmaId });
  }
  for (const nota of s.notasSimulado) {
    if (!alunos.has(nota.alunoId)) alunos.set(nota.alunoId, { alunoId: nota.alunoId, nome: nota.aluno.nome, turmaId: nota.turmaId });
  }
  return alunos;
}

// "Não presente" não entra na média; o zero automático entra. Duas casas decimais.
function media(notas: Nota[]) {
  const valores = notas.filter((nota) => !nota.ausente && nota.valor !== null).map((nota) => nota.valor!);
  if (valores.length === 0) return null;
  return Math.round((valores.reduce((soma, valor) => soma + valor, 0) / valores.length) * 100) / 100;
}

const duasCasas = (valor: number) => Math.abs(Math.round(valor * 100) - valor * 100) < 1e-6;

export class SimuladosService {
  constructor(private readonly simuladosRepository: SimuladosRepository) {}

  // Prazo vencido sem envio: quem ficou sem registro recebe zero automático e o simulado é encerrado. Preguiçosa e
  // idempotente (só olha os simulados em aberto com prazo vencido); chamada nas leituras de simulados e de avisos.
  async consolidarPrazos() {
    const now = agora();
    const hoje = parseDateOnly(todayInSaoPaulo(now));
    const vencidos = await this.simuladosRepository.listPrazosVencidos(hoje);
    for (const s of vencidos) {
      const comNota = new Set(s.notasSimulado.map((nota) => nota.alunoId));
      const zeros = [...turmaPorAluno(s.turmas, isoDate(s.data))]
        .filter(([alunoId]) => !comNota.has(alunoId))
        .map(([alunoId, turmaId]) => ({ alunoId, turmaId }));
      await this.simuladosRepository.encerrar(s.id, hoje, now, zeros);
    }
  }

  async list() {
    await this.consolidarPrazos();
    const now = agora();
    return (await this.simuladosRepository.list()).map((s) => this.resumo(s, now));
  }

  // Notas do aluno nos simulados finalizados, em % da pontuação máxima, com a média da turma dele em cada um.
  async notasDoAluno(alunoId: string) {
    const aluno = await this.simuladosRepository.findAluno(alunoId);
    if (!aluno) throw new HttpError(404, "Aluno não encontrado");
    await this.consolidarPrazos();
    const doAluno = await this.simuladosRepository.listNotasFinalizadasDoAluno(alunoId);
    const todas = await this.simuladosRepository.listNotasDosSimulados(doAluno.map((n) => n.reuniao.id));
    const percentual = (valor: number, maxima: number) => (valor / maxima) * 100;
    const arredonda = (n: number) => Math.round(n * 100) / 100;

    const simulados = doAluno
      .sort((a, b) => a.reuniao.data.getTime() - b.reuniao.data.getTime() || a.reuniao.horarioInicio.getTime() - b.reuniao.horarioInicio.getTime())
      .map((n) => {
        const maxima = n.reuniao.pontuacaoMaxima!;
        const pontos = todas
          .filter((o) => o.reuniaoId === n.reuniao.id && o.turmaId === n.turma.id && !o.ausente && o.valor !== null)
          .map((o) => percentual(o.valor!, maxima));
        return {
          id: n.reuniao.id,
          titulo: n.reuniao.titulo,
          data: isoDate(n.reuniao.data),
          pontuacaoMaxima: maxima,
          valor: n.valor,
          ausente: n.ausente,
          automatica: n.automatica,
          percentual: !n.ausente && n.valor !== null ? arredonda(percentual(n.valor, maxima)) : null,
          mediaTurmaPercentual: pontos.length > 0 ? arredonda(pontos.reduce((s, p) => s + p, 0) / pontos.length) : null,
          turma: n.turma
        };
      });
    const percentuais = simulados.flatMap((s) => (s.percentual === null ? [] : [s.percentual]));
    const mediaGeral = percentuais.length > 0 ? arredonda(percentuais.reduce((s, p) => s + p, 0) / percentuais.length) : null;
    return { aluno, media: mediaGeral, simulados };
  }

  // Médias da turma em cada simulado finalizado (e a geral do simulado); a média final pesa cada simulado igual.
  async notasDaTurma(turmaId: string) {
    const turma = await this.simuladosRepository.findTurma(turmaId);
    if (!turma) throw new HttpError(404, "Turma não encontrada");
    await this.consolidarPrazos();
    const finalizados = await this.simuladosRepository.listSimuladosFinalizadosDaTurma(turmaId);
    const todas = await this.simuladosRepository.listNotasDosSimulados(finalizados.map((s) => s.id));
    const arredonda = (n: number) => Math.round(n * 100) / 100;
    const media = (xs: number[]) => (xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

    const brutas: (number | null)[] = [];
    const simulados = finalizados.map((s) => {
      const maxima = s.pontuacaoMaxima!;
      const doSimulado = todas.filter((n) => n.reuniaoId === s.id);
      const pct = (notas: typeof doSimulado) => notas.filter((n) => !n.ausente && n.valor !== null).map((n) => (n.valor! / maxima) * 100);
      const daTurma = doSimulado.filter((n) => n.turmaId === turmaId);
      const mediaTurma = media(pct(daTurma));
      const mediaGeral = media(pct(doSimulado));
      brutas.push(mediaTurma);
      return {
        id: s.id,
        titulo: s.titulo,
        data: isoDate(s.data),
        pontuacaoMaxima: maxima,
        mediaTurmaPercentual: mediaTurma === null ? null : arredonda(mediaTurma),
        mediaGeralPercentual: mediaGeral === null ? null : arredonda(mediaGeral),
        avaliados: pct(daTurma).length,
        ausentes: daTurma.filter((n) => n.ausente).length
      };
    });
    const mediaFinal = media(brutas.filter((m): m is number => m !== null));
    return { turma, media: mediaFinal === null ? null : arredonda(mediaFinal), simulados };
  }

  async getById(id: string, actor: Actor) {
    await this.consolidarPrazos();
    const s = await this.simuladosRepository.findById(id);
    if (!s) throw new HttpError(404, "Simulado não encontrado");
    return this.detalhe(s, actor, agora());
  }

  // Salvar (andamento) e, opcionalmente, Enviar (entrega definitiva) na mesma transação serializável. Conflito com outro
  // corretor salvando ao mesmo tempo (P2034): tenta de novo até 3 vezes antes de responder 409.
  async lancarNotas(id: string, input: LancarNotasInput, actor: Actor) {
    await this.consolidarPrazos();
    for (let tentativa = 1; ; tentativa++) {
      try {
        await this.gravarNotas(id, input, actor);
        break;
      } catch (error) {
        const conflito = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
        if (!conflito) throw error;
        if (tentativa >= 3) throw new HttpError(409, "Outro corretor salvou ao mesmo tempo; confira e salve de novo.");
      }
    }
    return this.getById(id, actor);
  }

  private gravarNotas(id: string, input: LancarNotasInput, actor: Actor) {
    return this.simuladosRepository.transaction(async (repository) => {
      const s = await repository.findById(id);
      if (!s) throw new HttpError(404, "Simulado não encontrado");
      const now = agora();

      const gestao = hasRole(actor, "GESTAO");
      if (!gestao && !s.corretores.some((corretor) => corretor.id === actor.id)) {
        throw new HttpError(403, "Somente os corretores do simulado e a gestão lançam as notas");
      }
      if (!configurado(s)) throw new HttpError(409, "Complete a configuração do simulado (turmas, corretores, prazo e pontuação máxima) na agenda");
      if (!terminou(s, now)) throw new HttpError(409, "A correção abre quando o simulado termina");
      // A gestão pode editar sempre; o professor só enquanto a correção está aberta.
      if (!gestao && s.correcaoEnviadaEm) throw new HttpError(409, "A correção deste simulado já foi enviada");
      if (!gestao && (s.correcaoEncerradaEm || prazoVencido(s, now))) throw new HttpError(409, "O prazo da correção deste simulado terminou");
      const fechado = !!s.correcaoEnviadaEm || !!s.correcaoEncerradaEm;
      if (input.enviar && fechado) throw new HttpError(409, "A correção deste simulado já foi enviada ou encerrada");

      const alunos = alunosDoSimulado(s);
      const maxima = s.pontuacaoMaxima!;
      const vistos = new Set<string>();
      for (const item of input.notas) {
        if (vistos.has(item.alunoId)) throw new HttpError(400, "Há aluno repetido na lista de notas");
        vistos.add(item.alunoId);
        if (!alunos.has(item.alunoId)) throw new HttpError(400, "Há aluno que não está nas turmas do simulado");
        if (item.ausente && item.valor !== null) throw new HttpError(400, "Informe a nota ou marque Não presente, não os dois");
        if (item.valor !== null && (item.valor < 0 || item.valor > maxima)) throw new HttpError(400, `A nota precisa estar entre 0 e ${maxima}`);
        if (item.valor !== null && !duasCasas(item.valor)) throw new HttpError(400, "A nota pode ter no máximo duas casas decimais");
        // Depois do envio/encerramento cada aluno continua com nota ou "Não presente".
        if (fechado && item.valor === null && !item.ausente) {
          throw new HttpError(400, "Depois do envio ou do encerramento, cada aluno precisa ter nota ou Não presente");
        }
      }

      for (const item of input.notas) {
        if (item.valor === null && !item.ausente) await repository.removerNota(id, item.alunoId);
        else await repository.salvarNota(id, { ...item, turmaId: alunos.get(item.alunoId)!.turmaId }, actor.id);
      }

      if (input.enviar) {
        const comNota = await repository.listAlunoIdsComNota(id);
        const faltam = [...alunos.keys()].filter((alunoId) => !comNota.has(alunoId)).length;
        if (faltam > 0) {
          throw new HttpError(400, `Faltam ${faltam} ${faltam === 1 ? "aluno" : "alunos"} sem nota ou Não presente`, { faltam });
        }
        await repository.marcarEnviada(id, now, actor.id);
      }
    });
  }

  // Avisos do corretor: simulados já terminados, ainda em correção, com o andamento.
  async correcoesPendentes(corretorId: string): Promise<CorrecaoPendente[]> {
    await this.consolidarPrazos();
    const now = agora();
    const simulados = await this.simuladosRepository.listCorrecoesEmAberto(corretorId, parseDateOnly(todayInSaoPaulo(now)));
    return simulados
      .filter((s) => configurado(s) && terminou(s, now) && !prazoVencido(s, now))
      .map((s) => {
        const { lancados, total } = this.andamento(s);
        return {
          eventoId: s.id,
          titulo: s.titulo,
          data: isoDate(s.data),
          horarioInicio: formatTimeHHMM(s.horarioInicio),
          horarioFim: formatTimeHHMM(s.horarioFim),
          prazoCorrecao: isoDate(s.prazoCorrecao!),
          lancados,
          total
        };
      })
      .sort((a, b) => a.prazoCorrecao.localeCompare(b.prazoCorrecao) || a.data.localeCompare(b.data));
  }

  // Avisos da gestão: simulados encerrados pelo prazo em que algum aluno ficou com zero por falta de correção.
  async avisosDeEncerramento(): Promise<AvisoEncerramento[]> {
    await this.consolidarPrazos();
    const encerrados = await this.simuladosRepository.listEncerramentosSemCiente();
    return encerrados.map((s) => ({
      id: `simulado:${s.id}`,
      tipo: "SIMULADO",
      titulo: s.titulo,
      turma: s.turmas.length > 0 ? s.turmas.map((turma) => turma.nome).join(", ") : null,
      data: isoDate(s.data),
      horarioInicio: formatTimeHHMM(s.horarioInicio),
      horarioFim: formatTimeHHMM(s.horarioFim),
      eventoId: s.id,
      prazoCorrecao: s.prazoCorrecao ? isoDate(s.prazoCorrecao) : null,
      zerados: s._count.notasSimulado
    }));
  }

  cienteEncerramento(id: string) {
    return this.simuladosRepository.marcarCienteEncerramento(id, agora());
  }

  private andamento(s: SimuladoRow) {
    const alunos = alunosDoSimulado(s);
    const comNota = new Set(s.notasSimulado.map((nota) => nota.alunoId));
    return { lancados: [...alunos.keys()].filter((alunoId) => comNota.has(alunoId)).length, total: alunos.size };
  }

  private resumo(s: SimuladoRow, now: Date) {
    return {
      id: s.id,
      titulo: s.titulo,
      data: isoDate(s.data),
      horarioInicio: formatTimeHHMM(s.horarioInicio),
      horarioFim: formatTimeHHMM(s.horarioFim),
      local: s.local,
      turmas: s.turmas.map((turma) => ({ id: turma.id, nome: turma.nome })),
      corretores: s.corretores.map((corretor) => ({ userId: corretor.id, name: corretor.name })),
      prazoCorrecao: s.prazoCorrecao ? isoDate(s.prazoCorrecao) : null,
      pontuacaoMaxima: s.pontuacaoMaxima,
      estado: estadoDe(s, now),
      ...this.andamento(s),
      media: media(s.notasSimulado),
      correcaoEnviadaEm: s.correcaoEnviadaEm,
      correcaoEnviadaPor: s.correcaoEnviadaPor,
      correcaoEncerradaEm: s.correcaoEncerradaEm
    };
  }

  private detalhe(s: SimuladoRow, actor: Actor, now: Date) {
    const alunos = alunosDoSimulado(s);
    const notaDe = new Map(s.notasSimulado.map((nota) => [nota.alunoId, nota]));
    const nomeDaTurma = new Map(s.turmas.map((turma) => [turma.id, turma.nome]));

    const porTurma = new Map<string, AlunoDoSimulado[]>();
    for (const aluno of alunos.values()) porTurma.set(aluno.turmaId, [...(porTurma.get(aluno.turmaId) ?? []), aluno]);
    const turmas = [...porTurma.entries()]
      .map(([turmaId, daTurma]) => ({
        id: turmaId,
        nome: nomeDaTurma.get(turmaId) ?? s.notasSimulado.find((nota) => nota.turmaId === turmaId)?.turma.nome ?? "",
        media: media(daTurma.flatMap((aluno) => (notaDe.has(aluno.alunoId) ? [notaDe.get(aluno.alunoId)!] : []))),
        alunos: daTurma
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
          .map((aluno) => {
            const nota = notaDe.get(aluno.alunoId);
            return {
              alunoId: aluno.alunoId,
              nome: aluno.nome,
              valor: nota?.valor ?? null,
              ausente: nota?.ausente ?? false,
              automatica: nota?.automatica ?? false,
              lancado: !!nota
            };
          })
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const gestao = hasRole(actor, "GESTAO");
    const corretor = s.corretores.some((c) => c.id === actor.id);
    const enviadoOuEncerrado = !!s.correcaoEnviadaEm || !!s.correcaoEncerradaEm;
    const aberto = configurado(s) && terminou(s, now);
    const lancar = aberto && (gestao || (corretor && !enviadoOuEncerrado && !prazoVencido(s, now)));

    return {
      ...this.resumo(s, now),
      turmasComAlunos: turmas,
      permissoes: { lancar, enviar: lancar && !enviadoOuEncerrado }
    };
  }
}
