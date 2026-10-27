import { useCallback, useEffect, useState } from "react";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Metros entre dos puntos (haversine). A la escala de un barrio el error es de centímetros. */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "80 m", "450 m", "1.2 km": redondeado a lo que de verdad se puede caminar. */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

/** Centro de los lugares con ubicación; null si ninguno tiene. */
export function centroid(points: LatLng[]): LatLng | null {
  if (!points.length) return null;
  const s = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: s.lat / points.length, lng: s.lng / points.length };
}

export type GeoState =
  | { status: "idle" }
  | { status: "asking" }
  | { status: "ok"; at: LatLng; accuracy: number }
  | { status: "denied" }
  | { status: "unavailable" };

/**
 * Ubicación del vecino, solo cuando la pide (al abrir el radar).
 * Vive en memoria: no se guarda ni se manda al servidor.
 */
let last: GeoState = { status: "idle" };

export function useMyLocation(auto: boolean) {
  const [state, setState] = useState<GeoState>(last);
  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      last = { status: "unavailable" };
      setState(last);
      return;
    }
    setState((s) => (s.status === "ok" ? s : { status: "asking" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        last = { status: "ok", at: { lat: pos.coords.latitude, lng: pos.coords.longitude }, accuracy: pos.coords.accuracy };
        setState(last);
      },
      (err) => {
        last = err.code === err.PERMISSION_DENIED ? { status: "denied" } : { status: "unavailable" };
        setState(last);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }, []);
  useEffect(() => {
    if (auto && (last.status === "idle" || last.status === "ok")) request();
  }, [auto, request]);
  return { state, request };
}
