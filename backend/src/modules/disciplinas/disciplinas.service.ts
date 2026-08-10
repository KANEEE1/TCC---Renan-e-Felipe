import type { CreateDisciplinaInput } from "./disciplinas.schemas.js";
import type { DisciplinasRepository } from "./disciplinas.repository.js";

export class DisciplinasService {
  constructor(private readonly disciplinasRepository: DisciplinasRepository) {}

  list() {
    return this.disciplinasRepository.list();
  }

  create(input: CreateDisciplinaInput) {
    return this.disciplinasRepository.create(input);
  }
}
