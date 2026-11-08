import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminListNotices,
  useAdminCreateNotice,
  useAdminUpdateNotice,
  useAdminDismissNoticeReports,
  getAdminListNoticesQueryKey,
  getListNoticesQueryKey,
  type AdminNoticeReportGroup,
  type NoticeKind,
} from "@workspace/api-client-react";
import { Check, Eye, MessageCircle, Plus, Users, X } from "lucide-react";
import { NOTICE_STYLE } from "@/components/Notices";

/**
 * Panel → Avisos. Tres bloques: reportes de vecinos por confirmar, publicar un
 * aviso nuevo y los avisos vigentes (confirmar los auto-publicados o cerrarlos).
 */
const KINDS: NoticeKind[] = ["agua", "luz", "calle", "general"];
const SOURCES = ["JAPAMI", "CFE", "Tránsito", "Protección Civil", "Administración", "Vecinos"];
const HOURS = [3, 6, 12, 24, 48, 72];
const TITLE: Record<NoticeKind, string> = { agua: "Sin agua", luz: "Sin luz", calle: "Calle cerrada", general: "" };

const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};
const left = (iso: string) => {
  const m = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  return m < 60 ? `${Math.max(m, 0)} min` : `${Math.round(m / 60)} h`;
};

interface Draft {
  kind: NoticeKind;
  title: string;
  body: string;
  zone: string;
  source: string;
  hours: number;
  reportIds: string[];
}
const EMPTY: Draft = { kind: "agua", title: "Sin agua", body: "", zone: "", source: "JAPAMI", hours: 24, reportIds: [] };

export function AdminNotices() {
  const qc = useQueryClient();
  const { data } = useAdminListNotices({ query: { queryKey: getAdminListNoticesQueryKey(), refetchInterval: 60_000 } });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: getAdminListNoticesQueryKey() });
    void qc.invalidateQueries({ queryKey: getListNoticesQueryKey() });
  };
  const [draft, setDraft] = useState<Draft | null>(null);
  const create = useAdminCreateNotice({
    mutation: {
      onSuccess: () => {
        setDraft(null);
        refresh();
      },
    },
  });
  const update = useAdminUpdateNotice({ mutation: { onSuccess: refresh } });
  const dismiss = useAdminDismissNoticeReports({ mutation: { onSuccess: refresh } });

  if (!data) return <p className="text-sm text-muted">Cargando…</p>;

  const fromGroup = (g: AdminNoticeReportGroup): Draft => ({
    kind: g.kind,
    title: `${TITLE[g.kind] || "Aviso"}${g.zone ? ` en ${g.zone}` : " en Villas"}`,
    body: "",
    zone: g.zone ?? "",
    source: "Vecinos",
    hours: 6,
    reportIds: g.reports.map((r) => r.id),
  });

  return (
    <div className="space-y-7">
      {draft ? (
        <NoticeForm
          draft={draft}
          zones={data.zones}
          busy={create.isPending}
          error={(create.error as { data?: { message?: string } } | null)?.data?.message ?? null}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSubmit={() =>
            create.mutate({
              data: {
                kind: draft.kind,
                title: draft.title.trim(),
                body: draft.body.trim() || null,
                zone: draft.zone.trim() || null,
                source: draft.source.trim(),
                hours: draft.hours,
                reportIds: draft.reportIds.length ? draft.reportIds : undefined,
              },
            })
          }
        />
      ) : (
        <button
          onClick={() => setDraft(EMPTY)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-black text-space"
        >
          <Plus size={18} /> Nuevo aviso
        </button>
      )}

      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-muted">Por confirmar · {data.pending.length}</h2>
        {data.pending.length === 0 && <p className="text-sm text-muted">Ningún reporte pendiente.</p>}
        <ul className="space-y-3">
          {data.pending.map((g) => {
            const { color, Icon, label } = NOTICE_STYLE[g.kind];
            return (
              <li key={`${g.kind}-${g.zone}`} className="rounded-2xl bg-panel p-4">
                <p className="flex items-center gap-2 font-black">
                  <Icon size={18} style={{ color }} aria-hidden />
                  <span style={{ color }}>{label}</span>
                  <span className="text-muted">· {g.zone ?? "Toda Villas"}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  <Users size={12} /> {g.residents} {g.residents === 1 ? "vecino" : "vecinos"} · último {ago(g.latestAt)}
                </p>
                <ul className="mt-2 space-y-1.5 border-l border-white/10 pl-3 text-sm">
                  {g.reports.slice(0, 5).map((r) => (
                    <li key={r.id}>
                      «{r.text}» <span className="text-xs text-muted">— {r.residentName.split(" ")[0]}, {ago(r.createdAt)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setDraft(fromGroup(g))}
                    className="min-h-11 flex-1 rounded-xl bg-primary text-sm font-black text-space"
                  >
                    Publicar
                  </button>
                  <button
                    onClick={() => dismiss.mutate({ data: { ids: g.reports.map((r) => r.id) } })}
                    className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-muted"
                  >
                    Descartar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-muted">Activos · {data.active.length}</h2>
        {data.active.length === 0 && <p className="text-sm text-muted">No hay avisos vigentes. La franja del inicio no se muestra.</p>}
        <ul className="space-y-3">
          {data.active.map((n) => {
            const { color, Icon } = NOTICE_STYLE[n.kind];
            return (
              <li key={n.id} className="rounded-2xl border-l-4 bg-panel p-4" style={{ borderLeftColor: color }}>
                <div className="flex items-start gap-2">
                  <Icon size={18} className="mt-0.5 shrink-0" style={{ color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-black leading-snug">{n.title}</p>
                    <p className="text-xs text-muted">
                      {n.zone ?? "Toda Villas"} · {n.source} · quedan {left(n.expiresAt)}
                    </p>
                  </div>
                  {!n.confirmed && (
                    <span className="shrink-0 rounded-full bg-[#e6c882]/20 px-2 py-0.5 text-[11px] font-bold text-[#e6c882]">sin confirmar</span>
                  )}
                </div>
                {n.body && <p className="mt-2 text-sm">{n.body}</p>}
                <p className="mt-2 flex gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1"><Eye size={12} /> {n.views} vieron</span>
                  <span className="flex items-center gap-1"><MessageCircle size={12} /> {n.shares} compartieron</span>
                  {n.reports > 0 && <span className="flex items-center gap-1"><Users size={12} /> {n.reports} reportes</span>}
                </p>
                <div className="mt-3 flex gap-2">
                  {!n.confirmed && (
                    <button
                      onClick={() => update.mutate({ id: n.id, data: { confirm: true } })}
                      className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-confianza/90 text-sm font-black text-space"
                    >
                      <Check size={16} /> Confirmar
                    </button>
                  )}
                  <button
                    onClick={() => update.mutate({ id: n.id, data: { close: true } })}
                    className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 text-sm font-bold"
                  >
                    <X size={16} /> {n.confirmed ? "Ya se resolvió" : "Quitar"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Chip({ on, onClick, children, color }: { on: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full border px-3 py-1.5 text-sm font-bold"
      style={on ? { borderColor: color ?? "#7d80d9", background: `${color ?? "#7d80d9"}26`, color: color ?? undefined } : { borderColor: "rgba(255,255,255,0.12)", color: "#a6abd6" }}
    >
      {children}
    </button>
  );
}

function NoticeForm({
  draft,
  zones,
  busy,
  error,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: Draft;
  zones: string[];
  busy: boolean;
  error: string | null;
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const set = (p: Partial<Draft>) => onChange({ ...draft, ...p });
  const field = "w-full rounded-xl border border-white/12 bg-space-2 px-3 py-2.5 text-base outline-none focus:border-primary";
  const label = "mb-1.5 block text-xs font-bold text-muted";
  return (
    <form
      className="space-y-4 rounded-2xl border border-primary/40 bg-panel p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <p className="text-base font-black">{draft.reportIds.length ? `Publicar reporte de ${draft.reportIds.length} vecinos` : "Nuevo aviso"}</p>

      <div>
        <span className={label}>Tipo</span>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Chip
              key={k}
              on={draft.kind === k}
              color={NOTICE_STYLE[k].color}
              onClick={() => {
                // Si el título empieza con el texto del tipo anterior, se cambia con el tipo.
                const prefix = /^(Sin agua|Sin luz|Calle cerrada|Aviso)/;
                const next = TITLE[k] || "Aviso";
                set({ kind: k, title: !draft.title ? next : prefix.test(draft.title) ? draft.title.replace(prefix, next) : draft.title });
              }}
            >
              {NOTICE_STYLE[k].label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="aviso-titulo" className={label}>Título (lo que se lee en la franja)</label>
        <input id="aviso-titulo" required minLength={3} maxLength={90} className={field} value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Sin agua mañana de 9 a 14 h" />
      </div>

      <div>
        <label htmlFor="aviso-detalle" className={label}>Detalle (opcional)</label>
        <textarea id="aviso-detalle" rows={2} maxLength={500} className={field} value={draft.body} onChange={(e) => set({ body: e.target.value })} placeholder="Llenen cisternas hoy en la noche." />
      </div>

      <div>
        <label htmlFor="aviso-zona" className={label}>¿A quién le toca?</label>
        <input id="aviso-zona" list="aviso-zonas" maxLength={80} className={field} value={draft.zone} onChange={(e) => set({ zone: e.target.value })} placeholder="Vacío = toda Villas" />
        <datalist id="aviso-zonas">
          {zones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        {draft.kind === "calle" && <p className="mt-1 text-[11px] text-muted">Calle cerrada la ven todos, aunque pongas una privada.</p>}
      </div>

      <div>
        <span className={label}>Fuente (siempre visible)</span>
        <div className="mb-2 flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <Chip key={s} on={draft.source === s} onClick={() => set({ source: s })}>
              {s}
            </Chip>
          ))}
        </div>
        <input aria-label="Otra fuente" required minLength={2} maxLength={60} className={field} value={draft.source} onChange={(e) => set({ source: e.target.value })} />
      </div>

      <div>
        <span className={label}>Dura</span>
        <div className="flex flex-wrap gap-2">
          {HOURS.map((h) => (
            <Chip key={h} on={draft.hours === h} onClick={() => set({ hours: h })}>
              {h < 24 ? `${h} h` : `${h / 24} ${h === 24 ? "día" : "días"}`}
            </Chip>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-alert">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="px-3 text-sm font-bold text-muted">
          Cancelar
        </button>
        <button disabled={busy || draft.title.trim().length < 3} className="min-h-12 flex-1 rounded-xl bg-primary font-black text-space disabled:opacity-40">
          {busy ? "Publicando…" : "Publicar aviso"}
        </button>
      </div>
    </form>
  );
}
