import type { ConstellationInfo } from "@workspace/api-client-react";

/** Constelación lista para dibujar: con su ángulo alrededor de "Tú". */
export interface Constellation extends ConstellationInfo {
  /** Grados; -90 = arriba. */
  angle: number;
}

/**
 * Reparte las constelaciones en círculo alrededor del vecino, en el orden que
 * elige el creador. La primera queda arriba y las demás siguen el reloj.
 */
export function placeConstellations(list: ConstellationInfo[]): Constellation[] {
  const sorted = [...list].sort((a, b) => a.position - b.position);
  const n = Math.max(sorted.length, 1);
  return sorted.map((c, i) => ({ ...c, angle: -90 + (360 / n) * i }));
}

export const byId = (list: Constellation[]) => new Map(list.map((c) => [c.id, c]));

/** Respaldo por si una estrella apunta a una constelación que ya no existe. */
export const FALLBACK: Constellation = {
  id: "_",
  name: "Otros",
  hint: "",
  color: "#a6abd6",
  isProperty: false,
  position: 99,
  angle: -90,
};

/**
 * Colores de la marca para constelaciones. El azul claro (vecino) y el morado
 * (IA) no se ofrecen: ya tienen un significado fijo en pantalla.
 */
export const PALETTE: Array<{ name: string; hex: string }> = [
  { name: "Naranja", hex: "#E6C882" },
  { name: "Verde", hex: "#50e3c2" },
  { name: "Rosa", hex: "#e38fc1" },
  { name: "Azul fuerte", hex: "#7d80d9" },
  { name: "Rojo", hex: "#ffabab" },
];

/** Link de WhatsApp con mensaje inicial; deja claro de dónde viene el contacto. */
export function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
