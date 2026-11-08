import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useLogout, getGetMeQueryKey, type Me, type SkyPass } from "@workspace/api-client-react";
import { ChevronRight, Gift, LogOut, Megaphone, X } from "lucide-react";
import { expiresLabel } from "@/lib/passes";

/** Link que va dentro del QR: el comercio lo abre con la cámara normal de su celular. */
export const memberLink = (code: string) => `${window.location.origin}${import.meta.env.BASE_URL}v/${code}`;
const pretty = (code: string) => code.replace(/(.{4})(?=.)/g, "$1 ");

/** La credencial del club: se enseña al pagar para encender la estrella. */
function Credential({ code, name }: { code: string; name: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void QRCode.toString(memberLink(code), {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b0d1f", light: "#ffffff" },
    }).then((s) => alive && setSvg(s));
    return () => {
      alive = false;
    };
  }, [code]);
  return (
    <div className="mb-5 rounded-3xl p-[2px]" style={{ background: "linear-gradient(135deg,#7d80d9,#c38cf3,#e38fc1)" }}>
      <div className="rounded-[22px] bg-space-2 p-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Vecino de Villas</p>
        <p className="mb-3 text-lg font-black">{name}</p>
        <div
          className="mx-auto aspect-square w-52 overflow-hidden rounded-2xl bg-white p-2"
          aria-label="Código QR de tu credencial"
          role="img"
          // SVG generado aquí mismo a partir de tu código; no viene de fuera.
          dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        />
        <p className="mt-3 font-mono text-base font-bold tracking-widest">{pretty(code)}</p>
        <p className="mt-2 text-xs text-muted">
          Enséñala en los negocios de OrbiTú Villas y gana regalos en otros de la colonia.
        </p>
      </div>
    </div>
  );
}

/** "Tu cuenta": discreta, se abre tocando tu nombre en el centro del universo. */
export function MeSheet({
  me,
  creatorFirstName,
  memberCode,
  passes,
  onOpenPlace,
  onReport,
  onClose,
}: {
  me: Me;
  creatorFirstName: string;
  memberCode: string | null;
  passes: SkyPass[];
  onOpenPlace: (placeId: string) => void;
  /** Abre «Reportar algo en Villas» (corte de agua, apagón, calle cerrada...). */
  onReport: () => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        qc.removeQueries({ queryKey: getGetMeQueryKey() });
        window.location.href = import.meta.env.BASE_URL;
      },
    },
  });
  const initial = me.name.trim()[0]?.toUpperCase() ?? "?";

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="sheet-enter pb-safe max-h-[92%] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-white/10 bg-panel px-6 pt-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Tu cuenta"
      >
        <button onClick={onClose} className="float-right rounded-full p-2 text-muted hover:bg-white/10" aria-label="Cerrar">
          <X size={20} />
        </button>
        <div className="mb-5 flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-me text-lg font-black text-space">{initial}</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-me">Tu cuenta</p>
            <h2 className="text-xl font-black">{me.name}</h2>
          </div>
        </div>
        {memberCode ? <Credential code={memberCode} name={me.name} /> : <p className="mb-5 text-sm text-muted">Cargando tu credencial…</p>}
        <Gifts passes={passes} onOpenPlace={onOpenPlace} />
        <button
          onClick={onReport}
          className="mb-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 font-bold text-primary"
        >
          <Megaphone size={16} /> Reportar algo en Villas
        </button>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="mb-2 flex items-center gap-2 text-sm text-muted">
            <LogOut size={16} /> Cerrar sesión en este teléfono
          </button>
        ) : (
          <div className="mb-2 rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm">
            <p className="mb-3">Para volver a entrar, {creatorFirstName} tendrá que darte acceso otra vez. ¿Cerrar sesión?</p>
            <div className="flex gap-2">
              <button
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="rounded-full bg-alert px-4 py-2 font-bold text-space"
              >
                Sí, cerrar
              </button>
              <button onClick={() => setConfirming(false)} className="px-3 py-2 text-muted">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * «Te lo paso»: regalos que otros comercios te pasaron. Dicen qué hacer hoy
 * y cuándo vencen; tocarlos abre el lugar.
 */
function Gifts({ passes, onOpenPlace }: { passes: SkyPass[]; onOpenPlace: (placeId: string) => void }) {
  // Sin regalos no se muestra nada: la credencial ya explica cómo llegan.
  if (passes.length === 0) return null;
  return (
    <div className="mb-6">
      <p className="mb-2 text-sm font-bold">
        {passes.length === 1 ? "Tienes un regalo esperándote" : `Tienes ${passes.length} regalos esperándote`}
      </p>
      <ul className="space-y-2">
        {passes.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onOpenPlace(p.toPlaceId)}
              className="flex w-full items-center gap-3 rounded-2xl border border-[#E6C882]/50 bg-[#E6C882]/10 p-3 text-left"
            >
              <Gift size={20} className="shrink-0 text-[#E6C882]" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-[#E6C882]">
                  {p.offer} en {p.toPlaceName}
                </span>
                <span className="block text-xs text-muted">
                  De parte de {p.fromPlaceName} · {expiresLabel(p.expiresAt)}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
