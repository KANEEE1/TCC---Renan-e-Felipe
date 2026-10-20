export function currentPeriodoLetivo(date: Date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() < 6 ? 1 : 2}`;
}
