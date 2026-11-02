"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { ScoreChart } from "@/components/simulados/score-chart";

interface SimuladoTurma {
  id: string;
  titulo: string;
  data: string;
  pontuacaoMaxima: number;
  mediaTurmaPercentual: number | null;
  mediaGeralPercentual: number | null;
  avaliados: number;
  ausentes: number;
}

interface NotasTurmaDTO {
  turma: { id: string; nome: string };
  media: number | null;
  simulados: SimuladoTurma[];
}

const fmtPct = (n: number | null) => (n === null ? "—" : `${Math.round(n)}%`);
const fmtDataCompleta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function ClassGrades({ classId }: { classId: string }) {
  const router = useRouter();
  const [dados, setDados] = useState<NotasTurmaDTO | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    api.get<NotasTurmaDTO>(`/simulados/turma/${classId}`).then(setDados).catch(() => setErro(true));
  }, [classId]);

  const recentes = dados ? [...dados.simulados].reverse() : [];

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-teal-600 to-emerald-700 p-4 text-white">
        <div className="flex items-center">
          <button type="button" onClick={() => router.back()} className="mr-3" aria-label="Voltar">
            <ArrowLeft size={24} />
          </button>
          <div className="min-w-0">
            <h1 className="text-white">Notas dos simulados</h1>
            {dados && <p className="truncate text-sm text-teal-200">{dados.turma.nome}</p>}
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
                    em {plural(dados.simulados.filter((s) => s.mediaTurmaPercentual !== null).length, "simulado", "simulados")}
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
                      principal: s.mediaTurmaPercentual,
                      comparacao: s.mediaGeralPercentual,
                      descricao: `${s.titulo}, ${fmtDataCompleta(s.data)}: turma ${s.mediaTurmaPercentual !== null ? fmtPct(s.mediaTurmaPercentual) : "sem dados"}, média geral ${s.mediaGeralPercentual !== null ? fmtPct(s.mediaGeralPercentual) : "sem dados"}`,
                      linhas: [`Turma: ${fmtPct(s.mediaTurmaPercentual)}`, `Geral: ${fmtPct(s.mediaGeralPercentual)}`, `${s.avaliados} fizeram · ${s.ausentes} faltaram`]
                    }))}
                    legendaPrincipal="Turma"
                    legendaComparacao="Média geral"
                  />
                </div>

                <div className="space-y-2">
                  {recentes.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-slate-800">{s.titulo}</p>
                          <p className="text-xs text-slate-500">{fmtDataCompleta(s.data)}</p>
                        </div>
                        <p className="shrink-0 text-slate-800">{fmtPct(s.mediaTurmaPercentual)}</p>
                      </div>
                      <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-slate-500">
                        <span>Média geral: {fmtPct(s.mediaGeralPercentual)}</span>
                        <span>{s.avaliados} fizeram · {s.ausentes} faltaram</span>
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
