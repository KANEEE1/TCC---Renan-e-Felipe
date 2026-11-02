"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { ScoreChart } from "@/components/simulados/score-chart";

interface SimuladoNota {
  id: string;
  titulo: string;
  data: string;
  pontuacaoMaxima: number;
  valor: number | null;
  ausente: boolean;
  automatica: boolean;
  percentual: number | null;
  mediaTurmaPercentual: number | null;
  turma: { id: string; nome: string };
}

interface NotasDTO {
  aluno: { id: string; nome: string };
  media: number | null;
  simulados: SimuladoNota[];
}

const fmtPct = (n: number) => `${Math.round(n)}%`;
const fmtNum = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const fmtDataCompleta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

function notaReal(s: SimuladoNota) {
  if (s.ausente) return "Não presente";
  if (s.valor === null) return "—";
  const base = `${fmtNum(s.valor)}/${fmtNum(s.pontuacaoMaxima)}`;
  return s.automatica ? `${base} (sem correção)` : base;
}

export function StudentGrades({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [dados, setDados] = useState<NotasDTO | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    api.get<NotasDTO>(`/simulados/aluno/${studentId}`).then(setDados).catch(() => setErro(true));
  }, [studentId]);

  const recentes = dados ? [...dados.simulados].reverse() : [];

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-indigo-600 p-4 text-white">
        <div className="flex items-center">
          <button type="button" onClick={() => router.back()} className="mr-3" aria-label="Voltar">
            <ArrowLeft size={24} />
          </button>
          <div className="min-w-0">
            <h1 className="text-white">Notas dos simulados</h1>
            {dados && <p className="truncate text-sm text-indigo-200">{dados.aluno.nome}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {erro && <p className="text-sm text-slate-500">Não foi possível carregar as notas.</p>}

        {dados && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {dados.media === null ? (
                <p className="text-sm text-slate-500">Nenhum simulado corrigido ainda.</p>
              ) : (
                <>
                  <p className="text-xs text-slate-500">Média geral</p>
                  <p className="text-4xl leading-tight text-slate-800">{fmtPct(dados.media)}</p>
                  <p className="text-xs text-slate-500">
                    em {dados.simulados.filter((s) => s.percentual !== null).length} simulado(s)
                  </p>
                </>
              )}
            </div>

            {dados.simulados.length > 0 && (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <ScoreChart
                    simulados={dados.simulados.map((s) => ({
                      id: s.id,
                      titulo: s.titulo,
                      data: s.data,
                      principal: s.percentual,
                      comparacao: s.mediaTurmaPercentual,
                      ausente: s.ausente,
                      descricao: `${s.titulo}, ${fmtDataCompleta(s.data)}: ${s.ausente ? "Não presente" : s.percentual !== null ? `${fmtPct(s.percentual)} (${notaReal(s)})` : "sem nota"}. Média da turma: ${s.mediaTurmaPercentual !== null ? fmtPct(s.mediaTurmaPercentual) : "sem dados"}`,
                      linhas: [
                        s.ausente ? "Não presente" : s.percentual !== null ? `${notaReal(s)} · ${fmtPct(s.percentual)}` : "—",
                        `Turma: ${s.mediaTurmaPercentual !== null ? fmtPct(s.mediaTurmaPercentual) : "—"}`
                      ]
                    }))}
                    legendaPrincipal="Aluno"
                    legendaComparacao="Média da turma"
                  />
                </div>

                <div className="space-y-2">
                  {recentes.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-slate-800">{s.titulo}</p>
                          <p className="text-xs text-slate-500">{fmtDataCompleta(s.data)} · {s.turma.nome}</p>
                        </div>
                        <p className="shrink-0 text-slate-800">{s.percentual !== null ? fmtPct(s.percentual) : "—"}</p>
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-slate-500">
                        <span>Nota: {notaReal(s)}</span>
                        <span>Média da turma: {s.mediaTurmaPercentual !== null ? fmtPct(s.mediaTurmaPercentual) : "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
