"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

const CLASSES = ["Extensivo - Manhã", "Extensivo - Noite", "Intensivo - Integral", "Semi-Intensivo - Tarde", "Reta Final ENEM", "Medicina - Específicas"];

const EDIT_DEFAULTS = {
  name: "Ana Beatriz Santos",
  number: "01",
  class: "Extensivo - Manhã",
  email: "ana.beatriz@email.com",
  phone: "(11) 98765-1111",
  birthDate: "2005-05-15",
  cpf: "123.456.789-00",
  address: "Rua das Flores, 123 - São Paulo, SP"
};

const EMPTY_DEFAULTS = {
  name: "",
  number: "",
  class: "",
  email: "",
  phone: "",
  birthDate: "",
  cpf: "",
  address: ""
};

type StudentFormProps = {
  isEdit?: boolean;
};

export function StudentForm({ isEdit = false }: StudentFormProps) {
  const [formData, setFormData] = useState(isEdit ? EDIT_DEFAULTS : EMPTY_DEFAULTS);

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-indigo-600 p-4 text-white">
        <Link href="/students" className="mr-3">
          <ArrowLeft size={24} />
        </Link>
        <h1>{isEdit ? "Editar Aluno" : "Novo Aluno"}</h1>
      </div>

      <form onSubmit={(event) => event.preventDefault()} className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="mb-4 rounded-lg bg-white p-4 shadow">
          <h3 className="mb-4 text-gray-800">Dados do Aluno</h3>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-gray-700">Nome Completo</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Nome completo do aluno"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-gray-700">Número</label>
                <input
                  type="text"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nº"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-gray-700">Turma</label>
                <select
                  value={formData.class}
                  onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Selecione</option>
                  {CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Data de Nascimento</label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-gray-700">E-mail</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="email@aluno.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Telefone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="(11) 98765-4321"
              />
            </div>

            <div>
              <label className="mb-2 block text-gray-700">CPF</label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="123.456.789-00"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-gray-700">Endereço</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Endereço completo"
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
          <button type="submit" className="flex w-full items-center justify-center rounded-lg bg-indigo-600 py-3 text-white transition-colors hover:bg-indigo-700">
            <Save size={20} className="mr-2" />
            {isEdit ? "Salvar Alterações" : "Cadastrar Aluno"}
          </button>
        </div>
      </form>
    </div>
  );
}
