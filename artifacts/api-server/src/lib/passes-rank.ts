/**
 * Reparto de «Te lo paso»: 1) el que menos pases recibió este mes, 2) de otra
 * categoría, 3) el más cercano, 4) por nombre. Sin base de datos, para probarlo.
 */
export function rankCandidates<T extends { issued: number; otherConstellation: boolean; distance: number | null; name: string }>(
  list: T[],
): T[] {
  return [...list].sort(
    (x, y) =>
      x.issued - y.issued ||
      Number(y.otherConstellation) - Number(x.otherConstellation) ||
      (x.distance ?? Infinity) - (y.distance ?? Infinity) ||
      x.name.localeCompare(y.name, "es"),
  );
}

