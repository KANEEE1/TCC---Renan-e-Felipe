import { HttpError } from "../../shared/http.js";
import type { CreateTurmaInput, UpdateTurmaInput } from "./turmas.schemas.js";
import type { TurmasRepository } from "./turmas.repository.js";

export class TurmasService {
  constructor(private readonly turmasRepository: TurmasRepository) {}

  list() {
    return this.turmasRepository.list();
  }

  async getById(id: string) {
    const turma = await this.turmasRepository.findById(id);

    if (!turma) {
      throw new HttpError(404, "Class not found");
    }

    return turma;
  }

  create(input: CreateTurmaInput) {
    return this.turmasRepository.create(input);
  }

  async update(id: string, input: UpdateTurmaInput) {
    await this.getById(id);
    return this.turmasRepository.update(id, input);
  }
}
