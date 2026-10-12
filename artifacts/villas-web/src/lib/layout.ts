import type { Constellation, PlaceSummary } from "@workspace/api-client-react";
import { CONSTELLATIONS, ORDER } from "./constellations";

/** Distancia del vecino (centro) a cada constelación, en unidades del mundo. */
export const NEBULA_R = 300;
/** Radio del mundo completo; sirve para encuadrar la vista inicial. */
export const WORLD_R = 470;

export interface StarPos {
  x: number;
  y: number;
  /** 0–1: brillo/coincidencia. 1 sin búsqueda activa. */
  glow: number;
  matched: boolean;
  dimmed: boolean;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function nebulaCenter(c: Constellation) {
  const a = rad(CONSTELLATIONS[c].angle);
  return { x: Math.cos(a) * NEBULA_R, y: Math.sin(a) * NEBULA_R };
}

/**
 * Posición "en casa" de cada estrella: espiral dorada dentro de su constelación.
 * Las más recomendadas quedan al centro de su grupo.
 */
export function homeLayout(places: PlaceSummary[]): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  for (const c of ORDER) {
    const center = nebulaCenter(c);
    const group = places
      .filter((p) => p.constellation === c)
      .sort((a, b) => b.endorsementCount - a.endorsementCount || a.name.localeCompare(b.name));
    // La espiral se compacta si hay muchas estrellas, para no invadir otra constelación.
    const step = Math.max(16, 40 - group.length * 0.4);
    group.forEach((p, i) => {
      const r = 22 + step * Math.sqrt(i + 0.5);
      const a = i * GOLDEN + rad(CONSTELLATIONS[c].angle);
      out.set(p.id, { x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
    });
  }
  return out;
}

/**
 * Con búsqueda activa: las que coinciden se acercan al vecino (más cerca = mejor),
 * conservando la dirección de su constelación; las demás se alejan y se apagan.
 */
export function searchLayout(
  places: PlaceSummary[],
  home: Map<string, { x: number; y: number }>,
  scores: Map<string, number> | null,
): Map<string, StarPos> {
  const out = new Map<string, StarPos>();
  if (!scores) {
    for (const p of places) {
      const h = home.get(p.id)!;
      out.set(p.id, { ...h, glow: 1, matched: false, dimmed: false });
    }
    return out;
  }

  const byConst = new Map<Constellation, Array<[PlaceSummary, number]>>();
  for (const p of places) {
    const s = scores.get(p.id);
    if (s === undefined) continue;
    const list = byConst.get(p.constellation) ?? [];
    list.push([p, s]);
    byConst.set(p.constellation, list);
  }

  for (const [c, list] of byConst) {
    list.sort((a, b) => b[1] - a[1]);
    const baseAngle = rad(CONSTELLATIONS[c].angle);
    list.forEach(([p, s], i) => {
      // Abanico alrededor de la dirección de la constelación.
      const spread = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.32;
      const r = 70 + (1 - s) * 200 + Math.floor(i / 5) * 26;
      const a = baseAngle + spread;
      out.set(p.id, { x: Math.cos(a) * r, y: Math.sin(a) * r, glow: s, matched: true, dimmed: false });
    });
  }

  for (const p of places) {
    if (out.has(p.id)) continue;
    const h = home.get(p.id)!;
    out.set(p.id, { x: h.x * 1.7, y: h.y * 1.7, glow: 0.15, matched: false, dimmed: true });
  }
  return out;
}

/** Caja que contiene a las estrellas que coinciden, para encuadrarlas. */
export function matchBounds(pos: Map<string, StarPos>) {
  let minX = -60;
  let minY = -60;
  let maxX = 60;
  let maxY = 60;
  for (const p of pos.values()) {
    if (!p.matched) continue;
    minX = Math.min(minX, p.x - 40);
    maxX = Math.max(maxX, p.x + 40);
    minY = Math.min(minY, p.y - 40);
    maxY = Math.max(maxY, p.y + 40);
  }
  return { minX, minY, maxX, maxY };
}
