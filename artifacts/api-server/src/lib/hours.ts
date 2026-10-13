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

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Día y minuto en Irapuato, sin depender de la zona del servidor. */
export function nowInVillas(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return { day, min: hour * 60 + minute, label: `${DAY_NAMES[day]} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
}

/** true/false = abierto o cerrado ahora; null = no capturó horario. */
export function isOpenNow(week: WeekHours | null | undefined, date = new Date()): boolean | null {
  if (!week || !week.some(Boolean)) return null;
  const { day, min } = nowInVillas(date);
  const today = week[day];
  if (today) {
    const o = toMin(today.open);
    const c = today.close === "00:00" ? 1440 : toMin(today.close);
    if (c > o ? min >= o && min < c : min >= o) return true;
  }
  const y = week[(day + 6) % 7];
  if (y) {
    const o = toMin(y.open);
    const c = toMin(y.close);
    if (c < o && c !== 0 && min < c) return true;
  }
  return false;
}
