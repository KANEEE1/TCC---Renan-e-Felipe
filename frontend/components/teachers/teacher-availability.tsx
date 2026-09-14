"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Save } from "lucide-react";

const TIME_SLOTS = [
  "07:00 - 08:00",
  "08:00 - 09:00",
  "09:00 - 10:00",
  "10:00 - 11:00",
  "11:00 - 12:00",
  "13:00 - 14:00",
  "14:00 - 15:00",
  "15:00 - 16:00",
  "16:00 - 17:00",
  "17:00 - 18:00"
];

const WEEK_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

const DEFAULT_AVAILABILITY: Record<string, boolean> = {
  "Segunda-08:00 - 09:00": true,
  "Segunda-09:00 - 10:00": true,
  "Terça-08:00 - 09:00": true,
  "Quarta-14:00 - 15:00": true,
  "Quinta-08:00 - 09:00": true,
  "Sexta-10:00 - 11:00": true
};

export function TeacherAvailability() {
  const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);

  const toggleSlot = (day: string, time: string) => {
    const key = `${day}-${time}`;
    setAvailability((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="flex items-center bg-purple-600 p-4 text-white">
        <Link href="/teachers" className="mr-3">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1>Disponibilidade</h1>
          <p className="text-sm text-purple-100">Ana Silva</p>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 pb-32">
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="mb-4 text-sm text-gray-600">Selecione os horários disponíveis para o professor</p>

          <div className="min-w-max">
            <div className="mb-2 grid grid-cols-6 gap-2">
              <div className="w-24" />
              {WEEK_DAYS.map((day) => (
                <div key={day} className="p-2 text-center text-gray-700">
                  {day}
                </div>
              ))}
            </div>

            {TIME_SLOTS.map((time) => (
              <div key={time} className="mb-2 grid grid-cols-6 gap-2">
                <div className="flex w-24 items-center text-sm text-gray-600">{time}</div>
                {WEEK_DAYS.map((day) => {
                  const key = `${day}-${time}`;
                  const isAvailable = availability[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSlot(day, time)}
                      className={`rounded-lg p-3 transition-all ${
                        isAvailable ? "bg-green-500 text-white" : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      {isAvailable && <Check size={20} className="mx-auto" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-blue-50 p-4">
          <h3 className="mb-2 text-blue-800">Legenda</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="mr-2 h-4 w-4 rounded bg-green-500" />
              <span className="text-sm text-gray-700">Disponível</span>
            </div>
            <div className="flex items-center">
              <div className="mr-2 h-4 w-4 rounded border border-gray-300 bg-gray-100" />
              <span className="text-sm text-gray-700">Indisponível</span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-white p-4">
        <button
          type="button"
          className="flex w-full items-center justify-center rounded-lg bg-purple-600 py-3 text-white transition-colors hover:bg-purple-700"
        >
          <Save size={20} className="mr-2" />
          Salvar Disponibilidade
        </button>
      </div>
    </div>
  );
}
