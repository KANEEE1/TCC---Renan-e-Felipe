import { hasRole, type Actor } from "../../shared/auth.js";
import { HttpError } from "../../shared/http.js";
import { diaSemanaOfDateOnly, todayInSaoPaulo } from "../../shared/time.js";
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
    const aula = await this.ausenciasRepository.findAulaById(input.aulaId);

    if (!aula) {
      throw new HttpError(404, "Aula not found");
    }

    if (aula.professorId !== actor.id) {
      throw new HttpError(403, "Only the lesson's teacher can register an absence");
    }

    if (input.data < todayInSaoPaulo()) {
      throw new HttpError(400, "Absence date cannot be in the past");
    }

    if (diaSemanaOfDateOnly(input.data) !== aula.diaSemana) {
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
