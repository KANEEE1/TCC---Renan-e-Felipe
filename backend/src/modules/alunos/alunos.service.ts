import { agora } from "../../shared/clock.js";
import { HttpError } from "../../shared/http.js";
import { todayInSaoPaulo } from "../../shared/time.js";
import { lerPlanilha } from "./alunos-planilha.js";
import type { CreateAlunoInput, UpdateAlunoInput } from "./alunos.schemas.js";
import type { AlunosRepository } from "./alunos.repository.js";
import type { PresencaService } from "../presenca/presenca.service.js";
import type { SimuladosService } from "../simulados/simulados.service.js";

export class AlunosService {
  constructor(
    private readonly alunosRepository: AlunosRepository,
    private readonly presencaService: PresencaService,
    private readonly simuladosService: SimuladosService
  ) {}

  // Frequência e média dos simulados de todos os alunos ativos de uma vez (null = sem dados).
  async indicadores() {
    const [ids, frequencias, medias] = await Promise.all([
      this.alunosRepository.listIdsAtivos(),
      this.presencaService.frequenciaPorAluno(),
      this.simuladosService.mediasPorAluno()
    ]);
    return ids.map((alunoId) => ({
      alunoId,
      frequenciaPercentual: frequencias.get(alunoId) ?? null,
      mediaSimuladosPercentual: medias.get(alunoId) ?? null
    }));
  }

  list() {
    return this.alunosRepository.list();
  }

  async getById(id: string) {
    const aluno = await this.alunosRepository.findById(id);

    if (!aluno) {
      throw new HttpError(404, "Student not found");
    }

    return aluno;
  }

  async create(input: CreateAlunoInput) {
    if (!(await this.alunosRepository.turmaExists(input.turmaId))) {
      throw new HttpError(400, "Turma não encontrada");
    }
    return this.alunosRepository.create(input);
  }

  // Confere a planilha inteira e devolve todos os problemas de uma vez, na ordem das linhas.
  async validarPlanilha(csv: string) {
    const { linhas, erros: errosDeLeitura } = lerPlanilha(csv);
    const erros = [...errosDeLeitura];
    if (linhas.length === 0 && erros.length === 0) erros.push("A planilha não tem nenhum aluno preenchido.");

    const anoLetivo = Number(todayInSaoPaulo(agora()).slice(0, 4));
    const [turmas, existentes] = await Promise.all([
      this.alunosRepository.listTurmasDoAno(anoLetivo),
      this.alunosRepository.nomesExistentes(linhas.map((l) => l.aluno).filter(Boolean))
    ]);
    const turmaPorNome = new Map(turmas.map((turma) => [turma.nome, turma.id]));
    const primeiraLinha = new Map<string, number>();
    const novos: { nome: string; numero: string | null; turmaId: string }[] = [];

    for (const { linha, aluno, numero, turma } of linhas) {
      const problemas: string[] = [];
      if (!aluno) problemas.push("o nome do aluno está vazio");
      else if (existentes.has(aluno)) problemas.push(`já existe um aluno chamado "${aluno}"`);
      else if (primeiraLinha.has(aluno)) problemas.push(`"${aluno}" está repetido na planilha (já aparece na linha ${primeiraLinha.get(aluno)})`);
      if (aluno && !primeiraLinha.has(aluno)) primeiraLinha.set(aluno, linha);

      const turmaId = turmaPorNome.get(turma);
      if (!turma) problemas.push("a turma está vazia");
      else if (!turmaId) problemas.push(`a turma "${turma}" não existe em ${anoLetivo}`);

      if (problemas.length > 0) erros.push(`Linha ${linha}: ${problemas.join("; ")}.`);
      else novos.push({ nome: aluno, numero: numero || null, turmaId: turmaId! });
    }
    return { novos, erros };
  }

  // Tudo ou nada: qualquer problema na planilha impede o cadastro de todos os alunos.
  async importarPlanilha(csv: string) {
    const { novos, erros } = await this.validarPlanilha(csv);
    if (erros.length > 0) throw new HttpError(400, "A planilha tem problemas; nenhum aluno foi cadastrado.", { erros });
    return { importados: await this.alunosRepository.importar(novos) };
  }

  async update(id: string, input: UpdateAlunoInput) {
    if ((await this.getById(id)).removidoEm) throw new HttpError(409, "Aluno removido");
    return this.alunosRepository.update(id, input);
  }

  // Idempotente: aluno já removido mantém a data da primeira remoção.
  async remove(id: string) {
    const aluno = await this.getById(id);
    if (!aluno.removidoEm) await this.alunosRepository.remover(id, agora());
  }
}
