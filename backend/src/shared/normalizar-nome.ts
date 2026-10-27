export function normalizarNome(nome: string) {
  return nome.trim().replace(/\s+/g, " ").toLowerCase();
}
