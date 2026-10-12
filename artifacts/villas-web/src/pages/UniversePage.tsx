import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  useGetUniverse,
  useSearch,
  useSuggestPhrasing,
  type Creator,
  type Me,
  type SearchResult,
} from "@workspace/api-client-react";
import { Crosshair, List, Orbit, Search, Settings2, Sparkles, X, MessageCircle } from "lucide-react";
import { UniverseCanvas, type UniverseHandle, type Level } from "@/components/UniverseCanvas";
import { PlaceSheet } from "@/components/PlaceSheet";
import { CreatorAvatar, CreatorSheet } from "@/components/CreatorSheet";
import { ListView } from "@/components/ListView";
import { MeSheet } from "@/components/MeSheet";
import { homeLayout, searchLayout } from "@/lib/layout";
import { CONSTELLATIONS, whatsappLink } from "@/lib/constellations";

export function UniversePage({ me, creator }: { me: Me; creator: Creator }) {
  const { data, isLoading } = useGetUniverse();
  const places = data?.places ?? [];

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const autoSelected = useRef(false);
  const [view, setView] = useState<"universe" | "list">("universe");
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [meOpen, setMeOpen] = useState(false);
  // Sugerencias de la IA para decir mejor lo que se busca; null = ocultas.
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("far");
  const canvas = useRef<UniverseHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scores = useMemo(
    () => (result ? new Map(result.matches.map((m) => [m.placeId, m.score])) : null),
    [result],
  );
  const home = useMemo(() => homeLayout(places), [places]);
  const positions = useMemo(() => searchLayout(places, home, scores), [places, home, scores]);

  const search = useSearch({
    mutation: {
      onSuccess: (r) => {
        setResult(r);
        setSelectedId(null);
        inputRef.current?.blur();
      },
    },
  });

  // Tras una búsqueda, encuadrar lo que coincidió (cuando ya terminó la animación de posiciones).
  useEffect(() => {
    if (!result || view !== "universe") return;
    const t = setTimeout(() => {
      if (result.matches.length === 1) {
        canvas.current?.flyTo(result.matches[0]!.placeId);
        setSelectedId(result.matches[0]!.placeId);
      } else if (result.matches.length > 0) {
        canvas.current?.fitMatches();
      } else {
        canvas.current?.home();
      }
    }, 80);
    return () => clearTimeout(t);
  }, [result, view]);

  const runWith = (text: string) => {
    const q = text.trim();
    if (!q || search.isPending) return;
    setSuggestions(null);
    setAiHint(null);
    search.mutate({ data: { query: q, refine: false } });
  };
  const run = () => runWith(query);

  const suggest = useSuggestPhrasing({
    mutation: {
      onSuccess: (r) => {
        if (!r.available || r.suggestions.length === 0) {
          setSuggestions(null);
          setAiHint("No pude ayudarte ahora. Intenta escribirlo con otras palabras.");
          return;
        }
        setAiHint(null);
        setSuggestions(r.suggestions);
      },
      onError: () => setAiHint("No pude ayudarte ahora. Intenta de nuevo en un momento."),
    },
  });
  const askHelp = () => {
    const q = query.trim();
    if (!q) {
      setSuggestions(null);
      setAiHint("Escribe lo que necesitas como te salga y te ayudo a decirlo mejor.");
      inputRef.current?.focus();
      return;
    }
    setAiHint(null);
    suggest.mutate({ data: { query: q } });
  };

  const clear = () => {
    setQuery("");
    setResult(null);
    setSelectedId(null);
    setSuggestions(null);
    setAiHint(null);
    canvas.current?.home();
  };

  const select = (id: string) => {
    autoSelected.current = false;
    setSelectedId(id);
    if (view === "universe") canvas.current?.flyTo(id);
  };

  const firstName = creator.name.split(" ")[0] ?? creator.name;
  const meFirst = me.name.trim().split(/\s+/)[0] ?? me.name;
  const noResults = result && result.matches.length === 0;

  return (
    <div className="relative h-full overflow-hidden">
      <div className="sky" aria-hidden />

      {view === "universe" ? (
        <UniverseCanvas
          ref={canvas}
          places={places}
          positions={positions}
          searching={Boolean(result)}
          selectedId={selectedId}
          onSelect={select}
          onLevelChange={setLevel}
          meLabel={meFirst}
          onMeClick={() => setMeOpen(true)}
          onApproach={(id) => {
            if (id && !selectedId) {
              autoSelected.current = true;
              setSelectedId(id);
            } else if (!id && autoSelected.current) {
              autoSelected.current = false;
              setSelectedId(null);
            }
          }}
        />
      ) : (
        <ListView places={places} scores={scores} onSelect={select} />
      )}

      {/* Lo único fijo: la búsqueda (y la cara del creador). */}
      <header className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-20 px-3">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2">
          <form
            className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-panel/90 py-1.5 pl-4 pr-1.5 shadow-xl backdrop-blur focus-within:border-primary"
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
            role="search"
          >
            <Search size={18} className="shrink-0 text-muted" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="¿Qué necesitas? Escríbelo con tus palabras"
              aria-label="Buscar en Villas"
              enterKeyHint="search"
              maxLength={200}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-muted/70"
            />
            {(query || result) && (
              <button type="button" onClick={clear} className="rounded-full p-1.5 text-muted hover:bg-white/10" aria-label="Limpiar búsqueda">
                <X size={18} />
              </button>
            )}
            {creator.aiEnabled && (
              <button
                type="button"
                onClick={askHelp}
                disabled={suggest.isPending}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-ai transition hover:bg-ai/15 ${suggest.isPending ? "animate-pulse" : ""}`}
                aria-label="Ayúdame a decirlo mejor"
                title="Ayúdame a decirlo mejor"
              >
                <Sparkles size={18} />
              </button>
            )}
          </form>
          <CreatorAvatar creator={creator} onClick={() => setCreatorOpen(true)} />
        </div>

        <div className="pointer-events-auto mx-auto mt-2 max-w-lg px-2 text-center text-xs text-muted" aria-live="polite">
          {search.isPending && "Buscando entre las estrellas…"}
          {!search.isPending && result && result.matches.length > 0 && (
            <>
              {result.matches.length} {result.matches.length === 1 ? "coincidencia" : "coincidencias"}
              {result.constellation && ` en ${CONSTELLATIONS[result.constellation].label}`} · más cerca y más brillante = mejor
              {result.refinedQuery && <span className="block text-ai">Busqué: {result.refinedQuery}</span>}
            </>
          )}
          {!search.isPending && !result && !suggestions && !aiHint && !isLoading && level === "far" && view === "universe" && (
            <>Hola, {meFirst} · pellizca para acercarte o toca una constelación</>
          )}
          {suggest.isPending && <span className="text-ai">Pensando cómo decirlo…</span>}
          {aiHint && <span className="text-ai">{aiHint}</span>}
          {search.isError && <span className="text-alert">No pude buscar. Revisa tu conexión.</span>}
        </div>

        {suggestions && (
          <div className="sheet-enter pointer-events-auto mx-auto mt-2 max-w-lg px-1">
            <p className="mb-1.5 flex items-center gap-1 text-xs text-ai">
              <Sparkles size={12} /> ¿Lo quieres decir así? Toca una:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setQuery(s);
                    runWith(s);
                  }}
                  className="rounded-full border border-ai/50 bg-panel/90 px-3 py-1.5 text-left text-sm text-ink backdrop-blur hover:bg-ai/15"
                >
                  {s}
                </button>
              ))}
              <button onClick={() => setSuggestions(null)} className="px-2 text-xs text-muted" aria-label="Ocultar sugerencias">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {noResults && (
          <div className="sheet-enter pointer-events-auto mx-auto mt-3 max-w-lg rounded-2xl border border-primary/40 bg-panel/95 p-4 text-sm shadow-xl">
            <p className="mb-3">
              No encontré nada para <b>«{query}»</b>. Ya le llegó a {firstName} y te ayuda en persona.
            </p>
            <a
              href={whatsappLink(creator.whatsapp, `Hola ${firstName}, busqué «${query}» en la guía de Villas y no encontré nada.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-bold text-space"
            >
              <MessageCircle size={16} /> Escribirle a {firstName}
            </a>
            {creator.aiEnabled && (
              <button
                onClick={askHelp}
                disabled={suggest.isPending}
                className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-ai/50 px-4 py-2 font-bold text-ai"
              >
                <Sparkles size={15} /> Decirlo de otra forma
              </button>
            )}
          </div>
        )}
      </header>

      {/* Controles mínimos abajo. */}
      <nav className="pb-safe pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-4">
        <div className="pointer-events-auto flex gap-2">
          <button
            onClick={() => {
              setView(view === "universe" ? "list" : "universe");
              setSelectedId(null);
            }}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-panel/90 px-4 py-2.5 text-sm font-bold shadow-lg backdrop-blur"
          >
            {view === "universe" ? <List size={16} /> : <Orbit size={16} />}
            {view === "universe" ? "Lista" : "Universo"}
          </button>
          {me.role === "admin" && (
            <Link
              href="/panel"
              className="flex items-center gap-2 rounded-full border border-white/10 bg-panel/90 px-4 py-2.5 text-sm font-bold shadow-lg"
            >
              <Settings2 size={16} /> Panel
            </Link>
          )}
        </div>
        {view === "universe" && (level !== "far" || result) && (
          <button
            onClick={() => {
              setSelectedId(null);
              if (result && result.matches.length > 0) canvas.current?.fitMatches();
              else canvas.current?.home();
            }}
            className="pointer-events-auto rounded-full border border-white/10 bg-panel/90 p-3 shadow-lg backdrop-blur"
            aria-label="Volver a ver todo"
          >
            <Crosshair size={18} />
          </button>
        )}
      </nav>

      {isLoading && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted">Encendiendo el cielo de Villas…</div>
      )}
      {!isLoading && places.length === 0 && (
        <div className="absolute inset-x-6 bottom-28 text-center text-sm text-muted">
          Aún no hay estrellas. {me.role === "admin" ? "Da de alta los primeros comercios desde el panel." : `${firstName} está sumando las primeras.`}
        </div>
      )}

      {selectedId && (
        <PlaceSheet
          key={selectedId}
          placeId={selectedId}
          searchId={result?.searchId ?? null}
          creatorName={creator.name}
          meName={me.name}
          onClose={() => {
            autoSelected.current = false;
            setSelectedId(null);
          }}
        />
      )}
      {creatorOpen && <CreatorSheet creator={creator} onClose={() => setCreatorOpen(false)} />}
      {meOpen && <MeSheet me={me} creatorFirstName={firstName} onClose={() => setMeOpen(false)} />}
    </div>
  );
}
