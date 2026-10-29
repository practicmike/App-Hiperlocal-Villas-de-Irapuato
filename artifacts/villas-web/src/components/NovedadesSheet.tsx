import type { NewsItem, PlaceSummary } from "@workspace/api-client-react";
import { Bell, X } from "lucide-react";
import type { Constellation } from "@/lib/constellations";
import { store } from "@/lib/storage";
import { PlaceTile } from "@/components/PlaceTile";

const SEEN_KEY = "villas-novedades-visto";
/** Un lugar cuenta como "nuevo" durante una semana. */
const NEW_DAYS = 7;

const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `hace ${m} min`;
  if (m < 60 * 24) return `hace ${Math.round(m / 60)} h`;
  const d = Math.round(m / 1440);
  return d === 1 ? "ayer" : `hace ${d} días`;
};

export const newPlaces = (places: PlaceSummary[]) => {
  const since = Date.now() - NEW_DAYS * 86_400_000;
  return places
    .filter((p) => new Date(p.createdAt).getTime() >= since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/** ¿Hay algo que el vecino no ha visto? Sin push: el punto en la campana es el aviso. */
export function hasUnseen(news: NewsItem[], places: PlaceSummary[]) {
  const seen = store.get(SEEN_KEY) ?? "";
  const newest = [...news.map((n) => n.createdAt), ...newPlaces(places).map((p) => p.createdAt)].sort().pop();
  return !!newest && newest > seen;
}

export const markSeen = () => store.set(SEEN_KEY, new Date().toISOString());

/**
 * Novedades dentro de la app: lo que publicaron hoy los comercios ("Hoy en Villas")
 * y quién se sumó a Villas en la última semana.
 */
export function NovedadesSheet({
  news,
  places,
  constellations,
  onOpen,
  onClose,
}: {
  news: NewsItem[];
  places: PlaceSummary[];
  constellations: Map<string, Constellation>;
  onOpen: (placeId: string) => void;
  onClose: () => void;
}) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const fresh = newPlaces(places);
  const byPlace = new Map(places.map((p) => [p.id, p]));
  const dot = (cid: string) => constellations.get(cid)?.color ?? "#7d80d9";
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="sheet-enter pb-safe max-h-[85%] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-white/10 bg-panel px-5 pt-5 md:max-w-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Novedades"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Bell size={20} className="text-primary" /> Novedades
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-white/10" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {news.length === 0 && fresh.length === 0 && (
          <p className="pb-8 pt-4 text-sm text-muted">Nada nuevo por ahora. Cuando un comercio publique algo o se sume alguien a Villas, lo verás aquí.</p>
        )}

        {news.length > 0 && (
          <section className="pb-2">
            <h3 className="py-2 text-xs font-bold tracking-widest text-muted">HOY EN VILLAS</h3>
            <ul className="space-y-2">
              {news.map((n) => (
                <li key={n.id}>
                  <button onClick={() => onOpen(n.placeId)} className="flex w-full gap-3 rounded-2xl bg-space-2/60 p-3 text-left hover:bg-white/5">
                    {n.photoUrl ? (
                      <img src={`${base}${n.photoUrl}`} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <PlaceTile
                        size={56}
                        color={dot(n.constellation)}
                        category={byPlace.get(n.placeId)?.category ?? ""}
                        name={n.placeName}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold" style={{ color: dot(n.constellation) }}>
                        {n.placeName} · {ago(n.createdAt)}
                      </span>
                      <span className="block font-bold leading-snug">{n.text}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {fresh.length > 0 && (
          <section className="pb-4">
            <h3 className="py-2 text-xs font-bold tracking-widest text-muted">NUEVOS EN VILLAS</h3>
            <ul>
              {fresh.map((p) => (
                <li key={p.id}>
                  <button onClick={() => onOpen(p.id)} className="flex w-full items-center gap-3 border-b border-white/5 py-3 text-left">
                    <PlaceTile color={dot(p.constellation)} category={p.category} name={p.name} coverUrl={p.coverUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{p.name}</span>
                      <span className="block text-sm text-muted">
                        {p.category} · {ago(p.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
