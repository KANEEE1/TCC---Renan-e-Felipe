export type Candidato = {
  id: string;
  name: string;
  lecionaDisciplina: boolean;
  disponivel: boolean;
  carga: { aulasSemanais: number; substituicoesMes: number };
};

export function rankCandidatos(candidatos: Candidato[]) {
  return [...candidatos].sort(
    (a, b) =>
      Number(b.lecionaDisciplina) - Number(a.lecionaDisciplina) ||
      Number(b.disponivel) - Number(a.disponivel) ||
      a.carga.aulasSemanais + a.carga.substituicoesMes - (b.carga.aulasSemanais + b.carga.substituicoesMes) ||
      a.name.localeCompare(b.name, "pt-BR")
  );
}
