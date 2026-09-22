import { HttpError } from "../../shared/http.js";
import type { CreateAulaInput, UpdateAulaInput } from "./grade-horaria.schemas.js";
import type { GradeHorariaRepository } from "./grade-horaria.repository.js";

export class GradeHorariaService {
  constructor(private readonly gradeHorariaRepository: GradeHorariaRepository) {}

  list() {
    return this.gradeHorariaRepository.list();
  }

  async getById(id: string) {
    const aula = await this.gradeHorariaRepository.findById(id);

    if (!aula) {
      throw new HttpError(404, "Class schedule entry not found");
    }

    return aula;
  }

  listByTurma(turmaId: string) {
    return this.gradeHorariaRepository.listByTurma(turmaId);
  }

  listByProfessor(professorId: string) {
    return this.gradeHorariaRepository.listByProfessor(professorId);
  }

  create(input: CreateAulaInput) {
    if (input.horarioFim <= input.horarioInicio) {
      throw new HttpError(400, "Class end time must be after start time");
    }

    return this.gradeHorariaRepository.create(input);
  }

  async update(id: string, input: UpdateAulaInput) {
    await this.getById(id);

    if (input.horarioInicio && input.horarioFim && input.horarioFim <= input.horarioInicio) {
      throw new HttpError(400, "Class end time must be after start time");
    }

    return this.gradeHorariaRepository.update(id, input);
  }

  async remove(id: string) {
    await this.getById(id);
    await this.gradeHorariaRepository.remove(id);
  }
}
