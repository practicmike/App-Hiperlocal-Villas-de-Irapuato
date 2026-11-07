/**
 * Botón "atrás" del celular (Android) y gesto de deslizar desde el borde (iOS / navegadores).
 *
 * Sin esto, "atrás" salía de la app porque la app es una sola página: el historial
 * del navegador no sabía que había pantallas encima. Aquí cada capa abierta
 * (resultados, ficha de un lugar…) agrega una entrada al historial; al ir atrás
 * se cierra la capa de arriba en vez de salir.
 *
 * `depth` = cuántas capas hay abiertas ahora. `onBack` cierra la de arriba.
 */
import { useEffect, useRef } from "react";

export function useBackLayers(depth: number, onBack: () => void) {
  const pushed = useRef(0);
  const ignore = useRef(0);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  // Sincroniza el historial con las capas abiertas.
  useEffect(() => {
    if (depth > pushed.current) {
      for (let i = pushed.current; i < depth; i++) window.history.pushState({ villasLayer: i + 1 }, "");
      pushed.current = depth;
    } else if (depth < pushed.current) {
      // Se cerró con un botón de la app: se quitan esas entradas sin disparar otro cierre.
      ignore.current += 1;
      window.history.go(depth - pushed.current);
      pushed.current = depth;
    }
  }, [depth]);

  useEffect(() => {
    const onPop = () => {
      if (ignore.current > 0) {
        ignore.current -= 1;
        return;
      }
      if (pushed.current === 0) return; // Ya no hay capas: que el navegador salga normal.
      pushed.current -= 1;
      onBackRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
}
