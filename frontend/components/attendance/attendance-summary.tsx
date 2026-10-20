"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";

interface TurmaOption {
  id: string;
  nome: string;
}

interface SummaryItem {
  alunoId: string;
  nome: string;
  turmas: TurmaOption[];
  totalRegistros: number;
  presencas: number;
  faltas: number;
  percentual: number | null;
  abaixoDoLimite: boolean;
  semRegistros: boolean;
}

interface SummaryDTO {
  limite: number;
  items: SummaryItem[];
}

export function AttendanceSummary() {
  const router = useRouter();
  const [classes, setClasses] = useState<TurmaOption[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [limite, setLimite] = useState(75);
  const [limiteInput, setLimiteInput] = useState("75");

  useEffect(() => {
    const value = Number(limiteInput);
    if (limiteInput.trim() === "" || !Number.isFinite(value) || value < 0 || value > 100) return;
    const timer = setTimeout(() => setLimite(value), 400);
    return () => clearTimeout(timer);
  }, [limiteInput]);
  const [summary, setSummary] = useState<SummaryDTO | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get<TurmaOption[]>("/classes").then(setClasses).catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ limite: String(Number.isFinite(limite) ? limite : 75) });
    if (turmaId) params.set("turmaId", turmaId);
    setError(false);
    api
      .get<SummaryDTO>(`/attendance/summary?${params.toString()}`)
      .then(setSummary)
      .catch(() => {
        setSummary(null);
        setError(true);
      });
  }, [turmaId, limite]);

  const withRecords = summary?.items.filter((i) => !i.semRegistros) ?? [];
  const withoutRecords = summary?.items.filter((i) => i.semRegistros) ?? [];

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 pb-6 pt-5 text-white">
        <button onClick={() => router.back()} className="mb-3 flex items-center gap-1 text-sm text-emerald-100">
          <ArrowLeft size={16} /> Voltar
        </button>
        <h1 className="text-white">Relatório de frequência</h1>
        <p className="mt-0.5 text-sm text-emerald-200">Frequência por aluno</p>
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
              <option value="">Todas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Limite mínimo (%)
            <input
              type="number"
              min={0}
              max={100}
              value={limiteInput}
              onChange={(e) => setLimiteInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            />
          </label>
        </div>

        {error && <p className="text-sm text-rose-500">Não foi possível carregar o relatório.</p>}

        {summary && withRecords.length === 0 && <p className="text-sm text-slate-400">Nenhum aluno com registros.</p>}

        <div className="space-y-2.5">
          {withRecords.map((item) => (
            <Link
              key={item.alunoId}
              href={`/attendance/report/${item.alunoId}`}
              className={`block rounded-2xl border p-4 shadow-sm ${item.abaixoDoLimite ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-slate-800">{item.nome}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{item.turmas.map((t) => t.nome).join(", ")}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {item.presencas} presenças · {item.faltas} faltas · {item.totalRegistros} registros
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm ${item.abaixoDoLimite ? "text-rose-600" : "text-emerald-600"}`}>{item.percentual}%</p>
                  {item.abaixoDoLimite ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-rose-600">
                      <AlertTriangle size={12} /> Abaixo do limite
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle size={12} /> Dentro do limite
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {withoutRecords.length > 0 && (
          <section>
            <h2 className="mb-2 text-slate-700">Sem registros</h2>
            <div className="space-y-2">
              {withoutRecords.map((item) => (
                <Link
                  key={item.alunoId}
                  href={`/attendance/report/${item.alunoId}`}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-600"
                >
                  <span>{item.nome}</span>
                  <span className="text-xs text-slate-400">{item.turmas.map((t) => t.nome).join(", ")}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
