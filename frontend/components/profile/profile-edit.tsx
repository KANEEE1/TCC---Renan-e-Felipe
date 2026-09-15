"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Save } from "lucide-react";

const AVAILABLE_SUBJECTS = [
  "Matemática", "Física", "Química", "Biologia", "História",
  "Geografia", "Português", "Literatura", "Redação", "Inglês",
  "Filosofia", "Sociologia"
];

const userRole: string = "gestão";

const INITIAL_FORM = {
  name: "Ana Silva",
  email: "ana.silva@cursinho.com",
  phone: "(11) 98765-4321",
  department: "Ciências Exatas",
  subjects: ["Matemática", "Física"] as string[],
  bio: "Professora voluntária dedicada ao ensino preparatório para vestibular e ENEM."
};

export function ProfileEdit() {
  const [formData, setFormData] = useState(INITIAL_FORM);

  const handleSubjectToggle = (subject: string) => {
    setFormData((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject) ? prev.subjects.filter((s) => s !== subject) : [...prev.subjects, subject]
    }));
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
        <div className="mb-4 flex items-center">
          <Link href="/dashboard" className="mr-3">
            <ArrowLeft size={24} />
          </Link>
          <h1>Editar Perfil</h1>
        </div>
      </div>

      <form onSubmit={(event) => event.preventDefault()} className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="mb-4 rounded-lg bg-white p-4 shadow">
          <div className="mb-6 flex flex-col items-center">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-3xl text-white">
                {formData.name.charAt(0)}
              </div>
              <button type="button" className="absolute bottom-0 right-0 rounded-full border-2 border-gray-200 bg-white p-2 shadow-lg">
                <Camera size={16} className="text-gray-600" />
              </button>
            </div>
            <h3 className="mt-3 text-gray-800">{formData.name}</h3>
            <p className="text-sm capitalize text-gray-600">{userRole}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-gray-700">Nome Completo</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-gray-700">E-mail</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Telefone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Departamento</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Ciências Exatas">Ciências Exatas</option>
                <option value="Ciências Humanas">Ciências Humanas</option>
                <option value="Linguagens">Linguagens</option>
                <option value="Ciências da Natureza">Ciências da Natureza</option>
                <option value="Coordenação Pedagógica">Coordenação Pedagógica</option>
              </select>
            </div>

            {userRole === "professor" && (
              <div>
                <label className="mb-2 block text-gray-700">Disciplinas que Leciona</label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_SUBJECTS.map((subject) => (
                    <label
                      key={subject}
                      className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                        formData.subjects.includes(subject) ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
                      }`}
                    >
                      <input type="checkbox" checked={formData.subjects.includes(subject)} onChange={() => handleSubjectToggle(subject)} className="mr-2" />
                      <span className="text-sm text-gray-900">{subject}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-gray-700">Biografia</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Fale um pouco sobre você..."
                rows={4}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4">
          <h4 className="text-blue-800">Informação</h4>
          <p className="mt-1 text-sm text-blue-700">Para alterar sua senha ou outras configurações de conta, entre em contato com a coordenação.</p>
        </div>

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button type="submit" className="flex w-full items-center justify-center rounded-lg bg-blue-600 py-3 text-white transition-colors hover:bg-blue-700">
            <Save size={20} className="mr-2" />
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  );
}
