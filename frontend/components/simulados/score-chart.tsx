"use client";

import { useEffect, useRef, useState } from "react";

const COR_PRINCIPAL = "#4f46e5";
const COR_COMPARACAO = "#d97706";

const fmtPct = (n: number) => `${Math.round(n)}%`;
const fmtData = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const fmtDataCompleta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

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

export interface PontoGrafico {
  id: string;
  titulo: string;
  data: string; // ISO yyyy-mm-dd
  principal: number | null;
  comparacao: number | null;
  ausente?: boolean;
  descricao: string; // texto para leitor de tela
  linhas: string[]; // tooltip: a 1ª em destaque, as demais em cinza
}

export function ScoreChart({ simulados, legendaPrincipal, legendaComparacao }: { simulados: PontoGrafico[]; legendaPrincipal: string; legendaComparacao: string }) {
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

  const pontosAluno = simulados.map((s, i) => (s.principal !== null ? { x: xDe(i), y: yDe(s.principal) } : null));
  const pontosTurma = simulados.map((s, i) => (s.comparacao !== null ? { x: xDe(i), y: yDe(s.comparacao) } : null));

  let ultimo = -1;
  simulados.forEach((s, i) => {
    if (s.principal !== null) ultimo = i;
  });
  // Com colunas estreitas, só a primeira e a última data (e a destacada) aparecem, para não colidir.
  const mostraData = (i: number) => larg >= 44 || i === 0 || i === n - 1 || i === ativo;

  const sel = ativo !== null ? simulados[ativo] : null;
  const tooltipEsquerda = ativo !== null ? Math.min(Math.max(xDe(ativo), 80), W - 80) : 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full" style={{ background: COR_PRINCIPAL }} /> {legendaPrincipal}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="2" aria-hidden="true"><line x1="0" y1="1" x2="14" y2="1" stroke={COR_COMPARACAO} strokeWidth="1.5" strokeDasharray="3 2" /></svg>
          {legendaComparacao}
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
            <path key={i} d={d} fill="none" stroke={COR_COMPARACAO} strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" opacity="0.8" />
          ))}
          {caminhos(pontosAluno).map((d, i) => (
            <path key={i} d={d} fill="none" stroke={COR_PRINCIPAL} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {simulados.map((s, i) =>
            s.ausente ? (
              <circle key={s.id} cx={xDe(i)} cy={base} r="3" fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
            ) : s.principal !== null ? (
              <circle key={s.id} cx={xDe(i)} cy={yDe(s.principal)} r={ativo === i ? 5 : 3.5} fill={COR_PRINCIPAL} stroke="#fff" strokeWidth="2" />
            ) : null
          )}
          {ativo !== null && simulados[ativo].comparacao !== null && (
            <circle cx={xDe(ativo)} cy={yDe(simulados[ativo].comparacao!)} r="3.5" fill={COR_COMPARACAO} stroke="#fff" strokeWidth="2" />
          )}

          {ultimo >= 0 && ativo === null && (
            <text
              x={xDe(ultimo)}
              y={yDe(simulados[ultimo].principal!) - 10}
              textAnchor={xDe(ultimo) > W - M.right - 16 ? "end" : "middle"}
              fontSize="11"
              fontWeight="500"
              fill="#334155"
            >
              {fmtPct(simulados[ultimo].principal!)}
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
              aria-label={s.descricao}
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
            {sel.linhas.map((l, k) => (
              <p key={k} className={k === 0 ? "mt-1" : "text-slate-300"}>{l}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

