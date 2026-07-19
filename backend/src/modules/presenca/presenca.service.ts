import type { CreatePresencaInput } from "./presenca.schemas.js";
import type { PresencaRepository } from "./presenca.repository.js";

export class PresencaService {
  constructor(private readonly presencaRepository: PresencaRepository) {}

  list() {
    return this.presencaRepository.list();
  }

  create(input: CreatePresencaInput) {
    return this.presencaRepository.create(input);
  }
}
