import type { CreateSimuladoInput } from "./simulados.schemas.js";
import type { SimuladosRepository } from "./simulados.repository.js";

export class SimuladosService {
  constructor(private readonly simuladosRepository: SimuladosRepository) {}

  list() {
    return this.simuladosRepository.list();
  }

  create(input: CreateSimuladoInput) {
    return this.simuladosRepository.create(input);
  }
}
