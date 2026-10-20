"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";

interface TurmaOption {
  id: string;
  nome: string;
}

interface PerformanceDTO {
  turmaId: string;
  limite: number;
  totalNotas: number;
  mediaGeral: number | null;
  porDisciplina: { disciplinaId: string | null; nome: string; media: number; totalNotas: number }[];
  porSimulado: { simuladoId: string; nome: string; data: string; disciplinaId: string | null; media: number; totalNotas: number }[];
  alunosAbaixoDoLimite: { alunoId: string; nome: string; media: number }[];
  piorDisciplina: { disciplinaId: string | null; nome: string; media: number } | null;
}

export function ClassPerformance() {
  const router = useRouter();
  const [classes, setClasses] = useState<TurmaOption[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [limite, setLimite] = useState(6);
  const [limiteInput, setLimiteInput] = useState("6");
  const [data, setData] = useState<PerformanceDTO | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [classesError, setClassesError] = useState(false);

  useEffect(() => {
    api.get<TurmaOption[]>("/classes").then(setClasses).catch(() => setClassesError(true));
  }, []);

  useEffect(() => {
    const value = Number(limiteInput);
    if (limiteInput.trim() === "" || !Number.isFinite(value) || value < 0 || value > 10) return;
    const timer = setTimeout(() => setLimite(value), 400);
    return () => clearTimeout(timer);
  }, [limiteInput]);

  useEffect(() => {
    if (!turmaId) {
      setData(null);
      setError(false);
      return;
    }
    let cancelled = false;
    setError(false);
    setData(null);
    setLoading(true);
    api
      .get<PerformanceDTO>(`/grades/class-summary/${turmaId}?limite=${limite}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [turmaId, limite]);

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-5 pb-6 pt-5 text-white">
        <button onClick={() => router.back()} className="mb-3 flex items-center gap-1 text-sm text-amber-100">
          <ArrowLeft size={16} /> Voltar
        </button>
        <h1 className="text-white">Desempenho por turma</h1>
        <p className="mt-0.5 text-sm text-amber-100">Notas de simulados agregadas</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-500">
            Turma
            <select
              value={turmaId}
              onChange={(e) => setTurmaId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="">Selecione...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Nota mínima (0–10)
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={limiteInput}
              onChange={(e) => setLimiteInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            />
          </label>
        </div>

        {!turmaId && <p className="text-sm text-slate-400">Selecione uma turma para ver o desempenho.</p>}
        {classesError && <p className="text-sm text-rose-500">Não foi possível carregar as turmas.</p>}
        {loading && <p className="text-sm text-slate-400">Carregando...</p>}
        {error && <p className="text-sm text-rose-500">Não foi possível carregar o desempenho.</p>}
        {data && data.totalNotas === 0 && <p className="text-sm text-slate-400">Nenhuma nota registrada para esta turma.</p>}

        {data && data.totalNotas > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                <p className="text-xl text-slate-800">{data.mediaGeral}</p>
                <p className="text-[10px] text-slate-400">Média geral</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                <p className="text-xl text-slate-800">{data.totalNotas}</p>
                <p className="text-[10px] text-slate-400">Notas</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                <p className="truncate text-sm text-slate-800">{data.piorDisciplina ? `${data.piorDisciplina.nome} (${data.piorDisciplina.media})` : "–"}</p>
                <p className="text-[10px] text-slate-400">Pior disciplina</p>
              </div>
            </div>

            <section>
              <h2 className="mb-2 text-slate-700">Por disciplina</h2>
              <table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
                <thead className="text-left text-xs text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Disciplina</th>
                    <th className="px-3 py-2">Média</th>
                    <th className="px-3 py-2">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porDisciplina.map((d) => (
                    <tr key={d.disciplinaId ?? "none"} className="border-t border-slate-100 text-slate-700">
                      <td className="px-3 py-2">{d.nome}</td>
                      <td className="px-3 py-2">{d.media}</td>
                      <td className="px-3 py-2">{d.totalNotas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <h2 className="mb-2 text-slate-700">Por simulado</h2>
              <table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
                <thead className="text-left text-xs text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Simulado</th>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Média</th>
                    <th className="px-3 py-2">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porSimulado.map((s) => (
                    <tr key={s.simuladoId} className="border-t border-slate-100 text-slate-700">
                      <td className="px-3 py-2">{s.nome}</td>
                      <td className="px-3 py-2">{new Date(s.data.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                      <td className="px-3 py-2">{s.media}</td>
                      <td className="px-3 py-2">{s.totalNotas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <h2 className="mb-2 text-slate-700">Alunos abaixo de {limite}</h2>
              {data.alunosAbaixoDoLimite.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum aluno abaixo do limite.</p>
              ) : (
                <div className="space-y-2">
                  {data.alunosAbaixoDoLimite.map((a) => (
                    <div key={a.alunoId} className="flex items-center justify-between gap-2 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm">
                      <span className="text-slate-800">{a.nome}</span>
                      <Link href={`/attendance/report/${a.alunoId}`} className="text-xs text-indigo-600 underline">
                        ver frequência
                      </Link>
                      <span className="inline-flex items-center gap-1 text-xs text-rose-600">
                        <AlertTriangle size={12} /> Abaixo do limite · {a.media}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
