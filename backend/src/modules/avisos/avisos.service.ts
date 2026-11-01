import { agora } from "../../shared/clock.js";
import { HttpError } from "../../shared/http.js";
import { addDays, indisponibilidadeVigente, isoDate, jaComecou } from "../grade-horaria/ocorrencias.js";
import { formatTimeHHMM, parseDateOnly, todayInSaoPaulo } from "../../shared/time.js";
import type { AvisosRepository } from "./avisos.repository.js";

export interface Aviso {
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

export class AvisosService {
  constructor(private readonly avisosRepository: AvisosRepository) {}

  // Avisos ativos: professores que não poderão participar de aulas ou eventos futuros, ainda não dispensados.
  async list(): Promise<Aviso[]> {
    const now = agora();
    const [aulas, eventos] = await Promise.all([this.avisosDeAulas(now), this.avisosDeEventos(now)]);
    return [...aulas, ...eventos].sort((a, b) => a.data.localeCompare(b.data) || a.horarioInicio.localeCompare(b.horarioInicio));
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
          : false;

    if (!ok) throw new HttpError(404, "Notice not found");
  }

  private async avisosDeAulas(now: Date): Promise<Aviso[]> {
    // A ocorrência só pode estar no futuro se a data original é recente (margem de 7 dias para ocorrências movidas).
    const desde = parseDateOnly(addDays(todayInSaoPaulo(now), -7));
    const indisponibilidades = await this.avisosRepository.listIndisponibilidadesPendentes(desde);
    const excecoes = await this.avisosRepository.listExcecoesDasAulas([...new Set(indisponibilidades.map((i) => i.aula.id))]);
    const excecaoPorOcorrencia = new Map(excecoes.map((e) => [`${e.aulaId}|${isoDate(e.dataOriginal)}`, e]));

    const avisos: Aviso[] = [];
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

  private async avisosDeEventos(now: Date): Promise<Aviso[]> {
    const recusas = await this.avisosRepository.listRecusasPendentes(parseDateOnly(todayInSaoPaulo(now)));

    return recusas
      .map(({ id, reuniaoId, user, reuniao }): Aviso => ({
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
