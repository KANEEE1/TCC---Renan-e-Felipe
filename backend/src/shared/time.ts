export function parseTimeToDate(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}
