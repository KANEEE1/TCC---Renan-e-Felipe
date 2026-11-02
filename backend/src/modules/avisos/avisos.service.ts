import { agora } from "../../shared/clock.js";
import { HttpError } from "../../shared/http.js";
import { addDays, indisponibilidadeVigente, isoDate, jaComecou } from "../grade-horaria/ocorrencias.js";
import { formatTimeHHMM, parseDateOnly, todayInSaoPaulo } from "../../shared/time.js";
import type { AvisoEncerramento, SimuladosService } from "../simulados/simulados.service.js";
import type { AvisosRepository } from "./avisos.repository.js";

// Professor que não poderá participar de uma aula ou evento.
export interface AvisoIndisponibilidade {
  id: string;
  tipo: "AULA" | "EVENTO";
  professor: { id: string; name: string };
  titulo: string;
  turma: string | null;
  data: string;
  horarioInicio: string;
  horarioFim: string;
  aulaId?: string;
  dataOriginal?: string;
  eventoId?: string;
}

// Indisponibilidade de professor ou simulado encerrado pelo prazo com zeros automáticos.
export type Aviso = AvisoIndisponibilidade | AvisoEncerramento;

export class AvisosService {
  constructor(
    private readonly avisosRepository: AvisosRepository,
    private readonly simuladosService: Pick<SimuladosService, "avisosDeEncerramento" | "cienteEncerramento">
  ) {}

  // Avisos ativos: professores que não poderão participar de aulas ou eventos futuros e simulados encerrados pelo prazo
  // com alunos zerados, ainda não dispensados.
  async list(): Promise<Aviso[]> {
    const now = agora();
    const [aulas, eventos, simulados] = await Promise.all([
      this.avisosDeAulas(now),
      this.avisosDeEventos(now),
      this.simuladosService.avisosDeEncerramento()
    ]);
    return [...aulas, ...eventos, ...simulados].sort((a, b) => a.data.localeCompare(b.data) || a.horarioInicio.localeCompare(b.horarioInicio));
  }

  async ciente(id: string) {
    const [tipo, ...resto] = id.split(":");
    const registroId = resto.join(":");
    const cienteEm = agora();
    const ok =
      tipo === "aula" && registroId
        ? await this.avisosRepository.marcarCienteAula(registroId, cienteEm)
        : tipo === "evento" && registroId
          ? await this.avisosRepository.marcarCienteEvento(registroId, cienteEm)
          : tipo === "simulado" && registroId
            ? await this.simuladosService.cienteEncerramento(registroId)
            : false;

    if (!ok) throw new HttpError(404, "Notice not found");
  }

  private async avisosDeAulas(now: Date): Promise<AvisoIndisponibilidade[]> {
    // A ocorrência só pode estar no futuro se a data original é recente (margem de 7 dias para ocorrências movidas).
    const desde = parseDateOnly(addDays(todayInSaoPaulo(now), -7));
    const indisponibilidades = await this.avisosRepository.listIndisponibilidadesPendentes(desde);
    const excecoes = await this.avisosRepository.listExcecoesDasAulas([...new Set(indisponibilidades.map((i) => i.aula.id))]);
    const excecaoPorOcorrencia = new Map(excecoes.map((e) => [`${e.aulaId}|${isoDate(e.dataOriginal)}`, e]));

    const avisos: AvisoIndisponibilidade[] = [];
    for (const indisponibilidade of indisponibilidades) {
      const dataOriginal = isoDate(indisponibilidade.dataOriginal);
      const excecao = excecaoPorOcorrencia.get(`${indisponibilidade.aula.id}|${dataOriginal}`);
      const ocorrencia = indisponibilidadeVigente(indisponibilidade.aula, excecao, indisponibilidade);
      if (!ocorrencia || jaComecou(ocorrencia, now)) continue;

      avisos.push({
        id: `aula:${indisponibilidade.id}`,
        tipo: "AULA",
        professor: indisponibilidade.professor,
        titulo: indisponibilidade.aula.disciplina.nome,
        turma: indisponibilidade.aula.turma.nome,
        data: ocorrencia.data,
        horarioInicio: ocorrencia.horarioInicio,
        horarioFim: ocorrencia.horarioFim,
        aulaId: ocorrencia.aulaId,
        dataOriginal
      });
    }
    return avisos;
  }

  private async avisosDeEventos(now: Date): Promise<AvisoIndisponibilidade[]> {
    const recusas = await this.avisosRepository.listRecusasPendentes(parseDateOnly(todayInSaoPaulo(now)));

    return recusas
      .map(({ id, reuniaoId, user, reuniao }): AvisoIndisponibilidade => ({
        id: `evento:${id}`,
        tipo: "EVENTO",
        professor: user,
        titulo: reuniao.titulo,
        turma: reuniao.turmas.length > 0 ? reuniao.turmas.map((turma) => turma.nome).join(", ") : null,
        data: isoDate(reuniao.data),
        horarioInicio: formatTimeHHMM(reuniao.horarioInicio),
        horarioFim: formatTimeHHMM(reuniao.horarioFim),
        eventoId: reuniaoId
      }))
      .filter((aviso) => !jaComecou(aviso, now));
  }
}
