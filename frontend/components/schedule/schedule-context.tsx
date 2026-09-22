"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface ScheduleItem {
  id: number;
  day: number;
  startTime: string;
  endTime: string;
  duration: number;
  subject: string;
  class: string;
  teacher: string;
  room: string;
  color: string;
  type: "aula" | "plantao" | "aulao";
}

const DEFAULT_SCHEDULE: ScheduleItem[] = [
  { id: 1, day: 0, startTime: "08:00", endTime: "10:00", duration: 2, subject: "Matemática", class: "Extensivo", teacher: "Ana Silva", room: "Sala 101", color: "bg-blue-500", type: "aula" },
  { id: 2, day: 0, startTime: "10:00", endTime: "12:00", duration: 2, subject: "Física", class: "Intensivo", teacher: "Ana Silva", room: "Sala 102", color: "bg-green-500", type: "aula" },
  { id: 3, day: 0, startTime: "14:00", endTime: "16:00", duration: 2, subject: "Plantão Exatas", class: "Todas", teacher: "Ana Silva", room: "Sala 103", color: "bg-purple-500", type: "plantao" },
  { id: 4, day: 1, startTime: "08:00", endTime: "10:00", duration: 2, subject: "História", class: "Extensivo", teacher: "Carlos Santos", room: "Sala 201", color: "bg-indigo-500", type: "aula" },
  { id: 5, day: 2, startTime: "10:00", endTime: "12:00", duration: 2, subject: "Redação", class: "Reta Final", teacher: "Maria Oliveira", room: "Sala 301", color: "bg-orange-500", type: "aula" },
  { id: 6, day: 3, startTime: "14:00", endTime: "16:00", duration: 2, subject: "Química", class: "Intensivo", teacher: "João Costa", room: "Sala 401", color: "bg-red-500", type: "aula" },
  { id: 7, day: 4, startTime: "09:00", endTime: "11:00", duration: 2, subject: "Biologia", class: "Medicina", teacher: "Pedro Lima", room: "Sala 501", color: "bg-teal-500", type: "aula" }
];

interface ScheduleContextType {
  schedules: ScheduleItem[];
  addSchedule: (item: Omit<ScheduleItem, "id">) => void;
  updateSchedule: (id: number, patch: Partial<Omit<ScheduleItem, "id">>) => void;
  removeSchedule: (id: number) => void;
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

const STORAGE_KEY = "app_schedules";

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>(DEFAULT_SCHEDULE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSchedules(JSON.parse(stored) as ScheduleItem[]);
    } catch {
      // ignora storage indisponível/corrompido, mantém o valor padrão
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  }, [schedules]);

  const addSchedule = (item: Omit<ScheduleItem, "id">) => {
    setSchedules((prev) => [...prev, { ...item, id: Date.now() }]);
  };

  const updateSchedule = (id: number, patch: Partial<Omit<ScheduleItem, "id">>) => {
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeSchedule = (id: number) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  return <ScheduleContext.Provider value={{ schedules, addSchedule, updateSchedule, removeSchedule }}>{children}</ScheduleContext.Provider>;
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
}
