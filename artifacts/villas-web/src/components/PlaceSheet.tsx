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
import { BadgeCheck, Heart, KeyRound, MessageCircle, Pencil, ShieldAlert, Sparkles, X } from "lucide-react";
import { CONSTELLATIONS, whatsappLink } from "@/lib/constellations";

interface Match {
  score: number;
  reason: string | null;
}

interface Props {
  placeId: string;
  searchId: string | null;
  /** % de match con IA y por qué; null si la búsqueda no fue con IA. */
  match: Match | null;
  creatorName: string;
  meName: string;
  isAdmin: boolean;
  onClose: () => void;
}

export function PlaceSheet({ placeId, searchId, match, creatorName, meName, isAdmin, onClose }: Props) {
  const { data: place, isLoading } = useGetPlace(placeId);

  return (
    <div
      className="sheet-enter pb-safe absolute inset-x-0 bottom-0 z-30 mx-auto max-w-lg rounded-t-3xl border-t border-white/10 bg-panel/95 px-5 pt-4 shadow-2xl backdrop-blur"
      role="dialog"
      aria-label={place?.name ?? "Tarjeta"}
    >
      <button
        onClick={onClose}
        className="absolute right-3 top-3 rounded-full p-2 text-muted hover:bg-white/10"
        aria-label="Cerrar"
      >
        <X size={20} />
      </button>
      {isLoading || !place ? (
        <div className="h-40 animate-pulse" />
      ) : (
        <Card place={place} searchId={searchId} match={match} creatorName={creatorName} meName={meName} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function Card({
  place,
  searchId,
  match,
  creatorName,
  meName,
  isAdmin,
}: {
  place: PlaceDetail;
  searchId: string | null;
  match: Match | null;
  creatorName: string;
  meName: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const info = CONSTELLATIONS[place.constellation];
  const contact = useRecordContact();
  const onSaved = (data: PlaceDetail) => {
    qc.setQueryData(getGetPlaceQueryKey(place.id), data);
    void qc.invalidateQueries({ queryKey: getGetUniverseQueryKey() });
  };
  const endorse = useEndorsePlace({ mutation: { onSuccess: onSaved } });
  const unendorse = useRemoveEndorsement({ mutation: { onSuccess: onSaved } });
  const busy = endorse.isPending || unendorse.isPending;

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

  const message = `Hola${place.contactName ? ` ${place.contactName}` : ""}, te encontré en la guía de vecinos de Villas.`;

  return (
    <div className="space-y-4 pr-8">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: info.color }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: info.color }} />
          {info.label} · {place.category}
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

      {(place.priceLabel || place.zone) && (
        <p className="text-sm">
          {place.operation && <span className="font-bold capitalize">{place.operation} · </span>}
          {place.priceLabel && <span className="font-bold" style={{ color: info.color }}>{place.priceLabel}</span>}
          {place.priceLabel && place.zone && " · "}
          {place.zone && <span className="text-muted">{place.zone}</span>}
        </p>
      )}

      {place.description && <p className="text-[15px] leading-relaxed text-ink/90">{place.description}</p>}

      <div className="space-y-1 text-sm">
        {place.verified && (
          <p className="flex items-center gap-1.5 text-me">
            <BadgeCheck size={16} /> {firstName} lo conoce en persona
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
            <KeyRound size={20} /> Únete para ver el contacto
          </Link>
          <p className="pb-2 text-center text-xs text-muted">
            Los vecinos de Villas ven el WhatsApp, quién atiende y quién lo recomienda.
          </p>
        </div>
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

      {isAdmin && (
        <Link href={`/panel?editar=${place.id}`} className="flex items-center gap-1.5 pb-2 text-xs text-primary">
          <Pencil size={13} /> Editar esta estrella (solo tú lo ves)
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
