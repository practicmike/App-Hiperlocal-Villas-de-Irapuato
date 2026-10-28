import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/geo";

export interface RadarPoint extends LatLng {
  id: string;
  name: string;
  color: string;
}

/**
 * Teselas de OpenStreetMap, oscurecidas con CSS para que combinen con la app.
 * Uso ligero permitido con atribución (https://operations.osmfoundation.org/policies/tiles/).
 * Si Villas crece mucho, cambiar TILE_URL por un proveedor con plan (MapTiler, Stadia).
 */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Píxeles que mide `meters` en este zoom y latitud (proyección Web Mercator). */
const metersToPx = (map: L.Map, lat: number, meters: number) =>
  meters / ((156_543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** map.getZoom());

/**
 * El radar: calles reales, tú al centro con anillos de 200 y 500 m y un barrido
 * que gira. Leaflet se maneja a mano (sin react-leaflet) para que React no
 * vuelva a pintar el mapa en cada cambio.
 */
export function RadarMap({
  center,
  me,
  points,
  selectedId,
  onSelect,
  bottomInset,
  fitKey,
}: {
  /** Dónde abrir: tu ubicación o el centro de los lugares. */
  center: LatLng;
  /** Tu punto azul; null si no compartiste ubicación. */
  me: LatLng | null;
  points: RadarPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Alto de la hoja de abajo, para no encuadrar lugares detrás de ella. */
  bottomInset: number;
  /** Cambia cuando hay que volver a encuadrar (nueva búsqueda). */
  fitKey: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const meLayer = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Crear el mapa una sola vez.
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, {
      zoomControl: false,
      attributionControl: true,
      center: [center.lat, center.lng],
      zoom: 16,
      minZoom: 13,
      maxZoom: 19,
    });
    m.attributionControl.setPrefix(false);
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19, className: "radar-tiles" }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    meLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tú, anillos y barrido.
  useEffect(() => {
    const m = map.current;
    const g = meLayer.current;
    if (!m || !g) return;
    g.clearLayers();
    const origin = me ?? center;
    const ring = (r: number) =>
      L.circle([origin.lat, origin.lng], {
        radius: r,
        interactive: false,
        color: "#2f5fd0",
        opacity: 0.7,
        weight: 1,
        dashArray: "4 6",
        fill: false,
      }).addTo(g);
    if (me) {
      ring(200);
      ring(500);
      L.marker([me.lat, me.lng], {
        interactive: false,
        keyboard: false,
        zIndexOffset: -1000,
        icon: L.divIcon({
          className: "",
          iconSize: [0, 0],
          html: '<div class="radar-sweep" aria-hidden="true"></div><div class="radar-me" aria-hidden="true"></div>',
        }),
      }).addTo(g);
      const label = (r: number) =>
        L.marker([origin.lat, origin.lng + r / (111_320 * Math.cos((origin.lat * Math.PI) / 180))], {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({ className: "", iconSize: [0, 0], html: `<span class="radar-ring-label">${r} m</span>` }),
        }).addTo(g);
      label(200);
      label(500);
    }
    const size = () => {
      const px = metersToPx(m, origin.lat, 500) * 2;
      m.getContainer().style.setProperty("--sweep", `${Math.min(px, 2400)}px`);
    };
    size();
    m.on("zoom", size);
    return () => {
      m.off("zoom", size);
    };
  }, [me?.lat, me?.lng, center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Puntos de los lugares.
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const p of points) {
      const selected = p.id === selectedId;
      const marker = L.marker([p.lat, p.lng], {
        title: p.name,
        alt: p.name,
        riseOnHover: true,
        zIndexOffset: selected ? 1000 : 0,
        icon: L.divIcon({
          className: "",
          iconSize: [44, 44],
          iconAnchor: [22, 22],
          html: `<span class="radar-dot${selected ? " is-selected" : ""}" style="--c:${esc(p.color)}"><span></span></span>${
            selected ? `<span class="radar-dot-label">${esc(p.name)}</span>` : ""
          }`,
        }),
      });
      marker.on("click", () => onSelectRef.current(p.id));
      marker.addTo(g);
    }
  }, [points, selectedId]);

  // Encuadrar: lo que coincidió (y tú, si estás cerca).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const pad = L.point(32, 96);
    const padBottom = L.point(32, bottomInset + 24);
    const coords: L.LatLngExpression[] = points.map((p) => [p.lat, p.lng]);
    if (me) coords.push([me.lat, me.lng]);
    if (coords.length >= 2) {
      m.fitBounds(L.latLngBounds(coords), { paddingTopLeft: pad, paddingBottomRight: padBottom, maxZoom: 16, animate: true });
    } else {
      const only = points[0] ?? me ?? center;
      m.setView([only.lat, only.lng], 16, { animate: true });
    }
  }, [fitKey, me?.lat, me?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Llevar el seleccionado a la vista.
  useEffect(() => {
    const m = map.current;
    const p = points.find((x) => x.id === selectedId);
    if (m && p && !m.getBounds().pad(-0.15).contains([p.lat, p.lng])) m.panTo([p.lat, p.lng]);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="radar-map absolute inset-0 isolate z-0" role="application" aria-label="Radar de Villas" />;
}
