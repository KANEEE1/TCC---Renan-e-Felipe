"use client";

import { useEffect, useRef, useState } from "react";
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

function notaReal(s: SimuladoNota) {
  if (s.ausente) return "Não presente";
  if (s.valor === null) return "—";
  const base = `${fmtNum(s.valor)}/${fmtNum(s.pontuacaoMaxima)}`;
  return s.automatica ? `${base} (sem correção)` : base;
}

// Geometria do gráfico, em pixels reais (o SVG acompanha a largura do card, então o texto não escala).
const H = 180;
const M = { top: 18, right: 14, bottom: 26, left: 42 };
const yDe = (pct: number) => M.top + (H - M.top - M.bottom) * (1 - pct / 100);

// Trechos contínuos de pontos existentes: a ausência quebra a linha.
function caminhos(pontos: ({ x: number; y: number } | null)[]) {
  const out: string[] = [];
  let atual = "";
  for (const p of pontos) {
    if (!p) {
      if (atual) out.push(atual);
      atual = "";
      continue;
    }
    atual += `${atual ? "L" : "M"}${p.x},${p.y}`;
  }
  if (atual) out.push(atual);
  return out;
}

function Grafico({ simulados }: { simulados: SimuladoNota[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(320);
  const [ativo, setAtivo] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const n = simulados.length;
  const PW = W - M.left - M.right;
  const larg = PW / n;
  const xDe = (i: number) => M.left + larg * (i + 0.5);
  const base = H - M.bottom;

  const pontosAluno = simulados.map((s, i) => (s.percentual !== null ? { x: xDe(i), y: yDe(s.percentual) } : null));
  const pontosTurma = simulados.map((s, i) => (s.mediaTurmaPercentual !== null ? { x: xDe(i), y: yDe(s.mediaTurmaPercentual) } : null));

  let ultimo = -1;
  simulados.forEach((s, i) => {
    if (s.percentual !== null) ultimo = i;
  });
  // Com colunas estreitas, só a primeira e a última data (e a destacada) aparecem, para não colidir.
  const mostraData = (i: number) => larg >= 44 || i === 0 || i === n - 1 || i === ativo;

  const sel = ativo !== null ? simulados[ativo] : null;
  const tooltipEsquerda = ativo !== null ? Math.min(Math.max(xDe(ativo), 80), W - 80) : 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full" style={{ background: COR_ALUNO }} /> Aluno
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="2" aria-hidden="true"><line x1="0" y1="1" x2="14" y2="1" stroke={COR_TURMA} strokeWidth="1.5" strokeDasharray="3 2" /></svg>
          Média da turma
        </span>
      </div>

      <div ref={ref} className="relative">
        <svg width={W} height={H} className="block touch-pan-y select-none" role="img" aria-label="Gráfico de notas em porcentagem por simulado; os mesmos dados estão na lista abaixo">
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={M.left} x2={W - M.right} y1={yDe(v)} y2={yDe(v)} stroke="#f1f5f9" strokeWidth="1" />
              <text x={M.left - 8} y={yDe(v) + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">{v}%</text>
            </g>
          ))}

          {ativo !== null && <line x1={xDe(ativo)} x2={xDe(ativo)} y1={M.top} y2={base} stroke="#e2e8f0" strokeWidth="1" />}

          {caminhos(pontosTurma).map((d, i) => (
            <path key={i} d={d} fill="none" stroke={COR_TURMA} strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" opacity="0.8" />
          ))}
          {caminhos(pontosAluno).map((d, i) => (
            <path key={i} d={d} fill="none" stroke={COR_ALUNO} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {simulados.map((s, i) =>
            s.ausente ? (
              <circle key={s.id} cx={xDe(i)} cy={base} r="3" fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
            ) : s.percentual !== null ? (
              <circle key={s.id} cx={xDe(i)} cy={yDe(s.percentual)} r={ativo === i ? 5 : 3.5} fill={COR_ALUNO} stroke="#fff" strokeWidth="2" />
            ) : null
          )}
          {ativo !== null && simulados[ativo].mediaTurmaPercentual !== null && (
            <circle cx={xDe(ativo)} cy={yDe(simulados[ativo].mediaTurmaPercentual!)} r="3.5" fill={COR_TURMA} stroke="#fff" strokeWidth="2" />
          )}

          {ultimo >= 0 && ativo === null && (
            <text
              x={xDe(ultimo)}
              y={yDe(simulados[ultimo].percentual!) - 10}
              textAnchor={xDe(ultimo) > W - M.right - 16 ? "end" : "middle"}
              fontSize="11"
              fontWeight="500"
              fill="#334155"
            >
              {fmtPct(simulados[ultimo].percentual!)}
            </text>
          )}

          {simulados.map((s, i) =>
            mostraData(i) ? (
              <text key={s.id} x={xDe(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={ativo === i ? "#334155" : "#94a3b8"}>
                {fmtData(s.data)}
              </text>
            ) : null
          )}

          {/* Área de acerto: coluna inteira, mouse, toque e teclado. */}
          {simulados.map((s, i) => (
            <rect
              key={s.id}
              x={M.left + larg * i}
              y={0}
              width={larg}
              height={H}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${s.titulo}, ${fmtDataCompleta(s.data)}: ${s.ausente ? "Não presente" : s.percentual !== null ? `${fmtPct(s.percentual)} (${notaReal(s)})` : "sem nota"}. Média da turma: ${s.mediaTurmaPercentual !== null ? fmtPct(s.mediaTurmaPercentual) : "sem dados"}`}
              className="outline-none"
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
            className="pointer-events-none absolute -top-2 z-10 w-40 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-800 px-2.5 py-2 text-[11px] leading-snug text-white shadow-lg"
            style={{ left: tooltipEsquerda }}
          >
            <p className="truncate font-medium">{sel.titulo}</p>
            <p className="text-slate-300">{fmtDataCompleta(sel.data)}</p>
            <p className="mt-1">{sel.ausente ? "Não presente" : sel.percentual !== null ? `${notaReal(sel)} · ${fmtPct(sel.percentual)}` : "—"}</p>
            <p className="text-slate-300">Turma: {sel.mediaTurmaPercentual !== null ? fmtPct(sel.mediaTurmaPercentual) : "—"}</p>
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
