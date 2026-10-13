import type { PlaceSummary } from "@workspace/api-client-react";
import { Heart, BadgeCheck, Gift } from "lucide-react";
import type { Constellation } from "@/lib/constellations";
import { openState } from "@/lib/hours";

/** Vista en lista: misma información, sin 3D ni gestos. Accesible por teclado y lector. */
export function ListView({
  constellations,
  places,
  scores,
  reasons,
  showPercent = false,
  onSelect,
}: {
  constellations: Constellation[];
  places: PlaceSummary[];
  scores: Map<string, number> | null;
  reasons?: Map<string, string | null>;
  showPercent?: boolean;
  onSelect: (id: string) => void;
}) {
  const visible = scores ? places.filter((p) => scores.has(p.id)) : places;
  const sorted = [...visible].sort((a, b) =>
    scores ? (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) : a.name.localeCompare(b.name),
  );

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 pb-28 pt-24">
      <div className="mx-auto max-w-lg space-y-6">
        {constellations.map((info) => {
          const c = info.id;
          const group = sorted.filter((p) => p.constellation === c);
          if (group.length === 0) return null;
          return (
            <section key={c} aria-label={info.name}>
              <h2 className="mb-2 text-sm font-black uppercase tracking-wide" style={{ color: info.color }}>
                {info.name}
              </h2>
              <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-panel/70">
                {group.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => onSelect(p.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
                    >
                      {p.coverUrl ? (
                        <img
                          src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}${p.coverUrl}`}
                          alt=""
                          loading="lazy"
                          className="h-11 w-11 shrink-0 rounded-xl object-cover"
                          style={{ opacity: scores ? 0.45 + (scores.get(p.id) ?? 0) * 0.55 : 1 }}
                        />
                      ) : (
                        <span className="grid h-11 w-11 shrink-0 place-items-center">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{
                              background: info.color,
                              opacity: scores ? 0.35 + (scores.get(p.id) ?? 0) * 0.65 : 1,
                            }}
                          />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{p.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {p.category}
                          {(() => {
                            const o = openState(p.hours);
                            return o ? <span className={o.open ? "text-confianza" : ""}> · {o.open ? "Abierto" : "Cerrado"}</span> : null;
                          })()}
                        </span>
                        {showPercent && reasons?.get(p.id) && (
                          <span className="block text-xs text-ai">{reasons.get(p.id)}</span>
                        )}
                      </span>
                      {showPercent && scores?.has(p.id) && (
                        <span className="shrink-0 text-sm font-black text-ai">{Math.round(scores.get(p.id)! * 100)}%</span>
                      )}
                      {p.welcome && <Gift size={15} className="text-[#E6C882]" aria-label="Regalo en tu primera visita" />}
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
