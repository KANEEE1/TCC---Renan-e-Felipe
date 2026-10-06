export function parseTimeToDate(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

const WEEKDAYS = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"] as const;

export function currentDiaSemana(date: Date = new Date()) {
  return WEEKDAYS[date.getDay()];
}

export function currentTimeOfDay(date: Date = new Date()) {
  return parseTimeToDate(`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`);
}
