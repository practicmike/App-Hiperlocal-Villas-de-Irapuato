import type { NewsItem } from "@workspace/api-client-react";
import { Sparkles, X } from "lucide-react";
import type { Constellation } from "@/lib/constellations";

const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`;
};

/** "Hoy en Villas": lo nuevo del día en todo el universo; tocar una abre su estrella. */
export function NewsSheet({
  news,
  constellations,
  onOpen,
  onClose,
}: {
  news: NewsItem[];
  constellations: Map<string, Constellation>;
  onOpen: (placeId: string) => void;
  onClose: () => void;
}) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="sheet-enter pb-safe max-h-[85%] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-white/10 bg-panel px-5 pt-5 md:max-w-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Hoy en Villas"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Sparkles size={20} className="text-ai" /> Hoy en Villas
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-white/10" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <ul className="space-y-2 pb-4">
          {news.map((n) => {
            const c = constellations.get(n.constellation);
            return (
              <li key={n.id}>
                <button onClick={() => onOpen(n.placeId)} className="flex w-full gap-3 rounded-2xl bg-space-2/60 p-3 text-left hover:bg-white/5">
                  {n.photoUrl ? (
                    <img src={`${base}${n.photoUrl}`} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl" style={{ background: `${c?.color ?? "#7d80d9"}22` }}>
                      <span className="h-3 w-3 rounded-full" style={{ background: c?.color ?? "#7d80d9" }} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold" style={{ color: c?.color }}>
                      {n.placeName} · {ago(n.createdAt)}
                    </span>
                    <span className="block font-bold leading-snug">{n.text}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
