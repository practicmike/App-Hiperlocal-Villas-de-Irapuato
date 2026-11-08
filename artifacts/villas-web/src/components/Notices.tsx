import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotices,
  useReportNotice,
  useRecordNoticeEvent,
  getListNoticesQueryKey,
  type Notice,
  type NoticeKind,
} from "@workspace/api-client-react";
import { Check, ChevronRight, Construction, Droplets, Megaphone, MessageCircle, Send, X, Zap, type LucideIcon } from "lucide-react";

/**
 * Avisos generales (corte de agua, apagón, calle cerrada...). Sin push: una franja
 * arriba del inicio cuando hay algo vigente que le toca al vecino, y nada cuando no.
 */
export const NOTICE_STYLE: Record<NoticeKind, { label: string; color: string; Icon: LucideIcon }> = {
  agua: { label: "Agua", color: "#6eb5ff", Icon: Droplets },
  luz: { label: "Luz", color: "#e6c882", Icon: Zap },
  calle: { label: "Calle cerrada", color: "#ffabab", Icon: Construction },
  general: { label: "Otro", color: "#c38cf3", Icon: Megaphone },
};

const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return `hace ${Math.round(m / 1440)} d`;
};

/** Cuándo se quita el aviso (no cuándo termina el corte: eso va en el título). */
const until = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const time = d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `hasta hoy ${time}`;
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (d.toDateString() === tomorrow.toDateString()) return `hasta mañana ${time}`;
  return `hasta el ${d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" })} ${time}`;
};

export function useNotices(enabled: boolean) {
  return (
    useListNotices({
      query: { queryKey: getListNoticesQueryKey(), enabled, refetchOnWindowFocus: true, staleTime: 60_000, refetchInterval: 5 * 60_000 },
    }).data ?? []
  );
}

/** Franja del inicio: el aviso más reciente y cuántos más hay. */
export function NoticesBar({ notices, onOpen }: { notices: Notice[]; onOpen: () => void }) {
  const first = notices[0];
  if (!first) return null;
  const { color, Icon } = NOTICE_STYLE[first.kind];
  return (
    <button
      onClick={onOpen}
      className="sheet-enter relative z-10 mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-lg items-center gap-3 rounded-2xl border p-3 text-left"
      style={{ borderColor: `${color}66`, background: `${color}1f` }}
      aria-label={`Aviso: ${first.title}`}
    >
      <Icon size={22} className="shrink-0" style={{ color }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 block text-[15px] font-black leading-snug" style={{ color }}>
          {first.title}
        </span>
        <span className="line-clamp-1 block text-xs text-muted">
          {first.confirmed ? first.source : `${first.source}, sin confirmar`} · {ago(first.createdAt)}
        </span>
      </span>
      {notices.length > 1 && (
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold">+{notices.length - 1}</span>
      )}
      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
    </button>
  );
}

/** Lista de avisos vigentes + reportar. */
export function NoticesSheet({
  notices,
  myZone,
  creatorFirst,
  startReporting = false,
  onClose,
}: {
  notices: Notice[];
  myZone: string | null;
  creatorFirst: string;
  startReporting?: boolean;
  onClose: () => void;
}) {
  const [reporting, setReporting] = useState(startReporting || notices.length === 0);
  const event = useRecordNoticeEvent();
  const counted = useRef(new Set<string>());
  // Abrir la hoja = el vecino vio los avisos (una vez por aviso).
  useEffect(() => {
    for (const n of notices) {
      if (counted.current.has(n.id)) continue;
      counted.current.add(n.id);
      event.mutate({ id: n.id, data: { kind: "view" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notices]);

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="sheet-enter pb-safe max-h-[88%] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-white/10 bg-panel px-5 pt-5 md:max-w-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Avisos de Villas"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Megaphone size={20} className="text-primary" /> Avisos
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-white/10" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {notices.length > 0 && (
          <ul className="space-y-3">
            {notices.map((n) => (
              <NoticeCard key={n.id} n={n} onShare={() => event.mutate({ id: n.id, data: { kind: "share" } })} />
            ))}
          </ul>
        )}

        <div className="py-5">
          {reporting ? (
            <ReportForm myZone={myZone} creatorFirst={creatorFirst} onCancel={notices.length ? () => setReporting(false) : undefined} />
          ) : (
            <button
              onClick={() => setReporting(true)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 font-bold text-primary"
            >
              <Send size={16} /> Reportar algo en Villas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NoticeCard({ n, onShare }: { n: Notice; onShare: () => void }) {
  const { color, Icon, label } = NOTICE_STYLE[n.kind];
  const link = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const text = `${n.title}${n.body ? `. ${n.body}` : ""}. Fuente: ${n.source}${n.confirmed ? "" : ", sin confirmar"}. Avisos de la colonia en OrbiTú Villas: ${link}`;
  return (
    <li className="rounded-2xl border-l-4 bg-space-2 p-4" style={{ borderLeftColor: color }}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
        <Icon size={13} aria-hidden /> {label}
        {n.zone ? ` · ${n.zone}` : " · Toda Villas"}
      </p>
      <p className="mt-1 text-lg font-black leading-snug">{n.title}</p>
      {n.body && <p className="mt-1 text-sm">{n.body}</p>}
      <p className="mt-2 text-xs text-muted">
        Publicado {ago(n.createdAt)} · se quita solo {until(n.expiresAt).replace("hasta ", "")}
      </p>
      <p className="text-xs text-muted">
        Fuente: <b className="text-ink">{n.source}</b>
        {!n.confirmed && <span className="ml-1 rounded-full bg-[#e6c882]/20 px-1.5 py-0.5 font-bold text-[#e6c882]">sin confirmar</span>}
      </p>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onShare}
        className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-black text-[#0b3d1f]"
      >
        <MessageCircle size={16} /> Compartir en WhatsApp
      </a>
    </li>
  );
}

const KINDS: NoticeKind[] = ["agua", "luz", "calle", "general"];

function ReportForm({ myZone, creatorFirst, onCancel }: { myZone: string | null; creatorFirst: string; onCancel?: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<NoticeKind | null>(null);
  const [allVillas, setAllVillas] = useState(!myZone);
  const [zone, setZone] = useState(myZone ?? "");
  const [text, setText] = useState("");
  const report = useReportNotice({
    mutation: { onSuccess: () => void qc.invalidateQueries({ queryKey: getListNoticesQueryKey() }) },
  });
  const err = report.error as { data?: { message?: string }; message?: string } | null;

  if (report.data) {
    return (
      <div className="rounded-2xl border border-confianza/40 bg-space-2 p-4 text-sm">
        <p className="flex items-center gap-2 font-bold">
          <Check size={18} className="text-confianza" />
          {report.data.published ? "Listo, ya está publicado arriba." : `Gracias. ${creatorFirst} lo revisa.`}
        </p>
        {!report.data.published && (
          <p className="mt-1 text-xs text-muted">Si otros vecinos reportan lo mismo en tu zona, se publica solo.</p>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-3 rounded-2xl border border-white/10 bg-space-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!kind || text.trim().length < 3) return;
        report.mutate({ data: { kind, zone: allVillas ? null : zone.trim() || null, text: text.trim() } });
      }}
    >
      <p className="text-base font-black">Reportar algo en Villas</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de reporte">
        {KINDS.map((k) => {
          const { label, color, Icon } = NOTICE_STYLE[k];
          const on = kind === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setKind(k)}
              className="flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm font-bold"
              style={on ? { borderColor: color, background: `${color}22`, color } : { borderColor: "rgba(255,255,255,0.12)" }}
            >
              <Icon size={18} style={{ color }} aria-hidden /> {label}
            </button>
          );
        })}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-xs font-bold text-muted">¿Dónde?</legend>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAllVillas(false)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold ${!allVillas ? "border-primary bg-primary/15" : "border-white/12 text-muted"}`}
          >
            {myZone ? "Mi privada" : "Una privada"}
          </button>
          <button
            type="button"
            onClick={() => setAllVillas(true)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold ${allVillas ? "border-primary bg-primary/15" : "border-white/12 text-muted"}`}
          >
            Toda Villas
          </button>
        </div>
        {!allVillas && (
          <input
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            maxLength={80}
            placeholder="Privada o calle"
            aria-label="Privada o calle"
            className="mt-2 w-full rounded-xl border border-white/12 bg-panel px-3 py-2.5 text-base outline-none focus:border-primary"
          />
        )}
      </fieldset>

      <div>
        <label htmlFor="aviso-texto" className="mb-1.5 block text-xs font-bold text-muted">
          ¿Qué pasa?
        </label>
        <textarea
          id="aviso-texto"
          rows={2}
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej. se fue la luz desde las 3 pm"
          className="w-full rounded-xl border border-white/12 bg-panel px-3 py-2.5 text-base outline-none focus:border-primary"
        />
        <p className="text-[11px] text-muted">No se publica tal cual: {creatorFirst} lo revisa. Tu nombre no se publica.</p>
      </div>

      {err && <p className="text-sm text-alert">{err.data?.message ?? err.message}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 text-sm font-bold text-muted">
            Cancelar
          </button>
        )}
        <button
          disabled={!kind || text.trim().length < 3 || (!allVillas && !zone.trim()) || report.isPending}
          className="min-h-12 flex-1 rounded-xl bg-primary font-black text-space disabled:opacity-40"
        >
          {report.isPending ? "Enviando…" : "Enviar reporte"}
        </button>
      </div>
    </form>
  );
}
