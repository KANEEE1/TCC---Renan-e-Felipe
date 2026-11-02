import { z } from "zod";

// Cada item: nota (valor) OU "Não presente" (ausente). Sem os dois = limpar o lançamento do aluno.
export const lancarNotasSchema = z.object({
  notas: z.array(
    z.object({
      alunoId: z.string().min(1),
      valor: z.number().finite().nullable(),
      ausente: z.boolean()
    })
  ),
  // Entrega definitiva: exige todos os alunos lançados e fecha o simulado para os professores.
  enviar: z.boolean().optional()
});

export type LancarNotasInput = z.infer<typeof lancarNotasSchema>;
