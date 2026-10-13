/**
 * /e/<estrella>: el link que un comercio comparte en sus redes.
 * Quien no vive en Villas ve esa tarjeta completa (con WhatsApp) y una invitación
 * a conocer el universo; el resto sigue siendo para vecinos.
 */
import { useMemo } from "react";
import { Link } from "wouter";
import {
  useGetSharedPlace,
  getGetSharedPlaceQueryKey,
  useGetUniverse,
  type Creator,
  type Me,
} from "@workspace/api-client-react";
import { Card } from "@/components/PlaceSheet";
import { FALLBACK, byId, placeConstellations } from "@/lib/constellations";
import { Shell } from "@/pages/AccessPages";

export function SharedPlacePage({ slug, me, creator }: { slug: string; me: Me | null; creator: Creator }) {
  const { data: place, isLoading, isError } = useGetSharedPlace(slug, {
    query: { queryKey: getGetSharedPlaceQueryKey(slug), retry: false },
  });
  const { data: universe } = useGetUniverse();
  const cById = useMemo(() => byId(placeConstellations(universe?.constellations ?? [])), [universe]);

  if (isLoading) return <Shell><p className="text-center text-muted">Cargando…</p></Shell>;
  if (isError || !place) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-black">No encontramos esa estrella</h1>
          <p className="mb-6 text-ink/80">Quizá ya no está activa.</p>
          <Link href="/" className="inline-flex rounded-2xl bg-primary px-5 py-3 font-black text-space">Ver el universo de Villas</Link>
        </div>
      </Shell>
    );
  }
  return (
    <div className="relative min-h-full overflow-y-auto">
      <div className="sky" aria-hidden />
      <header className="pt-safe relative mx-auto flex max-w-xl items-center gap-3 px-5 pt-4">
        <Link href="/" className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="h-9 w-9 rounded-xl" />
          <span className="text-lg font-black">villas</span>
        </Link>
      </header>
      <main className="pb-safe relative mx-auto max-w-xl px-5 py-5">
        <div className="rounded-3xl border border-white/10 bg-panel/95 p-5 shadow-2xl">
          <Card
            place={place}
            searchId={null}
            match={null}
            info={cById.get(place.constellation) ?? FALLBACK}
            creatorName={creator.name}
            creatorWhatsapp={creator.whatsapp}
            meName={me?.name ?? ""}
            isAdmin={me?.role === "admin"}
          />
        </div>
        {!me && (
          <div className="mt-5 rounded-3xl border border-primary/40 bg-panel/80 p-5 text-center">
            <p className="mb-1 font-black">Es una estrella del universo de Villas</p>
            <p className="mb-4 text-sm text-ink/80">
              Comercios, oficios y casas de Villas de Irapuato que un vecino conoce en persona. {creator.name.split(" ")[0]} los visita uno por uno.
            </p>
            <Link href="/" className="inline-flex rounded-2xl bg-primary px-5 py-3 font-black text-space">
              Explorar el universo
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
