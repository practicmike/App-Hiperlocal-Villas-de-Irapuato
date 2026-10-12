import type { Creator } from "@workspace/api-client-react";
import { MessageCircle, X } from "lucide-react";
import { whatsappLink } from "@/lib/constellations";

/** Cara visible: quién hizo la app y cómo hablar con él, siempre a un toque. */
export function CreatorAvatar({ creator, onClick }: { creator: Creator; onClick: () => void }) {
  const initials = creator.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <button
      onClick={onClick}
      aria-label={`Hablar con ${creator.name}, creador de la app`}
      className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-primary bg-space-2 text-sm font-black text-ink shadow-lg"
    >
      {creator.photoUrl ? (
        <img src={creator.photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </button>
  );
}

export function CreatorSheet({ creator, onClose }: { creator: Creator; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="sheet-enter pb-safe w-full max-w-lg rounded-t-3xl border-t border-white/10 bg-panel px-6 pt-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Sobre ${creator.name}`}
      >
        <button onClick={onClose} className="float-right rounded-full p-2 text-muted hover:bg-white/10" aria-label="Cerrar">
          <X size={20} />
        </button>
        <div className="mb-4 flex items-center gap-4">
          <CreatorAvatar creator={creator} onClick={() => {}} />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Quién hizo esto</p>
            <h2 className="text-xl font-black">{creator.name}</h2>
          </div>
        </div>
        <p className="mb-5 text-[15px] leading-relaxed text-ink/90">{creator.message}</p>
        {creator.whatsapp && (
          <a
            href={whatsappLink(creator.whatsapp, "Hola, te escribo desde la guía de Villas.")}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-black text-space"
          >
            <MessageCircle size={20} /> Escríbeme
          </a>
        )}
        <p className="pb-2 text-center text-xs text-muted">
          Sin anuncios, sin rastreo. Las quejas me llegan solo a mí.
        </p>
      </div>
    </div>
  );
}
