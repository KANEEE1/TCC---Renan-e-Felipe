"use client";

import Link from "next/link";
import { List, Plus } from "lucide-react";
import { useSchedule } from "@/components/schedule/schedule-context";

const TIME_SLOTS = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

const WEEK_DAYS = [
  { short: "Seg", date: "29/04" },
  { short: "Ter", date: "30/04" },
  { short: "Qua", date: "01/05" },
  { short: "Qui", date: "02/05" },
  { short: "Sex", date: "03/05" }
];

export function ScheduleWeekly() {
  const { schedules } = useSchedule();

  const getScheduleForSlot = (dayIndex: number, time: string) => schedules.find((item) => item.day === dayIndex && item.startTime === time);

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      <div className="bg-blue-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1>Grade Horária</h1>
            <p className="mt-1 text-sm text-blue-100">Semana 29/04 - 03/05/2026</p>
          </div>
          <Link href="/schedule/by-class" className="rounded-lg bg-white/20 p-2 transition-colors hover:bg-white/30">
            <List size={20} />
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
        <div className="min-w-max rounded-lg bg-white p-2 shadow">
          <div className="sticky top-0 z-10 mb-2 grid grid-cols-6 gap-1 bg-white pb-2">
            <div className="w-16" />
            {WEEK_DAYS.map((day) => (
              <div key={day.short} className="p-2 text-center">
                <div className="text-gray-800">{day.short}</div>
                <div className="text-xs text-gray-600">{day.date}</div>
              </div>
            ))}
          </div>

          {TIME_SLOTS.map((time) => (
            <div key={time} className="mb-1 grid grid-cols-6 gap-1">
              <div className="flex w-16 items-start pt-2 text-sm text-gray-600">{time}</div>
              {WEEK_DAYS.map((day, dayIdx) => {
                const item = getScheduleForSlot(dayIdx, time);
                if (item) {
                  return (
                    <Link
                      key={day.short}
                      href={`/schedule/edit/${item.id}`}
                      className={`${item.color} rounded-lg p-2 text-white transition-opacity hover:opacity-90`}
                      style={{ gridRow: `span ${item.duration}` }}
                    >
                      <div className="text-xs">{item.subject}</div>
                      <div className="text-xs opacity-90">{item.class}</div>
                      <div className="mt-1 text-xs opacity-75">{item.teacher}</div>
                    </Link>
                  );
                }
                return <div key={day.short} className="min-h-16 rounded bg-gray-50 p-2" />;
              })}
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 pb-6">
          <div className="rounded-lg bg-blue-50 p-3">
            <div className="text-sm text-blue-800">Total de Aulas</div>
            <div className="text-2xl text-blue-900">{schedules.filter((s) => s.type === "aula").length}</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3">
            <div className="text-sm text-green-800">Esta Semana</div>
            <div className="text-2xl text-green-900">{schedules.length}</div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-20 right-4 z-40">
        <Link href="/schedule/create" className="flex rounded-full bg-blue-600 p-4 text-white shadow-lg transition-colors hover:bg-blue-700">
          <Plus size={28} />
        </Link>
      </div>
    </div>
  );
}
