import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLogout, getGetMeQueryKey, type Me } from "@workspace/api-client-react";
import { LogOut, X } from "lucide-react";

/** "Tu cuenta": discreta, se abre tocando tu nombre en el centro del universo. */
export function MeSheet({ me, creatorFirstName, onClose }: { me: Me; creatorFirstName: string; onClose: () => void }) {
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
        className="sheet-enter pb-safe w-full max-w-lg rounded-t-3xl border-t border-white/10 bg-panel px-6 pt-6"
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
        <p className="mb-6 text-sm text-ink/85">
          Eres vecino verificado de la guía de Villas. Tus recomendaciones ayudan a otros a encontrar gente de confianza.
        </p>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="mb-2 flex items-center gap-2 text-sm text-muted">
            <LogOut size={16} /> Cerrar sesión en este teléfono
          </button>
        ) : (
          <div className="mb-2 rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm">
            <p className="mb-3">Para volver a entrar necesitarás una llave nueva de {creatorFirstName}. ¿Cerrar sesión?</p>
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
