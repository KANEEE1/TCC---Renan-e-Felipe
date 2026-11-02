"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarCheck, Clock, GraduationCap, Save, Send, Trophy, UserCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { diaMes, ESTADO_STYLE, estadoLabel, formatarNota, type SimuladoAluno, type SimuladoDetalhe } from "./simulado-types";

// O que está no formulário para cada aluno: nota digitada (texto) ou "Não presente".
interface Lancamento {
  valor: string;
  ausente: boolean;
}

const lancamentoDe = (aluno: SimuladoAluno): Lancamento => ({
  valor: aluno.valor !== null && !aluno.ausente ? String(aluno.valor).replace(".", ",") : "",
  ausente: aluno.ausente
});

const parseNota = (texto: string) => (texto.trim() === "" ? null : Number(texto.trim().replace(",", ".")));

// Mesmas regras (e mensagens) do backend.
function erroDaNota(texto: string, maxima: number) {
  const valor = parseNota(texto);
  if (valor === null) return null;
  if (!Number.isFinite(valor) || valor < 0 || valor > maxima) return `A nota precisa estar entre 0 e ${formatarNota(maxima)}`;
  if (Math.abs(Math.round(valor * 100) - valor * 100) > 1e-6) return "A nota pode ter no máximo duas casas decimais";
  return null;
}

function motivoSemLancamento(s: SimuladoDetalhe) {
  switch (s.estado) {
    case "CONFIGURACAO_PENDENTE":
      return "Este simulado está sem configuração (turmas, corretores, prazo ou pontuação máxima). A gestão completa pela agenda.";
    case "AGENDADO":
      return "A correção abre quando o simulado terminar.";
    case "ENVIADO":
      return `Correção enviada${s.correcaoEnviadaPor ? ` por ${s.correcaoEnviadaPor.name}` : ""}. Somente a gestão pode alterar as notas.`;
    case "ENCERRADO":
      return "O prazo da correção terminou. Alunos sem correção ficaram com zero; somente a gestão pode alterar as notas.";
    default:
      return "Somente os corretores do simulado e a gestão lançam as notas.";
  }
}

export function SimuladoDetail({ simuladoId }: { simuladoId: string }) {
  const [simulado, setSimulado] = useState<SimuladoDetalhe | null>(null);
  const [form, setForm] = useState<Record<string, Lancamento>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // `editados`: campos que o usuário mudou e ainda não salvou (preservados ao recarregar depois de um conflito).
  const aplicar = (detalhe: SimuladoDetalhe, editados: Record<string, Lancamento> = {}) => {
    setSimulado(detalhe);
    const inicial: Record<string, Lancamento> = {};
    for (const turma of detalhe.turmasComAlunos) {
      for (const aluno of turma.alunos) inicial[aluno.alunoId] = editados[aluno.alunoId] ?? lancamentoDe(aluno);
    }
    setForm(inicial);
  };

  useEffect(() => {
    api
      .get<SimuladoDetalhe>(`/simulados/${simuladoId}`)
      .then(aplicar)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Não foi possível carregar o simulado."))
      .finally(() => setLoading(false));
  }, [simuladoId]);

  const alunos = useMemo(() => simulado?.turmasComAlunos.flatMap((turma) => turma.alunos) ?? [], [simulado]);
  const maxima = simulado?.pontuacaoMaxima ?? 0;
  const podeLancar = !!simulado?.permissoes.lancar;

  const preenchido = (alunoId: string) => {
    const item = form[alunoId];
    return !!item && (item.ausente || item.valor.trim() !== "");
  };
  const lancados = alunos.filter((aluno) => preenchido(aluno.alunoId)).length;

  const atualizar = (alunoId: string, mudanca: Partial<Lancamento>) => {
    setFeedback(null);
    setForm((atual) => ({ ...atual, [alunoId]: { ...atual[alunoId], ...mudanca } }));
  };

  // Só vai o que mudou: outro corretor pode estar lançando ao mesmo tempo.
  const alterados = () =>
    alunos.flatMap((aluno) => {
      const atual = form[aluno.alunoId];
      const original = lancamentoDe(aluno);
      if (!atual || (atual.ausente === original.ausente && parseNota(atual.valor) === parseNota(original.valor))) return [];
      return [{ alunoId: aluno.alunoId, valor: atual.ausente ? null : parseNota(atual.valor), ausente: atual.ausente }];
    });

  const enviarNotas = async (enviar: boolean) => {
    if (!simulado || saving) return;
    const invalida = alunos.find((aluno) => !form[aluno.alunoId]?.ausente && erroDaNota(form[aluno.alunoId]?.valor ?? "", maxima));
    if (invalida) return setError(`${invalida.nome}: ${erroDaNota(form[invalida.alunoId].valor, maxima)}`);
    if (enviar) {
      const faltam = alunos.length - lancados;
      if (faltam > 0) return setError(`Faltam ${faltam} ${faltam === 1 ? "aluno" : "alunos"} sem nota ou Não presente`);
      if (!confirm("Depois de enviar, nenhum professor poderá mais editar as notas. Enviar a correção?")) return;
    }

    setError(null);
    setFeedback(null);
    setSaving(true);
    try {
      const detalhe = await api.put<SimuladoDetalhe>(`/simulados/${simulado.id}/notas`, { notas: alterados(), enviar });
      aplicar(detalhe);
      setFeedback(enviar ? "Correção enviada." : "Notas salvas.");
    } catch (err) {
      // 409: outro corretor salvou ao mesmo tempo (ou o simulado mudou). Recarrega mantendo o que o usuário editou.
      if (err instanceof ApiError && err.status === 409) {
        const editados = Object.fromEntries(alterados().map((item) => [item.alunoId, form[item.alunoId]]));
        try {
          aplicar(await api.get<SimuladoDetalhe>(`/simulados/${simulado.id}`), editados);
        } catch {
          // Mantém a tela como está; a mensagem abaixo já orienta a tentar de novo.
        }
        setError(err.message || "Outro corretor salvou ao mesmo tempo; confira e salve de novo.");
      } else {
        setError(err instanceof ApiError ? err.message : "Não foi possível salvar as notas.");
      }
    } finally {
      setSaving(false);
    }
  };

  const leitura = (aluno: SimuladoAluno) => {
    if (aluno.ausente) return <span className="text-slate-500">Não presente</span>;
    if (aluno.automatica) return <span className="text-red-600">0 (sem correção)</span>;
    if (aluno.valor === null) return <span className="text-slate-400">—</span>;
    return <span className="text-slate-800">{formatarNota(aluno.valor)}</span>;
  };

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-5 pb-5 pt-5 text-white">
        <div className="flex items-center gap-3">
          <Link href="/simulados" aria-label="Voltar">
            <ArrowLeft size={22} />
          </Link>
          <h1 className="min-w-0 truncate text-white">{simulado?.titulo ?? (loading ? "Carregando..." : "Simulado")}</h1>
        </div>
        {simulado && (
          <div className="mt-3 space-y-1 rounded-xl bg-white/15 p-3 text-sm text-orange-50">
            <p className="flex items-center gap-2">
              <Clock size={14} className="shrink-0" />
              <span className="capitalize">
                {new Date(`${simulado.data}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}
              </span>
              · {simulado.horarioInicio}–{simulado.horarioFim}
            </p>
            {simulado.turmas.length > 0 && (
              <p className="flex items-center gap-2">
                <GraduationCap size={14} className="shrink-0" />
                {simulado.turmas.map((t) => t.nome).join(", ")}
              </p>
            )}
            <p className="flex items-center gap-2">
              <UserCheck size={14} className="shrink-0" />
              Corretores: {simulado.corretores.length > 0 ? simulado.corretores.map((c) => c.name).join(", ") : "não definidos"}
            </p>
            <p className="flex items-center gap-2">
              <CalendarCheck size={14} className="shrink-0" />
              Prazo: {simulado.prazoCorrecao ? diaMes(simulado.prazoCorrecao) : "não definido"}
              <span className="mx-1">·</span>
              <Trophy size={14} className="shrink-0" />
              Pontuação máxima: {simulado.pontuacaoMaxima !== null ? formatarNota(simulado.pontuacaoMaxima) : "não definida"}
            </p>
          </div>
        )}
      </div>

      <div className={`flex-1 space-y-4 p-4 ${podeLancar ? "pb-44" : ""}`}>
        {simulado && (
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${ESTADO_STYLE[simulado.estado]}`}>{estadoLabel(simulado)}</span>
            <span className="text-sm text-slate-600">
              Média geral: {simulado.media !== null ? formatarNota(simulado.media) : "—"}
            </span>
          </div>
        )}
        {simulado && !podeLancar && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{motivoSemLancamento(simulado)}</p>}
        {simulado && alunos.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
            Nenhum aluno matriculado nas turmas deste simulado na data da prova.
          </p>
        )}

        {simulado?.turmasComAlunos.map((turma) => (
          <section key={turma.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm text-slate-800">{turma.nome}</h2>
              <span className="text-xs text-slate-500">Média {turma.media !== null ? formatarNota(turma.media) : "—"}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {turma.alunos.map((aluno) => {
                const item = form[aluno.alunoId] ?? { valor: "", ausente: false };
                const erro = !item.ausente ? erroDaNota(item.valor, maxima) : null;
                return (
                  <li key={aluno.alunoId} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                      {aluno.nome}
                      {podeLancar && aluno.automatica && <span className="ml-1.5 text-xs text-red-600">0 automático (sem correção)</span>}
                    </span>
                    {podeLancar ? (
                      <>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.ausente ? "" : item.valor}
                          disabled={item.ausente}
                          onChange={(e) => atualizar(aluno.alunoId, { valor: e.target.value })}
                          placeholder={item.ausente ? "—" : `0–${formatarNota(maxima)}`}
                          aria-label={`Nota de ${aluno.nome}`}
                          aria-invalid={!!erro}
                          title={erro ?? undefined}
                          className={`w-20 rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 disabled:opacity-50 ${
                            erro ? "bg-red-50 text-red-700 ring-1 ring-red-300 focus:ring-red-400" : "bg-slate-100 text-slate-800 focus:ring-blue-500"
                          }`}
                        />
                        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={item.ausente}
                            onChange={(e) => atualizar(aluno.alunoId, { ausente: e.target.checked, valor: e.target.checked ? "" : item.valor })}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Não presente
                        </label>
                      </>
                    ) : (
                      <span className="shrink-0 text-sm">{leitura(aluno)}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {!podeLancar && error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {simulado && podeLancar && (
        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <div className="mx-auto max-w-lg">
            <p className="mb-2 text-center text-sm text-slate-600">
              {lancados} de {alunos.length} alunos lançados
            </p>
            {error && <p className="mb-2 text-center text-sm text-red-600">{error}</p>}
            {feedback && <p className="mb-2 text-center text-sm text-emerald-600">{feedback}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => enviarNotas(false)}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-orange-300 py-3 text-sm text-orange-700 transition-colors hover:bg-orange-50 disabled:opacity-60"
              >
                <Save size={18} />
                {saving ? "Salvando..." : "Salvar"}
              </button>
              {simulado.permissoes.enviar && (
                <button
                  type="button"
                  onClick={() => enviarNotas(true)}
                  disabled={saving}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
                >
                  <Send size={18} />
                  Todas as provas corrigidas, enviar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
