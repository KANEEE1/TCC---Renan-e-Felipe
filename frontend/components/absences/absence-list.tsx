"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, Plus, User } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { toHHMM, type AbsenceDTO } from "./absence-types";

function formatDate(data: string) {
  return new Date(`${data.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");
}

export function AbsenceList() {
  const [absences, setAbsences] = useState<AbsenceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [isManagement, setIsManagement] = useState(false);

  useEffect(() => {
    setIsManagement(!!getSessionUser()?.roles.includes("GESTAO"));
    api
      .get<AbsenceDTO[]>("/absences")
      .then(setAbsences)
      .catch(() => setError("Não foi possível carregar as faltas."))
      .finally(() => setLoading(false));
  }, []);

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

        {!loading && error && <p className="text-center text-sm text-red-600">{error}</p>}

        {!loading && !error && absences.length === 0 && (
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
          </div>
        ))}
      </div>
    </div>
  );
}
