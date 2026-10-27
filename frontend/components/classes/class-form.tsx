"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import {
  CurriculumEditor,
  makeRow,
  toDisciplinasPayload,
  type CargaRow,
  type CurriculumDiscipline as Discipline
} from "./curriculum-editor";

const SHIFTS = ["Manhã", "Tarde", "Noite", "Integral"];

interface ClassDetail {
  nome: string;
  turno: string | null;
  sala: string | null;
  coordenador: string | null;
  cargas?: { aulasPorSemana: number; duracaoMinutos: number; disciplina: { id: string; nome: string } }[];
}

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-teal-500";

type ClassFormProps = {
  isEdit?: boolean;
  classId?: string;
};

const EMPTY = { name: "", shift: "", room: "", coordinator: "" };

export function ClassForm({ isEdit = false, classId }: ClassFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<Discipline[]>([]);
  const [rows, setRows] = useState<CargaRow[]>([]);
  // Na edição, só libera o envio depois de carregar a matriz; senão o PUT apagaria as cargas.
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    api.get<Discipline[]>("/disciplinas").then(setCatalog).catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (!isEdit || !classId) return;
    api
      .get<ClassDetail>(`/classes/${classId}`)
      .then((cls) => {
        setFormData({
          name: cls.nome,
          shift: cls.turno ?? "",
          room: cls.sala ?? "",
          coordinator: cls.coordenador ?? ""
        });
        setRows((cls.cargas ?? []).map((carga) => makeRow(carga.disciplina.nome, carga.aulasPorSemana, carga.duracaoMinutos)));
        setLoaded(true);
      })
      .catch(() => setError("Não foi possível carregar a turma."));
  }, [isEdit, classId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const disciplinas = toDisciplinasPayload(rows, catalog);

    setLoading(true);

    // anoLetivo não aparece na tela: a turma é do ano corrente.
    const payload = {
      nome: formData.name,
      anoLetivo: new Date().getFullYear(),
      turno: formData.shift || undefined,
      sala: formData.room || undefined,
      coordenador: formData.coordinator || undefined,
      disciplinas
    };

    try {
      if (isEdit && classId) {
        await api.put(`/classes/${classId}`, payload);
      } else {
        await api.post("/classes", payload);
      }
      router.push("/classes");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-teal-600 p-4 text-white">
        <Link href="/classes" className="mr-3" aria-label="Voltar">
          <ArrowLeft size={24} />
        </Link>
        <h1>{isEdit ? "Editar Turma" : "Nova Turma"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-4 pb-32">
        <section className="space-y-4 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold text-gray-800">Informações da turma</h2>

          <div>
            <label className="mb-2 block text-sm text-gray-700">Nome da turma</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={inputClass}
              placeholder="Ex: Extensivo - Manhã"
              required
            />
          </div>

          <div>
            <span className="mb-2 block text-sm text-gray-700">Turno</span>
            <div className="grid grid-cols-4 gap-2">
              {SHIFTS.map((shift) => {
                const active = formData.shift === shift;
                return (
                  <button
                    key={shift}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFormData({ ...formData, shift: active ? "" : shift })}
                    className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                      active ? "border-teal-600 bg-teal-600 text-white" : "border-gray-300 bg-white text-gray-700 hover:border-teal-400"
                    }`}
                  >
                    {shift}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-gray-700">
                Sala <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                className={inputClass}
                placeholder="Ex: Sala 201"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-gray-700">
                Coordenador <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={formData.coordinator}
                onChange={(e) => setFormData({ ...formData, coordinator: e.target.value })}
                className={inputClass}
                placeholder="Nome do responsável"
              />
            </div>
          </div>
        </section>

        <CurriculumEditor rows={rows} onChange={setRows} catalog={catalog} onError={setError} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button
            type="submit"
            disabled={loading || !loaded}
            className="flex w-full items-center justify-center rounded-lg bg-teal-600 py-3 text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
          >
            <Save size={20} className="mr-2" />
            {loading ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Turma"}
          </button>
        </div>
      </form>
    </div>
  );
}
