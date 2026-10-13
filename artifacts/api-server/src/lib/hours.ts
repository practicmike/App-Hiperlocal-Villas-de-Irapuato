import type { WeekHours } from "@workspace/db";

/** Acepta solo 7 días con HH:MM válidos; cualquier otra cosa se guarda como "sin horario". */
export function cleanHours(raw: unknown): WeekHours | null {
  if (!Array.isArray(raw) || raw.length !== 7) return null;
  const ok = /^([01]\d|2[0-4]):[0-5]\d$/;
  const week = raw.map((d) => {
    if (!d || typeof d !== "object") return null;
    const { open, close: rawClose } = d as { open?: unknown; close?: unknown };
    // 00:00 a 00:00 = abierto todo el día.
    const close = open === "00:00" && rawClose === "00:00" ? "24:00" : rawClose;
    return typeof open === "string" && typeof close === "string" && ok.test(open) && ok.test(close) && open !== close
      ? { open, close }
      : null;
  });
  return week.some(Boolean) ? week : null;
}
