import { HttpError } from "../../shared/http.js";
import type { CreatePeriodoLetivoInput } from "./periodos-letivos.schemas.js";
import type { PeriodosLetivosRepository } from "./periodos-letivos.repository.js";

export class PeriodosLetivosService {
  constructor(private readonly periodosLetivosRepository: PeriodosLetivosRepository) {}

  list() {
    return this.periodosLetivosRepository.list();
  }

  create(input: CreatePeriodoLetivoInput) {
    if (input.endsAt <= input.startsAt) {
      throw new HttpError(400, "Periodo letivo end date must be after start date");
    }

    return this.periodosLetivosRepository.create(input);
  }
}
