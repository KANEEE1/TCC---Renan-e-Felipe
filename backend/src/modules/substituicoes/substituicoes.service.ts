import { HttpError } from "../../shared/http.js";
import { formatTimeHHMM, todayInSaoPaulo } from "../../shared/time.js";
import { overlaps } from "../grade-horaria/grade-horaria.allocator.js";
import type { SubstituicoesRepository } from "./substituicoes.repository.js";
import type { CreateSubstituicaoInput } from "./substituicoes.schemas.js";

type Horario = { horarioInicio: Date; horarioFim: Date };

export class SubstituicoesService {
  constructor(private readonly substituicoesRepository: SubstituicoesRepository) {}

  create(input: CreateSubstituicaoInput, designadoPorId: string) {
    return this.substituicoesRepository.transaction(async (repository) => {
      const ausencia = await repository.findAusenciaById(input.ausenciaId);

      if (!ausencia) {
        throw new HttpError(404, "Absence not found");
      }

      if (ausencia.data.toISOString().slice(0, 10) < todayInSaoPaulo()) {
        throw new HttpError(400, "Cannot assign a substitute to a past absence");
      }

      const substituto = await repository.findUserById(input.substitutoId);

      if (!substituto || !substituto.ativo || !substituto.roles.includes("PROFESSOR")) {
        throw new HttpError(400, "Substitute must be an active teacher");
      }

      if (substituto.id === ausencia.aula.professorId) {
        throw new HttpError(400, "Substitute cannot be the lesson's own teacher");
      }

      if (await repository.findAtivaByAusencia(ausencia.id)) {
        throw new HttpError(409, "Absence already has a substitute");
      }

      const aulasDoSubstituto = await repository.findAulasOfProfessorNoDia(substituto.id, ausencia.aula.diaSemana);
      const substituicoesNaData = (await repository.findAtivasDoSubstitutoNaData(substituto.id, ausencia.data)).map(
        (item) => item.ausencia.aula
      );

      if ([...aulasDoSubstituto, ...substituicoesNaData].some((horario) => this.conflita(horario, ausencia.aula))) {
        throw new HttpError(409, "Substitute has a conflicting commitment at this time");
      }

      return repository.create({ ausenciaId: ausencia.id, substitutoId: substituto.id }, designadoPorId);
    });
  }

  async remove(id: string) {
    const substituicao = await this.substituicoesRepository.findById(id);

    if (!substituicao) {
      throw new HttpError(404, "Substitution not found");
    }

    if (substituicao.status !== "PENDENTE") {
      throw new HttpError(409, "Only pending substitutions can be cancelled");
    }

    await this.substituicoesRepository.remove(id);
  }

  private conflita(a: Horario, b: Horario) {
    return overlaps(formatTimeHHMM(a.horarioInicio), formatTimeHHMM(a.horarioFim), formatTimeHHMM(b.horarioInicio), formatTimeHHMM(b.horarioFim));
  }
}
