import type { CreateAlunoInput } from "./alunos.schemas.js";
import type { AlunosRepository } from "./alunos.repository.js";

export class AlunosService {
  constructor(private readonly alunosRepository: AlunosRepository) {}

  list() {
    return this.alunosRepository.list();
  }

  create(input: CreateAlunoInput) {
    return this.alunosRepository.create(input);
  }
}
