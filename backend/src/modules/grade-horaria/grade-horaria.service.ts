import { HttpError } from "../../shared/http.js";
import type { CreateAulaInput } from "./grade-horaria.schemas.js";
import type { GradeHorariaRepository } from "./grade-horaria.repository.js";

export class GradeHorariaService {
  constructor(private readonly gradeHorariaRepository: GradeHorariaRepository) {}

  list() {
    return this.gradeHorariaRepository.list();
  }

  create(input: CreateAulaInput) {
    if (input.horarioFim <= input.horarioInicio) {
      throw new HttpError(400, "Class end time must be after start time");
    }

    return this.gradeHorariaRepository.create(input);
  }
}
