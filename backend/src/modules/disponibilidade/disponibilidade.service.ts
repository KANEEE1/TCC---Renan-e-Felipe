import { HttpError } from "../../shared/http.js";
import type { CreateDisponibilidadeInput } from "./disponibilidade.schemas.js";
import type { DisponibilidadeRepository } from "./disponibilidade.repository.js";

export class DisponibilidadeService {
  constructor(private readonly disponibilidadeRepository: DisponibilidadeRepository) {}

  list() {
    return this.disponibilidadeRepository.list();
  }

  create(input: CreateDisponibilidadeInput) {
    if (input.horarioFim <= input.horarioInicio) {
      throw new HttpError(400, "Availability end time must be after start time");
    }

    return this.disponibilidadeRepository.create(input);
  }
}
