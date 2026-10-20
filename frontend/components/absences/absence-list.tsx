"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, Plus, User } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { SUBSTITUICAO_STATUS_LABELS, toHHMM, type AbsenceDTO } from "./absence-types";

function formatDate(data: string) {
  return new Date(`${data.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");
}

interface CandidateOption {
  id: string;
  name: string;
  lecionaDisciplina: boolean;
  disponivel: boolean;
  carga: { aulasSemanais: number; substituicoesMes: number };
}

export function AbsenceList() {
  const [absences, setAbsences] = useState<AbsenceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [isManagement, setIsManagement] = useState(false);
  const [candidates, setCandidates] = useState<Record<string, CandidateOption[]>>({});
  const [candidatesError, setCandidatesError] = useState<Record<string, boolean>>({});
  const [selectedSubstitutes, setSelectedSubstitutes] = useState<Record<string, string>>({});
  const [busySubstitutionId, setBusySubstitutionId] = useState<string | null>(null);

  useEffect(() => {
    const management = !!getSessionUser()?.roles.includes("GESTAO");
    setIsManagement(management);
    api
      .get<AbsenceDTO[]>("/absences")
      .then((data) => {
        setAbsences(data);
        if (management) data.filter((absence) => !absence.substituicao).forEach((absence) => loadCandidates(absence.id));
      })
      .catch(() => setError("Não foi possível carregar as faltas."))
      .finally(() => setLoading(false));
  }, []);

  const loadCandidates = (absenceId: string) =>
    api
      .get<CandidateOption[]>(`/substitutions/candidates?ausenciaId=${encodeURIComponent(absenceId)}`)
      .then((list) => {
        setCandidatesError((prev) => ({ ...prev, [absenceId]: false }));
        setCandidates((prev) => ({ ...prev, [absenceId]: list }));
        if (list.length > 0) setSelectedSubstitutes((prev) => ({ ...prev, [absenceId]: prev[absenceId] ?? list[0].id }));
      })
      .catch(() => setCandidatesError((prev) => ({ ...prev, [absenceId]: true })));

  const updateSubstitution = (id: string, substituicao: AbsenceDTO["substituicao"]) =>
    setAbsences((prev) => prev.map((absence) => (absence.id === id ? { ...absence, substituicao } : absence)));

  const handleAssign = async (absenceId: string) => {
    const substitutoId = selectedSubstitutes[absenceId];
    if (busySubstitutionId || !substitutoId) return;
    setError(null);
    setBusySubstitutionId(absenceId);
    try {
      const created = await api.post<NonNullable<AbsenceDTO["substituicao"]>>("/substitutions", { ausenciaId: absenceId, substitutoId });
      updateSubstitution(absenceId, { id: created.id, status: created.status, substituto: created.substituto });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível designar o substituto.");
    } finally {
      setBusySubstitutionId(null);
    }
  };

  const handleUnassign = async (absenceId: string, substitutionId: string) => {
    if (busySubstitutionId || !confirm("Cancelar a designação do substituto?")) return;
    setError(null);
    setBusySubstitutionId(absenceId);
    try {
      await api.delete(`/substitutions/${substitutionId}`);
      updateSubstitution(absenceId, null);
      setSelectedSubstitutes((prev) => {
        const { [absenceId]: _removed, ...rest } = prev;
        return rest;
      });
      loadCandidates(absenceId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível cancelar a designação.");
    } finally {
      setBusySubstitutionId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (cancelingId || !confirm("Cancelar esta falta?")) return;
    setError(null);
    setCancelingId(id);
    try {
      await api.delete(`/absences/${id}`);
      setAbsences((prev) => prev.filter((absence) => absence.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível cancelar a falta.");
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-rose-600 to-orange-600 px-5 pb-7 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" aria-label="Voltar">
              <ArrowLeft size={22} />
            </Link>
            <div>
              <h1 className="text-white">Faltas de professores</h1>
              <p className="mt-0.5 text-sm text-rose-100">{isManagement ? "Todas as faltas registradas" : "Minhas faltas"}</p>
            </div>
          </div>
          <Link
            href="/absences/add"
            aria-label="Registrar falta"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm transition-colors hover:bg-rose-50"
          >
            <Plus size={20} className="text-rose-600" />
          </Link>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-6 pt-4">
        {loading && <p className="text-center text-sm text-slate-400">Carregando...</p>}

        {error && <p className="text-center text-sm text-red-600">{error}</p>}

        {!loading && absences.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
            Nenhuma falta registrada.
          </p>
        )}

        {absences.map((absence) => (
          <div key={absence.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="min-w-0 flex-1 truncate text-slate-800">
                {absence.aula.disciplina.nome} · {absence.aula.turma.nome}
              </h3>
              {absence.permissoes.cancelar && (
                <button
                  type="button"
                  onClick={() => handleCancel(absence.id)}
                  disabled={cancelingId === absence.id}
                  className="shrink-0 rounded-lg bg-red-50 px-3 py-1 text-xs text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
                >
                  Cancelar
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar size={12} /> {formatDate(absence.data)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} /> {toHHMM(absence.aula.horarioInicio)}–{toHHMM(absence.aula.horarioFim)}
              </span>
              {isManagement && (
                <span className="flex items-center gap-1">
                  <User size={12} /> {absence.aula.professor.name}
                </span>
              )}
            </div>
            {absence.motivo && <p className="mt-2 text-sm text-slate-600">{absence.motivo}</p>}
            {absence.substituicao && (
              <div className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-600">
                <span>
                  Substituto: {absence.substituicao.substituto.name} ({SUBSTITUICAO_STATUS_LABELS[absence.substituicao.status]})
                </span>
                {isManagement && absence.substituicao.status === "PENDENTE" && (
                  <button
                    type="button"
                    onClick={() => handleUnassign(absence.id, absence.substituicao!.id)}
                    disabled={busySubstitutionId === absence.id}
                    className="shrink-0 rounded-lg bg-slate-100 px-3 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60"
                  >
                    Cancelar designação
                  </button>
                )}
              </div>
            )}
            {isManagement && !absence.substituicao && candidatesError[absence.id] && (
              <p className="mt-2 text-sm text-rose-500">Não foi possível carregar os candidatos.</p>
            )}
            {isManagement && !absence.substituicao && !candidatesError[absence.id] && candidates[absence.id] && (
              candidates[absence.id].length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">Nenhum professor elegível</p>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={selectedSubstitutes[absence.id] ?? ""}
                    onChange={(e) => setSelectedSubstitutes((prev) => ({ ...prev, [absence.id]: e.target.value }))}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
                  >
                    {candidates[absence.id].map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                        {candidate.lecionaDisciplina ? " · Leciona a disciplina" : ""}
                        {candidate.disponivel ? " · Disponível" : ""}
                        {` · ${candidate.carga.aulasSemanais} aulas/sem, ${candidate.carga.substituicoesMes} subst./mês`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleAssign(absence.id)}
                    disabled={!selectedSubstitutes[absence.id] || busySubstitutionId === absence.id}
                    className="shrink-0 rounded-lg bg-rose-600 px-3 py-1 text-xs text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
                  >
                    Designar substituto
                  </button>
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
