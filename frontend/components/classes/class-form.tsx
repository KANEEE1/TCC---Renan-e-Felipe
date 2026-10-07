"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { api, ApiError } from "@/lib/api";

const YEARS = ["Extensivo", "Intensivo", "Semi-Intensivo", "Reta Final", "Específicas", "ENEM"];
const SHIFTS = ["Manhã", "Tarde", "Noite", "Integral"];

interface ClassDetail {
  nome: string;
  turno: string | null;
  sala: string | null;
  coordenador: string | null;
  capacidade: number | null;
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
    });
  }, [isEdit, classId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
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
      capacidade: formData.capacity ? Number(formData.capacity) : undefined
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

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button
            type="submit"
            disabled={loading}
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
