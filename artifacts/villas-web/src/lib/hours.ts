import type { DayHours, WeekHours } from "@workspace/api-client-react";

export const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
/** "08:00" → "8:00"; "24:00" → "medianoche". */
export const fmt = (t: string) => (t === "24:00" || t === "00:00" ? "medianoche" : t.replace(/^0/, ""));

/** Hora y día en Irapuato, aunque el teléfono tenga otra zona configurada. */
function nowInVillas(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, min: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Abierto en este minuto (cubre horarios que pasan la medianoche y 24 h). */
function openAt(week: WeekHours, day: number, min: number): DayHours | null {
  if (!week) return null;
  const today = week[day];
  if (today) {
    const o = toMin(today.open);
    const c = today.close === "00:00" ? 1440 : toMin(today.close);
    if (c > o ? min >= o && min < c : min >= o) return today;
  }
  // Lo de ayer que cruzó la medianoche.
  const y = week[(day + 6) % 7];
  if (y) {
    const o = toMin(y.open);
    const c = toMin(y.close);
    if (c < o && c !== 0 && min < c) return y;
  }
  return null;
}

export interface OpenState {
  open: boolean;
  text: string;
}

/** "Abierto · cierra 13:00" o "Cerrado · abre mañana 8:00". null = sin horario. */
export function openState(week: WeekHours | null | undefined, date = new Date()): OpenState | null {
  if (!week || !week.some(Boolean)) return null;
  const { day, min } = nowInVillas(date);
  const cur = openAt(week, day, min);
  if (cur) {
    const allDay = cur.open === "00:00" && (cur.close === "24:00" || cur.close === "00:00");
    return { open: true, text: allDay ? "Abierto 24 horas" : `Abierto · cierra ${fmt(cur.close)}` };
  }
  for (let i = 0; i < 7; i++) {
    const d = (day + i) % 7;
    const h = week[d];
    if (!h) continue;
    if (i === 0 && toMin(h.open) <= min) continue;
    const when = i === 0 ? "hoy" : i === 1 ? "mañana" : `el ${DAY_LONG[d]}`;
    return { open: false, text: `Cerrado · abre ${when} ${fmt(h.open)}` };
  }
  return { open: false, text: "Cerrado" };
}

/** Resumen corto: "Lun a Vie 8:00–13:00 · Sáb 9:00–14:00". */
export function weekSummary(week: WeekHours | null | undefined): string[] {
  if (!week) return [];
  const out: string[] = [];
  // Empieza en lunes, como se lee un horario en México.
  const order = [1, 2, 3, 4, 5, 6, 0];
  let i = 0;
  while (i < 7) {
    const d = week[order[i]!];
    let j = i;
    while (j + 1 < 7 && sameDay(week[order[j + 1]!], d)) j++;
    const label = j > i ? `${DAY_SHORT[order[i]!]} a ${DAY_SHORT[order[j]!]}` : DAY_SHORT[order[i]!];
    out.push(`${label}: ${d ? `${fmt(d.open)}–${fmt(d.close)}` : "cerrado"}`);
    i = j + 1;
  }
  return out;
}
const sameDay = (a: DayHours | null | undefined, b: DayHours | null | undefined) =>
  (!a && !b) || (!!a && !!b && a.open === b.open && a.close === b.close);
