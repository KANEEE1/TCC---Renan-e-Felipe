// Fonte única de "agora" para regras que dependem do horário (ex.: presença).
// Os testes controlam o tempo via vi.setSystemTime (fake timers só de Date).
export function agora() {
  return new Date();
}
