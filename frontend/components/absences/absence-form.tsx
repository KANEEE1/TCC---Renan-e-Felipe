"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { DIA_LABELS, toHHMM, weekdayOf } from "./absence-types";

interface AulaDTO {
  id: string;
  diaSemana: string;
  horarioInicio: string;
  horarioFim: string;
  disciplina: { nome: string };
  turma: { nome: string };
  professor: { id: string };
}

export function AbsenceForm() {
  const router = useRouter();
  const [aulas, setAulas] = useState<AulaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aulaId, setAulaId] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    const userId = getSessionUser()?.id;
    api
      .get<AulaDTO[]>("/schedule/weekly")
      .then((all) => setAulas(all.filter((aula) => aula.professor.id === userId)))
      .catch(() => setError("Não foi possível carregar suas aulas."))
      .finally(() => setLoading(false));
  }, []);

  const selected = aulas.find((aula) => aula.id === aulaId);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (selected && weekdayOf(date) !== selected.diaSemana) {
      setError(`A data escolhida não é uma ${DIA_LABELS[selected.diaSemana]}.`);
      return;
    }

    setSaving(true);
    try {
      await api.post("/absences", { aulaId, data: date, motivo: reason || undefined });
      router.push("/absences");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível registrar a falta.");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-rose-600 p-4 text-white">
        <Link href="/absences" className="mr-3">
          <ArrowLeft size={24} />
        </Link>
        <h1>Registrar Falta</h1>
      </div>

      {loading ? (
        <p className="p-4 text-center text-sm text-gray-400">Carregando...</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 pb-32">
          <div className="mb-4 space-y-4 rounded-lg bg-white p-4 shadow">
            <div>
              <label className="mb-2 block text-gray-700">Aula</label>
              <select
                value={aulaId}
                onChange={(e) => {
                  setAulaId(e.target.value);
                  setDate("");
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              >
                <option value="">Selecione</option>
                {aulas.map((aula) => (
                  <option key={aula.id} value={aula.id}>
                    {DIA_LABELS[aula.diaSemana]} {toHHMM(aula.horarioInicio)} · {aula.disciplina.nome} · {aula.turma.nome}
                  </option>
                ))}
              </select>
              {aulas.length === 0 && !error && <p className="mt-2 text-xs text-gray-500">Você não possui aulas na grade.</p>}
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Data</label>
              <input
                type="date"
                value={date}
                min={today}
                disabled={!selected}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:bg-gray-100"
                required
              />
              {selected && <p className="mt-1 text-xs text-gray-500">Escolha uma {DIA_LABELS[selected.diaSemana].toLowerCase()}.</p>}
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Motivo (opcional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
                rows={3}
              />
            </div>
          </div>

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving || !selected}
            className="flex w-full items-center justify-center rounded-lg bg-rose-600 py-3 text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
          >
            <Save size={18} className="mr-2" />
            {saving ? "Salvando..." : "Registrar falta"}
          </button>
        </form>
      )}
    </div>
  );
}
