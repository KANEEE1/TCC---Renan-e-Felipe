import type { CreateTurmaInput } from "./turmas.schemas.js";
import type { TurmasRepository } from "./turmas.repository.js";

export class TurmasService {
  constructor(private readonly turmasRepository: TurmasRepository) {}

  list() {
    return this.turmasRepository.list();
  }

  create(input: CreateTurmaInput) {
    return this.turmasRepository.create(input);
  }
}
