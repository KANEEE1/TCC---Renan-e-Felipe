export function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function isPastDate(isoDate: string) {
  return isoDate.slice(0, 10) < todayInSaoPaulo();
}
