import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminGetPush,
  useAdminUpdatePushPrefs,
  useAdminAddPushSubscription,
  useAdminRemovePushSubscription,
  useAdminTestPush,
  getAdminGetPushQueryKey,
  type AdminPush,
} from "@workspace/api-client-react";
import { BellRing, BellOff, Moon, Send } from "lucide-react";

/**
 * Notificaciones push SOLO para el creador. Se activan por teléfono desde aquí.
 * Los vecinos nunca ven esto ni reciben push.
 */
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function toKey(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone" : /Mac/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows" : "Otro";
  const br = /SamsungBrowser/i.test(ua) ? "Samsung Internet" : /Edg\//i.test(ua) ? "Edge" : /Chrome/i.test(ua) ? "Chrome" : /Firefox/i.test(ua) ? "Firefox" : /Safari/i.test(ua) ? "Safari" : "Navegador";
  return `${os} · ${br}`;
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration(`${base}/`)) ?? navigator.serviceWorker.register(`${base}/sw.js`);
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const fmtHour = (h: number) => (h === 0 ? "12 am" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`);

export function PushSettings() {
  const qc = useQueryClient();
  const { data } = useAdminGetPush();
  const refresh = () => void qc.invalidateQueries({ queryKey: getAdminGetPushQueryKey() });
  const [mine, setMine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const add = useAdminAddPushSubscription({ mutation: { onSuccess: refresh } });
  const remove = useAdminRemovePushSubscription({ mutation: { onSuccess: refresh } });
  const test = useAdminTestPush();

  // ¿Este teléfono ya está suscrito?
  useEffect(() => {
    if (!supported()) return;
    void navigator.serviceWorker
      .getRegistration(`${base}/`)
      .then((r) => r?.pushManager.getSubscription())
      .then((s) => setMine(s?.endpoint ?? null));
  }, [data?.devices.length]);

  if (!data) return null;
  const onThisPhone = !!mine && data.devices.some((d) => d.endpoint === mine);

  const activate = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!data.publicKey) throw new Error("Falta configurar las llaves en el servidor.");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Bloqueaste las notificaciones. Actívalas en Ajustes → Apps → Chrome → Notificaciones.");
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(data.publicKey) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await add.mutateAsync({ data: { endpoint: json.endpoint, keys: json.keys, label: deviceLabel() } });
      setMine(json.endpoint);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar.");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(`${base}/`);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await remove.mutateAsync({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setMine(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-primary/30 bg-panel p-4">
      <div className="flex items-start gap-3">
        {onThisPhone ? <BellRing size={22} className="mt-0.5 shrink-0 text-confianza" /> : <BellOff size={22} className="mt-0.5 shrink-0 text-muted" />}
        <div className="min-w-0 flex-1">
          <h2 className="font-black">Notificaciones para ti</h2>
          <p className="text-xs text-muted">
            {onThisPhone
              ? "Activas en este teléfono. Solo tú las recibes; los vecinos no."
              : "Te avisan al momento de lo que pide acción tuya. Solo tú las recibes."}
          </p>
        </div>
      </div>

      {!data.available ? (
        <p className="mt-3 text-sm text-[#e6c882]">Falta configurar VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en Vercel.</p>
      ) : !supported() ? (
        <p className="mt-3 text-sm text-[#e6c882]">Este navegador no admite notificaciones. Abre OrbiTú en Chrome.</p>
      ) : (
        <div className="mt-3 flex gap-2">
          {onThisPhone ? (
            <>
              <button
                onClick={() => test.mutate()}
                disabled={test.isPending}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-black text-space"
              >
                <Send size={15} /> {test.isPending ? "Enviando…" : test.data ? "Enviada ✓" : "Mandar prueba"}
              </button>
              <button onClick={deactivate} disabled={busy} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-muted">
                Desactivar
              </button>
            </>
          ) : (
            <button onClick={activate} disabled={busy} className="min-h-12 flex-1 rounded-xl bg-primary font-black text-space">
              {busy ? "Activando…" : "Activar en este teléfono"}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-alert">{error}</p>}

      {data.available && <Prefs data={data} onSaved={refresh} />}

      {data.devices.length > 0 && (
        <p className="mt-3 text-[11px] text-muted">
          Activas en: {data.devices.map((d) => `${d.label ?? "dispositivo"}${d.endpoint === mine ? " (este)" : ""}`).join(" · ")}
        </p>
      )}
    </section>
  );
}

function Prefs({ data, onSaved }: { data: AdminPush; onSaved: () => void }) {
  const save = useAdminUpdatePushPrefs({ mutation: { onSuccess: onSaved } });
  const [open, setOpen] = useState(false);
  const muted = new Set(data.muted);
  const quietOn = data.quietStart != null && data.quietEnd != null;
  const put = (p: Partial<{ muted: string[]; quietStart: number | null; quietEnd: number | null; digest: boolean }>) =>
    save.mutate({
      data: {
        muted: data.muted,
        quietStart: data.quietStart,
        quietEnd: data.quietEnd,
        digest: data.digest,
        ...p,
      },
    });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 text-sm font-bold text-primary">
        Elegir qué me llega{quietOn ? ` · silencio ${fmtHour(data.quietStart!)}–${fmtHour(data.quietEnd!)}` : ""}
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
      <ul className="space-y-1">
        {data.kinds.map((k) => {
          const on = k.id === "resumen" ? data.digest : !muted.has(k.id);
          return (
            <li key={k.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2 active:bg-white/5">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-[#7d80d9]"
                  checked={on}
                  onChange={() => {
                    if (k.id === "resumen") return put({ digest: !data.digest });
                    const next = new Set(muted);
                    if (next.has(k.id)) next.delete(k.id);
                    else next.add(k.id);
                    put({ muted: [...next] });
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{k.label}</span>
                  <span className="block text-xs text-muted">{k.hint}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div>
        <label className="flex items-center gap-3 px-1">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[#7d80d9]"
            checked={quietOn}
            onChange={() => (quietOn ? put({ quietStart: null, quietEnd: null }) : put({ quietStart: 22, quietEnd: 7 }))}
          />
          <span className="flex items-center gap-1.5 text-sm font-bold">
            <Moon size={15} /> Horario silencioso
          </span>
        </label>
        {quietOn && (
          <div className="mt-2 flex items-center gap-2 pl-9 text-sm">
            de
            <select
              aria-label="Desde"
              value={data.quietStart!}
              onChange={(e) => put({ quietStart: Number(e.target.value) })}
              className="rounded-lg border border-white/15 bg-space-2 px-2 py-1.5"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>{fmtHour(h)}</option>
              ))}
            </select>
            a
            <select
              aria-label="Hasta"
              value={data.quietEnd!}
              onChange={(e) => put({ quietEnd: Number(e.target.value) })}
              className="rounded-lg border border-white/15 bg-space-2 px-2 py-1.5"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>{fmtHour(h)}</option>
              ))}
            </select>
          </div>
        )}
        <p className="mt-1 pl-9 text-[11px] text-muted">Lo que llegue en silencio te espera en el panel. «Interesado en una casa» suena siempre.</p>
      </div>
      <button onClick={() => setOpen(false)} className="text-sm font-bold text-muted">
        Listo
      </button>
    </div>
  );
}
