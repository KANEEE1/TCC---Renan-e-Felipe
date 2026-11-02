import type { Actor } from "../../shared/auth.js";
import { agora } from "../../shared/clock.js";
import { HttpError } from "../../shared/http.js";
import { formatTimeHHMM, parseDateOnly, todayInSaoPaulo } from "../../shared/time.js";
import { addDays, isoDate, jaComecou, resolverOcorrencia, type Ocorrencia } from "../grade-horaria/ocorrencias.js";
import type { AvisosProfessorRepository } from "./avisos-professor.repository.js";

export interface AvisosDoProfessor {
  convocacoes: {
    id: string;
    aulaId: string;
    dataOriginal: string;
    data: string;
    horarioInicio: string;
    horarioFim: string;
    disciplina: string;
    turma: string;
    remarcada: boolean;
  }[];
  retiradas: {
    id: string;
    tipo: string;
    titulo: string;
    turma: string | null;
    data: string;
    horarioInicio: string;
    horarioFim: string;
  }[];
}

type Convocacao = NonNullable<Awaited<ReturnType<AvisosProfessorRepository["findConvocacao"]>>>;
type Excecao = Awaited<ReturnType<AvisosProfessorRepository["listExcecoesDasAulas"]>>[number];

// A convocação vale enquanto a ocorrência existe (não cancelada), ainda não começou e o professor efetivo continua sendo ele.
function ocorrenciaVigente(convocacao: Convocacao, excecao: Excecao | undefined, now: Date): Ocorrencia | null {
  if (!excecao) return null;
  const ocorrencia = resolverOcorrencia(convocacao.aula, excecao, isoDate(convocacao.dataOriginal));
  if (!ocorrencia || ocorrencia.professorId !== convocacao.professorId || jaComecou(ocorrencia, now)) return null;
  return ocorrencia;
}

export class AvisosProfessorService {
  constructor(private readonly avisosProfessorRepository: AvisosProfessorRepository) {}

  async listMine(actor: Actor): Promise<AvisosDoProfessor> {
    const now = agora();
    const hoje = todayInSaoPaulo(now);
    const [convocacoes, retiradas] = await Promise.all([
      this.convocacoesVigentes(actor.id, hoje, now),
      this.avisosProfessorRepository.listRetiradasPendentes(actor.id, parseDateOnly(hoje))
    ]);

    return {
      convocacoes,
      retiradas: retiradas
        .map((aviso) => ({
          id: aviso.id,
          tipo: aviso.tipo,
          titulo: aviso.titulo,
          turma: aviso.turma,
          data: isoDate(aviso.data),
          horarioInicio: formatTimeHHMM(aviso.horarioInicio),
          horarioFim: formatTimeHHMM(aviso.horarioFim)
        }))
        .filter((aviso) => !jaComecou(aviso, now))
        .sort(porDataEHorario)
    };
  }

  // Leitura, checagem de vigência e escrita na mesma transação serializável (uma edição concorrente da ocorrência dá 409).
  responderConvocacao(id: string, status: "CONFIRMADO" | "RECUSADO", actor: Actor) {
    return this.avisosProfessorRepository.transaction(async (repository) => {
      const convocacao = await repository.findConvocacao(id);
      if (!convocacao || convocacao.professorId !== actor.id) throw new HttpError(404, "Notice not found");

      const excecoes = await repository.listExcecoesDasAulas([convocacao.aulaId]);
      const excecao = excecoes.find((e) => e.dataOriginal.getTime() === convocacao.dataOriginal.getTime());
      if (convocacao.status !== "PENDENTE" || !ocorrenciaVigente(convocacao, excecao, agora())) {
        throw new HttpError(409, "Esta convocação não está mais vigente");
      }

      await repository.responderConvocacao(convocacao, status);
      return { id, status };
    });
  }

  async ciente(id: string, actor: Actor) {
    if (!(await this.avisosProfessorRepository.marcarCiente(id, actor.id, agora()))) {
      throw new HttpError(404, "Notice not found");
    }
  }

  private async convocacoesVigentes(professorId: string, hoje: string, now: Date): Promise<AvisosDoProfessor["convocacoes"]> {
    const convocacoes = await this.avisosProfessorRepository.listConvocacoesPendentes(professorId, parseDateOnly(hoje));
    if (convocacoes.length === 0) return [];

    const excecoes = await this.avisosProfessorRepository.listExcecoesDasAulas([...new Set(convocacoes.map((c) => c.aulaId))]);
    const excecaoPorOcorrencia = new Map(excecoes.map((e) => [`${e.aulaId}|${isoDate(e.dataOriginal)}`, e]));

    return convocacoes
      .flatMap((convocacao) => {
        const ocorrencia = ocorrenciaVigente(convocacao, excecaoPorOcorrencia.get(`${convocacao.aulaId}|${isoDate(convocacao.dataOriginal)}`), now);
        return ocorrencia
          ? [{
              id: convocacao.id,
              aulaId: convocacao.aulaId,
              dataOriginal: ocorrencia.dataOriginal,
              data: ocorrencia.data,
              horarioInicio: ocorrencia.horarioInicio,
              horarioFim: ocorrencia.horarioFim,
              disciplina: convocacao.aula.disciplina.nome,
              turma: convocacao.aula.turma.nome,
              remarcada: convocacao.remarcada
            }]
          : [];
      })
      .sort(porDataEHorario);
  }
}

function porDataEHorario(a: { data: string; horarioInicio: string }, b: { data: string; horarioInicio: string }) {
  return a.data.localeCompare(b.data) || a.horarioInicio.localeCompare(b.horarioInicio);
}
