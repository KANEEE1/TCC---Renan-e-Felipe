import type { AssignStudentsInput, CreateMatriculaInput } from "./matriculas.schemas.js";
import type { MatriculasRepository } from "./matriculas.repository.js";

export class MatriculasService {
  constructor(private readonly matriculasRepository: MatriculasRepository) {}

  list() {
    return this.matriculasRepository.list();
  }

  create(input: CreateMatriculaInput) {
    return this.matriculasRepository.create(input);
  }

  async assignStudents(turmaId: string, input: AssignStudentsInput) {
    await this.matriculasRepository.createMany(turmaId, input.studentIds);
    return this.matriculasRepository.listByTurma(turmaId);
  }
}
