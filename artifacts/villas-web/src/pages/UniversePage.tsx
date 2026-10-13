import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetUniverse,
  useGetMySky,
  getGetMySkyQueryKey,
  useListNews,
  getListNewsQueryKey,
  useSearch,
  type Creator,
  type Me,
  type SearchResult,
} from "@workspace/api-client-react";
import { Crosshair, List, Orbit, Search, Settings2, X, MessageCircle, KeyRound, QrCode, Sparkles, ShoppingBag } from "lucide-react";
import { NewsSheet } from "@/components/NewsSheet";
import { getPickup, setPickup, type PendingPickup } from "@/lib/pickup";
import { UniverseCanvas, type UniverseHandle, type Level } from "@/components/UniverseCanvas";
import { PlaceSheet } from "@/components/PlaceSheet";
import { CreatorAvatar, CreatorSheet } from "@/components/CreatorSheet";
import { ListView } from "@/components/ListView";
import { MeSheet } from "@/components/MeSheet";
import { Intro, introSeen } from "@/components/Intro";
import { InstallPrompt } from "@/components/InstallPrompt";
import { homeLayout, searchLayout } from "@/lib/layout";
import { byId, placeConstellations, whatsappLink } from "@/lib/constellations";

/**
 * Pantalla principal. me = null es un visitante sin llave: ve y busca en el
 * universo, pero el contacto y quién recomienda quedan detrás de "Únete".
 */
export function UniversePage({ me, creator }: { me: Me | null; creator: Creator }) {
  const [, navigate] = useLocation();
  const guest = me === null;
  const { data, isLoading } = useGetUniverse();
  const places = data?.places ?? [];
  const constellations = useMemo(() => placeConstellations(data?.constellations ?? []), [data]);
  const cById = useMemo(() => byId(constellations), [constellations]);
  // Cielo personal: se refresca al volver a la app (por si acaban de escanear tu credencial).
  const sky = useGetMySky({
    query: { queryKey: getGetMySkyQueryKey(), enabled: !guest, refetchOnWindowFocus: true, staleTime: 20_000 },
  });
  const lit = useMemo(
    () => (guest ? null : new Set((sky.data?.visits ?? []).map((v) => v.placeId))),
    [guest, sky.data],
  );
  const litCount = useMemo(() => (lit ? places.filter((p) => lit.has(p.id)).length : 0), [lit, places]);

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const autoSelected = useRef(false);
  const [view, setView] = useState<"universe" | "list">("universe");
  const [creatorOpen, setCreatorOpen] = useState(false);
  // Atajo del ícono instalado ("Mi credencial") o link directo: abre la credencial.
  const [meOpen, setMeOpen] = useState(() => !guest && new URLSearchParams(window.location.search).has("credencial"));
  const [showIntro, setShowIntro] = useState(() => !introSeen());
  const news = useListNews({ query: { queryKey: getListNewsQueryKey(), refetchOnWindowFocus: true, staleTime: 60_000 } }).data ?? [];
  const [newsOpen, setNewsOpen] = useState(false);
  const [pickup, setPickupState] = useState<PendingPickup | null>(() => getPickup());
  useEffect(() => {
    const on = () => setPickupState(getPickup());
    window.addEventListener("villas-pickup", on);
    window.addEventListener("focus", on);
    return () => {
      window.removeEventListener("villas-pickup", on);
      window.removeEventListener("focus", on);
    };
  }, []);
  const [level, setLevel] = useState<Level>("far");
  const canvas = useRef<UniverseHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scores = useMemo(
    () => (result ? new Map(result.matches.map((m) => [m.placeId, m.score])) : null),
    [result],
  );
  const reasons = useMemo(
    () => new Map((result?.matches ?? []).map((m) => [m.placeId, m.reason])),
    [result],
  );
  const home = useMemo(() => homeLayout(places, constellations), [places, constellations]);
  const positions = useMemo(
    () => searchLayout(places, home, scores, constellations),
    [places, home, scores, constellations],
  );

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

  const run = () => {
    const q = query.trim();
    if (!q || search.isPending) return;
    search.mutate({ data: { query: q, refine: false } });
  };

  const clear = () => {
    setQuery("");
    setResult(null);
    setSelectedId(null);
    canvas.current?.home();
  };

  const select = (id: string) => {
    autoSelected.current = false;
    setSelectedId(id);
    if (view === "universe") canvas.current?.flyTo(id);
  };

  const firstName = creator.name.split(" ")[0] ?? creator.name;
  const meFirst = me ? (me.name.trim().split(/\s+/)[0] ?? me.name) : "Tú";
  const noResults = result && result.matches.length === 0;
  const tooManyGuestSearches =
    search.isError && (search.error as { status?: number } | null)?.status === 429;

  return (
    <div className="relative h-full overflow-hidden">
      <div className="sky" aria-hidden />

      {view === "universe" ? (
        <UniverseCanvas
          ref={canvas}
          constellations={constellations}
          places={places}
          positions={positions}
          searching={Boolean(result)}
          showPercent={result?.mode === "ai"}
          selectedId={selectedId}
          onSelect={select}
          onLevelChange={setLevel}
          meLabel={meFirst}
          lit={lit}
          onMeClick={() => (guest ? navigate("/unirme") : setMeOpen(true))}
        />
      ) : (
        <ListView constellations={constellations} places={places} scores={scores} reasons={reasons} showPercent={result?.mode === "ai"} onSelect={select} />
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
              placeholder="¿Qué necesitas? Entre más detalle, mejor"
              aria-label="Buscar en Villas"
              enterKeyHint="search"
              maxLength={400}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-muted/70"
            />
            {(query || result) && (
              <button type="button" onClick={clear} className="rounded-full p-1.5 text-muted hover:bg-white/10" aria-label="Limpiar búsqueda">
                <X size={18} />
              </button>
            )}
          </form>
          <CreatorAvatar creator={creator} onClick={() => setCreatorOpen(true)} />
        </div>

        <div className="pointer-events-auto mx-auto mt-2 max-w-lg px-2 text-center text-xs text-muted" aria-live="polite">
          {search.isPending && (creator.aiEnabled && !guest ? "Buscando el mejor match…" : "Buscando entre las estrellas…")}
          {!search.isPending && result && result.matches.length > 0 && (
            <>
              {result.matches.length} {result.matches.length === 1 ? "coincidencia" : "coincidencias"}
              {result.mode === "ai" ? (
                <span className="text-ai"> · ordenadas por match con IA</span>
              ) : (
                " · más cerca y más brillante = mejor"
              )}
            </>
          )}
          {/* Solo al visitante nuevo le hace falta la pista; el vecino ya conoce su universo. */}
          {guest && !search.isPending && !result && !isLoading && level === "far" && view === "universe" && (
            <>Pellizca para acercarte o toca una constelación</>
          )}
          {tooManyGuestSearches && (
            <span className="text-casas">Llegaste al límite de búsquedas de la vista previa. Únete para buscar sin límite.</span>
          )}
          {search.isError && !tooManyGuestSearches && <span className="text-alert">No pude buscar. Revisa tu conexión.</span>}
        </div>

        {/* Hoy en Villas: lo nuevo del día, a un toque. */}
        {!result && news.length > 0 && view === "universe" && (
          <div className="pointer-events-auto mx-auto mt-2 flex max-w-lg justify-center">
            <button
              onClick={() => setNewsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-ai/50 bg-panel/80 px-3 py-1 text-xs font-bold text-ai backdrop-blur"
            >
              <Sparkles size={13} /> Hoy en Villas · {news.length} {news.length === 1 ? "novedad" : "novedades"}
            </button>
          </div>
        )}

        {/* Visitante: invitación discreta a unirse. */}
        {guest && !result && (
          <div className="pointer-events-auto mx-auto mt-2 flex max-w-lg justify-center">
            <Link
              href="/unirme"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-panel/80 px-3 py-1 text-xs font-bold text-primary backdrop-blur"
            >
              <KeyRound size={13} /> Vista previa · Únete para ver contactos
            </Link>
          </div>
        )}

        {noResults && (
          <div className="sheet-enter pointer-events-auto mx-auto mt-3 max-w-lg rounded-2xl border border-primary/40 bg-panel/95 p-4 text-sm shadow-xl">
            <p className="mb-3">
              No encontré nada para <b>«{query}»</b>.{" "}
              {guest ? `Escríbele a ${firstName}: quizá lo conoce.` : `Ya le llegó a ${firstName} y te ayuda en persona.`}
            </p>
            <a
              href={whatsappLink(creator.whatsapp, `Hola ${firstName}, busqué «${query}» en la guía de Villas y no encontré nada.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-bold text-space"
            >
              <MessageCircle size={16} /> Escribirle a {firstName}
            </a>
          </div>
        )}
      </header>

      {/* Controles mínimos abajo. */}
      <nav className="pb-safe pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4">
        {pickup && !selectedId && !meOpen ? (
          <div className="sheet-enter pointer-events-auto mx-auto mb-3 flex w-full max-w-lg items-center gap-3 rounded-2xl border border-[#25D366]/50 bg-panel/95 p-3 shadow-2xl backdrop-blur">
            <ShoppingBag size={20} className="shrink-0 text-[#25D366]" />
            <p className="min-w-0 flex-1 text-sm">
              Tu pedido en <b>{pickup.placeName}</b>
            </p>
            <a
              href={whatsappLink(
                pickup.whatsapp,
                `Hola${pickup.contactName ? ` ${pickup.contactName}` : ""}, ya estoy afuera para recoger mi pedido. Soy ${meFirst}, de Villas.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setPickup(null)}
              className="shrink-0 rounded-full bg-[#25D366] px-4 py-2 text-xs font-black text-[#0b3d1f]"
            >
              Ya llegué
            </a>
            <button onClick={() => setPickup(null)} className="rounded-full p-1 text-muted" aria-label="Quitar pedido">
              <X size={16} />
            </button>
          </div>
        ) : (
          !guest && !showIntro && !selectedId && !meOpen && <InstallPrompt />
        )}
        <div className="flex items-end justify-between">
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
          {!guest && (
            <button
              onClick={() => setMeOpen(true)}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-panel/90 px-4 py-2.5 text-sm font-bold shadow-lg backdrop-blur"
            >
              <QrCode size={16} /> Credencial
            </button>
          )}
          {me?.role === "admin" && (
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
        </div>
      </nav>

      {isLoading && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted">Encendiendo el cielo de Villas…</div>
      )}
      {!isLoading && places.length === 0 && (
        <div className="absolute inset-x-6 bottom-28 text-center text-sm text-muted">
          Aún no hay estrellas. {me?.role === "admin" ? "Da de alta los primeros comercios desde el panel." : `${firstName} está sumando las primeras.`}
        </div>
      )}

      {selectedId && (
        <PlaceSheet
          key={selectedId}
          placeId={selectedId}
          searchId={result?.searchId ?? null}
          match={
            result?.mode === "ai" && scores?.has(selectedId)
              ? { score: scores.get(selectedId)!, reason: reasons.get(selectedId) ?? null }
              : null
          }
          constellations={cById}
          creatorName={creator.name}
          creatorWhatsapp={creator.whatsapp}
          meName={me?.name ?? ""}
          isAdmin={me?.role === "admin"}
          onClose={() => {
            autoSelected.current = false;
            setSelectedId(null);
          }}
        />
      )}
      {newsOpen && (
        <NewsSheet
          news={news}
          constellations={cById}
          onOpen={(id) => {
            setNewsOpen(false);
            select(id);
          }}
          onClose={() => setNewsOpen(false)}
        />
      )}
      {showIntro && <Intro creator={creator} guest={guest} onDone={() => setShowIntro(false)} />}
      {creatorOpen && <CreatorSheet creator={creator} onClose={() => setCreatorOpen(false)} />}
      {meOpen && me && (
        <MeSheet
          me={me}
          creatorFirstName={firstName}
          memberCode={sky.data?.memberCode ?? null}
          litCount={litCount}
          total={places.length}
          onClose={() => setMeOpen(false)}
        />
      )}
    </div>
  );
}
