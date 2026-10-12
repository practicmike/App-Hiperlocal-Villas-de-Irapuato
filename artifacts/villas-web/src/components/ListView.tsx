import type { PlaceSummary } from "@workspace/api-client-react";
import { Heart, BadgeCheck } from "lucide-react";
import { CONSTELLATIONS, ORDER } from "@/lib/constellations";

/** Vista en lista: misma información, sin 3D ni gestos. Accesible por teclado y lector. */
export function ListView({
  places,
  scores,
  onSelect,
}: {
  places: PlaceSummary[];
  scores: Map<string, number> | null;
  onSelect: (id: string) => void;
}) {
  const visible = scores ? places.filter((p) => scores.has(p.id)) : places;
  const sorted = [...visible].sort((a, b) =>
    scores ? (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) : a.name.localeCompare(b.name),
  );

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 pb-28 pt-24">
      <div className="mx-auto max-w-lg space-y-6">
        {ORDER.map((c) => {
          const group = sorted.filter((p) => p.constellation === c);
          if (group.length === 0) return null;
          const info = CONSTELLATIONS[c];
          return (
            <section key={c} aria-label={info.label}>
              <h2 className="mb-2 text-sm font-black uppercase tracking-wide" style={{ color: info.color }}>
                {info.label}
              </h2>
              <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-panel/70">
                {group.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => onSelect(p.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{
                          background: info.color,
                          opacity: scores ? 0.35 + (scores.get(p.id) ?? 0) * 0.65 : 1,
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{p.name}</span>
                        <span className="block truncate text-xs text-muted">{p.category}</span>
                      </span>
                      {p.verified && <BadgeCheck size={16} className="text-me" aria-label="Verificado" />}
                      {p.endorsementCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-alert">
                          <Heart size={12} fill="currentColor" /> {p.endorsementCount}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
