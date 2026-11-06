import { HttpError } from "./http.js";

// DDDs em uso no Brasil (Anatel).
const DDDS = new Set(
  (
    "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 " +
    "51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99"
  ).split(" ")
);

// Confere se o número pode existir (não se está ativo) e devolve no formato "(11) 98765-4321".
// Vazio (null/undefined) passa direto: o celular é opcional.
export function validarCelular<T extends string | null | undefined>(valor: T): T | string {
  if (valor === null || valor === undefined) return valor;
  const digitos = valor.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, "");
  if (!/^\d{2}9\d{8}$/.test(digitos) || !DDDS.has(digitos.slice(0, 2))) {
    throw new HttpError(400, "Informe um celular válido, com DDD. Exemplo: (11) 98765-4321");
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}
