import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPlace,
  useEndorsePlace,
  useRemoveEndorsement,
  useRecordContact,
  useSendComplaint,
  getGetPlaceQueryKey,
  getGetUniverseQueryKey,
  type PlaceDetail,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { BadgeCheck, Bath, BedDouble, Bookmark, Car, Clock, Gift, Heart, Home, KeyRound, MessageCircle, Pencil, Ruler, ShieldAlert, Sparkles, Star, Truck, Users, X } from "lucide-react";
import { openState, weekSummary } from "@/lib/hours";
import { setPickup } from "@/lib/pickup";
import { ShoppingBag, Share2 } from "lucide-react";
import { useRecordLead } from "@workspace/api-client-react";
import { FALLBACK, whatsappLink, type Constellation } from "@/lib/constellations";
import { useSaved } from "@/lib/saved";

interface Match {
  score: number;
  reason: string | null;
}

interface Props {
  placeId: string;
  searchId: string | null;
  /** % de match con IA y por qué; null si la búsqueda no fue con IA. */
  match: Match | null;
  /** Constelaciones por id, para color y nombre. */
  constellations: Map<string, Constellation>;
  creatorName: string;
  creatorWhatsapp?: string;
  meName: string;
  isAdmin: boolean;
  onClose: () => void;
}

export function PlaceSheet({ placeId, searchId, match, constellations, creatorName, creatorWhatsapp = "", meName, isAdmin, onClose }: Props) {
  const { data: place, isLoading } = useGetPlace(placeId);

  return (
    <div
      className="sheet-enter pb-safe absolute inset-x-0 bottom-0 z-30 mx-auto max-h-[88%] max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border-t border-white/10 bg-panel/95 px-5 pt-4 shadow-2xl backdrop-blur md:max-w-xl"
      role="dialog"
      aria-label={place?.name ?? "Tarjeta"}
    >
      <div className="sticky top-0 z-10 flex h-0 justify-end">
      <button
        onClick={onClose}
        className="-mr-2 h-9 w-9 rounded-full bg-panel/80 p-2 text-muted backdrop-blur hover:bg-white/10"
        aria-label="Cerrar"
      >
        <X size={20} />
      </button>
      </div>
      {isLoading || !place ? (
        <div className="h-40 animate-pulse" />
      ) : (
        <Card place={place} searchId={searchId} match={match} info={constellations.get(place.constellation) ?? FALLBACK} creatorName={creatorName} creatorWhatsapp={creatorWhatsapp} meName={meName} isAdmin={isAdmin} />
      )}
    </div>
  );
}

export function Card({
  place,
  searchId,
  match,
  info,
  creatorName,
  creatorWhatsapp = "",
  meName,
  isAdmin,
}: {
  place: PlaceDetail;
  searchId: string | null;
  match: Match | null;
  info: Constellation;
  creatorName: string;
  creatorWhatsapp?: string;
  meName: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const contact = useRecordContact();
  const guest = !meName;
  const onSaved = (data: PlaceDetail) => {
    qc.setQueryData(getGetPlaceQueryKey(place.id), data);
    void qc.invalidateQueries({ queryKey: getGetUniverseQueryKey() });
  };
  const endorse = useEndorsePlace({ mutation: { onSuccess: onSaved } });
  const unendorse = useRemoveEndorsement({ mutation: { onSuccess: onSaved } });
  const busy = endorse.isPending || unendorse.isPending;
  const saved = useSaved(!guest);
  const isSaved = saved.has(place.id);

  // La API solo publica nombres con permiso; si el mío aparece, ya lo había dado.
  const [showName, setShowName] = useState(
    place.endorsedByMe && place.endorserNames.includes(meName.trim().split(/\s+/)[0] ?? ""),
  );
  const firstName = creatorName.split(" ")[0];

  const recommendedBy = (() => {
    const n = place.endorsementCount;
    if (n === 0) return null;
    const names = place.endorserNames;
    const others = n - names.length;
    if (names.length === 0) return `${n} ${n === 1 ? "vecino lo recomienda" : "vecinos lo recomiendan"}`;
    const list = names.join(", ");
    return others > 0
      ? `Lo recomiendan ${list} y ${others} ${others === 1 ? "vecino" : "vecinos"} más`
      : `Lo ${names.length === 1 ? "recomienda" : "recomiendan"} ${list}`;
  })();

  const message = `Hola${place.contactName ? ` ${place.contactName}` : ""}, te encontré en OrbiTú Villas.`;

  return (
    <div className="space-y-4">
      {place.photos.length > 0 && <Photos photos={place.photos} name={place.name} />}
      <div className="pr-8">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: info.color }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: info.color }} />
          {info.name} · {place.category}
          {place.sponsored && (
            <span className="rounded-full border border-current px-2 py-0.5 text-[10px]">Patrocinado</span>
          )}
        </div>
        <h2 className="text-2xl font-black leading-tight">{place.name}</h2>
        {match && (
          <p className="mt-1.5 flex items-start gap-1.5 text-sm text-ai">
            <Sparkles size={15} className="mt-0.5 shrink-0" />
            <span>
              <b>{Math.round(match.score * 100)}% match</b>
              {match.reason && <> · {match.reason}</>}
            </span>
          </p>
        )}
        {place.contactName && <p className="text-sm text-muted">Te atiende {place.contactName}</p>}
      </div>

      <Facts place={place} color={info.color} />

      {place.news && <TodayNews news={place.news} />}

      {/* Regalo de bienvenida: la invitación a encender una estrella nueva. */}
      {place.welcomeOffer && place.myVisits === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#E6C882]/50 bg-[#E6C882]/10 p-3">
          <Gift size={20} className="mt-0.5 shrink-0 text-[#E6C882]" />
          <div className="text-sm">
            <p className="font-bold text-[#E6C882]">Tu primera visita: {place.welcomeOffer}</p>
            <p className="text-xs text-muted">
              {place.locked || guest ? "Para vecinos de Villas con credencial." : "Enseña tu credencial al pagar y se aplica solo."}
            </p>
          </div>
        </div>
      )}
      {place.myVisits > 0 && (
        <p className="flex items-center gap-1.5 text-sm font-bold text-me">
          <Star size={16} fill="currentColor" /> Ya lo visitaste · {place.myVisits} {place.myVisits === 1 ? "visita" : "visitas"}
        </p>
      )}

      {place.description && <p className="text-[15px] leading-relaxed text-ink/90">{place.description}</p>}

      <div className="space-y-1 text-sm">
        {place.verified && (
          <p className="flex items-center gap-1.5 text-me">
            <BadgeCheck size={16} /> {firstName} lo conoce en persona
          </p>
        )}
        {place.neighborsServed > 0 && (
          <p className="flex items-center gap-1.5 text-confianza">
            <Users size={16} />
            {place.kind === "oficio"
              ? `${place.neighborsServed} ${place.neighborsServed === 1 ? "vecino ya lo contrató" : "vecinos ya lo contrataron"} en Villas`
              : `${place.neighborsServed} ${place.neighborsServed === 1 ? "vecino atendido" : "vecinos atendidos"} en Villas`}
          </p>
        )}
        {recommendedBy && (
          <p className="flex items-center gap-1.5 text-alert">
            <Heart size={16} fill="currentColor" /> {recommendedBy}
          </p>
        )}
      </div>

      {place.locked ? (
        // Visitante: ve el valor, pero el contacto y los nombres son para vecinos.
        <div className="space-y-2">
          <Link
            href="/unirme"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-base font-black text-space active:scale-[0.98]"
          >
            <KeyRound size={20} /> Pide entrar para ver el contacto
          </Link>
          <p className="pb-2 text-center text-xs text-muted">
            Los vecinos de Villas ven el WhatsApp, quién atiende y quién lo recomienda.
          </p>
        </div>
      ) : (
        <>
      {guest ? (
        // Visitante con contacto abierto (casa o link compartido): queda como interesado.
        <GuestContact place={place} message={message} creatorName={creatorName} creatorWhatsapp={creatorWhatsapp} />
      ) : (
        <>
      <a
        href={whatsappLink(place.whatsapp, message)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => contact.mutate({ id: place.id, data: { searchId } })}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 text-base font-black text-[#0b3d1f] active:scale-[0.98]"
      >
        <MessageCircle size={20} /> Escribir por WhatsApp
      </a>
      <button
        type="button"
        onClick={() => saved.toggle(place.id)}
        aria-pressed={isSaved}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-[15px] font-bold transition active:scale-[0.98] ${
          isSaved ? "border-casas bg-casas/15 text-casas" : "border-white/20 text-ink"
        }`}
      >
        <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
        {isSaved ? "Guardado · está en tus Guardados" : "Guardar para después"}
      </button>
      {place.pickup && (
        <PickupOrder place={place} meName={meName} onSent={() => contact.mutate({ id: place.id, data: { searchId } })} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={busy}
          onClick={() =>
            place.endorsedByMe
              ? unendorse.mutate({ id: place.id })
              : endorse.mutate({ id: place.id, data: { showName } })
          }
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${
            place.endorsedByMe ? "border-alert bg-alert/15 text-alert" : "border-white/20 text-ink"
          }`}
        >
          <Heart size={16} fill={place.endorsedByMe ? "currentColor" : "none"} />
          {place.endorsedByMe ? "Lo recomiendas" : "Lo recomiendo"}
        </button>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            className="accent-[#7d80d9]"
            checked={showName}
            onChange={(e) => {
              setShowName(e.target.checked);
              if (place.endorsedByMe) endorse.mutate({ id: place.id, data: { showName: e.target.checked } });
            }}
          />
          Que vean mi nombre
        </label>
      </div>

      <Complaint placeId={place.id} creatorName={firstName ?? creatorName} />
        </>
      )}
        </>
      )}

      {place.slug && <ShareButton slug={place.slug} name={place.name} />}

      {isAdmin && (
        <Link href={`/panel?editar=${place.id}`} className="flex items-center gap-1.5 pb-2 text-xs text-primary">
          <Pencil size={13} /> Editar este lugar (solo tú lo ves)
        </Link>
      )}
    </div>
  );
}

function Complaint({ placeId, creatorName }: { placeId: string; creatorName: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const send = useSendComplaint();

  if (send.isSuccess) {
    return <p className="pb-2 text-xs text-muted">Gracias. Solo {creatorName} lo verá y te escribirá.</p>;
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-start gap-1.5 pb-2 text-left text-xs text-muted underline-offset-2 hover:underline">
        <ShieldAlert size={14} /> ¿Tuviste una mala experiencia? Cuéntaselo en privado
      </button>
    );
  }
  return (
    <form
      className="space-y-2 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim().length >= 5) send.mutate({ id: placeId, data: { message: text.trim() } });
      }}
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder={`Esto no se publica. Le llega solo a ${creatorName}.`}
        className="w-full rounded-xl border border-white/15 bg-space-2 p-3 text-sm outline-none focus:border-alert"
      />
      <button
        disabled={send.isPending || text.trim().length < 5}
        className="rounded-full bg-alert px-4 py-2 text-sm font-bold text-space disabled:opacity-40"
      >
        Enviar en privado
      </button>
    </form>
  );
}

/** Fotos deslizables; la primera es la portada. */
function Photos({ photos, name }: { photos: PlaceDetail["photos"]; name: string }) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <div className="-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
      {photos.map((p, i) => (
        <img
          key={p.id}
          src={`${base}${p.url}`}
          alt={i === 0 ? name : `${name}, foto ${i + 1}`}
          loading={i === 0 ? "eager" : "lazy"}
          width={p.width}
          height={p.height}
          className={`aspect-[4/3] max-h-[38vh] shrink-0 snap-center rounded-2xl bg-space-2 object-cover ${photos.length === 1 ? "w-full" : "w-[85%]"}`}
        />
      ))}
    </div>
  );
}

/** Datos duros de un vistazo: abierto ahora, a domicilio, precio y, en casas, recámaras y m². */
function Facts({ place, color }: { place: PlaceDetail; color: string }) {
  const [showHours, setShowHours] = useState(false);
  const open = openState(place.hours);
  const chip = "inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-[13px]";
  const house = [
    place.bedrooms != null && { icon: <BedDouble size={15} />, text: `${place.bedrooms} rec.` },
    place.bathrooms != null && { icon: <Bath size={15} />, text: `${place.bathrooms} baños` },
    place.parking != null && { icon: <Car size={15} />, text: `${place.parking} autos` },
    place.landM2 != null && { icon: <Ruler size={15} />, text: `${place.landM2} m² terreno` },
    place.builtM2 != null && { icon: <Home size={15} />, text: `${place.builtM2} m² const.` },
  ].filter(Boolean) as Array<{ icon: React.ReactNode; text: string }>;
  const hasAny = open || place.delivers || place.kind === "oficio" || place.priceLabel || place.zone || place.operation || house.length;
  if (!hasAny) return null;
  return (
    <div className="space-y-2">
      {(place.priceLabel || place.operation) && (
        <p className="text-lg font-black" style={{ color }}>
          {place.operation && <span className="capitalize">{place.operation}</span>}
          {place.operation && place.priceLabel && " · "}
          {place.priceLabel}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {open && (
          <button type="button" onClick={() => setShowHours(!showHours)} className={`${chip} ${open.open ? "text-confianza" : "text-alert"}`}>
            <Clock size={15} /> {open.text}
          </button>
        )}
        {place.kind === "oficio" && <span className={chip}><Home size={15} /> Va a tu casa</span>}
        {place.delivers && place.kind !== "oficio" && <span className={chip}><Truck size={15} /> A domicilio</span>}
        {house.map((h) => (
          <span key={h.text} className={chip}>{h.icon} {h.text}</span>
        ))}
        {place.zone && <span className={`${chip} text-muted`}>{place.zone}</span>}
      </div>
      {showHours && (
        <ul className="rounded-2xl bg-space-2/60 px-4 py-3 text-sm">
          {weekSummary(place.hours).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`;
};

/** "Hoy en Villas": la novedad del día de esta estrella. */
function TodayNews({ news }: { news: NonNullable<PlaceDetail["news"]> }) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <div className="flex gap-3 rounded-2xl border border-ai/40 bg-ai/10 p-3">
      {news.photoUrl && <img src={`${base}${news.photoUrl}`} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />}
      <div className="min-w-0 text-sm">
        <p className="text-[11px] font-black uppercase tracking-wide text-ai">Hoy · {ago(news.createdAt)}</p>
        <p className="font-bold leading-snug">{news.text}</p>
      </div>
    </div>
  );
}

const WHEN = ["En 15 min", "En 30 min", "En 1 hora"] as const;

/** Pedir para recoger: arma el mensaje de WhatsApp y deja listo el botón "Ya llegué". */
function PickupOrder({ place, meName, onSent }: { place: PlaceDetail; meName: string; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState("");
  const [when, setWhen] = useState<string>(WHEN[1]);
  const first = meName.trim().split(/\s+/)[0] ?? "";
  const status = openState(place.hours);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#25D366]/60 py-3 text-base font-black text-[#25D366] active:scale-[0.98]"
      >
        <ShoppingBag size={19} /> Pedir para recoger
      </button>
    );
  }
  const msg =
    `Hola${place.contactName ? ` ${place.contactName}` : ""}, soy ${first}, vecino de Villas. ` +
    `Quiero pedir para recoger: ${items.trim()}. Paso ${when.toLowerCase()}. ¿Me confirmas? 🙌`;
  return (
    <div className="space-y-3 rounded-2xl border border-[#25D366]/40 bg-[#25D366]/5 p-3">
      <p className="text-sm font-black">¿Qué vas a pedir?</p>
      {status && !status.open && <p className="text-xs text-alert">{status.text}. Puedes dejar tu pedido para cuando abra.</p>}
      <textarea
        value={items}
        onChange={(e) => setItems(e.target.value)}
        rows={2}
        maxLength={300}
        placeholder="2 pizzas grandes, una hawaiana y una pepperoni"
        className="w-full rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm outline-none focus:border-[#25D366]"
      />
      <div className="flex flex-wrap gap-2">
        {WHEN.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWhen(w)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${when === w ? "border-[#25D366] text-[#25D366]" : "border-white/20 text-muted"}`}
          >
            {w}
          </button>
        ))}
      </div>
      <a
        href={items.trim().length >= 2 ? whatsappLink(place.whatsapp, msg) : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={items.trim().length < 2}
        onClick={(e) => {
          if (items.trim().length < 2) return e.preventDefault();
          onSent();
          setPickup({ placeId: place.id, placeName: place.name, whatsapp: place.whatsapp, contactName: place.contactName, at: Date.now() });
          setOpen(false);
        }}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3 font-black text-[#0b3d1f] ${items.trim().length < 2 ? "opacity-40" : ""}`}
      >
        <MessageCircle size={18} /> Enviar pedido por WhatsApp
      </a>
      <p className="text-[11px] text-muted">Al llegar, toca "Ya llegué" en la pantalla principal y le avisamos que estás afuera.</p>
    </div>
  );
}

/**
 * Contacto para alguien de fuera de Villas. En casas pide su nombre (el vendedor
 * sabe quién escribe y tú ves cuántos interesados tuvo); en un link compartido, directo.
 */
function GuestContact({
  place,
  message,
  creatorName,
  creatorWhatsapp,
}: {
  place: PlaceDetail;
  message: string;
  creatorName: string;
  creatorWhatsapp: string;
}) {
  const lead = useRecordLead();
  const [sent, setSent] = useState(false);
  const creatorFirst = creatorName.split(" ")[0] ?? creatorName;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const btn = "flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 text-base font-black text-[#0b3d1f] active:scale-[0.98]";
  if (!place.leadForm) {
    return (
      <a
        href={whatsappLink(place.whatsapp, message)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => lead.mutate({ id: place.id, data: { source: "link", name: null, phone: null } })}
        className={btn}
      >
        <MessageCircle size={20} /> Escribir por WhatsApp
      </a>
    );
  }
  if (sent && place.viaCreator) {
    return (
      <p className="rounded-2xl border border-[#25D366]/40 bg-[#25D366]/5 p-3 text-sm">
        Listo. {creatorFirst} te responde por WhatsApp y te presenta con el vendedor.
      </p>
    );
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btn}>
        <MessageCircle size={20} /> {place.viaCreator ? "Me interesa · pedir informes" : "Me interesa · escribir por WhatsApp"}
      </button>
    );
  }
  const ok = name.trim().length >= 2;
  const link = place.slug ? ` ${window.location.origin}${import.meta.env.BASE_URL}e/${place.slug}` : "";
  const detail = [place.operation, place.priceLabel].filter(Boolean).join(" ");
  // Sin contacto directo: el mensaje va al creador, que lo presenta con el vendedor.
  const to = place.viaCreator ? creatorWhatsapp : place.whatsapp;
  const text = place.viaCreator
    ? `Hola ${creatorFirst}, soy ${name.trim()}. Me interesa «${place.name}»${detail ? ` (${detail})` : ""} que vi en la guía de Villas. ¿Me pasas informes o me presentas con el vendedor?${link}`
    : `Hola${place.contactName ? ` ${place.contactName}` : ""}, soy ${name.trim()}. Vi «${place.name}» en la guía de Villas y me interesa. ¿Sigue disponible?`;
  return (
    <div className="space-y-2 rounded-2xl border border-[#25D366]/40 bg-[#25D366]/5 p-3">
      <p className="text-sm font-black">¿Cómo te llamas?</p>
      {place.viaCreator && (
        <p className="text-xs text-ink/80">
          Le escribes a {creatorFirst}: él conoce al vendedor en persona y te presenta. Así el vendedor no recibe mensajes de desconocidos.
        </p>
      )}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        placeholder="Tu nombre"
        className="w-full rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm outline-none focus:border-[#25D366]"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        maxLength={20}
        placeholder="Tu WhatsApp (opcional)"
        className="w-full rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm outline-none focus:border-[#25D366]"
      />
      <a
        href={ok && to ? whatsappLink(to, text) : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!ok}
        onClick={(e) => {
          if (!ok) return e.preventDefault();
          lead.mutate({ id: place.id, data: { source: "casa", name: name.trim(), phone: phone.trim() || null } });
          setSent(true);
        }}
        className={`${btn} ${ok ? "" : "opacity-40"}`}
      >
        <MessageCircle size={20} /> {place.viaCreator ? `Escribirle a ${creatorFirst}` : "Escribir por WhatsApp"}
      </a>
    </div>
  );
}

/** Compartir la estrella con su link público (en el celular abre el menú de compartir). */
export function ShareButton({ slug, name }: { slug: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${import.meta.env.BASE_URL}e/${slug}`;
  return (
    <button
      type="button"
      onClick={async () => {
        const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
        if (nav.share) {
          await nav.share({ title: name, text: `${name} en la guía de Villas`, url }).catch(() => {});
        } else {
          await navigator.clipboard?.writeText(url).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
      className="flex items-center gap-1.5 pb-2 text-xs font-bold text-muted"
    >
      <Share2 size={14} /> {copied ? "Link copiado" : "Compartir este lugar"}
    </button>
  );
}
