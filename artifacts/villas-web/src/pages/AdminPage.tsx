import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminOverview,
  useAdminListResidents,
  useAdminApproveResident,
  useAdminRegenerateKey,
  useAdminBlockResident,
  useAdminListInvites,
  useAdminCreateInvite,
  useAdminListPlaces,
  useAdminCreatePlace,
  useAdminUpdatePlace,
  useAdminLoadDemoPlaces,
  useAdminRemoveDemoPlaces,
  useAdminListSearches,
  useAdminMarkSearchHandled,
  useAdminListComplaints,
  useAdminResolveComplaint,
  getAdminListResidentsQueryKey,
  getAdminListInvitesQueryKey,
  getAdminListPlacesQueryKey,
  getAdminListSearchesQueryKey,
  getAdminListComplaintsQueryKey,
  getAdminOverviewQueryKey,
  getGetUniverseQueryKey,
  type AccessKey,
  type AdminPlace,
  type PlaceInput,
  type Creator,
} from "@workspace/api-client-react";
import { ArrowLeft, Copy, MessageCircle } from "lucide-react";
import { CONSTELLATIONS, ORDER, whatsappLink } from "@/lib/constellations";

type Tab = "resumen" | "vecinos" | "lugares" | "busquedas" | "quejas";
const TABS: Array<[Tab, string]> = [
  ["resumen", "Resumen"],
  ["vecinos", "Vecinos"],
  ["lugares", "Lugares"],
  ["busquedas", "Búsquedas"],
  ["quejas", "Quejas"],
];

const keyLink = (token: string) => `${window.location.origin}${import.meta.env.BASE_URL}llave/${token}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function AdminPage({ creator }: { creator: Creator }) {
  const [tab, setTab] = useState<Tab>("resumen");
  const me = creator.name.split(" ")[0] ?? creator.name;
  return (
    <div className="h-full overflow-y-auto bg-space">
      <header className="pt-safe sticky top-0 z-10 border-b border-white/10 bg-space/95 px-4 pb-2 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link href="/" className="rounded-full p-2 hover:bg-white/10" aria-label="Volver al universo">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-black">Panel del creador</h1>
        </div>
        <nav className="mx-auto mt-2 flex max-w-3xl gap-1 overflow-x-auto">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold ${
                tab === id ? "bg-primary text-space" : "text-muted hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5 pb-24">
        {tab === "resumen" && <Overview />}
        {tab === "vecinos" && <Residents me={me} />}
        {tab === "lugares" && <Places />}
        {tab === "busquedas" && <Searches />}
        {tab === "quejas" && <Complaints />}
      </main>
    </div>
  );
}

// ------------------------------------------------------------------ resumen
function Overview() {
  const { data: o } = useAdminOverview();
  if (!o) return <Loading />;
  const pct = o.searches30d ? Math.round((o.searchesWithContact30d / o.searches30d) * 100) : 0;
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-muted">Señales de que funciona · 30 días</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Vecinos por invitación" value={o.residentsByInvite} hint={`${o.residentsApproved} aprobados`} />
          <Stat label="Búsquedas → WhatsApp" value={`${pct}%`} hint={`${o.searchesWithContact30d} de ${o.searches30d}`} accent="#50e3c2" />
          <Stat label="Búsquedas sin resultado" value={o.searchesNoResult30d} hint="Lo que falta en Villas" accent="#e6c882" />
        </div>
      </section>
      <section className="grid grid-cols-3 gap-3">
        <Stat label="Pendientes" value={o.residentsPending} accent={o.residentsPending ? "#7d80d9" : undefined} />
        <Stat label="Estrellas" value={o.places} />
        <Stat label="Quejas abiertas" value={o.openComplaints} accent={o.openComplaints ? "#ffabab" : undefined} />
      </section>
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: number | string; hint?: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-3xl font-black tabular-nums" style={{ color: accent }}>
        {value}
      </p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ vecinos
function KeyBox({ k, me, onDone }: { k: AccessKey; me: string; onDone: () => void }) {
  const link = keyLink(k.token);
  const first = k.name.split(" ")[0];
  return (
    <div className="mb-4 rounded-2xl border border-primary/50 bg-primary/10 p-4 text-sm">
      <p className="mb-2 font-bold">Llave de {k.name}</p>
      <p className="mb-3 break-all rounded-lg bg-space-2 p-2 font-mono text-xs">{link}</p>
      <p className="mb-3 text-xs text-muted">Se muestra una sola vez. Si se pierde, genera otra: la anterior deja de servir.</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappLink(k.phone, `Hola ${first}, soy ${me}, de la guía de vecinos de Villas. Esta es tu llave personal, ábrela en tu teléfono y no la compartas: ${link}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 font-bold text-[#0b3d1f]"
        >
          <MessageCircle size={16} /> Enviar por WhatsApp
        </a>
        <button onClick={() => void navigator.clipboard?.writeText(link)} className="flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 font-bold">
          <Copy size={14} /> Copiar
        </button>
        <button onClick={onDone} className="px-3 py-2 text-muted">
          Listo
        </button>
      </div>
    </div>
  );
}

function Residents({ me }: { me: string }) {
  const qc = useQueryClient();
  const { data: residents } = useAdminListResidents();
  const { data: invites } = useAdminListInvites();
  const [key, setKey] = useState<AccessKey | null>(null);
  const [note, setNote] = useState("");
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: getAdminListResidentsQueryKey() });
    void qc.invalidateQueries({ queryKey: getAdminOverviewQueryKey() });
  };
  const approve = useAdminApproveResident({ mutation: { onSuccess: (k) => (setKey(k), refresh()) } });
  const regen = useAdminRegenerateKey({ mutation: { onSuccess: (k) => setKey(k) } });
  const block = useAdminBlockResident({ mutation: { onSuccess: refresh } });
  const invite = useAdminCreateInvite({
    mutation: {
      onSuccess: () => {
        setNote("");
        void qc.invalidateQueries({ queryKey: getAdminListInvitesQueryKey() });
      },
    },
  });
  const unusedInvites = invites?.filter((i) => !i.usedBy) ?? [];

  return (
    <div className="space-y-8">
      {key && <KeyBox k={key} me={me} onDone={() => setKey(null)} />}

      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-muted">Invitar a alguien</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate({ data: { note } });
          }}
        >
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Para quién (ej. Laura, Privada Encino)"
            maxLength={120}
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button disabled={invite.isPending} className="rounded-xl bg-primary px-4 text-sm font-bold text-space">
            Crear código
          </button>
        </form>
        {unusedInvites.length > 0 && (
          <ul className="mt-3 space-y-2">
            {unusedInvites.map((i) => (
              <li key={i.code} className="flex items-center justify-between gap-2 rounded-xl bg-panel px-3 py-2 text-sm">
                <span>
                  <b className="font-mono">{i.code}</b>
                  {i.note && <span className="text-muted"> · {i.note}</span>}
                </span>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Te invito a la guía de vecinos de Villas. Entra a ${window.location.origin}${import.meta.env.BASE_URL} y usa el código ${i.code}`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-bold text-confianza"
                >
                  Compartir
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-muted">Vecinos</h2>
        {!residents ? (
          <Loading />
        ) : (
          <ul className="space-y-2">
            {residents.map((r) => (
              <li key={r.id} className="rounded-2xl bg-panel p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      {r.name} {r.role === "admin" && <span className="text-xs text-primary">(creador)</span>}
                    </p>
                    <p className="text-xs text-muted">
                      +{r.phone}
                      {r.zone && ` · ${r.zone}`}
                      {r.invitedBy && ` · invitó ${r.invitedBy}`}
                    </p>
                  </div>
                  <StatusPill status={r.status} />
                </div>
                {r.role !== "admin" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status === "pending" && (
                      <button onClick={() => approve.mutate({ id: r.id })} className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-space">
                        Ya lo conocí · aprobar
                      </button>
                    )}
                    {r.status === "approved" && (
                      <button onClick={() => regen.mutate({ id: r.id })} className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold">
                        Nueva llave
                      </button>
                    )}
                    {r.status !== "blocked" && (
                      <button
                        onClick={() => confirm(`¿Bloquear a ${r.name}? Pierde el acceso de inmediato.`) && block.mutate({ id: r.id })}
                        className="rounded-full px-3 py-1.5 text-xs text-alert"
                      >
                        Bloquear
                      </button>
                    )}
                    <a href={whatsappLink(r.phone, `Hola ${r.name.split(" ")[0]}, soy ${me}, de la guía de vecinos de Villas.`)} target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1.5 text-xs text-confianza">
                      WhatsApp
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: "pending" | "approved" | "blocked" }) {
  const map = {
    pending: ["Pendiente", "bg-primary/20 text-primary"],
    approved: ["Aprobado", "bg-confianza/15 text-confianza"],
    blocked: ["Bloqueado", "bg-alert/15 text-alert"],
  } as const;
  const [label, cls] = map[status];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{label}</span>;
}

// ------------------------------------------------------------------ lugares
const EMPTY: PlaceInput = {
  constellation: "confianza",
  name: "",
  category: "",
  description: "",
  contactName: null,
  whatsapp: "",
  zone: null,
  operation: null,
  priceLabel: null,
  imageUrl: null,
  verified: true,
  active: true,
};

function Places() {
  const qc = useQueryClient();
  const { data: places } = useAdminListPlaces();
  const [editing, setEditing] = useState<{ id: string | null; form: PlaceInput } | null>(null);
  const [filter, setFilter] = useState("");
  const done = () => {
    setEditing(null);
    void qc.invalidateQueries({ queryKey: getAdminListPlacesQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetUniverseQueryKey() });
  };
  const create = useAdminCreatePlace({ mutation: { onSuccess: done } });
  const update = useAdminUpdatePlace({ mutation: { onSuccess: done } });
  const error = create.error ?? update.error;

  if (editing) {
    const f = editing.form;
    const set = <K extends keyof PlaceInput>(k: K, v: PlaceInput[K]) =>
      setEditing({ ...editing, form: { ...f, [k]: v } });
    const txt = (k: "name" | "category" | "description" | "whatsapp") => ({
      value: f[k],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value),
    });
    const opt = (k: "contactName" | "zone" | "priceLabel" | "imageUrl") => ({
      value: f[k] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value || null),
    });
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (editing.id) update.mutate({ id: editing.id, data: f });
          else create.mutate({ data: f });
        }}
      >
        <h2 className="text-lg font-black">{editing.id ? "Editar estrella" : "Nueva estrella"}</h2>
        <div className="flex gap-2">
          {ORDER.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => set("constellation", c)}
              className="flex-1 rounded-xl border px-2 py-2 text-xs font-bold"
              style={{
                borderColor: f.constellation === c ? CONSTELLATIONS[c].color : "rgba(255,255,255,.15)",
                color: f.constellation === c ? CONSTELLATIONS[c].color : undefined,
              }}
            >
              {CONSTELLATIONS[c].label}
            </button>
          ))}
        </div>
        <AdminField label="Nombre" required minLength={2} maxLength={80} {...txt("name")} />
        <AdminField label="Giro u oficio (Plomería, Tacos, Casa en renta…)" required minLength={2} maxLength={60} {...txt("category")} />
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-muted">Descripción: qué ofrece, con las palabras que usaría un vecino</span>
          <textarea rows={3} maxLength={600} {...txt("description")} className="w-full rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <AdminField label="WhatsApp (10 dígitos)" required inputMode="tel" {...txt("whatsapp")} />
          <AdminField label="Quién atiende" maxLength={80} {...opt("contactName")} />
        </div>
        <AdminField label="Zona o privada" maxLength={80} {...opt("zone")} />
        {f.constellation === "casas" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-muted">Operación</span>
              <select
                value={f.operation ?? ""}
                onChange={(e) => set("operation", (e.target.value || null) as PlaceInput["operation"])}
                className="w-full rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm"
              >
                <option value="">—</option>
                <option value="venta">Venta</option>
                <option value="renta">Renta</option>
              </select>
            </label>
            <AdminField label="Precio" placeholder="$3.2 M" maxLength={60} {...opt("priceLabel")} />
          </div>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-[#7d80d9]" checked={f.verified} onChange={(e) => set("verified", e.target.checked)} />
            Lo conozco en persona
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-[#7d80d9]" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
            Visible en el universo
          </label>
        </div>
        {error && <p className="text-sm text-alert">Revisa los datos: {(error as Error).message}</p>}
        <div className="flex gap-2 pt-2">
          <button disabled={create.isPending || update.isPending} className="rounded-xl bg-primary px-5 py-2.5 font-bold text-space">
            Guardar
          </button>
          <button type="button" onClick={() => setEditing(null)} className="px-4 text-muted">
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  const shown = (places ?? []).filter((p) =>
    `${p.name} ${p.category}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar"
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm outline-none"
        />
        <button onClick={() => setEditing({ id: null, form: EMPTY })} className="rounded-xl bg-primary px-4 text-sm font-bold text-space">
          + Nueva
        </button>
      </div>
      <DemoTools places={places ?? []} onChange={done} />
      {!places ? (
        <Loading />
      ) : (
        <ul className="space-y-2">
          {shown.map((p) => (
            <PlaceRow key={p.id} p={p} onEdit={() => setEditing({ id: p.id, form: toInput(p) })} />
          ))}
        </ul>
      )}
    </div>
  );
}

const toInput = (p: AdminPlace): PlaceInput => ({
  constellation: p.constellation,
  name: p.name,
  category: p.category,
  description: p.description,
  contactName: p.contactName,
  whatsapp: p.whatsapp,
  zone: p.zone,
  operation: p.operation,
  priceLabel: p.priceLabel,
  imageUrl: p.imageUrl,
  verified: p.verified,
  active: p.active,
});

/** Cargar o borrar las 30 estrellas de ejemplo; las reales nunca se tocan. */
function DemoTools({ places, onChange }: { places: AdminPlace[]; onChange: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const load = useAdminLoadDemoPlaces({
    mutation: {
      onSuccess: (r) => {
        setMsg(r.inserted ? `Listo: ${r.inserted} estrellas de ejemplo. La marca "IA" aparece en unos segundos si OpenAI responde.` : "Los ejemplos ya estaban cargados.");
        onChange();
      },
    },
  });
  const remove = useAdminRemoveDemoPlaces({
    mutation: {
      onSuccess: (r) => {
        setMsg(`Borradas ${r.removed} estrellas de ejemplo.`);
        onChange();
      },
    },
  });
  const demoCount = places.filter((p) => p.isDemo).length;
  return (
    <div className="rounded-2xl border border-casas/30 bg-casas/5 p-3 text-sm">
      <p className="mb-2 text-xs text-muted">
        Datos de ejemplo para probar: 10 casas, 10 de gente de confianza y 10 comercios, con WhatsApp ficticio (no le escriben a nadie real).
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={load.isPending}
          onClick={() => load.mutate()}
          className="rounded-full bg-casas px-4 py-1.5 text-xs font-bold text-space disabled:opacity-50"
        >
          {load.isPending ? "Cargando…" : "Cargar 30 ejemplos"}
        </button>
        {demoCount > 0 && (
          <button
            disabled={remove.isPending}
            onClick={() => confirm(`¿Borrar las ${demoCount} estrellas de ejemplo? Las reales no se tocan.`) && remove.mutate()}
            className="rounded-full border border-alert/50 px-4 py-1.5 text-xs font-bold text-alert"
          >
            Borrar ejemplos ({demoCount})
          </button>
        )}
      </div>
      {msg && <p className="mt-2 text-xs text-ink/85">{msg}</p>}
    </div>
  );
}

function PlaceRow({ p, onEdit }: { p: AdminPlace; onEdit: () => void }) {
  const info = CONSTELLATIONS[p.constellation];
  return (
    <li>
      <button onClick={onEdit} className={`flex w-full items-center gap-3 rounded-2xl bg-panel p-3 text-left ${p.active ? "" : "opacity-50"}`}>
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: info.color }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{p.name}</span>
          <span className="block truncate text-xs text-muted">
            {p.isDemo && <span className="font-bold text-casas">Ejemplo · </span>}
            {p.category} · {p.whatsappClicks} contactos · {p.endorsementCount} ♥{!p.active && " · oculta"}
            {p.hasEmbedding && <span className="text-ai"> · IA</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function AdminField({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted">{label}</span>
      <input {...props} className="w-full rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm outline-none focus:border-primary" />
    </label>
  );
}

// ---------------------------------------------------------------- búsquedas
function Searches() {
  const qc = useQueryClient();
  const { data } = useAdminListSearches();
  const handled = useAdminMarkSearchHandled({
    mutation: { onSuccess: () => void qc.invalidateQueries({ queryKey: getAdminListSearchesQueryKey() }) },
  });
  if (!data) return <Loading />;
  if (data.length === 0) return <Empty text="Aún no hay búsquedas." />;
  return (
    <ul className="space-y-2">
      {data.map((s) => {
        const pending = s.resultCount === 0 && !s.handled;
        return (
          <li key={s.id} className={`rounded-2xl p-4 text-sm ${pending ? "border border-casas/50 bg-casas/10" : "bg-panel"}`}>
            <p className="font-bold">«{s.query}»</p>
            {s.refinedQuery && <p className="text-xs text-ai">IA: {s.refinedQuery}</p>}
            <p className="mt-1 text-xs text-muted">
              {s.residentName ?? "—"} · {fmtDate(s.createdAt)} · {s.resultCount} {s.resultCount === 1 ? "resultado" : "resultados"}
              {s.contacted && " · terminó en WhatsApp"}
            </p>
            {pending && (
              <div className="mt-3 flex flex-wrap gap-2">
                {s.residentPhone && (
                  <a
                    href={whatsappLink(s.residentPhone, `Hola ${s.residentName?.split(" ")[0] ?? ""}, vi que buscaste «${s.query}» en la guía de Villas. Te ayudo a encontrarlo.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-[#0b3d1f]"
                  >
                    Ayudarle por WhatsApp
                  </a>
                )}
                <button onClick={() => handled.mutate({ id: s.id })} className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold">
                  Atendida
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------------- quejas
function Complaints() {
  const qc = useQueryClient();
  const { data } = useAdminListComplaints();
  const resolve = useAdminResolveComplaint({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getAdminListComplaintsQueryKey() });
        void qc.invalidateQueries({ queryKey: getAdminOverviewQueryKey() });
      },
    },
  });
  if (!data) return <Loading />;
  if (data.length === 0) return <Empty text="Sin quejas. Buena señal." />;
  return (
    <ul className="space-y-2">
      {data.map((c) => (
        <li key={c.id} className={`rounded-2xl p-4 text-sm ${c.resolved ? "bg-panel opacity-60" : "border border-alert/40 bg-alert/10"}`}>
          <p className="text-xs font-bold text-alert">{c.placeName}</p>
          <p className="my-1">{c.message}</p>
          <p className="text-xs text-muted">
            {c.residentName} · {fmtDate(c.createdAt)}
          </p>
          {!c.resolved && (
            <div className="mt-3 flex gap-2">
              <a href={whatsappLink(c.residentPhone, `Hola ${c.residentName.split(" ")[0]}, recibí tu comentario sobre ${c.placeName}. Gracias por avisarme.`)} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-[#0b3d1f]">
                Responder
              </a>
              <button onClick={() => resolve.mutate({ id: c.id })} className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold">
                Resuelta
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

const Loading = () => <p className="text-sm text-muted">Cargando…</p>;
const Empty = ({ text }: { text: string }) => <p className="text-sm text-muted">{text}</p>;
