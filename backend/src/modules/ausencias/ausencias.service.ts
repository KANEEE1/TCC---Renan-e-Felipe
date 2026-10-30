import { hasRole, type Actor } from "../../shared/auth.js";
import { HttpError } from "../../shared/http.js";
import { diaSemanaOfDateOnly, parseDateOnly, todayInSaoPaulo } from "../../shared/time.js";
import { isoDate } from "../grade-horaria/ocorrencias.js";
import type { AusenciasRepository } from "./ausencias.repository.js";
import type { CreateAusenciaInput, ListAusenciasQuery } from "./ausencias.schemas.js";

type AusenciaWithAula = Awaited<ReturnType<AusenciasRepository["findById"]>> & {};

export class AusenciasService {
  constructor(private readonly ausenciasRepository: AusenciasRepository) {}

  async list(query: ListAusenciasQuery, actor: Actor) {
    if (query.de && query.ate && query.de > query.ate) {
      throw new HttpError(400, "'de' must not be after 'ate'");
    }

    const ausencias = await this.ausenciasRepository.list({
      ...query,
      registradoPorId: hasRole(actor, "GESTAO") ? undefined : actor.id
    });

    return ausencias.map((ausencia) => this.toResponse(ausencia, actor));
  }

  async create(input: CreateAusenciaInput, actor: Actor) {
    const aula = await this.ausenciasRepository.findAulaById(input.aulaId, input.data);

    if (!aula) {
      throw new HttpError(404, "Aula not found");
    }

    // A falta é da ocorrência (data original): vale o professor e a data efetivos dela, e ela não pode estar cancelada.
    const excecao = aula.excecoes[0];
    const efetiva = { professorId: excecao?.professorId ?? aula.professorId, data: excecao?.data ?? parseDateOnly(input.data) };

    if (excecao?.cancelada) {
      throw new HttpError(409, "The lesson was cancelled on this date");
    }

    if (efetiva.professorId !== actor.id) {
      throw new HttpError(403, "Only the lesson's teacher can register an absence");
    }

    if (isoDate(efetiva.data) < todayInSaoPaulo()) {
      throw new HttpError(400, "Absence date cannot be in the past");
    }

    // Ocorrência alterada (snapshot) pode ter origem num dia que a série já não usa.
    if (aula.excecoes.length === 0 && diaSemanaOfDateOnly(input.data) !== aula.diaSemana) {
      throw new HttpError(400, "Date does not match the lesson's weekday");
    }

    return this.toResponse(await this.ausenciasRepository.create(input, actor.id), actor);
  }

  async remove(id: string, actor: Actor) {
    const ausencia = await this.ausenciasRepository.findById(id);

    if (!ausencia || !this.canView(ausencia, actor)) {
      throw new HttpError(404, "Absence not found");
    }

    if (!this.canCancel(ausencia, actor)) {
      throw new HttpError(403, "Only who registered the absence or management can cancel it");
    }

    if (ausencia.substituicoes.length > 0) {
      throw new HttpError(409, "Cancel the substitute assignment before cancelling the absence");
    }

    await this.ausenciasRepository.remove(id);
  }

  private canView(ausencia: { registradoPorId: string }, actor: Actor) {
    return hasRole(actor, "GESTAO") || ausencia.registradoPorId === actor.id;
  }

  private canCancel(ausencia: { registradoPorId: string }, actor: Actor) {
    return this.canView(ausencia, actor);
  }

  private toResponse(ausencia: AusenciaWithAula, actor: Actor) {
    const { substituicoes, ...rest } = ausencia;
    return { ...rest, substituicao: substituicoes[0] ?? null, permissoes: { cancelar: this.canCancel(ausencia, actor) } };
  }
}
