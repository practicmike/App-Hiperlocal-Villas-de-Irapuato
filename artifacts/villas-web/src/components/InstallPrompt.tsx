/**
 * Aviso para instalar Villas en la pantalla de inicio.
 * - Android/Chrome: usa el aviso nativo del sistema (botón "Instalar").
 * - iPhone/iPad: Apple no permite el aviso automático; se explica cómo hacerlo en dos toques.
 * Se muestra una vez; si dicen "Ahora no", vuelve en 14 días.
 */
import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { isIOS, isStandalone, store } from "@/lib/storage";

const KEY = "villas_install_dismissed";
const AGAIN_MS = 14 * 86_400_000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const deferred = () => (window as unknown as { __villasInstall?: BeforeInstallPromptEvent }).__villasInstall;

export function InstallPrompt({ reason = "Tu credencial a un toque, como cualquier app." }: { reason?: string }) {
  const [canPrompt, setCanPrompt] = useState(() => !!deferred());
  const [hidden, setHidden] = useState(() => {
    if (isStandalone()) return true;
    const last = Number(store.get(KEY) ?? 0);
    return Date.now() - last < AGAIN_MS;
  });
  useEffect(() => {
    const on = () => setCanPrompt(true);
    const installed = () => setHidden(true);
    window.addEventListener("villas-installable", on);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("villas-installable", on);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const ios = isIOS();
  if (hidden || (!canPrompt && !ios)) return null;

  const dismiss = () => {
    store.set(KEY, String(Date.now()));
    setHidden(true);
  };
  const install = async () => {
    const e = deferred();
    if (!e) return;
    await e.prompt();
    const choice = await e.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") setHidden(true);
    else dismiss();
  };

  return (
    <div className="sheet-enter pointer-events-auto mx-auto mb-3 flex w-full max-w-lg items-start gap-3 rounded-2xl border border-primary/40 bg-panel/95 p-3 shadow-2xl backdrop-blur">
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-black">Instala Villas en tu {/(ipad|tablet)/i.test(navigator.userAgent) ? "tablet" : "celular"}</p>
        {ios ? (
          <p className="text-xs text-ink/80">
            En Safari toca <Share size={13} className="inline -mt-0.5" aria-label="Compartir" /> y luego <b>"Agregar a inicio"</b>. {reason}
          </p>
        ) : (
          <p className="text-xs text-ink/80">{reason}</p>
        )}
        {!ios && (
          <button onClick={() => void install()} className="mt-2 rounded-full bg-primary px-4 py-1.5 text-xs font-black text-space">
            Instalar
          </button>
        )}
      </div>
      <button onClick={dismiss} className="rounded-full p-1 text-muted hover:bg-white/10" aria-label="Ahora no">
        <X size={18} />
      </button>
    </div>
  );
}
