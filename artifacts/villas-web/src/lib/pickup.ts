import { store } from "./storage";

/** Pedido para recoger en curso: se guarda en este teléfono para el botón "Ya llegué". */
export interface PendingPickup {
  placeId: string;
  placeName: string;
  whatsapp: string;
  contactName: string | null;
  at: number;
}
const KEY = "villas_pickup";
const TTL = 3 * 3_600_000;

export function getPickup(): PendingPickup | null {
  try {
    const p = JSON.parse(store.get(KEY) ?? "null") as PendingPickup | null;
    return p && Date.now() - p.at < TTL ? p : null;
  } catch {
    return null;
  }
}
export function setPickup(p: PendingPickup | null) {
  store.set(KEY, p ? JSON.stringify(p) : "null");
  window.dispatchEvent(new Event("villas-pickup"));
}
