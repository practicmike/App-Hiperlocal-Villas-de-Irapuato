/**
 * KPIs de impacto de OrbiTú: últimos 30 días contra los 30 anteriores.
 *
 * Todo sale de datos que la app ya registra (búsquedas, toques de WhatsApp y
 * «Cómo llegar», visitas con credencial, pases, interesados). Las metas son
 * hipótesis iniciales para Villas, no verdades: se ajustan aquí cuando haya
 * historia real.
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { config } from "./config";
import { DEMO_WHATSAPP_PREFIX } from "./demo-places";

const DAY = 86_400_000;
const WINDOW_DAYS = 30;

type Status = "good" | "warn" | "bad" | "none";
type Trend = "up" | "down" | "flat" | "none";

export interface Kpi {
  id: string;
  label: string;
  display: string;
  detail: string | null;
  targetLabel: string | null;
  status: Status;
  trend: Trend;
  trendGood: boolean | null;
  previousDisplay: string | null;
  why: string;
}

export interface KpiSection {
  id: string;
  title: string;
  question: string;
  kpis: Kpi[];
  note: string | null;
}

interface WindowStats {
  residents: number;
  active: number;
  searches: number;
  empty: number;
  contacted: number;
  avgMatch: number | null;
  whatsapp: number;
  directions: number;
  visits: number;
  visitsPass: number;
  visitsWelcome: number;
  passesIssued: number;
  passesRedeemed: number;
  passesAlive: number;
  leads: number;
  leadsCreator: number;
  commerces: number;
  covered: number;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const pct = (part: number, whole: number): number | null => (whole > 0 ? (part / whole) * 100 : null);

/** Lugares que cuentan como negocio: activos, no demo, no casas/depas. */
const commerceCte = sql`
  commerce as (
    select p.id, p.name
    from places p
    join constellations c on c.id = p.constellation
    where p.active and not c.is_property and p.whatsapp not like ${DEMO_WHATSAPP_PREFIX + "%"}
  )`;

/** Vecinos (no el creador) con alguna acción en la ventana. */
const activeCte = (since: Date, until: Date) => sql`
  active_res as (
    select a.resident_id from (
      select resident_id from searches where resident_id is not null and created_at >= ${since} and created_at < ${until}
      union select resident_id from visits where created_at >= ${since} and created_at < ${until}
      union select resident_id from contact_events where resident_id is not null and created_at >= ${since} and created_at < ${until}
      union select resident_id from saved_places where created_at >= ${since} and created_at < ${until}
    ) a
    join residents r on r.id = a.resident_id
    where r.role = 'resident'
  )`;

async function windowStats(since: Date, until: Date): Promise<WindowStats> {
  const inWindow = (col: string) => sql.raw(`${col} >= '${since.toISOString()}' and ${col} < '${until.toISOString()}'`);
  const { rows } = await db.execute(sql`
    with ${commerceCte}, ${activeCte(since, until)}
    select
      (select count(*) from residents
        where role = 'resident' and status = 'approved'
          and coalesce(approved_at, created_at) < ${until}) as residents,
      (select count(*) from active_res) as active,
      (select count(*) from searches where resident_id is not null and ${inWindow("created_at")}) as searches,
      (select count(*) from searches where resident_id is not null and result_count = 0 and ${inWindow("created_at")}) as empty,
      (select count(*) from searches where resident_id is not null and contacted_place_id is not null and ${inWindow("created_at")}) as contacted,
      (select avg(top_score) from searches where resident_id is not null and result_count > 0 and ${inWindow("created_at")}) as avg_match,
      (select count(*) from contact_events where kind = 'whatsapp' and ${inWindow("created_at")}) as whatsapp,
      (select count(*) from contact_events where kind = 'directions' and ${inWindow("created_at")}) as directions,
      (select count(*) from visits where ${inWindow("created_at")}) as visits,
      (select count(*) from visits v where ${inWindow("v.created_at")}
        and exists (select 1 from passes ps where ps.redeemed_visit_id = v.id)) as visits_pass,
      (select count(*) from visits where welcome_applied and ${inWindow("created_at")}) as visits_welcome,
      (select count(*) from passes where ${inWindow("created_at")}) as passes_issued,
      (select count(*) from passes where redeemed_at is not null and ${inWindow("created_at")}) as passes_redeemed,
      (select count(*) from passes where redeemed_at is null and expires_at > now() and ${inWindow("created_at")}) as passes_alive,
      (select count(*) from leads where ${inWindow("created_at")}) as leads,
      (select count(*) from leads where via = 'creador' and ${inWindow("created_at")}) as leads_creator,
      (select count(*) from commerce) as commerces,
      (select count(*) from commerce c where
        exists (select 1 from contact_events e where e.place_id = c.id and ${inWindow("e.created_at")})
        or exists (select 1 from visits v where v.place_id = c.id and ${inWindow("v.created_at")})
        or exists (select 1 from searches s where s.contacted_place_id = c.id and ${inWindow("s.created_at")})
      ) as covered
  `);
  const r = rows[0] as Record<string, unknown>;
  return {
    residents: num(r["residents"]),
    active: num(r["active"]),
    searches: num(r["searches"]),
    empty: num(r["empty"]),
    contacted: num(r["contacted"]),
    avgMatch: r["avg_match"] == null ? null : Number(r["avg_match"]) * 100,
    whatsapp: num(r["whatsapp"]),
    directions: num(r["directions"]),
    visits: num(r["visits"]),
    visitsPass: num(r["visits_pass"]),
    visitsWelcome: num(r["visits_welcome"]),
    passesIssued: num(r["passes_issued"]),
    passesRedeemed: num(r["passes_redeemed"]),
    passesAlive: num(r["passes_alive"]),
    leads: num(r["leads"]),
    leadsCreator: num(r["leads_creator"]),
    commerces: num(r["commerces"]),
    covered: num(r["covered"]),
  };
}

/** % de pases que se lleva el 20% de negocios que más recibe (equidad de «Te lo paso»). */
export function topShare(counts: number[]): number | null {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0 || counts.length === 0) return null;
  const sorted = [...counts].sort((a, b) => b - a);
  const top = Math.max(1, Math.ceil(sorted.length * 0.2));
  return (sorted.slice(0, top).reduce((a, b) => a + b, 0) / total) * 100;
}

async function passesShare(since: Date, until: Date): Promise<number | null> {
  const { rows } = await db.execute(sql`
    with ${commerceCte}
    select (select count(*) from passes ps where ps.to_place_id = c.id
      and ps.created_at >= ${since} and ps.created_at < ${until}) as n
    from commerce c
  `);
  return topShare((rows as Array<Record<string, unknown>>).map((r) => num(r["n"])));
}

async function currentExtras(now: Date) {
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY);
  const cohortFrom = new Date(now.getTime() - 90 * DAY);
  const { rows } = await db.execute(sql`
    with ${commerceCte}, ${activeCte(since, now)},
    cohort as (
      select id from residents
      where role = 'resident' and status = 'approved'
        and coalesce(approved_at, created_at) >= ${cohortFrom}
        and coalesce(approved_at, created_at) < ${since}
    )
    select
      (select count(*) from cohort) as cohort,
      (select count(*) from cohort c join active_res a on a.resident_id = c.id) as cohort_active,
      (select count(*) from places p join constellations k on k.id = p.constellation
        where p.active and k.is_property and p.whatsapp not like ${DEMO_WHATSAPP_PREFIX + "%"}) as properties,
      (select coalesce(json_agg(c.name order by c.name), '[]'::json) from commerce c where
        not exists (select 1 from contact_events e where e.place_id = c.id and e.created_at >= ${since})
        and not exists (select 1 from visits v where v.place_id = c.id and v.created_at >= ${since})
        and not exists (select 1 from searches s where s.contacted_place_id = c.id and s.created_at >= ${since})
      ) as idle
  `);
  const r = rows[0] as Record<string, unknown>;
  const idleRaw = r["idle"];
  const idle = (typeof idleRaw === "string" ? JSON.parse(idleRaw) : idleRaw) as string[];
  return {
    cohort: num(r["cohort"]),
    cohortActive: num(r["cohort_active"]),
    properties: num(r["properties"]),
    idle,
  };
}

// ------------------------------------------------------------------ armado

const fmtPct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);
const fmtNum = (v: number | null) => (v == null ? "—" : Math.round(v).toLocaleString("es-MX"));
const fmtMoney = (v: number) => `$${Math.round(v).toLocaleString("es-MX")}`;

/** Semáforo contra la meta. warnAt = umbral de «casi». */
export function statusFor(value: number | null, good: number, warnAt: number, higherIsBetter = true): Status {
  if (value == null) return "none";
  if (higherIsBetter) return value >= good ? "good" : value >= warnAt ? "warn" : "bad";
  return value <= good ? "good" : value <= warnAt ? "warn" : "bad";
}

export function trendFor(cur: number | null, prev: number | null, higherIsBetter = true): { trend: Trend; trendGood: boolean | null } {
  if (cur == null || prev == null) return { trend: "none", trendGood: null };
  const diff = cur - prev;
  if (diff === 0) return { trend: "flat", trendGood: null };
  const up = diff > 0;
  return { trend: up ? "up" : "down", trendGood: up === higherIsBetter };
}

function kpi(o: {
  id: string;
  label: string;
  cur: number | null;
  prev?: number | null;
  fmt: (v: number | null) => string;
  why: string;
  detail?: string | null;
  target?: { label: string; good: number; warnAt: number };
  higherIsBetter?: boolean;
}): Kpi {
  const hib = o.higherIsBetter ?? true;
  // Si a simple vista el número es el mismo, la flecha también dice «igual».
  const t =
    o.prev === undefined
      ? { trend: "none" as Trend, trendGood: null }
      : o.prev != null && o.fmt(o.cur) === o.fmt(o.prev)
        ? { trend: "flat" as Trend, trendGood: null }
        : trendFor(o.cur, o.prev, hib);
  return {
    id: o.id,
    label: o.label,
    display: o.fmt(o.cur),
    detail: o.detail ?? null,
    targetLabel: o.target?.label ?? null,
    status: o.target ? statusFor(o.cur, o.target.good, o.target.warnAt, hib) : "none",
    trend: t.trend,
    trendGood: t.trendGood,
    previousDisplay: o.prev === undefined ? null : o.fmt(o.prev),
    why: o.why,
  };
}

export async function buildKpis(now = new Date()) {
  const { households, avgTicket } = config.kpis;
  const curFrom = new Date(now.getTime() - WINDOW_DAYS * DAY);
  const prevFrom = new Date(now.getTime() - 2 * WINDOW_DAYS * DAY);
  // Una conexión por instancia en Vercel: consultas en serie, no en paralelo.
  const c = await windowStats(curFrom, now);
  const p = await windowStats(prevFrom, curFrom);
  const shareCur = await passesShare(curFrom, now);
  const sharePrev = await passesShare(prevFrom, curFrom);
  const x = await currentExtras(now);
  const weeks = WINDOW_DAYS / 7;

  const sections: KpiSection[] = [
    {
      id: "norte",
      title: "Estrella del norte",
      question: "¿OrbiTú está generando clientes reales?",
      note: "Cada visita es una credencial escaneada en un negocio: prueba de que el vecino llegó. Es lo único que no se puede confundir con una recomendación de WhatsApp.",
      kpis: [
        kpi({
          id: "conexiones",
          label: "Conexiones confirmadas",
          cur: c.visits,
          prev: p.visits,
          fmt: fmtNum,
          detail: `${c.visitsPass} con pase · ${c.visitsWelcome} con regalo de bienvenida`,
          target: { label: "Meta inicial: 50 al mes", good: 50, warnAt: 25 },
          why: "Visitas en negocio con credencial escaneada. Si sube, OrbiTú genera tráfico real.",
        }),
      ],
    },
    {
      id: "adopcion",
      title: "Adopción",
      question: "¿Llegamos a los hogares de Villas?",
      note: `Penetración calculada sobre ${households.toLocaleString("es-MX")} hogares (estimado). Ajústalo con la variable HOGARES_VILLAS en Vercel.`,
      kpis: [
        kpi({
          id: "penetracion",
          label: "Penetración",
          cur: (c.residents / households) * 100,
          prev: (p.residents / households) * 100,
          fmt: fmtPct,
          detail: `${c.residents} vecinos con acceso`,
          target: { label: "Meta: 15%, luego 30%", good: 15, warnAt: 7.5 },
          why: "Cuántos hogares tienen OrbiTú. Sin alcance, nada de lo demás mueve la aguja.",
        }),
        kpi({
          id: "activos",
          label: "Vecinos activos",
          cur: pct(c.active, c.residents),
          prev: pct(p.active, p.residents),
          fmt: fmtPct,
          detail: `${c.active} de ${c.residents} buscaron, guardaron, contactaron o visitaron`,
          target: { label: "Meta: 30% o más", good: 30, warnAt: 15 },
          why: "Instalar no es usar. Mide si OrbiTú ya es un hábito.",
        }),
        kpi({
          id: "retencion",
          label: "Siguen después del primer mes",
          cur: pct(x.cohortActive, x.cohort),
          fmt: fmtPct,
          detail: x.cohort ? `${x.cohortActive} de ${x.cohort} dados de alta hace 1 a 3 meses` : "Aún no hay vecinos con más de un mes",
          target: { label: "Meta: 40% o más", good: 40, warnAt: 20 },
          why: "Si se van al mes, el problema es de valor, no de alcance.",
        }),
      ],
    },
    {
      id: "uso",
      title: "Uso",
      question: "¿Le sirve al vecino lo que encuentra?",
      note: null,
      kpis: [
        kpi({
          id: "busquedas",
          label: "Búsquedas por semana",
          cur: c.searches / weeks,
          prev: p.searches / weeks,
          fmt: fmtNum,
          detail: `${c.searches} en 30 días (sin contar visitantes)`,
          why: "Señal de que el vecino piensa en OrbiTú cuando necesita algo.",
        }),
        kpi({
          id: "sin-resultado",
          label: "Búsquedas sin resultado",
          cur: pct(c.empty, c.searches),
          prev: pct(p.empty, p.searches),
          fmt: fmtPct,
          detail: `${c.empty} de ${c.searches} · revísalas en Búsquedas`,
          target: { label: "Meta: 20% o menos", good: 20, warnAt: 35 },
          higherIsBetter: false,
          why: "Lo que falta en Villas. Es tu lista de prospección.",
        }),
        kpi({
          id: "match",
          label: "Match promedio",
          cur: c.avgMatch,
          prev: p.avgMatch,
          fmt: fmtPct,
          detail: "Del mejor resultado de cada búsqueda con resultados",
          target: { label: "Meta: 60% o más", good: 60, warnAt: 45 },
          why: "Si la IA no atina, el vecino vuelve al grupo de WhatsApp.",
        }),
      ],
    },
    {
      id: "conversion",
      title: "Conversión",
      question: "¿El vecino actúa después de buscar?",
      note: "Al salir a WhatsApp se pierde el rastro: esto mide intención, no venta.",
      kpis: [
        kpi({
          id: "contacto",
          label: "Búsquedas que terminan en WhatsApp",
          cur: pct(c.contacted, c.searches),
          prev: pct(p.contacted, p.searches),
          fmt: fmtPct,
          detail: `${c.contacted} de ${c.searches}`,
          target: { label: "Meta: 25% o más", good: 25, warnAt: 12 },
          why: "Una búsqueda que no termina en contacto no le dejó nada al negocio.",
        }),
        kpi({
          id: "whatsapp",
          label: "Toques a WhatsApp",
          cur: c.whatsapp,
          prev: p.whatsapp,
          fmt: fmtNum,
          detail: "Desde búsquedas, radar y explorar",
          why: "Intención de compra que OrbiTú le manda a los negocios.",
        }),
        kpi({
          id: "como-llegar",
          label: "Toques a «Cómo llegar»",
          cur: c.directions,
          prev: p.directions,
          fmt: fmtNum,
          why: "La intención más fuerte: el vecino ya va en camino.",
        }),
      ],
    },
    {
      id: "valor",
      title: "Valor real",
      question: "¿Hubo dinero de por medio?",
      note: `Venta estimada = visitas × ticket promedio de ${fmtMoney(avgTicket)} (variable TICKET_PROMEDIO). Es una estimación, no un dato duro.`,
      kpis: [
        kpi({
          id: "pases",
          label: "Pases «Te lo paso» emitidos",
          cur: c.passesIssued,
          prev: p.passesIssued,
          fmt: fmtNum,
          why: "Referencias entre negocios. Clientes referidos valen más y se quedan más.",
        }),
        kpi({
          id: "canje",
          label: "Pases canjeados",
          cur: pct(c.passesRedeemed, c.passesIssued),
          prev: pct(p.passesRedeemed, p.passesIssued),
          fmt: fmtPct,
          detail: `${c.passesRedeemed} de ${c.passesIssued}${c.passesAlive ? ` · ${c.passesAlive} siguen vigentes` : ""}`,
          target: { label: "Meta: 30% o más", good: 30, warnAt: 15 },
          why: "La atribución más dura: el pase se valida en el negocio.",
        }),
        kpi({
          id: "venta",
          label: "Venta estimada",
          cur: c.visits * avgTicket,
          prev: p.visits * avgTicket,
          fmt: (v) => (v == null ? "—" : fmtMoney(v)),
          detail: `${c.visits} visitas × ${fmtMoney(avgTicket)}`,
          why: "El orden de magnitud del impacto en los negocios de Villas.",
        }),
      ],
    },
    {
      id: "negocios",
      title: "Negocios",
      question: "¿A los negocios les conviene quedarse?",
      note: "Sin contar demos ni casas en venta o renta.",
      kpis: [
        kpi({
          id: "cobertura",
          label: "Negocios con movimiento",
          cur: pct(c.covered, c.commerces),
          prev: pct(p.covered, p.commerces),
          fmt: fmtPct,
          detail: `${c.covered} de ${c.commerces} recibieron al menos un contacto o visita`,
          target: { label: "Meta: 60% o más", good: 60, warnAt: 35 },
          why: "Un negocio que no recibe nada en un mes no va a renovar.",
        }),
        kpi({
          id: "equidad",
          label: "Pases en el 20% que más recibe",
          cur: shareCur,
          prev: sharePrev,
          fmt: fmtPct,
          detail: shareCur == null ? "Aún no hay pases en 30 días" : "Cuanto más bajo, más parejo el reparto",
          target: { label: "Meta: 50% o menos", good: 50, warnAt: 70 },
          higherIsBetter: false,
          why: "«Te lo paso» debe llegarle a todos, no solo a los favoritos.",
        }),
      ],
    },
    {
      id: "inmuebles",
      title: "Bienes raíces",
      question: "¿Se mueve la palanca más grande?",
      note: "Los cierres aún no se registran en OrbiTú. Anótalos aparte: una sola venta pesa más que todo lo demás.",
      kpis: [
        kpi({
          id: "interesados",
          label: "Interesados en casas",
          cur: c.leads,
          prev: p.leads,
          fmt: fmtNum,
          detail: `${c.leadsCreator} pasaron por ti · ${c.leads - c.leadsCreator} directo al vendedor`,
          why: "Cada interesado es una posible comisión.",
        }),
        kpi({
          id: "publicadas",
          label: "Casas y depas publicados",
          cur: x.properties,
          fmt: fmtNum,
          why: "Sin inventario no hay interesados.",
        }),
      ],
    },
  ];

  return { households, avgTicket, sections, idlePlaces: x.idle };
}
