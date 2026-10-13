import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import type { PlaceSummary } from "@workspace/api-client-react";
import { FALLBACK, byId, type Constellation } from "@/lib/constellations";
import { NEBULA_SIZE, matchBounds, nebulaCenter, worldRadius, type StarPos } from "@/lib/layout";

/** Nivel de zoom relativo a la vista completa: decide qué se muestra. */
export type Level = "far" | "mid" | "near";
const levelFor = (rel: number): Level => (rel < 1.7 ? "far" : rel < 3.3 ? "mid" : "near");

export interface UniverseHandle {
  flyTo: (id: string) => void;
  fitMatches: () => void;
  home: () => void;
}

interface Props {
  /** Ya ordenadas y con su ángulo (placeConstellations). */
  constellations: Constellation[];
  places: PlaceSummary[];
  positions: Map<string, StarPos>;
  searching: boolean;
  /** Búsqueda con IA: cada estrella que coincide muestra su % de match. */
  showPercent?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLevelChange?: (level: Level) => void;
  /** Al acercarse mucho, la estrella más cercana al centro abre su tarjeta. */
  onApproach?: (id: string | null) => void;
  /** Nombre de pila del vecino: va en el centro del universo, en lugar de "Tú". */
  meLabel: string;
  onMeClick?: () => void;
  /**
   * Cielo personal: estrellas donde el vecino ya compró (brillan) frente a las que
   * le faltan (tenues). null = visitante: todo el universo se ve encendido.
   */
  lit?: Set<string> | null;
}

const STAR_R = 7;
const DURATION = 750;

export const UniverseCanvas = forwardRef<UniverseHandle, Props>(function UniverseCanvas(
  { constellations, places, positions, searching, showPercent = false, selectedId, onSelect, onLevelChange, onApproach, meLabel, onMeClick, lit = null },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, k0: 1 });
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const [level, setLevel] = useState<Level>("far");
  const levelRef = useRef<Level>("far");
  const approachRef = useRef(onApproach);
  approachRef.current = onApproach;
  const levelCbRef = useRef(onLevelChange);
  levelCbRef.current = onLevelChange;

  const cById = useMemo(() => byId(constellations), [constellations]);
  const n = constellations.length;
  const nRef = useRef(n);
  nRef.current = n;


  /** Aplica el zoom directo al DOM: cero renders de React por cuadro. */
  const apply = useCallback((t: ZoomTransform) => {
    transformRef.current = t;
    const svg = svgRef.current;
    const world = worldRef.current;
    if (!svg || !world) return;
    world.setAttribute("transform", t.toString());
    svg.style.setProperty("--kl", String(1 / t.k));
    svg.style.setProperty("--ks", String(Math.pow(t.k, -0.72)));
    const { w, h, k0 } = sizeRef.current;
    svg.parentElement?.style.setProperty("--sky-x", `${(t.x - w / 2) * 0.04}px`);
    svg.parentElement?.style.setProperty("--sky-y", `${(t.y - h / 2) * 0.04}px`);
    const next = levelFor(t.k / k0);
    if (next !== levelRef.current) {
      levelRef.current = next;
      setLevel(next);
      levelCbRef.current?.(next);
    }
  }, []);

  /** Estrella más cercana al centro de la pantalla cuando ya estás muy cerca. */
  const checkApproach = useCallback(() => {
    if (levelRef.current !== "near") {
      approachRef.current?.(null);
      return;
    }
    const t = transformRef.current;
    const { w, h } = sizeRef.current;
    let best: string | null = null;
    let bestD = 64;
    for (const [id, p] of positionsRef.current) {
      if (p.dimmed) continue;
      const d = Math.hypot(t.x + p.x * t.k - w / 2, t.y + p.y * t.k - h * 0.4);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    approachRef.current?.(best);
  }, []);

  const transformTo = useCallback((t: ZoomTransform, animate = true) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    const sel = select(svg);
    if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sel.transition().duration(DURATION).call(z.transform, t);
    } else {
      sel.call(z.transform, t);
    }
  }, []);

  const homeTransform = useCallback(() => {
    const { w, h, k0 } = sizeRef.current;
    return zoomIdentity.translate(w / 2, h / 2 + 14).scale(k0);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      flyTo(id) {
        const p = positionsRef.current.get(id);
        if (!p) return;
        const { w, h, k0 } = sizeRef.current;
        const k = Math.max(transformRef.current.k, k0 * 4.2);
        // La estrella queda arriba: la tarjeta ocupa la parte baja de la pantalla.
        transformTo(zoomIdentity.translate(w / 2 - p.x * k, h * 0.3 - p.y * k).scale(k));
      },
      fitMatches() {
        const { w, h, k0 } = sizeRef.current;
        const b = matchBounds(positionsRef.current);
        const bw = b.maxX - b.minX;
        const bh = b.maxY - b.minY;
        const k = Math.min(k0 * 3.2, Math.max(k0, Math.min(w / bw, (h - 180) / bh) * 0.9));
        const cx = (b.minX + b.maxX) / 2;
        const cy = (b.minY + b.maxY) / 2;
        transformTo(zoomIdentity.translate(w / 2 - cx * k, h / 2 + 20 - cy * k).scale(k));
      },
      home() {
        transformTo(homeTransform());
      },
    }),
    [transformTo, homeTransform],
  );

  // Montaje: tamaño, comportamiento de zoom y vista inicial.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = zoom<SVGSVGElement, unknown>()
      .on("zoom", (e: { transform: ZoomTransform }) => apply(e.transform))
      .on("end", () => checkApproach());
    zoomRef.current = z;
    const sel = select(svg).call(z).on("dblclick.zoom", null);

    const resize = () => {
      const r = svg.getBoundingClientRect();
      // Deja libre la barra de búsqueda y los botones: importa en tablets acostadas.
      const k0 = (Math.min(r.width, r.height - 200) / (2 * worldRadius(nRef.current))) * 1.03;
      const first = sizeRef.current.w === 0;
      sizeRef.current = { w: r.width, h: r.height, k0: Math.max(k0, 0.2) };
      z.scaleExtent([k0 * 0.6, k0 * 10]);
      if (first) sel.call(z.transform, homeTransform());
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(svg);
    return () => {
      ro.disconnect();
      sel.on(".zoom", null);
    };
  }, [apply, checkApproach, homeTransform]);

  // Si cambia el número de constelaciones, se reencuadra el mundo completo.
  useEffect(() => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z || sizeRef.current.w === 0) return;
    const r = svg.getBoundingClientRect();
    const k0 = Math.max((Math.min(r.width, r.height - 200) / (2 * worldRadius(n))) * 1.03, 0.2);
    sizeRef.current = { ...sizeRef.current, k0 };
    z.scaleExtent([k0 * 0.6, k0 * 10]);
    if (!searching) select(svg).call(z.transform, homeTransform());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const zoomToNebula = (c: Constellation) => {
    const { w, h, k0 } = sizeRef.current;
    const n = nebulaCenter(c, constellations.length);
    const k = k0 * 3.1;
    transformTo(zoomIdentity.translate(w / 2 - n.x * k, h / 2 - n.y * k).scale(k));
  };

  const showNames = searching || level !== "far";
  const showSub = level === "near";

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 h-full w-full touch-none select-none"
      role="application"
      aria-label="Universo de Villas. Usa la vista en lista para navegar con lector de pantalla."
    >
      <defs>
        {[...constellations, FALLBACK].map((c) => (
          <radialGradient key={c.id} id={`halo-${c.id}`}>
            <stop offset="0%" stopColor={c.color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={c.color} stopOpacity="0" />
          </radialGradient>
        ))}
        {constellations.map((c) => (
          <radialGradient key={`n-${c.id}`} id={`nebula-${c.id}`}>
            <stop offset="0%" stopColor={c.color} stopOpacity="0.16" />
            <stop offset="70%" stopColor={c.color} stopOpacity="0.04" />
            <stop offset="100%" stopColor={c.color} stopOpacity="0" />
          </radialGradient>
        ))}
        <radialGradient id="halo-me">
          <stop offset="0%" stopColor="#6eb5ff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#6eb5ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g ref={worldRef}>
        {/* Nebulosas: el nivel "lejos" muestra Villas completo, una por constelación. */}
        {constellations.map((info) => {
          const c = info.id;
          const n = nebulaCenter(info, constellations.length);
          // Las de arriba llevan su nombre arriba y las de abajo, debajo: nunca chocan con "Tú".
          const labelAbove = Math.sin((info.angle * Math.PI) / 180) < -0.05;
          return (
            <g key={c} transform={`translate(${n.x},${n.y})`}>
              <circle
                r={NEBULA_SIZE}
                fill={`url(#nebula-${c})`}
                onClick={() => level === "far" && zoomToNebula(info)}
                style={{ cursor: level === "far" ? "zoom-in" : "default" }}
              />
              {/* Posición en unidades del mundo; tamaño de texto constante en pantalla. */}
              <g transform={`translate(0,${labelAbove ? -158 : 150})`}>
                <g
                  className="label-wrap"
                  style={{ opacity: searching ? 0.3 : level === "near" ? 0 : 1 }}
                >
                  {/* Arriba: el texto crece hacia afuera para no tapar sus estrellas. */}
                  <text className="nebula-label" textAnchor="middle" fill={info.color} y={labelAbove ? -16 : 0}>
                    {info.name}
                  </text>
                  {/* Lejos solo el nombre; la pista aparece al acercarte a la constelación. */}
                  {level === "mid" && info.hint && (
                    <text className="nebula-sub" textAnchor="middle" y={labelAbove ? 0 : 17}>
                      {info.hint}
                    </text>
                  )}
                </g>
              </g>
            </g>
          );
        })}

        {/* El vecino al centro: punto de referencia, nunca un dato público. */}
        <g
          className="star"
          role="button"
          tabIndex={0}
          aria-label={`Tu cuenta, ${meLabel}`}
          onClick={(e) => {
            e.stopPropagation();
            onMeClick?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onMeClick?.();
            }
          }}
        >
          <circle className="me-pulse" r={14} fill="none" stroke="#6eb5ff" strokeWidth={1.5} />
          <g className="star-body">
            <circle r={26} fill="url(#halo-me)" />
            <circle r={9} fill="#6eb5ff" />
          </g>
          <g className="label-wrap">
            <text className="star-label" textAnchor="middle" y={30}>
              {meLabel}
            </text>
          </g>
        </g>

        {places.map((p) => {
          const pos = positions.get(p.id);
          if (!pos) return null;
          const color = (cById.get(p.constellation) ?? FALLBACK).color;
          const selected = p.id === selectedId;
          const core = STAR_R * (0.75 + pos.glow * 0.55) + Math.min(p.endorsementCount, 6) * 0.35;
          const labelOn = showNames && !pos.dimmed;
          // En búsqueda manda el match; fuera de ella, tu cielo personal.
          const unlit = !!lit && !searching && !lit.has(p.id);
          return (
            <g
              key={p.id}
              className="star"
              role="button"
              tabIndex={pos.dimmed ? -1 : 0}
              aria-label={`${p.name}, ${p.category}`}
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                opacity: pos.dimmed ? 0.16 : 1,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(p.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(p.id);
                }
              }}
            >
              <g className="star-body">
                {/* Área táctil generosa: dedos, no cursores. */}
                <circle r={22} fill="transparent" />
                <circle r={core * 2.8} fill={`url(#halo-${cById.has(p.constellation) ? p.constellation : FALLBACK.id})`} opacity={unlit ? 0.12 : 0.35 + pos.glow * 0.65} />
                <circle r={core} fill={color} opacity={unlit ? 0.42 : 1} />
                {!unlit && <circle r={core * 0.38} fill="white" opacity={0.75} />}
                {/* Novedad del día: la estrella late. */}
                {p.hasNews && !pos.dimmed && (
                  <circle className="news-ring" r={core + 3} fill="none" stroke={color} strokeWidth={2} />
                )}
                {/* Estrella por descubrir con regalo de bienvenida. */}
                {unlit && p.welcome && (
                  <circle className="gift-ring" r={core + 4} fill="none" stroke="#E6C882" strokeWidth={1.4} strokeDasharray="2 3" />
                )}
                <circle
                  className="star-ring"
                  r={core + 5}
                  fill="none"
                  stroke={selected ? "white" : p.sponsored ? color : "transparent"}
                  strokeWidth={selected ? 2 : 1}
                  strokeDasharray={p.sponsored && !selected ? "3 3" : undefined}
                />
              </g>
              <g className="label-wrap" style={{ opacity: labelOn ? 1 : 0 }}>
                <text className="star-label" textAnchor="middle" y={26}>
                  {/* En el nivel medio los nombres largos se recortan para no encimarse. */}
                  {showSub || selected || p.name.length <= 18 ? p.name : `${p.name.slice(0, 16).trimEnd()}…`}
                </text>
                {showPercent && pos.matched ? (
                  <text className="star-sub" textAnchor="middle" y={40} style={{ fill: "#c38cf3", fontWeight: 700 }}>
                    {Math.round(pos.glow * 100)}% match
                  </text>
                ) : showSub && (
                  <text className="star-sub" textAnchor="middle" y={40}>
                    {p.category}
                    {p.endorsementCount > 0 ? ` · ${p.endorsementCount} ♥` : ""}
                  </text>
                )}
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
});
