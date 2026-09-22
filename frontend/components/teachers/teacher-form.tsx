"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

const AVAILABLE_SUBJECTS = [
  "Matemática",
  "Física",
  "Química",
  "Biologia",
  "História",
  "Geografia",
  "Português",
  "Literatura",
  "Redação",
  "Inglês",
  "Filosofia",
  "Sociologia"
];

const EDIT_DEFAULTS = {
  name: "Ana Silva",
  email: "ana.silva@escola.com",
  phone: "(11) 98765-4321",
  subjects: ["Matemática", "Física"],
  status: "Ativo"
};

const EMPTY_DEFAULTS = {
  name: "",
  email: "",
  phone: "",
  subjects: [] as string[],
  status: "Ativo"
};

type TeacherFormProps = {
  isEdit?: boolean;
};

export function TeacherForm({ isEdit = false }: TeacherFormProps) {
  const [formData, setFormData] = useState(isEdit ? EDIT_DEFAULTS : EMPTY_DEFAULTS);

  const handleSubjectToggle = (subject: string) => {
    setFormData((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject]
    }));
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-blue-600 p-4 text-white">
        <Link href="/teachers" className="mr-3">
          <ArrowLeft size={24} />
        </Link>
        <h1>{isEdit ? "Editar Professor" : "Novo Professor"}</h1>
      </div>

      <form onSubmit={(event) => event.preventDefault()} className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="space-y-4 rounded-lg bg-white p-4 shadow">
          <div>
            <label className="mb-2 block text-gray-700">Nome Completo</label>
            <input
              type="text"
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Digite o nome completo"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-gray-700">E-mail</label>
            <input
              type="email"
              value={formData.email}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@escola.com"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Telefone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="(11) 98765-4321"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Disciplinas</label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_SUBJECTS.map((subject) => (
                <label
                  key={subject}
                  className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                    formData.subjects.includes(subject) ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.subjects.includes(subject)}
                    onChange={() => handleSubjectToggle(subject)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-900">{subject}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-gray-700">Status</label>
            <select
              value={formData.status}
              onChange={(event) => setFormData({ ...formData, status: event.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
              <option value="Férias">Férias</option>
              <option value="Licença">Licença</option>
            </select>
          </div>
        </div>

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 py-3 text-white transition-colors hover:bg-blue-700"
          >
            <Save size={20} className="mr-2" />
            {isEdit ? "Salvar Alterações" : "Cadastrar Professor"}
          </button>
        </div>
      </form>
    </div>
  );
}
