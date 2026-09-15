"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

const YEARS = ["Extensivo", "Intensivo", "Semi-Intensivo", "Reta Final", "Específicas", "ENEM"];
const SHIFTS = ["Manhã", "Tarde", "Noite", "Integral"];
const COORDINATORS = ["Ana Silva", "Carlos Santos", "Maria Oliveira", "João Costa"];

const EDIT_DEFAULTS = {
  name: "Extensivo - Manhã",
  year: "Extensivo",
  shift: "Manhã",
  room: "Sala 201",
  coordinator: "Maria Oliveira",
  capacity: "50"
};

const EMPTY_DEFAULTS = {
  name: "",
  year: "",
  shift: "",
  room: "",
  coordinator: "",
  capacity: ""
};

type ClassFormProps = {
  isEdit?: boolean;
};

export function ClassForm({ isEdit = false }: ClassFormProps) {
  const [formData, setFormData] = useState(isEdit ? EDIT_DEFAULTS : EMPTY_DEFAULTS);

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-teal-600 p-4 text-white">
        <Link href="/classes" className="mr-3">
          <ArrowLeft size={24} />
        </Link>
        <h1>{isEdit ? "Editar Turma" : "Nova Turma"}</h1>
      </div>

      <form onSubmit={(event) => event.preventDefault()} className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="space-y-4 rounded-lg bg-white p-4 shadow">
          <div>
            <label className="mb-2 block text-gray-700">Nome da Turma</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Ex: 8º Ano A"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Ano/Série</label>
            <select
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
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
              required
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
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Coordenador</label>
            <select
              value={formData.coordinator}
              onChange={(e) => setFormData({ ...formData, coordinator: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            >
              <option value="">Selecione um responsável</option>
              {COORDINATORS.map((coord) => (
                <option key={coord} value={coord}>
                  {coord}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Capacidade Máxima</label>
            <input
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Número máximo de alunos"
              required
              min="1"
            />
          </div>
        </div>

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button type="submit" className="flex w-full items-center justify-center rounded-lg bg-teal-600 py-3 text-white transition-colors hover:bg-teal-700">
            <Save size={20} className="mr-2" />
            {isEdit ? "Salvar Alterações" : "Criar Turma"}
          </button>
        </div>
      </form>
    </div>
  );
}
