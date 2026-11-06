"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle, Download, Upload } from "lucide-react";
import { api, ApiError } from "@/lib/api";

// Só o cabeçalho, para preencher. O ";" e o BOM fazem o Excel em português abrir em colunas e com os acentos certos.
const MODELO_HREF = "data:text/csv;charset=utf-8,%EF%BB%BFaluno%3Bnumero%3Bturma%0D%0A";
const TAMANHO_MAXIMO = 80 * 1024;

interface Relatorio {
  total: number;
  erros: string[];
}

// O Excel pode salvar em UTF-8 ou em Windows-1252; sem isso, os acentos dos nomes viriam errados.
function decodificar(bytes: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function ImportStudents() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [arquivo, setArquivo] = useState("");
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const selecionar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Limpa o campo para o mesmo arquivo, depois de corrigido, poder ser escolhido de novo.
    event.target.value = "";
    if (!file) return;

    setErro(null);
    setRelatorio(null);
    setCsv("");
    setArquivo(file.name);
    if (file.size === 0) return setErro("O arquivo está vazio.");
    if (file.size > TAMANHO_MAXIMO) return setErro("O arquivo é grande demais (limite de 80 KB, cerca de 2.000 alunos).");

    setOcupado(true);
    try {
      const texto = decodificar(await file.arrayBuffer());
      setRelatorio(await api.post<Relatorio>("/students/importar/validacao", { csv: texto }));
      setCsv(texto);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível ler a planilha.");
    } finally {
      setOcupado(false);
    }
  };

  const confirmar = async () => {
    setErro(null);
    setOcupado(true);
    try {
      await api.post("/students/importar", { csv });
      router.push("/students");
    } catch (err) {
      // A situação pode ter mudado desde a conferência (ex.: aluno cadastrado nesse meio-tempo).
      const erros = err instanceof ApiError ? (err.body as { erros?: string[] } | undefined)?.erros : undefined;
      if (erros) setRelatorio({ total: 0, erros });
      else setErro(err instanceof ApiError ? err.message : "Não foi possível cadastrar os alunos.");
      setOcupado(false);
    }
  };

  const semErros = relatorio !== null && relatorio.erros.length === 0;

  return (
    <section className="mb-4 rounded-lg bg-white p-4 shadow">
      <h2 className="text-gray-800">Cadastrar vários alunos</h2>
      <p className="mt-1 text-sm text-gray-500">
        Baixe a planilha de exemplo, preencha uma linha por aluno e envie o arquivo em CSV. O número é opcional, e a turma precisa estar escrita como no
        sistema.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={MODELO_HREF}
          download="modelo-alunos.csv"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
        >
          <Download size={16} /> Planilha de exemplo
        </a>
        <label
          className={`flex items-center justify-center gap-1.5 rounded-lg border border-indigo-300 py-2.5 text-sm text-indigo-700 transition-colors focus-within:ring-2 focus-within:ring-indigo-500 hover:bg-indigo-50 ${
            ocupado ? "pointer-events-none opacity-60" : "cursor-pointer"
          }`}
        >
          <Upload size={16} /> {ocupado ? "Aguarde..." : "Enviar CSV"}
          <input type="file" accept=".csv,text/csv" onChange={selecionar} disabled={ocupado} className="sr-only" />
        </label>
      </div>

      {arquivo && <p className="mt-2 truncate text-xs text-gray-500">Arquivo: {arquivo}</p>}
      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

      {relatorio && !semErros && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <p className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            Nenhum aluno foi cadastrado. Corrija a planilha e envie de novo:
          </p>
          <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-6 text-xs">
            {relatorio.erros.map((mensagem) => (
              <li key={mensagem}>{mensagem}</li>
            ))}
          </ul>
        </div>
      )}

      {semErros && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="flex items-center gap-2">
            <CheckCircle size={16} className="shrink-0" />
            {relatorio.total === 1 ? "1 aluno pronto" : `${relatorio.total} alunos prontos`} para cadastrar.
          </p>
          <button
            type="button"
            onClick={confirmar}
            disabled={ocupado}
            className="mt-2 w-full rounded-lg bg-emerald-600 py-2.5 text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {ocupado ? "Cadastrando..." : "Confirmar cadastro"}
          </button>
        </div>
      )}
    </section>
  );
}
