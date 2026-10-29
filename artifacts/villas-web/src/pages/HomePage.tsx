import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  useGetUniverse,
  useGetMySky,
  getGetMySkyQueryKey,
  useListNews,
  getListNewsQueryKey,
  useSearch,
  useSendSearchSuggestion,
  useGetFrequentSearches,
  getGetFrequentSearchesQueryKey,
  type Creator,
  type Me,
  type PlaceSummary,
  type SearchResult,
} from "@workspace/api-client-react";
import { ArrowLeft, Bell, Bookmark, Check, ChevronDown, ChevronUp, History, KeyRound, LocateFixed, Lightbulb, QrCode, RotateCcw, Search, Settings2, ShoppingBag, X, Home } from "lucide-react";
import { getPickup, setPickup, type PendingPickup } from "@/lib/pickup";
import { PlaceSheet } from "@/components/PlaceSheet";
import { CreatorAvatar, CreatorSheet } from "@/components/CreatorSheet";
import { MeSheet } from "@/components/MeSheet";
import { Intro, introSeen } from "@/components/Intro";
import { InstallPrompt } from "@/components/InstallPrompt";
import { VoiceButton, voiceAvailable } from "@/components/VoiceButton";
import { RadarMap, type RadarPoint } from "@/components/RadarMap";
import { NovedadesSheet, hasUnseen, markSeen } from "@/components/NovedadesSheet";
import { useSaved } from "@/lib/saved";
import { FALLBACK, byId, placeConstellations, whatsappLink } from "@/lib/constellations";
import { centroid, distanceM, formatDistance, useMyLocation, type LatLng } from "@/lib/geo";

/** Si no hay lugares con ubicación todavía: centro de Irapuato, solo para que el mapa abra en algún lado. */
const IRAPUATO: LatLng = { lat: 20.6767, lng: -101.3563 };
/** Más lejos que esto, tu ubicación no es "Villas" (estás en otra ciudad): el radar abre en Villas. */
const NEAR_M = 5_000;
/** Alto de la hoja de resultados sobre el mapa. */
const SHEET_PX = 340;
/** Hoja plegada: solo la barra con el conteo, para ver el mapa completo. */
const SHEET_FOLDED_PX = 72;

/**
 * Inicio de Villas: primero la pregunta (escrita o hablada) con tus búsquedas
 * frecuentes como atajo; luego el radar con lo que te queda más cerca.
 * me = null es un visitante sin llave: busca con límite y el contacto queda detrás de "Únete".
 */
export function HomePage({ me, creator }: { me: Me | null; creator: Creator }) {
  const guest = me === null;
  const { data, isLoading } = useGetUniverse();
  const places = data?.places ?? [];
  const constellations = useMemo(() => placeConstellations(data?.constellations ?? []), [data]);
  const cById = useMemo(() => byId(constellations), [constellations]);
  const colorOf = (p: PlaceSummary) => (cById.get(p.constellation) ?? FALLBACK).color;

  const sky = useGetMySky({
    query: { queryKey: getGetMySkyQueryKey(), enabled: !guest, refetchOnWindowFocus: true, staleTime: 20_000 },
  });
  const litCount = useMemo(() => {
    const lit = new Set((sky.data?.visits ?? []).map((v) => v.placeId));
    return places.filter((p) => lit.has(p.id)).length;
  }, [sky.data, places]);
  const frequent = useGetFrequentSearches({
    query: { queryKey: getGetFrequentSearchesQueryKey(), staleTime: 5 * 60_000 },
  }).data;
  const news = useListNews({ query: { queryKey: getListNewsQueryKey(), refetchOnWindowFocus: true, staleTime: 60_000 } }).data ?? [];

  const [screen, setScreen] = useState<"ask" | "radar">("ask");
  /** Radar mostrando solo lo que el vecino guardó. */
  const [savedOnly, setSavedOnly] = useState(false);
  const saved = useSaved(!guest);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [meOpen, setMeOpen] = useState(() => !guest && new URLSearchParams(window.location.search).has("credencial"));
  const [showIntro, setShowIntro] = useState(() => !introSeen());
  const [novedadesOpen, setNovedadesOpen] = useState(false);
  const [unseen, setUnseen] = useState(false);
  useEffect(() => setUnseen(hasUnseen(news, places)), [news, places]);

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

  const inputRef = useRef<HTMLInputElement>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  useEffect(() => {
    if (!voiceError) return;
    const t = setTimeout(() => setVoiceError(null), 6000);
    return () => clearTimeout(t);
  }, [voiceError]);
  const hasVoice = useMemo(() => voiceAvailable(creator.aiEnabled), [creator.aiEnabled]);

  const search = useSearch({
    mutation: {
      onSuccess: (r) => {
        setResult(r);
        setSelectedId(null);
        inputRef.current?.blur();
        // Con algo que mostrar, directo al radar; sin nada, se queda en la pregunta con la salida a WhatsApp.
        if (r.matches.length > 0) {
          setSavedOnly(false);
          setScreen("radar");
        }
      },
    },
  });
  const run = (text?: string) => {
    const q = (text ?? query).trim();
    if (!q || search.isPending) return;
    setQuery(q);
    search.mutate({ data: { query: q, refine: false } });
  };
  const explore = () => {
    setResult(null);
    setSavedOnly(false);
    setSelectedId(null);
    setScreen("radar");
  };
  const openSaved = () => {
    setResult(null);
    setSavedOnly(true);
    setSelectedId(null);
    setScreen("radar");
  };
  const backToAsk = () => {
    setScreen("ask");
    setSavedOnly(false);
    setSelectedId(null);
  };

  // ---------------------------------------------------------- radar
  const geo = useMyLocation(screen === "radar");
  const located = places.filter((p): p is PlaceSummary & LatLng => p.lat != null && p.lng != null);
  const villasCenter = useMemo(() => centroid(located) ?? IRAPUATO, [located.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const me_at = geo.state.status === "ok" && distanceM(geo.state.at, villasCenter) < NEAR_M ? geo.state.at : null;
  const farAway = geo.state.status === "ok" && !me_at;

  const shown = useMemo(() => {
    if (savedOnly) {
      const order = new Map(saved.ids.map((id, i) => [id, i]));
      return places.filter((p) => order.has(p.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    }
    if (!result) return places;
    const ids = new Set(result.matches.map((m) => m.placeId));
    return places.filter((p) => ids.has(p.id));
  }, [places, result, savedOnly, saved.ids]);
  const reasons = useMemo(() => new Map((result?.matches ?? []).map((m) => [m.placeId, m.reason])), [result]);

  // Lugares con ubicación: por distancia si sabemos dónde estás; si no, por relevancia o por nombre.
  const rank = useMemo(() => new Map((result?.matches ?? []).map((m, i) => [m.placeId, i])), [result]);
  const withDistance = shown
    .filter((p): p is PlaceSummary & LatLng => p.lat != null && p.lng != null)
    .map((p) => ({ place: p, m: me_at ? distanceM(me_at, p) : null }))
    .sort((a, b) =>
      a.m !== null && b.m !== null
        ? a.m - b.m
        : result
          ? (rank.get(a.place.id) ?? 0) - (rank.get(b.place.id) ?? 0)
          : a.place.name.localeCompare(b.place.name, "es"),
    );
  // A domicilio: los que van a tu casa o aún no tienen ubicación. Sin punto en el mapa.
  const atHome = shown
    .filter((p) => p.lat == null || p.lng == null)
    .sort((a, b) => (result ? (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0) : a.name.localeCompare(b.name, "es")));
  const points: RadarPoint[] = useMemo(
    () => withDistance.map(({ place: p }) => ({ id: p.id, lat: p.lat, lng: p.lng, name: p.name, color: colorOf(p) })),
    [shown, cById], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // La hoja crece con los resultados hasta SHEET_PX; con uno solo, el mapa se ve más.
  const rows = withDistance.length + atHome.length;
  const [sheetOpen, setSheetOpen] = useState(true);
  // Cada búsqueda nueva vuelve a mostrar la lista.
  useEffect(() => setSheetOpen(true), [result?.searchId]);
  const sheetFull = Math.min(SHEET_PX, 92 + Math.max(rows, 1) * 69 + (atHome.length ? 36 : 0));
  const sheetH = sheetOpen ? sheetFull : SHEET_FOLDED_PX;

  // ---------------------------------------------------------- atajos
  const shortcuts = useMemo(() => {
    const mine = frequent?.mine ?? [];
    if (mine.length >= 3) return { title: "Tus búsquedas frecuentes", items: mine.slice(0, 4) };
    const merged = [...new Set([...mine, ...(frequent?.barrio ?? [])])].slice(0, 4);
    if (merged.length) return { title: mine.length ? "Tus búsquedas y las de Villas" : "Lo más buscado en Villas", items: merged };
    // Villas recién empezando: los giros con más lugares.
    const count = new Map<string, number>();
    for (const p of places) count.set(p.category, (count.get(p.category) ?? 0) + 1);
    const cats = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
    return { title: "Para empezar", items: cats };
  }, [frequent, places]);

  const firstName = creator.name.split(" ")[0] ?? creator.name;
  const meFirst = me ? (me.name.trim().split(/\s+/)[0] ?? me.name) : "Tú";
  const noResults = result && result.matches.length === 0 && screen === "ask";
  const tooManyGuestSearches = search.isError && (search.error as { status?: number } | null)?.status === 429;

  const status = (
    <div className="mt-3 min-h-5 text-center text-sm text-muted" aria-live="polite">
      {search.isPending && (creator.aiEnabled && !guest ? "Buscando el mejor match…" : "Buscando…")}
      {tooManyGuestSearches && (
        <span className="text-casas">Llegaste al límite de búsquedas de la vista previa. Pide entrar para buscar sin límite.</span>
      )}
      {search.isError && !tooManyGuestSearches && <span className="text-alert">No pude buscar. Revisa tu conexión.</span>}
      {voiceError && !search.isPending && <span className="text-alert">{voiceError}</span>}
    </div>
  );

  const bell = (
    <button
      onClick={() => {
        setNovedadesOpen(true);
        markSeen();
        setUnseen(false);
      }}
      className="relative grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-panel/80"
      aria-label={unseen ? "Novedades (hay nuevas)" : "Novedades"}
    >
      <Bell size={20} className="text-muted" />
      {unseen && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-space bg-me" aria-hidden />}
    </button>
  );

  return (
    <div className="relative h-full overflow-hidden">
      {screen === "ask" ? (
        <div className="relative flex h-full flex-col">
          <div className="sky" aria-hidden />
          <header className="pt-safe relative z-10 mx-auto flex w-full max-w-lg items-center gap-2 px-4 pt-3">
            <p className="min-w-0 flex-1 truncate text-base font-black">
              OrbiTú <span className="font-normal text-muted">Villas</span>
            </p>
            {bell}
            <CreatorAvatar creator={creator} onClick={() => setCreatorOpen(true)} />
          </header>

          <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5">
            <h1 className="text-[40px] font-light leading-tight">
              ¿Qué necesitas
              <br />
              <span className="font-black">hoy</span>?
            </h1>

            <form
              className="mt-6 flex items-center gap-2 rounded-full border border-white/10 bg-panel/90 py-1.5 pl-4 pr-1.5 shadow-xl focus-within:border-primary"
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
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (result) setResult(null);
                }}
                placeholder={listening ? "Te escucho…" : "Plomero, tacos, casa en renta…"}
                aria-label="Buscar en Villas"
                enterKeyHint="search"
                maxLength={400}
                className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted/70"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setResult(null);
                  }}
                  className="rounded-full p-2 text-muted hover:bg-white/10"
                  aria-label="Borrar"
                >
                  <X size={18} />
                </button>
              )}
            </form>

            {hasVoice && (
              <div className="mt-6 flex flex-col items-center gap-2">
                <VoiceButton
                  size="lg"
                  serverAi={creator.aiEnabled}
                  onPartial={setQuery}
                  onError={setVoiceError}
                  onListening={setListening}
                  onText={(t) => {
                    setQuery(t);
                    run(t);
                  }}
                />
                <span className="text-xs text-muted">{listening ? "Te escucho… toca para terminar" : "o dímelo"}</span>
              </div>
            )}

            {status}

            {noResults && result && (
              <NoResults
                key={result.searchId}
                query={query}
                searchId={result.searchId}
                creatorFirst={firstName}
                onRetry={() => {
                  setQuery("");
                  setResult(null);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
              />
            )}

            {!noResults && shortcuts.items.length > 0 && (
              <section className="mt-6" aria-label={shortcuts.title}>
                <h2 className="text-center text-xs font-bold tracking-widest text-muted">{shortcuts.title.toUpperCase()}</h2>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {shortcuts.items.map((s) => (
                    <button
                      key={s}
                      onClick={() => run(s)}
                      disabled={search.isPending}
                      className="flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-panel/60 px-4 text-[15px] hover:border-primary"
                    >
                      <History size={15} className="text-muted" aria-hidden />
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {guest && (
              <div className="mt-5 flex justify-center">
                <Link
                  href="/unirme"
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-panel/80 px-3 py-1.5 text-xs font-bold text-primary"
                >
                  <KeyRound size={13} /> Vista previa · Pide entrar para ver contactos
                </Link>
              </div>
            )}
          </main>

          <nav className="pb-safe relative z-10 mx-auto w-full max-w-lg px-4 pb-4">
            {pickup && !selectedId && !meOpen ? (
              <PickupBanner pickup={pickup} meFirst={meFirst} />
            ) : (
              !guest && !showIntro && !meOpen && <InstallPrompt />
            )}
            <button
              onClick={explore}
              className="mx-auto flex min-h-12 items-center justify-center gap-2 px-4 text-[15px] font-bold text-primary"
            >
              <LocateFixed size={18} /> o explora lo que hay cerca
            </button>
            <div className="mt-1 flex justify-center gap-2">
              {!guest && (
                <button onClick={openSaved} className="flex items-center gap-2 rounded-full border border-white/10 bg-panel/90 px-4 py-2.5 text-sm font-bold">
                  <Bookmark size={16} /> Guardados{saved.ids.length > 0 && <span className="text-casas">{saved.ids.length}</span>}
                </button>
              )}
              {!guest && (
                <button onClick={() => setMeOpen(true)} className="flex items-center gap-2 rounded-full border border-white/10 bg-panel/90 px-4 py-2.5 text-sm font-bold">
                  <QrCode size={16} /> Credencial
                </button>
              )}
              {me?.role === "admin" && (
                <Link href="/panel" className="flex items-center gap-2 rounded-full border border-white/10 bg-panel/90 px-4 py-2.5 text-sm font-bold">
                  <Settings2 size={16} /> Panel
                </Link>
              )}
            </div>
          </nav>
        </div>
      ) : (
        <div className="relative h-full">
          <RadarMap
            center={me_at ?? villasCenter}
            me={me_at}
            points={points}
            selectedId={selectedId}
            onSelect={setSelectedId}
            bottomInset={sheetH}
            fitKey={savedOnly ? `guardados-${saved.ids.length}` : (result?.searchId ?? "todo")}
          />

          <header className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pt-3">
            <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2">
              <button onClick={backToAsk} className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 bg-panel/95 shadow-lg" aria-label="Regresar a la pregunta">
                <ArrowLeft size={20} />
              </button>
              <button
                onClick={() => {
                  backToAsk();
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-panel/95 px-4 text-left shadow-lg"
                aria-label="Cambiar búsqueda"
              >
                <Search size={16} className="shrink-0 text-muted" aria-hidden />
                <span className={`truncate ${result || savedOnly ? "font-bold" : "text-muted"}`}>
                  {savedOnly ? "Tus guardados" : result ? query : "Todo lo cercano"}
                </span>
              </button>
              {bell}
            </div>
            {(geo.state.status === "denied" || geo.state.status === "unavailable" || farAway) && (
              <div className="pointer-events-auto mx-auto mt-2 flex max-w-lg items-center gap-2 rounded-2xl border border-white/10 bg-panel/95 px-3 py-2 text-xs text-muted shadow-lg">
                <LocateFixed size={14} className="shrink-0" />
                <span className="flex-1">
                  {farAway
                    ? "Estás lejos de Villas: el radar te muestra Villas, sin distancias."
                    : "Sin tu ubicación no puedo decirte a cuántos metros está cada lugar."}
                </span>
                {!farAway && (
                  <button onClick={geo.request} className="shrink-0 font-bold text-primary">
                    Activar
                  </button>
                )}
              </div>
            )}
          </header>

          <section
            aria-label="Resultados"
            className="pb-safe absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-lg flex-col rounded-t-3xl border-t border-white/10 bg-panel/[0.97] shadow-2xl"
            style={{ height: sheetH, transition: "height 220ms ease" }}
          >
            <button
              type="button"
              onClick={() => setSheetOpen((o) => !o)}
              aria-expanded={sheetOpen}
              aria-controls="lista-resultados"
              className="flex w-full flex-col px-5 pb-2 pt-3 text-left"
            >
              <span className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" aria-hidden />
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-sm text-muted">
                  {isLoading
                    ? "Cargando…"
                    : `${withDistance.length} ${withDistance.length === 1 ? "lugar" : "lugares"}${atHome.length ? ` y ${atHome.length} a domicilio` : ""}${me_at ? ", por distancia" : ""}`}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-primary">
                  {sheetOpen ? "Ver mapa" : "Ver lista"}
                  {sheetOpen ? <ChevronDown size={16} aria-hidden /> : <ChevronUp size={16} aria-hidden />}
                </span>
              </span>
            </button>
            <ul id="lista-resultados" hidden={!sheetOpen} className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              {withDistance.map(({ place: p, m }) => (
                <ResultRow
                  key={p.id}
                  place={p}
                  color={colorOf(p)}
                  right={m !== null ? formatDistance(m) : null}
                  reason={reasons.get(p.id) ?? null}
                  selected={selectedId === p.id}
                  onClick={() => setSelectedId(p.id)}
                />
              ))}
              {atHome.length > 0 && (
                <li className="pt-4">
                  <h3 className="flex items-center gap-1.5 pb-1 text-xs font-bold tracking-widest text-confianza">
                    <Home size={13} aria-hidden /> A DOMICILIO
                  </h3>
                  <ul>
                    {atHome.map((p) => (
                      <ResultRow
                        key={p.id}
                        place={p}
                        color={colorOf(p)}
                        right={null}
                        reason={reasons.get(p.id) ?? null}
                        selected={selectedId === p.id}
                        onClick={() => setSelectedId(p.id)}
                        sub={p.kind === "oficio" ? "Va a tu casa" : p.delivers ? "Entrega a domicilio" : "Sin ubicación en el mapa"}
                      />
                    ))}
                  </ul>
                </li>
              )}
              {!isLoading && shown.length === 0 && savedOnly && (
                <li className="py-6 text-center text-sm text-muted">
                  Aún no guardas nada. Abre un lugar y toca «Guardar para después».
                </li>
              )}
              {!isLoading && shown.length === 0 && !savedOnly && (
                <li className="py-6 text-center text-sm text-muted">
                  Aún no hay lugares. {me?.role === "admin" ? "Dalos de alta desde el panel." : `${firstName} está sumando los primeros.`}
                </li>
              )}
            </ul>
          </section>
        </div>
      )}

      {selectedId && (
        <PlaceSheet
          key={selectedId}
          placeId={selectedId}
          searchId={result?.searchId ?? null}
          match={
            result?.mode === "ai"
              ? (() => {
                  const m = result.matches.find((x) => x.placeId === selectedId);
                  return m ? { score: m.score, reason: m.reason ?? null } : null;
                })()
              : null
          }
          constellations={cById}
          creatorName={creator.name}
          creatorWhatsapp={creator.whatsapp}
          meName={me?.name ?? ""}
          isAdmin={me?.role === "admin"}
          onClose={() => setSelectedId(null)}
        />
      )}
      {novedadesOpen && (
        <NovedadesSheet
          news={news}
          places={places}
          constellations={cById}
          onOpen={(id) => {
            setNovedadesOpen(false);
            setSelectedId(id);
          }}
          onClose={() => setNovedadesOpen(false)}
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

/**
 * Sin resultados: no se manda al vecino a escribirle al creador. Se le ofrece
 * dejarle una recomendación o propuesta (queda en Panel → Búsquedas) o buscar otra cosa.
 */
function NoResults({
  query,
  searchId,
  creatorFirst,
  onRetry,
}: {
  query: string;
  searchId: string;
  creatorFirst: string;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const send = useSendSearchSuggestion();
  if (send.isSuccess) {
    return (
      <div className="sheet-enter mt-2 rounded-2xl border border-confianza/40 bg-panel/95 p-4 text-sm shadow-xl">
        <p className="flex items-center gap-2 font-bold">
          <Check size={18} className="text-confianza" /> Gracias, {creatorFirst} lo revisa.
        </p>
        <button onClick={onRetry} className="mt-3 inline-flex min-h-11 items-center gap-2 font-bold text-primary">
          <RotateCcw size={16} /> Buscar otra cosa
        </button>
      </div>
    );
  }
  return (
    <div className="sheet-enter mt-2 rounded-2xl border border-primary/40 bg-panel/95 p-4 text-sm shadow-xl">
      <p>
        No encontré nada para <b>«{query}»</b> en Villas.
      </p>
      {open ? (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length >= 3) send.mutate({ id: searchId, data: { text: text.trim() } });
          }}
        >
          <label htmlFor="sugerencia" className="mb-1.5 block text-xs font-bold text-muted">
            Tu recomendación o propuesta para {creatorFirst}
          </label>
          <textarea
            id="sugerencia"
            autoFocus
            rows={3}
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ej. La señora Lupe de Privada Encino hace pasteles por encargo"
            className="w-full rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-[15px] outline-none focus:border-primary"
          />
          {send.isError && <p className="mt-1 text-alert">No se pudo enviar. Intenta otra vez.</p>}
          <div className="mt-2 flex gap-2">
            <button disabled={send.isPending || text.trim().length < 3} className="min-h-11 rounded-full bg-primary px-5 font-bold text-space disabled:opacity-50">
              {send.isPending ? "Enviando…" : "Enviar"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-3 text-muted">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <button onClick={() => setOpen(true)} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-space">
            <Lightbulb size={16} /> Recomendar o proponer a {creatorFirst}
          </button>
          <button onClick={onRetry} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/15 px-4 font-bold">
            <RotateCcw size={16} /> Intentar otra búsqueda
          </button>
        </div>
      )}
    </div>
  );
}

function ResultRow({
  place,
  color,
  right,
  reason,
  selected,
  onClick,
  sub,
}: {
  place: PlaceSummary;
  color: string;
  right: string | null;
  reason: string | null;
  selected: boolean;
  onClick: () => void;
  sub?: string;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full items-center gap-3 border-b border-white/5 py-3 text-left ${selected ? "bg-white/5" : ""}`}
      >
        {place.coverUrl ? (
          <img src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}${place.coverUrl}`} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" style={{ boxShadow: `0 0 0 2px ${color}` }} />
        ) : (
          <span className="h-11 w-11 shrink-0 rounded-xl" style={{ background: color }} aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{place.name}</span>
          <span className="block truncate text-sm text-muted">{reason ?? sub ?? place.category}</span>
        </span>
        {right && <span className="shrink-0 text-[15px] font-bold">{right}</span>}
      </button>
    </li>
  );
}

function PickupBanner({ pickup, meFirst }: { pickup: PendingPickup; meFirst: string }) {
  return (
    <div className="sheet-enter mb-2 flex w-full items-center gap-3 rounded-2xl border border-[#25D366]/50 bg-panel/95 p-3 shadow-2xl">
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
  );
}
