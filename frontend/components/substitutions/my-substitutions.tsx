"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { isPastDate } from "@/lib/date";
import { api, ApiError } from "@/lib/api";
import {
  DIA_LABELS,
  SUBSTITUICAO_STATUS_LABELS,
  toHHMM,
} from "@/components/absences/absence-types";

export interface MySubstitutionDTO {
  id: string;
  status: "PENDENTE" | "ACEITA" | "RECUSADA";
  ausencia: {
    id: string;
    data: string;
    aula: {
      diaSemana: string;
      horarioInicio: string;
      horarioFim: string;
      turma: { id: string; nome: string };
      disciplina: { id: string; nome: string };
      professor: { id: string; name: string };
    };
  };
}

function isPastSubstitution(item: { ausencia: { data: string } }) {
  return isPastDate(item.ausencia.data);
}

function formatDate(data: string) {
  return new Date(`${data.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");
}

export function MySubstitutions() {
  const [items, setItems] = useState<MySubstitutionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(() => {
    const request = ++requestRef.current;
    setLoading(true);
    setLoadError(null);
    api
      .get<MySubstitutionDTO[]>("/substitutions/mine")
      .then((data) => {
        if (request === requestRef.current) setItems(data);
      })
      .catch(() => {
        if (request === requestRef.current)
          setLoadError("Não foi possível carregar suas substituições.");
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }, []);

  useEffect(load, [load]);

  const handleRespond = async (
    item: MySubstitutionDTO,
    status: "ACEITA" | "RECUSADA",
  ) => {
    const question =
      status === "ACEITA"
        ? "Aceitar esta substituição?"
        : "Recusar esta substituição?";
    if (busyId || !confirm(question)) return;
    setActionError(null);
    setBusyId(item.id);
    try {
      const updated = await api.put<MySubstitutionDTO>(
        `/substitutions/${item.id}/response`,
        { status },
      );
      setItems((prev) =>
        prev.map((current) => (current.id === updated.id ? updated : current)),
      );
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível responder à substituição.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const pending = items.filter((item) => item.status === "PENDENTE");
  const history = items.filter((item) => item.status !== "PENDENTE");

  const renderDetails = (item: MySubstitutionDTO) => {
    const { aula, data } = item.ausencia;
    return (
      <>
        <h3 className="truncate text-slate-800">
          {aula.disciplina.nome} · {aula.turma.nome}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Calendar size={12} /> {formatDate(data)} (
            {DIA_LABELS[aula.diaSemana] ?? aula.diaSemana})
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} /> {toHHMM(aula.horarioInicio)}–
            {toHHMM(aula.horarioFim)}
          </span>
          <span className="flex items-center gap-1">
            <User size={12} /> Titular: {aula.professor.name}
          </span>
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="bg-gradient-to-r from-rose-600 to-orange-600 px-5 pb-7 pt-5 text-white">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" aria-label="Voltar">
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1 className="text-white">Minhas substituições</h1>
            <p className="mt-0.5 text-sm text-rose-100">
              Aulas em que você foi designado como substituto
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-4">
        {loading && (
          <p className="text-center text-sm text-slate-400">Carregando...</p>
        )}
        {loadError && (
          <div className="text-center text-sm text-red-600">
            <p>{loadError}</p>
            <button type="button" onClick={load} className="mt-1 underline">
              Tentar novamente
            </button>
          </div>
        )}
        {actionError && (
          <p className="text-center text-sm text-red-600">{actionError}</p>
        )}

        {!loading && !loadError && items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
            Nenhuma substituição designada.
          </p>
        )}

        {pending.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="text-slate-700">Pendentes</h2>
            {pending.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                {renderDetails(item)}
                {isPastSubstitution(item) ? (
                  <p className="mt-3 text-xs text-slate-400">
                    A data já passou; não é mais possível responder.
                  </p>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRespond(item, "ACEITA")}
                      disabled={busyId !== null}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Aceitar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespond(item, "RECUSADA")}
                      disabled={busyId !== null}
                      className="rounded-lg bg-red-50 px-3 py-1 text-xs text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
                    >
                      Recusar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {history.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="text-slate-700">Histórico</h2>
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                {renderDetails(item)}
                <p className="mt-2 text-sm text-slate-600">
                  {SUBSTITUICAO_STATUS_LABELS[item.status]}
                </p>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
