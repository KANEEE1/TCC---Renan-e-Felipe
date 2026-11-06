const COLUNAS = ["aluno", "numero", "turma"] as const;

export interface LinhaPlanilha {
  linha: number;
  aluno: string;
  numero: string;
  turma: string;
}

const semAcento = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "");
const limpar = (texto: string) => texto.replace(/\s+/g, " ").trim();

// Divide o CSV em registros, guardando a linha do arquivo onde cada um começa. Aceita campos entre aspas (com separador,
// quebra de linha e "" dentro). `fechado` é false se terminou com aspas abertas.
function registros(texto: string, separador: string) {
  const lista: { linha: number; campos: string[] }[] = [];
  let campos: string[] = [];
  let campo = "";
  let entreAspas = false;
  let linhaAtual = 1;
  let inicio = 1;

  const fimDoRegistro = () => {
    lista.push({ linha: inicio, campos: [...campos, campo] });
    campos = [];
    campo = "";
    inicio = linhaAtual;
  };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "\n") linhaAtual++;
    if (entreAspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        entreAspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreAspas = true;
    } else if (c === separador) {
      campos.push(campo);
      campo = "";
    } else if (c === "\n") {
      fimDoRegistro();
    } else {
      campo += c;
    }
  }
  if (campo !== "" || campos.length > 0) fimDoRegistro();
  return { lista, fechado: !entreAspas };
}

// Lê a planilha de alunos: o Excel em português salva com ";", as demais ferramentas com ",".
export function lerPlanilha(csv: string): { linhas: LinhaPlanilha[]; erros: string[] } {
  // Sem BOM, e as quebras de linha do Windows (\r\n) e do Excel antigo de Mac (\r) viram \n.
  const texto = csv.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const separador = (texto.split("\n", 1)[0] ?? "").includes(";") ? ";" : ",";
  const { lista, fechado } = registros(texto, separador);
  if (!fechado) return { linhas: [], erros: ["A planilha tem aspas que não foram fechadas."] };

  const [cabecalho, ...dados] = lista;
  const nomes = (cabecalho?.campos ?? []).map((nome) => semAcento(limpar(nome)).toLowerCase());
  const posicao = Object.fromEntries(COLUNAS.map((coluna) => [coluna, nomes.indexOf(coluna)])) as Record<(typeof COLUNAS)[number], number>;
  if (COLUNAS.some((coluna) => posicao[coluna] < 0)) {
    return { linhas: [], erros: ["A primeira linha da planilha precisa ter as colunas aluno, numero e turma."] };
  }

  const linhas: LinhaPlanilha[] = [];
  const erros: string[] = [];
  for (const { linha, campos } of dados) {
    // Linha em branco (o Excel costuma deixar algumas no fim, como ";;").
    if (campos.every((campo) => limpar(campo) === "")) continue;
    // Campo a mais costuma ser um separador dentro do nome, o que deslocaria as colunas.
    if (campos.slice(nomes.length).some((campo) => limpar(campo) !== "")) {
      erros.push(`Linha ${linha}: tem mais colunas que o cabeçalho. Se o nome tiver "${separador}", coloque-o entre aspas.`);
      continue;
    }
    linhas.push({
      linha,
      aluno: limpar(campos[posicao.aluno] ?? ""),
      numero: limpar(campos[posicao.numero] ?? ""),
      turma: limpar(campos[posicao.turma] ?? "")
    });
  }
  return { linhas, erros };
}
