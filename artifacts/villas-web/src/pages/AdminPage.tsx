import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  useAdminOverview,
  useAdminListResidents,
  useAdminApproveResident,
  useAdminCreateResident,
  useAdminRegenerateKey,
  useAdminBlockResident,
  useAdminListPlaces,
  useAdminCreatePlace,
  useAdminUpdatePlace,
  useAdminLoadDemoPlaces,
  useAdminDeletePlace,
  useAdminRemoveDemoPlaces,
  useAdminListSearches,
  useAdminMarkSearchHandled,
  useAdminListComplaints,
  useAdminResolveComplaint,
  useAdminListConstellations,
  useAdminCreateConstellation,
  useAdminUpdateConstellation,
  useAdminRemoveConstellation,
  useAdminReorderConstellations,
  useAdminSuggestConstellation,
  useAdminIssueMerchantKey,
  useAdminUpdateResident,
  useAdminDeleteResident,
  useAdminListVisits,
  useAdminDeleteVisit,
  useAdminClearVisits,
  useAdminDeleteSearch,
  useAdminDeletePhoto,
  useAdminReorderPhotos,
  getGetPlaceQueryKey,
  useAdminListNews,
  getAdminListNewsQueryKey,
  getListNewsQueryKey,
  adminPublishNews,
  adminRemoveNews,
  useAdminListLeads,
  useAdminDeleteLead,
  useAdminClearLeads,
  getAdminListLeadsQueryKey,
  useAdminClearSearches,
  getAdminListVisitsQueryKey,
  getGetMySkyQueryKey,
  getAdminListConstellationsQueryKey,
  type AdminConstellation,
  type ConstellationInput,
  getAdminListResidentsQueryKey,
  getAdminListPlacesQueryKey,
  getAdminListSearchesQueryKey,
  getAdminListComplaintsQueryKey,
  getAdminOverviewQueryKey,
  getGetUniverseQueryKey,
  type AccessKey,
  type AdminResident,
  type AdminPlace,
  type PlaceInput,
  type Creator,
} from "@workspace/api-client-react";
import { ArrowLeft, Copy, MessageCircle, UserPlus } from "lucide-react";
import { FALLBACK, PALETTE, whatsappLink } from "@/lib/constellations";
import { shrinkPhoto, uploadPhoto } from "@/lib/photo";
import { NewsComposer } from "@/components/NewsComposer";
import { ShareButton } from "@/components/PlaceSheet";

type Tab = "resumen" | "vecinos" | "lugares" | "visitas" | "interesados" | "constelaciones" | "busquedas" | "quejas";
const TABS: Array<[Tab, string]> = [
  ["resumen", "Resumen"],
  ["vecinos", "Vecinos"],
  ["lugares", "Lugares"],
  ["visitas", "Visitas"],
  ["interesados", "Interesados"],
  ["constelaciones", "Categorías"],
  ["busquedas", "Búsquedas"],
  ["quejas", "Quejas"],
];

const keyLink = (token: string) => `${window.location.origin}${import.meta.env.BASE_URL}llave/${token}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function AdminPage({ creator }: { creator: Creator }) {
  // Desde la tarjeta de una estrella: /panel?editar=<id> abre su edición.
  const editId = new URLSearchParams(window.location.search).get("editar");
  const [tab, setTab] = useState<Tab>(editId ? "lugares" : "resumen");
  const me = creator.name.split(" ")[0] ?? creator.name;
  return (
    <div className="h-full overflow-y-auto bg-space">
      <header className="pt-safe sticky top-0 z-10 border-b border-white/10 bg-space/95 px-4 pb-2 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link href="/" className="rounded-full p-2 hover:bg-white/10" aria-label="Volver al inicio">
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
        {tab === "lugares" && <Places editId={editId} />}
        {tab === "visitas" && <Visits />}
        {tab === "interesados" && <Leads />}
        {tab === "constelaciones" && <Constellations />}
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
          <Stat label="Vecinos dentro" value={o.residentsApproved} hint="Con acceso aprobado" />
          <Stat label="Búsquedas → WhatsApp" value={`${pct}%`} hint={`${o.searchesWithContact30d} de ${o.searches30d}`} accent="#50e3c2" />
          <Stat label="Búsquedas sin resultado" value={o.searchesNoResult30d} hint="Lo que falta en Villas" accent="#e6c882" />
          <Stat label="Búsquedas de visitantes" value={o.guestSearches30d} hint="Gente sin acceso probando" accent="#c38cf3" />
          <Stat label="Visitas registradas" value={o.visits30d} hint="Credenciales escaneadas en comercios" accent="#6eb5ff" />
        </div>
      </section>
      <section className="grid grid-cols-3 gap-3">
        <Stat label="Piden entrar" value={o.residentsPending} accent={o.residentsPending ? "#7d80d9" : undefined} />
        <Stat label="Lugares" value={o.places} />
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
/**
 * La llave recién creada. En persona: el vecino escanea el QR con su cámara y
 * entra al instante. A distancia: se manda por WhatsApp. Es de un solo uso.
 */
function KeyBox({ k, me, onDone }: { k: AccessKey; me: string; onDone: () => void }) {
  const link = keyLink(k.token);
  const first = k.name.split(" ")[0];
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void QRCode.toString(link, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b0d1f", light: "#ffffff" },
    }).then((s) => alive && setSvg(s));
    return () => {
      alive = false;
    };
  }, [link]);
  return (
    <div className="mb-4 rounded-2xl border border-primary/50 bg-primary/10 p-4 text-sm">
      <p className="text-lg font-black">Listo: {k.name}</p>
      <p className="mb-3 text-xs text-muted">Que lo escanee con la cámara de su teléfono. Entra directo, sin códigos.</p>
      {svg && (
        <div
          className="mx-auto mb-3 w-full max-w-[260px] rounded-2xl bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
          role="img"
          aria-label={`QR de acceso de ${k.name}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      <p className="mb-3 text-center text-xs text-muted">Funciona una sola vez, en el primer teléfono que la abra.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <a
          href={whatsappLink(k.phone, `Hola ${first}, soy ${me}, de OrbiTú Villas. Este es tu acceso personal. Ábrelo en tu teléfono; funciona una sola vez, así que no lo reenvíes: ${link}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 font-bold text-[#0b3d1f]"
        >
          <MessageCircle size={16} /> Mejor por WhatsApp
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

/** Alta directa: nombre y WhatsApp de alguien que ya conociste. Sale aprobado y con su QR. */
function QuickAdd({ onCreated }: { onCreated: (k: AccessKey) => void }) {
  const [f, setF] = useState({ name: "", phone: "", zone: "" });
  const create = useAdminCreateResident({
    mutation: {
      onSuccess: (k) => {
        setF({ name: "", phone: "", zone: "" });
        onCreated(k);
      },
    },
  });
  const err = create.error as { data?: { message?: string }; message?: string } | null;
  return (
    <form
      className="space-y-2 rounded-2xl border border-primary/40 bg-panel p-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ data: { name: f.name, phone: f.phone, zone: f.zone || null } });
      }}
    >
      <h2 className="flex items-center gap-2 text-base font-black">
        <UserPlus size={18} className="text-primary" /> Dar de alta a un vecino
      </h2>
      <AdminField label="Nombre" required minLength={2} maxLength={80} autoComplete="off" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <AdminField label="WhatsApp (10 dígitos)" required inputMode="tel" autoComplete="off" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <AdminField label="Privada (opcional)" maxLength={80} value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} />
      </div>
      {err && <p className="text-sm text-alert">{err.data?.message ?? err.message}</p>}
      <button disabled={create.isPending} className="w-full rounded-xl bg-primary py-3 font-bold text-space">
        {create.isPending ? "Creando…" : "Dar de alta y mostrar QR"}
      </button>
    </form>
  );
}

function Residents({ me }: { me: string }) {
  const qc = useQueryClient();
  const { data: residents } = useAdminListResidents();
  const [key, setKey] = useState<AccessKey | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: getAdminListResidentsQueryKey() });
    void qc.invalidateQueries({ queryKey: getAdminOverviewQueryKey() });
  };
  const approve = useAdminApproveResident({ mutation: { onSuccess: (k) => (setKey(k), refresh()) } });
  const regen = useAdminRegenerateKey({ mutation: { onSuccess: (k) => setKey(k) } });
  const block = useAdminBlockResident({ mutation: { onSuccess: refresh } });
  const [editingId, setEditingId] = useState<string | null>(null);
  const remove = useAdminDeleteResident({
    mutation: {
      onSuccess: () => {
        refresh();
        void qc.invalidateQueries({ queryKey: getAdminListVisitsQueryKey() });
      },
    },
  });
  const pending = residents?.filter((r) => r.status === "pending") ?? [];

  return (
    <div className="space-y-8">
      {key && <KeyBox k={key} me={me} onDone={() => setKey(null)} />}

      {!key && <QuickAdd onCreated={(k) => (setKey(k), refresh())} />}

      {pending.length > 0 && (
        <p className="rounded-xl bg-[#E6C882]/10 px-3 py-2 text-sm text-casas">
          {pending.length} {pending.length === 1 ? "persona pidió" : "personas pidieron"} entrar. Cuando la conozcas, toca «Ya lo conocí · aprobar» y enséñale el QR.
        </p>
      )}


      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-muted">Vecinos</h2>
        {!residents ? (
          <Loading />
        ) : (
          <ul className="space-y-2">
            {[...residents].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending")).map((r) => (
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
                {r.status === "approved" && <KeyStatus r={r} />}
                {editingId === r.id && <ResidentEdit r={r} onDone={() => (setEditingId(null), refresh())} />}
                {r.role === "admin" && (
                  <div className="mt-3">
                    <button onClick={() => regen.mutate({ id: r.id })} className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold">
                      Nuevo acceso para mí (otro teléfono o computadora)
                    </button>
                    <button onClick={() => setEditingId(editingId === r.id ? null : r.id)} className="ml-2 rounded-full px-3 py-1.5 text-xs text-muted">
                      Editar
                    </button>
                  </div>
                )}
                {r.role !== "admin" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status === "pending" && (
                      <button onClick={() => approve.mutate({ id: r.id })} className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-space">
                        Ya lo conocí · aprobar
                      </button>
                    )}
                    {r.status === "approved" && (
                      <button onClick={() => regen.mutate({ id: r.id })} className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold">
                        Nuevo acceso
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
                    <a href={whatsappLink(r.phone, `Hola ${r.name.split(" ")[0]}, soy ${me}, de OrbiTú Villas.`)} target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1.5 text-xs text-confianza">
                      WhatsApp
                    </a>
                    <button onClick={() => setEditingId(editingId === r.id ? null : r.id)} className="rounded-full px-3 py-1.5 text-xs text-muted">
                      Editar
                    </button>
                    <button
                      disabled={remove.isPending}
                      onClick={() =>
                        confirm(
                          `¿Borrar a ${r.name} para siempre? Se borran también sus visitas, recomendaciones, quejas y búsquedas. Para alguien real que ya no debe entrar, mejor usa "Bloquear".`,
                        ) && remove.mutate({ id: r.id })
                      }
                      className="rounded-full px-3 py-1.5 text-xs text-alert/70"
                    >
                      Borrar
                    </button>
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

/** Estado de la llave: sin abrir, abierta, o alguien intentó reusarla. */
function KeyStatus({ r }: { r: AdminResident }) {
  const text =
    r.keyStatus === "none"
      ? "Sin acceso vigente"
      : r.keyStatus === "unused"
        ? "Acceso creado · aún sin abrir"
        : `Entró el ${fmtDate(r.keyUsedAt!)}`;
  return (
    <div className="mt-2 space-y-1 text-xs">
      <p className={r.keyStatus === "unused" ? "text-casas" : "text-muted"}>{text}</p>
      {r.keyRejectedAttempts > 0 && (
        <p className="rounded-lg bg-alert/15 px-2 py-1 text-alert">
          ⚠ Alguien intentó usar su acceso ya usado {r.keyRejectedAttempts} {r.keyRejectedAttempts === 1 ? "vez" : "veces"}. Puede que la haya reenviado. Escríbele y, si hace falta, genera una nueva.
        </p>
      )}
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
  constellation: "",
  name: "",
  category: "",
  description: "",
  contactName: null,
  whatsapp: "",
  zone: null,
  lat: null,
  lng: null,
  operation: null,
  priceLabel: null,
  imageUrl: null,
  welcomeOffer: null,
  kind: "comercio",
  delivers: false,
  pickup: false,
  directContact: false,
  hours: null,
  landM2: null,
  builtM2: null,
  bedrooms: null,
  bathrooms: null,
  parking: null,
  verified: true,
  active: true,
};

function Places({ editId }: { editId: string | null }) {
  const qc = useQueryClient();
  const { data: places } = useAdminListPlaces();
  const { data: cons } = useAdminListConstellations();
  const consMap = new Map((cons ?? []).map((c) => [c.id, c]));
  const [editing, setEditing] = useState<{ id: string | null; form: PlaceInput } | null>(null);
  const openedFromCard = useRef(false);
  useEffect(() => {
    if (!editId || openedFromCard.current || !places) return;
    const p = places.find((x) => x.id === editId);
    if (p) {
      openedFromCard.current = true;
      setEditing({ id: p.id, form: toInput(p) });
    }
  }, [editId, places]);
  const [filter, setFilter] = useState("");
  const done = () => {
    setEditing(null);
    setJustCreated(false);
    void qc.invalidateQueries({ queryKey: getAdminListPlacesQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetUniverseQueryKey() });
  };
  const [justCreated, setJustCreated] = useState(false);
  const create = useAdminCreatePlace({
    mutation: {
      // Se queda abierta para poder subir fotos a la estrella recién creada.
      onSuccess: (p) => {
        setEditing({ id: p.id, form: toInput(p) });
        setJustCreated(true);
        void qc.invalidateQueries({ queryKey: getAdminListPlacesQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetUniverseQueryKey() });
      },
    },
  });
  const update = useAdminUpdatePlace({ mutation: { onSuccess: done } });
  const remove = useAdminDeletePlace({ mutation: { onSuccess: done } });
  const error = create.error ?? update.error ?? remove.error;

  if (editing) {
    const f = editing.form;
    const current = cons?.find((c) => c.id === f.constellation);
    const set = <K extends keyof PlaceInput>(k: K, v: PlaceInput[K]) =>
      setEditing({ ...editing, form: { ...f, [k]: v } });
    const txt = (k: "name" | "category" | "description" | "whatsapp") => ({
      value: f[k],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value),
    });
    const opt = (k: "contactName" | "zone" | "priceLabel" | "imageUrl" | "welcomeOffer") => ({
      value: f[k] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value || null),
    });
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.constellation) return alert("Elige una categoría.");
          if (editing.id) update.mutate({ id: editing.id, data: f });
          else create.mutate({ data: f });
        }}
      >
        <h2 className="text-lg font-black">{editing.id ? "Editar lugar" : "Nuevo lugar"}</h2>
        <AdminField label="Nombre" required minLength={2} maxLength={80} {...txt("name")} />
        <AdminField label="Giro u oficio (Plomería, Tacos, Casa en renta…)" required minLength={2} maxLength={60} {...txt("category")} />
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-muted">Descripción detallada</span>
          <span className="mb-1.5 block text-xs text-ai">
            Entre más detalle, mejor match. Incluye: qué hace exactamente, horarios, si va a domicilio, zonas, precios aproximados, garantías, cómo se le contacta mejor.
          </span>
          <textarea rows={6} maxLength={1500} {...txt("description")} className="w-full rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm outline-none focus:border-primary" />
          <span className={`block text-right text-[11px] ${f.description.length < 120 ? "text-casas" : "text-muted"}`}>
            {f.description.length < 120 ? `Corta para un buen match (${f.description.length}/120 mínimo sugerido)` : `${f.description.length}/1500`}
          </span>
        </label>
        <ConstellationPicker
          list={cons ?? []}
          value={f.constellation}
          onChange={(c) => set("constellation", c)}
        />
        <SuggestBox
          place={{ name: f.name, category: f.category, description: f.description }}
          list={cons ?? []}
          onApply={(c, cat) =>
            setEditing({ ...editing, form: { ...f, constellation: c, category: cat ?? f.category } })
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <AdminField label="WhatsApp (10 dígitos)" required inputMode="tel" {...txt("whatsapp")} />
          <AdminField label="Quién atiende" maxLength={80} {...opt("contactName")} />
        </div>
        <AdminField label="Zona o privada" maxLength={80} {...opt("zone")} />
        {!(f.kind === "oficio" && !current?.isProperty) && (
          <LocationField
            lat={f.lat ?? null}
            lng={f.lng ?? null}
            onChange={(lat, lng) => setEditing({ ...editing, form: { ...f, lat, lng } })}
          />
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-muted">Regalo de bienvenida (primera visita con credencial)</span>
          <input
            maxLength={80}
            placeholder="Primer café 2x1 · 10% en tu primera compra"
            {...opt("welcomeOffer")}
            className="w-full rounded-xl border border-[#E6C882]/40 bg-space-2 px-3 py-2 text-sm outline-none focus:border-[#E6C882]"
          />
          <span className="mt-1 block text-[11px] text-muted">
            Lo paga el comercio a cambio de un cliente nuevo. Se aplica solo la primera vez que escanea a cada vecino. Vacío = sin regalo.
          </span>
        </label>
        <AdminField
          label={current?.isProperty ? "Precio" : "Precio o rango (opcional)"}
          placeholder={current?.isProperty ? "$3.2 M · $14,500 / mes" : "Desde $95 · $28 el kilo · Visita $300"}
          maxLength={60}
          {...opt("priceLabel")}
        />
        {current?.isProperty ? (
          <>
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
            <label className="flex items-start gap-2 rounded-xl bg-space-2/60 p-3 text-sm">
              <input type="checkbox" className="mt-0.5 accent-[#7d80d9]" checked={f.directContact} onChange={(e) => set("directContact", e.target.checked)} />
              <span>
                El vendedor acepta que visitantes le escriban directo
                <span className="block text-xs text-muted">Si no, los visitantes te escriben a ti y tú los presentas. Los vecinos siempre le escriben directo.</span>
              </span>
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              <NumField label="Recámaras" value={f.bedrooms} onChange={(v) => set("bedrooms", v)} />
              <NumField label="Baños" step={0.5} value={f.bathrooms} onChange={(v) => set("bathrooms", v)} />
              <NumField label="Autos" value={f.parking} onChange={(v) => set("parking", v)} />
              <NumField label="m² terreno" value={f.landM2} onChange={(v) => set("landM2", v)} />
              <NumField label="m² const." value={f.builtM2} onChange={(v) => set("builtM2", v)} />
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="mb-1 block text-xs font-bold text-muted">¿Cómo atiende?</span>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["comercio", "Comercio", "El vecino va"],
                  ["oficio", "Oficio", "Va a casa del vecino"],
                ] as const).map(([k, t, sub]) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => set("kind", k)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm ${f.kind === k ? "border-primary bg-primary/10" : "border-white/15"}`}
                  >
                    <span className="block font-bold">{t}</span>
                    <span className="block text-xs text-muted">{sub}</span>
                  </button>
                ))}
              </div>
            </div>
            {f.kind === "comercio" && (
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="accent-[#7d80d9]" checked={f.delivers} onChange={(e) => set("delivers", e.target.checked)} />
                  También entrega a domicilio
                </label>
              </div>
            )}
            <HoursEditor value={f.hours} onChange={(h) => set("hours", h)} />
          </>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-[#7d80d9]" checked={f.verified} onChange={(e) => set("verified", e.target.checked)} />
            Lo conozco en persona
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-[#7d80d9]" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
            Visible en la app
          </label>
        </div>
        {editing.id ? (
          <PhotoManager placeId={editing.id} highlight={justCreated} />
        ) : (
          <p className="rounded-xl bg-space-2/60 p-3 text-xs text-muted">Las fotos se agregan después de guardar el lugar.</p>
        )}
        {editing.id && places?.find((x) => x.id === editing.id)?.slug && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 p-3 text-xs">
            <span className="font-bold text-muted">Link público:</span>
            <span className="break-all font-mono">/e/{places.find((x) => x.id === editing.id)!.slug}</span>
            <ShareButton slug={places.find((x) => x.id === editing.id)!.slug!} name={f.name} />
          </div>
        )}
        {editing.id && !current?.isProperty && <AdminNewsBox placeId={editing.id} />}
        {editing.id && <MerchantKeyBox placeId={editing.id} placeName={f.name} whatsapp={f.whatsapp} hasKey={!!places?.find((x) => x.id === editing.id)?.hasMerchantKey} />}
        {error && <p className="text-sm text-alert">Revisa los datos: {(error as Error).message}</p>}
        <div className="flex gap-2 pt-2">
          <button disabled={create.isPending || update.isPending} className="rounded-xl bg-primary px-5 py-2.5 font-bold text-space">
            Guardar
          </button>
          <button type="button" onClick={() => (setEditing(null), setJustCreated(false))} className="px-4 text-muted">
            {justCreated ? "Listo" : "Cancelar"}
          </button>
          {editing.id && (
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() =>
                confirm(`¿Eliminar «${f.name}» para siempre? Se borran también sus recomendaciones. Si solo quieres ocultarla, desmarca "Visible en la app".`) &&
                remove.mutate({ id: editing.id! })
              }
              className="ml-auto rounded-xl px-4 text-sm font-bold text-alert"
            >
              Eliminar
            </button>
          )}
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
        <button onClick={() => setEditing({ id: null, form: { ...EMPTY, constellation: cons?.[0]?.id ?? "" } })} className="rounded-xl bg-primary px-4 text-sm font-bold text-space">
          + Nuevo
        </button>
      </div>
      <DemoTools places={places ?? []} onChange={done} />
      {!places ? (
        <Loading />
      ) : (
        <ul className="space-y-2">
          {shown.map((p) => (
            <PlaceRow key={p.id} p={p} color={consMap.get(p.constellation)?.color ?? FALLBACK.color} onEdit={() => setEditing({ id: p.id, form: toInput(p) })} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Ubicación para el radar. Lo más fácil: parado en el local, "Usar mi ubicación".
 * También acepta pegar las coordenadas de Google Maps ("20.6767, -101.3563").
 */
function LocationField({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}) {
  const [text, setText] = useState(lat !== null && lng !== null ? `${lat}, ${lng}` : "");
  const [status, setStatus] = useState<string | null>(null);
  const parse = (v: string) => {
    setText(v);
    const m = v.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
    if (!v.trim()) {
      onChange(null, null);
      setStatus(null);
    } else if (m && Math.abs(Number(m[1])) <= 90 && Math.abs(Number(m[2])) <= 180) {
      onChange(Number(m[1]), Number(m[2]));
      setStatus(null);
    } else {
      setStatus("Formato: 20.6767, -101.3563");
    }
  };
  const locate = () => {
    if (!navigator.geolocation) return setStatus("Este teléfono no comparte ubicación.");
    setStatus("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = Math.round(pos.coords.latitude * 1e6) / 1e6;
        const ln = Math.round(pos.coords.longitude * 1e6) / 1e6;
        setText(`${la}, ${ln}`);
        onChange(la, ln);
        setStatus(`Listo · precisión ±${Math.round(pos.coords.accuracy)} m`);
      },
      () => setStatus("No pude obtenerla. Revisa el permiso de ubicación o pega las coordenadas."),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };
  return (
    <div className="block">
      <span className="mb-1 block text-xs font-bold text-muted">Ubicación en el radar</span>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => parse(e.target.value)}
          placeholder="Sin ubicación"
          inputMode="decimal"
          aria-label="Coordenadas"
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button type="button" onClick={locate} className="shrink-0 rounded-xl border border-primary/50 px-3 text-sm font-bold text-primary">
          Usar mi ubicación
        </button>
      </div>
      <span className="mt-1 block text-[11px] text-muted">
        {status ?? "Párate en el local y toca «Usar mi ubicación», o pega las coordenadas de Google Maps. Vacío = no aparece en el radar."}
      </span>
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
  lat: p.lat ?? null,
  lng: p.lng ?? null,
  operation: p.operation,
  priceLabel: p.priceLabel,
  imageUrl: p.imageUrl,
  welcomeOffer: p.welcomeOffer,
  kind: p.kind,
  delivers: p.delivers,
  pickup: p.pickup,
  directContact: p.directContact,
  hours: p.hours,
  landM2: p.landM2,
  builtM2: p.builtM2,
  bedrooms: p.bedrooms,
  bathrooms: p.bathrooms,
  parking: p.parking,
  verified: p.verified,
  active: p.active,
});

/** Cargar o borrar las lugares de ejemplo; las reales nunca se tocan. */
function DemoTools({ places, onChange }: { places: AdminPlace[]; onChange: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const load = useAdminLoadDemoPlaces({
    mutation: {
      onSuccess: (r) => {
        setMsg(
          r.inserted
            ? `Listo: ${r.inserted} lugares de ejemplo. La marca "IA" aparece en unos segundos si OpenAI responde.`
            : `Actualicé ${r.updated ?? 0} ejemplos con descripciones detalladas. La marca "IA" vuelve en unos segundos.`,
        );
        onChange();
      },
    },
  });
  const remove = useAdminRemoveDemoPlaces({
    mutation: {
      onSuccess: (r) => {
        setMsg(`Borradas ${r.removed} lugares de ejemplo.`);
        onChange();
      },
    },
  });
  const demoCount = places.filter((p) => p.isDemo).length;
  return (
    <div className="rounded-2xl border border-casas/30 bg-casas/5 p-3 text-sm">
      <p className="mb-2 text-xs text-muted">
        Datos de ejemplo para probar (casas, oficios, comida, clases y salud) con WhatsApp ficticio: no le escriben a nadie real. Solo se cargan en categorías que existan.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={load.isPending}
          onClick={() => load.mutate()}
          className="rounded-full bg-casas px-4 py-1.5 text-xs font-bold text-space disabled:opacity-50"
        >
          {load.isPending ? "Cargando…" : demoCount > 0 ? "Actualizar ejemplos" : "Cargar ejemplos"}
        </button>
        {demoCount > 0 && (
          <button
            disabled={remove.isPending}
            onClick={() => confirm(`¿Borrar las ${demoCount} lugares de ejemplo? Las reales no se tocan.`) && remove.mutate()}
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

function PlaceRow({ p, color, onEdit }: { p: AdminPlace; color: string; onEdit: () => void }) {
  return (
    <li>
      <button onClick={onEdit} className={`flex w-full items-center gap-3 rounded-2xl bg-panel p-3 text-left ${p.active ? "" : "opacity-50"}`}>
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{p.name}</span>
          <span className="block truncate text-xs text-muted">
            {p.isDemo && <span className="font-bold text-casas">Ejemplo · </span>}
            {p.category} · {p.visitCount} visitas · {p.whatsappClicks} contactos · {p.endorsementCount} ♥{!p.active && " · oculta"}
            {p.welcomeOffer && <span className="text-[#E6C882]"> · regalo</span>}
            {p.hasMerchantKey && <span className="text-confianza"> · comercio</span>}
            {p.leadCount > 0 && <span className="text-[#25D366]"> · {p.leadCount} interesados</span>}
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
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: getAdminListSearchesQueryKey() });
    void qc.invalidateQueries({ queryKey: getAdminOverviewQueryKey() });
  };
  const handled = useAdminMarkSearchHandled({ mutation: { onSuccess: refresh } });
  const del = useAdminDeleteSearch({ mutation: { onSuccess: refresh } });
  const clear = useAdminClearSearches({ mutation: { onSuccess: refresh } });
  if (!data) return <Loading />;
  if (data.length === 0) return <Empty text="Aún no hay búsquedas." />;
  return (
    <div className="space-y-3">
    <div className="flex justify-end">
      <button
        disabled={clear.isPending}
        onClick={() => confirm(`¿Borrar TODAS las búsquedas (${data.length})? Las métricas del resumen arrancan de cero.`) && clear.mutate()}
        className="rounded-full border border-alert/50 px-4 py-1.5 text-xs font-bold text-alert"
      >
        Borrar todas
      </button>
    </div>
    <ul className="space-y-2">
      {data.map((s) => {
        const pending = s.resultCount === 0 && !s.handled;
        return (
          <li key={s.id} className={`relative rounded-2xl p-4 pr-10 text-sm ${pending ? "border border-casas/50 bg-casas/10" : "bg-panel"}`}>
            <button
              aria-label="Borrar búsqueda"
              disabled={del.isPending}
              onClick={() => del.mutate({ id: s.id })}
              className="absolute right-2 top-2 rounded-full px-2 py-1 text-alert/70 hover:bg-white/10"
            >
              ✕
            </button>
            <p className="font-bold">«{s.query}»</p>
            {s.refinedQuery && <p className="text-xs text-ai">IA: {s.refinedQuery}</p>}
            {s.suggestion && (
              <p className="mt-2 rounded-xl bg-space-2/70 px-3 py-2 text-sm">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-casas">Recomendación del vecino</span>
                {s.suggestion}
              </p>
            )}
            <p className="mt-1 text-xs text-muted">
              {s.residentName ?? "Visitante sin acceso"} · {fmtDate(s.createdAt)} · {s.resultCount} {s.resultCount === 1 ? "resultado" : "resultados"}
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
    </div>
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

// ------------------------------------------------------------ constelaciones
function ConstellationPicker({
  list,
  value,
  onChange,
}: {
  list: AdminConstellation[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-bold text-muted">Categoría</span>
      <div className="flex flex-wrap gap-2">
        {list.map((c) => (
          <button
            type="button"
            key={c.id}
            onClick={() => onChange(c.id)}
            className="rounded-xl border px-3 py-2 text-xs font-bold"
            style={{
              borderColor: value === c.id ? c.color : "rgba(255,255,255,.15)",
              color: value === c.id ? c.color : undefined,
              background: value === c.id ? `${c.color}1a` : undefined,
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** La IA propone constelación y giro; el creador decide si lo aplica. */
function SuggestBox({
  place,
  list,
  onApply,
}: {
  place: { name: string; category: string; description: string };
  list: AdminConstellation[];
  onApply: (constellation: string, category: string | null) => void;
}) {
  const suggest = useAdminSuggestConstellation();
  const r = suggest.data;
  const target = r?.constellation ? list.find((c) => c.id === r.constellation) : undefined;
  const ready = place.name.trim().length >= 2 && (place.description.trim().length >= 10 || place.category.trim().length >= 2);
  return (
    <div className="rounded-2xl border border-ai/30 bg-ai/5 p-3 text-sm">
      <button
        type="button"
        disabled={!ready || suggest.isPending}
        onClick={() => suggest.mutate({ data: place })}
        className="rounded-full bg-ai px-4 py-1.5 text-xs font-bold text-space disabled:opacity-40"
      >
        {suggest.isPending ? "Pensando…" : "✨ Sugerir categoría"}
      </button>
      {!ready && <span className="ml-2 text-xs text-muted">Escribe nombre y giro o descripción primero.</span>}
      {r && !r.available && <p className="mt-2 text-xs text-muted">La IA no está disponible ahora. Elige tú la categoría.</p>}
      {r?.available && !target && <p className="mt-2 text-xs text-muted">La IA no supo dónde va. Elige tú la categoría.</p>}
      {r?.available && target && (
        <div className="mt-2 space-y-2">
          <p className="text-xs">
            <span className="font-bold" style={{ color: target.color }}>
              {target.name}
            </span>
            {r.category && <> · giro «{r.category}»</>}
            {r.reason && <span className="text-muted"> — {r.reason}</span>}
          </p>
          <button
            type="button"
            onClick={() => (onApply(target.id, r.category), suggest.reset())}
            className="rounded-full border border-ai/60 px-3 py-1 text-xs font-bold text-ai"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

const EMPTY_CONS: ConstellationInput = { name: "", hint: "", color: PALETTE[0]!.hex, isProperty: false };
const MAX_CONS = 6;

function Constellations() {
  const qc = useQueryClient();
  const { data: list } = useAdminListConstellations();
  const [editing, setEditing] = useState<{ id: string | null; form: ConstellationInput } | null>(null);
  const [removing, setRemoving] = useState<AdminConstellation | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");
  const refresh = () => {
    setEditing(null);
    setRemoving(null);
    void qc.invalidateQueries({ queryKey: getAdminListConstellationsQueryKey() });
    void qc.invalidateQueries({ queryKey: getAdminListPlacesQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetUniverseQueryKey() });
  };
  const create = useAdminCreateConstellation({ mutation: { onSuccess: refresh } });
  const update = useAdminUpdateConstellation({ mutation: { onSuccess: refresh } });
  const remove = useAdminRemoveConstellation({ mutation: { onSuccess: refresh } });
  const reorder = useAdminReorderConstellations({ mutation: { onSuccess: refresh } });
  const error = create.error ?? update.error ?? remove.error ?? reorder.error;

  if (!list) return <Loading />;

  if (editing) {
    const f = editing.form;
    const set = <K extends keyof ConstellationInput>(k: K, v: ConstellationInput[K]) =>
      setEditing({ ...editing, form: { ...f, [k]: v } });
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (editing.id) update.mutate({ cid: editing.id, data: f });
          else create.mutate({ data: f });
        }}
      >
        <h2 className="text-lg font-black">{editing.id ? "Editar categoría" : "Nueva categoría"}</h2>
        <AdminField label="Nombre (corto: se lee en el mapa)" required minLength={2} maxLength={24} value={f.name} onChange={(e) => set("name", e.target.value)} />
        <AdminField label="Pista (qué hay adentro)" maxLength={60} placeholder="Plomería, luz, jardín…" value={f.hint} onChange={(e) => set("hint", e.target.value)} />
        <div>
          <span className="mb-1 block text-xs font-bold text-muted">Color</span>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                type="button"
                key={c.hex}
                onClick={() => set("color", c.hex)}
                aria-label={c.name}
                title={c.name}
                className="h-9 w-9 rounded-full border-2"
                style={{ background: c.hex, borderColor: f.color.toLowerCase() === c.hex.toLowerCase() ? "#eef0ff" : "transparent" }}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted">Azul claro (tú) y morado (IA) están reservados.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-[#7d80d9]" checked={f.isProperty} onChange={(e) => set("isProperty", e.target.checked)} />
          Son inmuebles (activa venta/renta y precio)
        </label>
        {error && <p className="text-sm text-alert">No se pudo: {(error as Error).message}</p>}
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

  const move = (i: number, d: -1 | 1) => {
    const ids = list.map((c) => c.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate({ data: { ids } });
  };
  const full = list.length >= MAX_CONS;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Las categorías agrupan los lugares (Comida, Servicios, Salud…). Tú las decides; la IA solo te sugiere en cuál va cada lugar.
        Máximo {MAX_CONS}, para que el vecino las distinga de un vistazo.
      </p>
      <button
        disabled={full}
        onClick={() => setEditing({ id: null, form: { ...EMPTY_CONS, color: PALETTE[list.length % PALETTE.length]!.hex } })}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-space disabled:opacity-40"
      >
        {full ? `Tienes ${MAX_CONS} (máximo)` : "+ Nueva categoría"}
      </button>
      {error && !editing && <p className="text-sm text-alert">No se pudo: {(error as Error).message}</p>}
      <ul className="space-y-2">
        {list.map((c, i) => (
          <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-panel p-3">
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: c.color }} />
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => setEditing({ id: c.id, form: { name: c.name, hint: c.hint, color: c.color, isProperty: c.isProperty } })}
            >
              <span className="block truncate font-bold">{c.name}</span>
              <span className="block truncate text-xs text-muted">
                {c.starCount} lugares{c.hint && ` · ${c.hint}`}{c.isProperty && " · inmuebles"}
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-1 text-muted">
              <button aria-label="Subir" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} className="rounded-full px-2 py-1 hover:bg-white/10 disabled:opacity-30">
                ↑
              </button>
              <button aria-label="Bajar" disabled={i === list.length - 1 || reorder.isPending} onClick={() => move(i, 1)} className="rounded-full px-2 py-1 hover:bg-white/10 disabled:opacity-30">
                ↓
              </button>
              <button
                aria-label="Eliminar"
                disabled={list.length <= 1}
                onClick={() => {
                  setRemoving(c);
                  setMoveTo(list.find((x) => x.id !== c.id)?.id ?? "");
                }}
                className="rounded-full px-2 py-1 text-alert hover:bg-white/10 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      {removing && (
        <div className="rounded-2xl border border-alert/40 bg-alert/5 p-3 text-sm">
          <p className="font-bold">¿Eliminar «{removing.name}»?</p>
          {removing.starCount > 0 ? (
            <label className="mt-2 block text-xs">
              Sus {removing.starCount} lugares se mueven a:
              <select
                value={moveTo}
                onChange={(e) => setMoveTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm"
              >
                {list
                  .filter((x) => x.id !== removing.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <p className="mt-1 text-xs text-muted">No tiene lugares; se borra sin mover nada.</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              disabled={remove.isPending}
              onClick={() => remove.mutate({ cid: removing.id, data: { moveTo: removing.starCount > 0 ? moveTo : null } })}
              className="rounded-xl bg-alert px-4 py-2 text-xs font-bold text-space"
            >
              Eliminar
            </button>
            <button onClick={() => setRemoving(null)} className="px-3 text-xs text-muted">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Link del modo comercio: se manda por WhatsApp al negocio, una vez. */
function MerchantKeyBox({ placeId, placeName, whatsapp, hasKey }: { placeId: string; placeName: string; whatsapp: string; hasKey: boolean }) {
  const qc = useQueryClient();
  const [link, setLink] = useState<string | null>(null);
  const issue = useAdminIssueMerchantKey({
    mutation: {
      onSuccess: (k) => {
        setLink(`${window.location.origin}${import.meta.env.BASE_URL}comercio/${k.token}`);
        void qc.invalidateQueries({ queryKey: getAdminListPlacesQueryKey() });
      },
    },
  });
  const msg = (l: string) =>
    `Hola, ya estás en OrbiTú Villas como «${placeName}». Abre este link en el celular de tu negocio: ${l}\n\nCuando un vecino te enseñe su credencial, apunta la cámara de tu celular a su código QR y confirma la visita. Así queda registrada su visita y le aplicas tu regalo de bienvenida.`;
  return (
    <div className="rounded-2xl border border-confianza/30 bg-confianza/5 p-3 text-sm">
      <p className="font-bold text-confianza">Modo comercio</p>
      <p className="mb-2 text-xs text-muted">
        {hasKey
          ? "Este comercio ya tiene su link. Generar uno nuevo apaga el anterior en todos sus teléfonos."
          : "Genera su link y mándaselo por WhatsApp. Con él escanea las credenciales de los vecinos, sin instalar nada."}
      </p>
      {!link ? (
        <button
          type="button"
          disabled={issue.isPending}
          onClick={() => (!hasKey || confirm("¿Generar un link nuevo? El anterior dejará de funcionar.")) && issue.mutate({ id: placeId })}
          className="rounded-full bg-confianza px-4 py-1.5 text-xs font-bold text-space"
        >
          {hasKey ? "Generar link nuevo" : "Generar link de comercio"}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="break-all rounded-xl bg-space-2 p-2 font-mono text-[11px]">{link}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={whatsappLink(whatsapp, msg(link))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-[#0b3d1f]"
            >
              <MessageCircle size={14} /> Mandar por WhatsApp
            </a>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(link)} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold">
              <Copy size={14} /> Copiar
            </button>
          </div>
          <p className="text-[11px] text-muted">Se muestra una sola vez. Si se pierde, genera otro.</p>
        </div>
      )}
    </div>
  );
}

function ResidentEdit({ r, onDone }: { r: AdminResident; onDone: () => void }) {
  const [f, setF] = useState({ name: r.name, phone: r.phone.replace(/^52(?=\d{10}$)/, ""), zone: r.zone ?? "" });
  const save = useAdminUpdateResident({ mutation: { onSuccess: onDone } });
  return (
    <form
      className="mt-3 space-y-2 rounded-xl bg-space-2/70 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ id: r.id, data: { name: f.name, phone: f.phone, zone: f.zone || null } });
      }}
    >
      <AdminField label="Nombre" required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <AdminField label="WhatsApp (10 dígitos)" required inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <AdminField label="Privada o sección" maxLength={80} value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} />
      </div>
      {save.isError && <p className="text-xs text-alert">{errorText(save.error, "No se pudo guardar.")}</p>}
      <div className="flex gap-2">
        <button disabled={save.isPending} className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-space">Guardar</button>
        <button type="button" onClick={onDone} className="px-3 text-xs text-muted">Cancelar</button>
      </div>
    </form>
  );
}

const errorText = (err: unknown, fallback: string) =>
  (err as { data?: { message?: string } } | null)?.data?.message ?? fallback;

// ------------------------------------------------------------------ visitas
/** Historial de credenciales escaneadas y regalos dados, con limpieza de pruebas. */
function Visits() {
  const qc = useQueryClient();
  const { data } = useAdminListVisits();
  const [onlyGifts, setOnlyGifts] = useState(false);
  const [place, setPlace] = useState("");
  const [resident, setResident] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: getAdminListVisitsQueryKey() });
    void qc.invalidateQueries({ queryKey: getAdminOverviewQueryKey() });
    void qc.invalidateQueries({ queryKey: getAdminListPlacesQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetMySkyQueryKey() });
  };
  const del = useAdminDeleteVisit({ mutation: { onSuccess: refresh } });
  const clear = useAdminClearVisits({
    mutation: {
      onSuccess: (r) => {
        setMsg(`Borradas ${r.removed} visitas.`);
        refresh();
      },
    },
  });
  if (!data) return <Loading />;

  const places = [...new Map(data.map((v) => [v.placeId, v.placeName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const residents = [...new Map(data.map((v) => [v.residentId, v.residentName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const shown = data.filter(
    (v) => (!onlyGifts || v.welcomeApplied) && (!place || v.placeId === place) && (!resident || v.residentId === resident),
  );
  const gifts = shown.filter((v) => v.welcomeApplied).length;
  const neighbors = new Set(shown.map((v) => v.residentId)).size;
  const shops = new Set(shown.map((v) => v.placeId)).size;
  const scope = resident || place;
  const select = "min-w-0 flex-1 rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Visitas" value={shown.length} />
        <Stat label="Regalos dados" value={gifts} accent="#E6C882" />
        <Stat label="Vecinos" value={neighbors} accent="#6eb5ff" />
        <Stat label="Comercios" value={shops} accent="#50e3c2" />
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={place} onChange={(e) => setPlace(e.target.value)} className={select}>
          <option value="">Todos los comercios</option>
          {places.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <select value={resident} onChange={(e) => setResident(e.target.value)} className={select}>
          <option value="">Todos los vecinos</option>
          {residents.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-[#E6C882]" checked={onlyGifts} onChange={(e) => setOnlyGifts(e.target.checked)} />
        Solo visitas con regalo de bienvenida
      </label>

      {shown.length === 0 ? (
        <Empty text="Aún no hay credenciales escaneadas. Aparecen aquí en cuanto un comercio confirma una visita." />
      ) : (
        <ul className="space-y-2">
          {shown.map((v) => (
            <li key={v.id} className="flex items-start gap-3 rounded-2xl bg-panel p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {v.residentName} <span className="font-normal text-muted">en</span> {v.placeName}
                </p>
                <p className="text-xs text-muted">{fmtDate(v.at)}</p>
                {v.welcomeApplied && <p className="mt-1 text-xs font-bold text-[#E6C882]">Regalo: {v.welcomeOffer}</p>}
              </div>
              <button
                aria-label="Borrar visita"
                disabled={del.isPending}
                onClick={() => confirm("¿Borrar esta visita? Si era la única, ese lugar deja de contar como visitado para el vecino.") && del.mutate({ id: v.id })}
                className="rounded-full px-2 py-1 text-alert/70 hover:bg-white/10"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-alert/30 bg-alert/5 p-3 text-sm">
        <p className="mb-1 font-bold text-alert">Limpiar pruebas</p>
        <p className="mb-2 text-xs text-muted">
          {scope
            ? "Borra las visitas del filtro elegido (comercio y/o vecino). Si borras la primera visita de un vecino, el regalo se le vuelve a ofrecer."
            : "Sin filtro borra TODAS las visitas. Úsalo solo mientras pruebas, antes de arrancar con vecinos reales."}
        </p>
        <button
          disabled={clear.isPending}
          onClick={() => {
            const label = scope ? `las visitas filtradas` : `TODAS las visitas (${data.length})`;
            if (confirm(`¿Borrar ${label}? No se puede deshacer.`))
              clear.mutate({ data: { residentId: resident || null, placeId: place || null } });
          }}
          className="rounded-full border border-alert/50 px-4 py-1.5 text-xs font-bold text-alert"
        >
          {scope ? "Borrar visitas del filtro" : "Borrar todas las visitas"}
        </button>
        {msg && <p className="mt-2 text-xs">{msg}</p>}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, step = 1 }: { label: string; value: number | null; onChange: (v: number | null) => void; step?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full rounded-xl border border-white/15 bg-space-2 px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Horario por día (lunes primero). Con él la tarjeta dice "Abierto · cierra 13:00". */
function HoursEditor({ value, onChange }: { value: PlaceInput["hours"]; onChange: (h: PlaceInput["hours"]) => void }) {
  const week = value ?? [null, null, null, null, null, null, null];
  const setDay = (d: number, v: { open: string; close: string } | null) => {
    const next = [...week];
    next[d] = v;
    onChange(next.some(Boolean) ? next : null);
  };
  const copyMonday = () => {
    const mon = week[1];
    if (!mon) return;
    onChange(week.map((d, i) => (i >= 1 && i <= 5 ? { ...mon } : d)));
  };
  // Ancho flexible: en celulares con reloj de 12 h el campo muestra "6:00 p.m." completo.
  const time = "time-field min-w-0 flex-1 rounded-lg border border-white/15 bg-space-2 px-1.5 py-1.5 text-sm";
  return (
    <div className="rounded-2xl border border-white/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted">Horario (opcional)</span>
        {week[1] && (
          <button type="button" onClick={copyMonday} className="text-xs font-bold text-primary">
            Copiar lunes a toda la semana
          </button>
        )}
      </div>
      <ul className="space-y-1.5">
        {DAYS_ORDER.map((d) => {
          const h = week[d];
          return (
            <li key={d} className="flex items-center gap-2 text-sm">
              <label className="flex w-16 shrink-0 items-center gap-1.5">
                <input
                  type="checkbox"
                  className="accent-[#7d80d9]"
                  checked={!!h}
                  onChange={(e) => setDay(d, e.target.checked ? { open: "09:00", close: "18:00" } : null)}
                />
                {DAY_NAMES[d]}
              </label>
              {h ? (
                <>
                  <input type="time" className={time} value={h.open} onChange={(e) => setDay(d, { ...h, open: e.target.value })} />
                  <span className="text-muted">a</span>
                  <input type="time" className={time} value={h.close === "24:00" ? "00:00" : h.close} onChange={(e) => setDay(d, { ...h, close: e.target.value })} />
                </>
              ) : (
                <span className="text-xs text-muted">Cerrado</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-muted">Si cierra después de medianoche, pon la hora de cierre del día siguiente (ej. 19:00 a 02:00).</p>
    </div>
  );
}

function PhotoManager({ placeId, highlight }: { placeId: string; highlight: boolean }) {
  const qc = useQueryClient();
  const { data: places } = useAdminListPlaces();
  const photos = places?.find((p) => p.id === placeId)?.photos ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: getAdminListPlacesQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetUniverseQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetPlaceQueryKey(placeId) });
  };
  const del = useAdminDeletePhoto({ mutation: { onSuccess: refresh } });
  const reorder = useAdminReorderPhotos({ mutation: { onSuccess: refresh } });
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    const room = 5 - photos.length;
    const list = Array.from(files).slice(0, room);
    try {
      for (const [i, file] of list.entries()) {
        setBusy(`Subiendo ${i + 1} de ${list.length}…`);
        await uploadPhoto(`/api/admin/places/${placeId}/photos`, await shrinkPhoto(file));
      }
      if (files.length > room) setErr(`Solo caben 5 fotos; subí ${list.length}.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
      refresh();
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className={`rounded-2xl border p-3 ${highlight ? "border-primary bg-primary/5" : "border-white/10"}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-muted">Fotos ({photos.length}/5) · la primera es la portada</span>
      </div>
      {highlight && photos.length === 0 && <p className="mb-2 text-sm">Guardada. Ahora agrega fotos: con foto, la gente confía más y contacta más.</p>}
      <div className="flex flex-wrap gap-2">
        {photos.map((ph, i) => (
          <div key={ph.id} className="relative">
            <img src={`${base}${ph.url}`} alt="" className={`h-20 w-20 rounded-xl object-cover ${i === 0 ? "ring-2 ring-primary" : ""}`} />
            <button
              type="button"
              aria-label="Borrar foto"
              onClick={() => confirm("¿Borrar esta foto?") && del.mutate({ id: ph.id })}
              className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-space text-xs text-alert shadow"
            >
              ✕
            </button>
            {i > 0 && (
              <button
                type="button"
                onClick={() => reorder.mutate({ id: placeId, data: { ids: [ph.id, ...photos.filter((x) => x.id !== ph.id).map((x) => x.id)] } })}
                className="absolute inset-x-0 bottom-0 rounded-b-xl bg-black/60 py-0.5 text-[10px] font-bold"
              >
                Portada
              </button>
            )}
          </div>
        ))}
        {photos.length < 5 && (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => input.current?.click()}
            className="grid h-20 w-20 place-items-center rounded-xl border border-dashed border-white/30 text-center text-xs text-muted"
          >
            {busy ?? "+ Foto"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files)} />
      {err && <p className="mt-2 text-xs text-alert">{err}</p>}
    </div>
  );
}

/** El creador también puede publicar la novedad del día por el comercio. */
function AdminNewsBox({ placeId }: { placeId: string }) {
  const qc = useQueryClient();
  const { data } = useAdminListNews();
  const current = data?.find((n) => n.placeId === placeId) ?? null;
  return (
    <NewsComposer
      current={current}
      publish={(text) => adminPublishNews(placeId, { text })}
      photoPath={(id) => `/api/admin/news/${id}/photo`}
      remove={() => (current ? adminRemoveNews(current.id) : Promise.resolve())}
      onChange={() => {
        void qc.invalidateQueries({ queryKey: getAdminListNewsQueryKey() });
        void qc.invalidateQueries({ queryKey: getListNewsQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetUniverseQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetPlaceQueryKey(placeId) });
      }}
    />
  );
}

// -------------------------------------------------------------- interesados
/** Gente de fuera que contactó una casa o un link público: el dato que vale para el anunciante. */
function Leads() {
  const qc = useQueryClient();
  const { data } = useAdminListLeads();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: getAdminListLeadsQueryKey() });
    void qc.invalidateQueries({ queryKey: getAdminListPlacesQueryKey() });
  };
  const del = useAdminDeleteLead({ mutation: { onSuccess: refresh } });
  const clear = useAdminClearLeads({ mutation: { onSuccess: refresh } });
  if (!data) return <Loading />;
  const byPlace = [...data.reduce((m, l) => m.set(l.placeName, (m.get(l.placeName) ?? 0) + 1), new Map<string, number>())].sort(
    (a, b) => b[1] - a[1],
  );
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Personas que no son vecinas y escribieron por WhatsApp a una casa (con su nombre) o desde el link público de un lugar.
        Es la prueba que le enseñas a un vendedor o comercio de que OrbiTú Villas le trae clientes.
      </p>
      {byPlace.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byPlace.slice(0, 8).map(([n, c]) => (
            <span key={n} className="rounded-full bg-panel px-3 py-1 text-xs">
              {n} · <b>{c}</b>
            </span>
          ))}
        </div>
      )}
      {data.length === 0 ? (
        <Empty text="Aún no hay interesados. Aparecen cuando alguien de fuera escribe a una casa o desde un link compartido." />
      ) : (
        <ul className="space-y-2">
          {data.map((l) => (
            <li key={l.id} className="flex items-start gap-3 rounded-2xl bg-panel p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {l.name ?? "Sin nombre"} <span className="font-normal text-muted">→</span> {l.placeName}
                </p>
                <p className="text-xs text-muted">
                  {l.source === "casa" ? "Casa" : "Link compartido"} · {fmtDate(l.createdAt)}
                  {l.via === "creador" ? (
                    <span className="font-bold text-[#E6C882]"> · te escribió a ti: preséntalo</span>
                  ) : (
                    <span> · escribió directo al vendedor</span>
                  )}
                </p>
              </div>
              {l.phone && (
                <a href={whatsappLink(l.phone, `Hola ${l.name ?? ""}, soy de la guía de Villas.`)} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full bg-[#25D366] px-3 py-1 text-xs font-bold text-[#0b3d1f]">
                  WhatsApp
                </a>
              )}
              <button aria-label="Borrar" onClick={() => del.mutate({ id: l.id })} className="rounded-full px-2 py-1 text-alert/70">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {data.length > 0 && (
        <button
          onClick={() => confirm(`¿Borrar los ${data.length} interesados? Úsalo solo para limpiar pruebas.`) && clear.mutate()}
          className="rounded-full border border-alert/50 px-4 py-1.5 text-xs font-bold text-alert"
        >
          Borrar todos (pruebas)
        </button>
      )}
    </div>
  );
}

const Loading = () => <p className="text-sm text-muted">Cargando…</p>;
const Empty = ({ text }: { text: string }) => <p className="text-sm text-muted">{text}</p>;
