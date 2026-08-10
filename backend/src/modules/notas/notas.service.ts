import type { CreateNotaInput } from "./notas.schemas.js";
import type { NotasRepository } from "./notas.repository.js";

export class NotasService {
  constructor(private readonly notasRepository: NotasRepository) {}

  list() {
    return this.notasRepository.list();
  }

  create(input: CreateNotaInput) {
    return this.notasRepository.create(input);
  }
}
