import { describe, expect, it } from "vitest";
import { rankCandidatos, type Candidato } from "../src/modules/substituicoes/substituicoes.ranking.js";

const mk = (name: string, o: Partial<Candidato> = {}): Candidato => ({
  id: name,
  name,
  lecionaDisciplina: false,
  disponivel: false,
  carga: { aulasSemanais: 0, substituicoesMes: 0 },
  ...o
});
const names = (c: Candidato[]) => rankCandidatos(c).map((x) => x.name);

describe("rankCandidatos", () => {
  it("puts teachers of the subject first", () => {
    expect(names([mk("A"), mk("B", { lecionaDisciplina: true })])).toEqual(["B", "A"]);
  });

  it("subject outweighs availability", () => {
    expect(names([mk("A", { disponivel: true }), mk("B", { lecionaDisciplina: true })])).toEqual(["B", "A"]);
  });

  it("puts available teachers before unavailable ones", () => {
    expect(names([mk("A"), mk("B", { disponivel: true })])).toEqual(["B", "A"]);
  });

  it("availability outweighs workload", () => {
    const light = mk("A", { carga: { aulasSemanais: 0, substituicoesMes: 0 } });
    const busy = mk("B", { disponivel: true, carga: { aulasSemanais: 9, substituicoesMes: 9 } });
    expect(names([light, busy])).toEqual(["B", "A"]);
  });

  it("orders by total workload (lessons + monthly substitutions) ascending", () => {
    const a = mk("A", { carga: { aulasSemanais: 3, substituicoesMes: 2 } });
    const b = mk("B", { carga: { aulasSemanais: 1, substituicoesMes: 1 } });
    const c = mk("C", { carga: { aulasSemanais: 0, substituicoesMes: 4 } });
    expect(names([a, b, c])).toEqual(["B", "C", "A"]);
  });

  it("breaks ties by name using pt-BR collation", () => {
    expect(names([mk("Zélia"), mk("Álvaro"), mk("Bia")])).toEqual(["Álvaro", "Bia", "Zélia"]);
  });

  it("does not mutate the input", () => {
    const input = [mk("B"), mk("A")];
    rankCandidatos(input);
    expect(input.map((x) => x.name)).toEqual(["B", "A"]);
  });
});
