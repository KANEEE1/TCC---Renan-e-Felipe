import { Prisma } from "@prisma/client";
import { HttpError } from "../../shared/http.js";
import { normalizarNome } from "../../shared/normalizar-nome.js";
import type { CreateDisciplinaInput, CreateDisciplinasLoteInput, UpdateDisciplinaInput } from "./disciplinas.schemas.js";
import type { DisciplinasRepository } from "./disciplinas.repository.js";

export class DisciplinasService {
  constructor(private readonly disciplinasRepository: DisciplinasRepository) {}

  list() {
    return this.disciplinasRepository.list();
  }

  create(input: CreateDisciplinaInput) {
    return this.disciplinasRepository.create({ nome: input.nome, nomeNormalizado: normalizarNome(input.nome) });
  }

  async createLote(input: CreateDisciplinasLoteInput) {
    const unicos = new Map<string, string>();
    for (const nome of input.nomes) {
      const normalizado = normalizarNome(nome);
      if (!unicos.has(normalizado)) unicos.set(normalizado, nome.trim().replace(/\s+/g, " "));
    }

    const existentes = await this.disciplinasRepository.listByNomesNormalizados([...unicos.keys()]);
    const existentesSet = new Set(existentes.map((item) => item.nomeNormalizado));

    const novas = [...unicos].filter(([normalizado]) => !existentesSet.has(normalizado));
    // skipDuplicates: um nome criado em paralelo é ignorado em vez de derrubar o lote.
    await this.disciplinasRepository.createMany(novas.map(([nomeNormalizado, nome]) => ({ nome, nomeNormalizado })));
    const criadas = await this.disciplinasRepository.listByNomesNormalizados(novas.map(([normalizado]) => normalizado));
    const ignoradas = [...unicos].filter(([normalizado]) => existentesSet.has(normalizado)).map(([, nome]) => nome);

    return { criadas, ignoradas };
  }

  async update(id: string, input: UpdateDisciplinaInput) {
    await this.getById(id);
    return this.disciplinasRepository.update(id, { nome: input.nome, nomeNormalizado: normalizarNome(input.nome) });
  }

  async remove(id: string) {
    await this.getById(id);

    if ((await this.disciplinasRepository.countProfessores(id)) > 0) {
      throw new HttpError(409, "Disciplina em uso");
    }

    try {
      await this.disciplinasRepository.remove(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new HttpError(409, "Disciplina em uso");
      }
      throw error;
    }
  }

  private async getById(id: string) {
    const disciplina = await this.disciplinasRepository.findById(id);

    if (!disciplina) {
      throw new HttpError(404, "Disciplina não encontrada");
    }

    return disciplina;
  }
}
