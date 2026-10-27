export function parseTimeToDate(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

export function formatTimeHHMM(date: Date) {
  return date.toISOString().slice(11, 16);
}

const WEEKDAYS = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"] as const;

export function currentDiaSemana(date: Date = new Date()) {
  return WEEKDAYS[date.getDay()];
}

export function currentTimeOfDay(date: Date = new Date()) {
  return parseTimeToDate(`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`);
}

const SAO_PAULO_TIMEZONE = "America/Sao_Paulo";
const SCHEDULE_WEEKDAYS = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"] as const;

export function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function todayInSaoPaulo(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SAO_PAULO_TIMEZONE }).format(now);
}

export function diaSemanaOfDateOnly(value: string) {
  return SCHEDULE_WEEKDAYS[(parseDateOnly(value).getUTCDay() + 6) % 7];
}
