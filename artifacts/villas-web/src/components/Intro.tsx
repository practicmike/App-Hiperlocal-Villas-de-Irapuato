/**
 * Bienvenida para quien llega por primera vez: tres pantallas, se desliza con el dedo
 * y se puede saltar. Solo se muestra una vez por teléfono.
 */
import { useRef, useState } from "react";
import { Search, Star, MessageCircle } from "lucide-react";
import type { Creator } from "@workspace/api-client-react";
import { store } from "@/lib/storage";

const KEY = "villas_intro_v1";
export const introSeen = () => store.get(KEY) === "1";

export function Intro({ creator, guest, onDone }: { creator: Creator; guest: boolean; onDone: () => void }) {
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  const first = creator.name.split(" ")[0] ?? creator.name;
  const finish = () => {
    store.set(KEY, "1");
    onDone();
  };

  const slides = [
    {
      art: <img src={`${import.meta.env.BASE_URL}icon-512.png`} alt="" className="h-32 w-32 rounded-[28px] shadow-[0_0_60px_#6eb5ff55]" />,
      title: "Bienvenido al universo de Villas",
      text: "Cada estrella es un comercio, un oficio o una casa de Villas que un vecino conoce en persona. Sin anuncios de fuera, sin scroll infinito.",
    },
    {
      art: (
        <div className="grid h-32 w-32 place-items-center rounded-full bg-primary/15">
          <Search size={56} className="text-primary" />
        </div>
      ),
      title: "Dime qué necesitas",
      text: "Escribe con tus palabras (\"plomero que venga hoy\") o pellizca para acercarte. Entre más cerca y más brillante, mejor te queda. Contactas directo por WhatsApp.",
    },
    {
      art: (
        <div className="grid h-32 w-32 place-items-center rounded-full bg-[#E6C882]/15">
          <Star size={56} className="text-[#E6C882]" fill="currentColor" />
        </div>
      ),
      title: "Tu cielo se enciende",
      text: guest
        ? `Los vecinos tienen credencial: al pagar, la estrella se enciende en su cielo y en la primera visita hay regalo. Para entrar necesitas la invitación de un vecino o de ${first}.`
        : "Enseña tu credencial al pagar: la estrella se enciende en tu cielo y en tu primera visita a cada lugar hay regalo.",
    },
  ];
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
          {last ? "Entrar al universo" : "Siguiente"}
        </button>
      </div>
    </div>
  );
}
