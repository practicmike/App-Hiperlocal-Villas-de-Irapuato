/**
 * Bienvenida para quien llega por primera vez: cuatro pantallas, se desliza con el
 * dedo y se puede saltar. Solo se muestra una vez por teléfono.
 *
 * Quien ya vio una versión anterior ve solo lo nuevo («Nuevo en OrbiTú»), no todo
 * otra vez. Al agregar algo: sube VERSION y marca la pantalla con `since`.
 */
import { useRef, useState, type ReactNode } from "react";
import { Search, Star, MessageCircle, Megaphone } from "lucide-react";
import type { Creator } from "@workspace/api-client-react";
import { store } from "@/lib/storage";

const KEY = "villas_intro";
const OLD_KEY = "villas_intro_v1";
const VERSION = 2;
/** Versión de la bienvenida que ya vio este teléfono (0 = nunca). */
const seenVersion = () => Number(store.get(KEY) ?? (store.get(OLD_KEY) === "1" ? 1 : 0)) || 0;
export const introSeen = () => seenVersion() >= VERSION;

export function Intro({ creator, guest, onDone }: { creator: Creator; guest: boolean; onDone: () => void }) {
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  const first = creator.name.split(" ")[0] ?? creator.name;
  const finish = () => {
    store.set(KEY, String(VERSION));
    onDone();
  };

  const all: Array<{ art: ReactNode; title: string; text: string; since: number }> = [
    {
      art: <img src={`${import.meta.env.BASE_URL}icon-512.png`} alt="" className="h-32 w-32 rounded-[28px] shadow-[0_0_60px_#6eb5ff55]" />,
      title: "Bienvenido a OrbiTú Villas",
      text: "Comercios, oficios y casas de Villas que un vecino conoce en persona. Lo hicimos para la comunidad, para que nos encontremos más fácil.",
      since: 1,
    },
    {
      art: (
        <div className="grid h-32 w-32 place-items-center rounded-full bg-primary/15">
          <Search size={56} className="text-primary" />
        </div>
      ),
      title: "Dime qué necesitas",
      text: "Escríbelo o dilo con tu voz (\"plomero que venga hoy\"). El radar te muestra qué te queda más cerca, en metros. Contactas directo por WhatsApp.",
      since: 1,
    },
    {
      art: (
        <div className="grid h-32 w-32 place-items-center rounded-full bg-[#6eb5ff]/15">
          <Megaphone size={56} className="text-[#6eb5ff]" />
        </div>
      ),
      title: "Avisos de tu colonia",
      text: guest
        ? "Los vecinos ven arriba del inicio los cortes de agua, apagones y calles cerradas que les tocan, con su fuente. Y pueden reportar lo que ven."
        : "¿Sin agua o sin luz? Arriba del inicio verás los avisos que le tocan a tu privada, con su fuente. Si ves algo, repórtalo.",
      since: 2,
    },
    {
      art: (
        <div className="grid h-32 w-32 place-items-center rounded-full bg-[#E6C882]/15">
          <Star size={56} className="text-[#E6C882]" fill="currentColor" />
        </div>
      ),
      title: "Tu credencial tiene premio",
      text: guest
        ? `Los vecinos tienen credencial: en su primera visita a cada lugar hay regalo, y los negocios se pasan clientes con regalo entre ellos. Para entrar necesitas la invitación de un vecino o de ${first}.`
        : "Enséñala al pagar: en tu primera visita a cada lugar hay regalo. Y con «Te lo paso», un negocio te regala algo en otro negocio de Villas.",
      since: 2,
    },
  ];
  // Quien ya vio una versión anterior: solo lo nuevo. Quien llega por primera vez: todo.
  const before = seenVersion();
  const slides = before > 0 ? all.filter((x) => x.since > before) : all;
  const last = i === slides.length - 1;
  const s = slides[i]!;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-space"
      role="dialog"
      aria-label="Bienvenida"
      onTouchStart={(e) => (startX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        if (startX.current === null) return;
        const dx = (e.changedTouches[0]?.clientX ?? startX.current) - startX.current;
        if (dx < -50 && !last) setI(i + 1);
        if (dx > 50 && i > 0) setI(i - 1);
        startX.current = null;
      }}
    >
      <div className="sky" aria-hidden />
      <div className="pt-safe relative flex justify-end px-4 pt-3">
        {!last && (
          <button onClick={finish} className="rounded-full px-4 py-2 text-sm text-muted">
            Saltar
          </button>
        )}
      </div>
      <div key={i} className="sheet-enter relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="mb-10">{s.art}</div>
        {before > 0 && <p className="mb-2 text-xs font-black uppercase tracking-widest text-primary">Nuevo en OrbiTú</p>}
        <h1 className="mb-4 text-3xl font-black leading-tight md:text-4xl">{s.title}</h1>
        <p className="text-base leading-relaxed text-ink/85 md:text-lg">{s.text}</p>
        {last && (
          <p className="mt-6 flex items-center gap-2 text-sm text-me">
            <MessageCircle size={16} /> Lo hizo {creator.name}, tu vecino. Si algo falta, escríbele.
          </p>
        )}
      </div>
      <div className="pb-safe relative mx-auto w-full max-w-md px-8 pb-8">
        <div className="mb-6 flex justify-center gap-2" aria-hidden>
          {slides.map((_, k) => (
            <span key={k} className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-primary" : "w-2 bg-white/25"}`} />
          ))}
        </div>
        <button
          onClick={() => (last ? finish() : setI(i + 1))}
          className="w-full rounded-2xl bg-primary py-4 text-lg font-black text-space active:scale-[0.98]"
        >
          {last ? (before > 0 ? "Entendido" : "Entrar") : "Siguiente"}
        </button>
      </div>
    </div>
  );
}
