"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";

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

const COR_ALUNO = "#4f46e5";
const COR_TURMA = "#d97706";

const fmtPct = (n: number) => `${Math.round(n)}%`;
const fmtNum = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const fmtData = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const fmtDataCompleta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const truncar = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

function notaReal(s: SimuladoNota) {
  if (s.ausente) return "Não presente";
  if (s.valor === null) return "—";
  const base = `${fmtNum(s.valor)}/${fmtNum(s.pontuacaoMaxima)}`;
  return s.automatica ? `${base} (sem correção)` : base;
}

// Geometria do gráfico (unidades do viewBox).
const W = 360;
const H = 300;
const M = { top: 20, right: 18, bottom: 96, left: 40 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;
const yDe = (pct: number) => M.top + PH * (1 - pct / 100);

function Grafico({ simulados }: { simulados: SimuladoNota[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const n = simulados.length;
  const larg = PW / n;
  const xDe = (i: number) => M.left + larg * (i + 0.5);

  // Segmentos só entre pontos consecutivos existentes: a ausência quebra a linha.
  const segmentos = (valor: (s: SimuladoNota) => number | null) => {
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = valor(simulados[i]);
      const b = valor(simulados[i + 1]);
      if (a !== null && b !== null) out.push({ x1: xDe(i), y1: yDe(a), x2: xDe(i + 1), y2: yDe(b) });
    }
    return out;
  };

  let ultimo = -1;
  simulados.forEach((s, i) => {
    if (s.percentual !== null) ultimo = i;
  });

  const sel = ativo !== null ? simulados[ativo] : null;
  const tooltipEsquerda = ativo !== null ? Math.min(Math.max((xDe(ativo) / W) * 100, 22), 78) : 0;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true"><line x1="0" y1="4" x2="22" y2="4" stroke={COR_ALUNO} strokeWidth="2" /><circle cx="11" cy="4" r="3" fill={COR_ALUNO} /></svg>
          Aluno
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true"><line x1="0" y1="4" x2="22" y2="4" stroke={COR_TURMA} strokeWidth="2" strokeDasharray="4 3" /><circle cx="11" cy="4" r="2.5" fill={COR_TURMA} /></svg>
          Média da turma
        </span>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y select-none" role="img" aria-label="Gráfico de notas em porcentagem por simulado; os mesmos dados estão na tabela abaixo">
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={M.left} x2={W - M.right} y1={yDe(v)} y2={yDe(v)} stroke="#e2e8f0" strokeWidth="1" />
              <text x={M.left - 6} y={yDe(v) + 3} textAnchor="end" fontSize="10" fill="#64748b">{v}%</text>
            </g>
          ))}

          {ativo !== null && <line x1={xDe(ativo)} x2={xDe(ativo)} y1={M.top} y2={M.top + PH} stroke="#94a3b8" strokeWidth="1" />}

          {segmentos((s) => s.mediaTurmaPercentual).map((l, i) => (
            <line key={i} {...l} stroke={COR_TURMA} strokeWidth="2" strokeDasharray="5 4" />
          ))}
          {segmentos((s) => s.percentual).map((l, i) => (
            <line key={i} {...l} stroke={COR_ALUNO} strokeWidth="2" />
          ))}

          {simulados.map((s, i) => (
            <g key={s.id}>
              {s.mediaTurmaPercentual !== null && <circle cx={xDe(i)} cy={yDe(s.mediaTurmaPercentual)} r="3" fill={COR_TURMA} stroke="#fff" strokeWidth="1.5" />}
              {s.percentual !== null && <circle cx={xDe(i)} cy={yDe(s.percentual)} r="4.5" fill={COR_ALUNO} stroke="#fff" strokeWidth="2" />}
            </g>
          ))}

          {ultimo >= 0 && (
            <text
              x={xDe(ultimo)}
              y={yDe(simulados[ultimo].percentual!) - 10}
              textAnchor={xDe(ultimo) > W - M.right - 14 ? "end" : "middle"}
              fontSize="11"
              fontWeight="600"
              fill="#334155"
            >
              {fmtPct(simulados[ultimo].percentual!)}
            </text>
          )}

          {simulados.map((s, i) => {
            const x = xDe(i);
            const y = M.top + PH + 12;
            return (
              <g key={s.id}>
                <text x={x} y={y} fontSize="9.5" fill="#475569" textAnchor="end" transform={`rotate(-45 ${x} ${y})`} dy="3">
                  {fmtData(s.data)} · {truncar(s.titulo, 14)}
                </text>
                {s.ausente && (
                  <text x={x} y={M.top + PH - 6} fontSize="9" fill="#94a3b8" textAnchor="start" transform={`rotate(-90 ${x} ${M.top + PH - 6})`} dy="3">
                    Não presente
                  </text>
                )}
              </g>
            );
          })}

          {/* Área de acerto: coluna inteira, mouse, toque e teclado. */}
          {simulados.map((s, i) => (
            <rect
              key={s.id}
              x={M.left + larg * i}
              y={M.top}
              width={larg}
              height={PH + 4}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${s.titulo}, ${fmtDataCompleta(s.data)}: ${s.ausente ? "Não presente" : s.percentual !== null ? `${fmtPct(s.percentual)} (${notaReal(s)})` : "sem nota"}. Média da turma: ${s.mediaTurmaPercentual !== null ? fmtPct(s.mediaTurmaPercentual) : "sem dados"}`}
              className="outline-none focus-visible:stroke-indigo-500"
              onPointerMove={() => setAtivo(i)}
              onPointerDown={() => setAtivo(i)}
              onPointerLeave={(e) => e.pointerType === "mouse" && setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") (e.currentTarget.nextElementSibling as SVGElement | null)?.focus();
                if (e.key === "ArrowLeft") (e.currentTarget.previousElementSibling as SVGElement | null)?.focus();
              }}
            />
          ))}
        </svg>

        {sel && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-md"
            style={{ left: `${tooltipEsquerda}%` }}
          >
            <p className="truncate font-medium text-slate-800">{sel.titulo}</p>
            <p className="text-slate-500">{fmtDataCompleta(sel.data)}</p>
            <p className="mt-1">
              {sel.ausente ? "Não presente" : sel.percentual !== null ? `${notaReal(sel)} · ${fmtPct(sel.percentual)}` : "—"}
            </p>
            <p>Média da turma: {sel.mediaTurmaPercentual !== null ? fmtPct(sel.mediaTurmaPercentual) : "—"}</p>
          </div>
        )}
      </div>
    </div>
  );
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
                  <Grafico simulados={dados.simulados} />
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
