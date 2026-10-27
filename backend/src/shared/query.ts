import { z } from "zod";

export function boundedNumberQuery(min: number, max: number, fallback: number) {
  return z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().min(min).max(max).default(fallback)
  );
}
