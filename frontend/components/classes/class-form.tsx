"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";

const YEARS = ["Extensivo", "Intensivo", "Semi-Intensivo", "Reta Final", "Específicas", "ENEM"];
const SHIFTS = ["Manhã", "Tarde", "Noite", "Integral"];

interface ClassDetail {
  nome: string;
  turno: string | null;
  sala: string | null;
  coordenador: string | null;
  capacidade: number | null;
  cargas?: { aulasPorSemana: number; duracaoMinutos: number; disciplina: { id: string; nome: string } }[];
}

interface Discipline {
  id: string;
  nome: string;
}

interface CargaRow {
  nome: string;
  aulasPorSemana: string;
  duracaoMinutos: string;
}

const EMPTY_ROW: CargaRow = { nome: "", aulasPorSemana: "2", duracaoMinutos: "120" };

function normalize(nome: string) {
  return nome.trim().replace(/\s+/g, " ").toLowerCase();
}

type ClassFormProps = {
  isEdit?: boolean;
  classId?: string;
};

const EMPTY = { name: "", year: "", shift: "", room: "", coordinator: "", capacity: "" };

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
    api.get<ClassDetail>(`/classes/${classId}`).then((cls) => {
      setFormData({
        name: cls.nome,
        year: "",
        shift: cls.turno ?? "",
        room: cls.sala ?? "",
        coordinator: cls.coordenador ?? "",
        capacity: cls.capacidade ? String(cls.capacidade) : ""
      });
      setRows(
        (cls.cargas ?? []).map((carga) => ({
          nome: carga.disciplina.nome,
          aulasPorSemana: String(carga.aulasPorSemana),
          duracaoMinutos: String(carga.duracaoMinutos)
        }))
      );
      setLoaded(true);
    }).catch(() => setError("Não foi possível carregar a turma."));
  }, [isEdit, classId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const names = new Set<string>();
    for (const row of rows) {
      const key = normalize(row.nome);
      const aulas = Number(row.aulasPorSemana);
      const duracao = Number(row.duracaoMinutos);
      if (!key) return setError("Informe o nome de todas as disciplinas da turma.");
      if (names.has(key)) return setError(`Disciplina repetida: ${row.nome.trim()}.`);
      names.add(key);
      if (!Number.isInteger(aulas) || aulas < 1 || aulas > 20) return setError("Aulas por semana deve ser entre 1 e 20.");
      if (!Number.isInteger(duracao) || duracao < 30 || duracao > 240 || duracao % 5 !== 0) {
        return setError("Duração deve ser entre 30 e 240 minutos, em múltiplos de 5.");
      }
    }

    const disciplinas = rows.map((row) => {
      const match = catalog.find((d) => normalize(d.nome) === normalize(row.nome));
      return {
        ...(match ? { disciplinaId: match.id } : { nome: row.nome.trim() }),
        aulasPorSemana: Number(row.aulasPorSemana),
        duracaoMinutos: Number(row.duracaoMinutos)
      };
    });

    setLoading(true);

    // "Ano/Série" (year) describes the course track, not the school's academic
    // year (anoLetivo) the backend tracks — there's no field for it on Turma,
    // so it isn't sent. anoLetivo defaults to the current calendar year.
    const payload = {
      nome: formData.name,
      anoLetivo: new Date().getFullYear(),
      turno: formData.shift || undefined,
      sala: formData.room || undefined,
      coordenador: formData.coordinator || undefined,
      capacidade: formData.capacity ? Number(formData.capacity) : undefined,
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
        <Link href="/classes" className="mr-3">
          <ArrowLeft size={24} />
        </Link>
        <h1>{isEdit ? "Editar Turma" : "Nova Turma"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="space-y-4 rounded-lg bg-white p-4 shadow">
          <div>
            <label className="mb-2 block text-gray-700">Nome da Turma</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Ex: Extensivo - Manhã"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Ano/Série</label>
            <select
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Selecione o ano</option>
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Turno</label>
            <select
              value={formData.shift}
              onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Selecione o turno</option>
              {SHIFTS.map((shift) => (
                <option key={shift} value={shift}>
                  {shift}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Sala</label>
            <input
              type="text"
              value={formData.room}
              onChange={(e) => setFormData({ ...formData, room: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Ex: Sala 201"
            />
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Coordenador</label>
            <input
              type="text"
              value={formData.coordinator}
              onChange={(e) => setFormData({ ...formData, coordinator: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Nome do responsável"
            />
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Capacidade Máxima</label>
            <input
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Número máximo de alunos"
              min="1"
            />
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Disciplinas da turma</label>
            <datalist id="class-form-disciplinas">
              {catalog.map((d) => (
                <option key={d.id} value={d.nome} />
              ))}
            </datalist>
            <div className="space-y-3">
              {rows.map((row, index) => {
                const update = (patch: Partial<CargaRow>) =>
                  setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
                return (
                  <div key={index} className="space-y-2 rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        list="class-form-disciplinas"
                        value={row.nome}
                        onChange={(e) => update({ nome: e.target.value })}
                        placeholder="Disciplina"
                        aria-label="Disciplina"
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                        aria-label="Remover disciplina"
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-gray-500">
                        Aulas/semana
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={row.aulasPorSemana}
                          onChange={(e) => update({ aulasPorSemana: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </label>
                      <label className="text-xs text-gray-500">
                        Duração (min)
                        <input
                          type="number"
                          min={30}
                          max={240}
                          step={5}
                          value={row.duracaoMinutos}
                          onChange={(e) => update({ duracaoMinutos: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, { ...EMPTY_ROW }])}
              className="mt-3 flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700"
            >
              <Plus size={16} /> Adicionar disciplina
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

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
