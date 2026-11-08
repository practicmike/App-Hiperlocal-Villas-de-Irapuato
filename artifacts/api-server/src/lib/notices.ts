/**
 * Avisos generales: corte de agua, apagón, calle cerrada...
 *
 * Reglas:
 * - Solo el creador publica. Excepción: si 3 vecinos distintos reportan el mismo
 *   tipo en la misma zona en menos de 1 hora, se publica solo como
 *   «Reportado por N vecinos · sin confirmar» (sin el texto de los vecinos).
 * - Cada vecino ve los avisos de toda Villas y los de su privada. «Calle cerrada»
 *   lo ven todos. Un vecino sin privada registrada ve todos.
 * - Los avisos caducan solos.
 */
import { and, desc, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  noticesTable,
  noticeReportsTable,
  type Notice,
  type NoticeKind,
} from "@workspace/db";

export const CONSENSUS_RESIDENTS = 3;
export const CONSENSUS_WINDOW_MS = 60 * 60_000;
/** Un aviso auto-publicado dura 6 h si el creador no lo toca. */
export const AUTO_HOURS = 6;

/** "Privada Roma", "priv. roma", "ROMA " → "roma". Para comparar zonas escritas a mano. */
export function normZone(zone: string | null | undefined): string | null {
  if (!zone) return null;
  const z = zone
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(privada|priv|calle|seccion|secc|fracc|fraccionamiento)\b\.?/g, " ")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return z || null;
}

/** ¿Este aviso le toca a este vecino? */
export function visibleTo(notice: Pick<Notice, "zone" | "kind">, residentZone: string | null): boolean {
  if (!notice.zone || notice.kind === "calle") return true;
  const mine = normZone(residentZone);
  if (!mine) return true;
  return normZone(notice.zone) === mine;
}

const KIND_TITLE: Record<NoticeKind, string> = {
  agua: "Sin agua",
  luz: "Sin luz",
  calle: "Calle cerrada",
  general: "Aviso de vecinos",
};

export function autoTitle(kind: NoticeKind, zone: string | null): string {
  return zone ? `${KIND_TITLE[kind]} en ${zone.trim()}` : `${KIND_TITLE[kind]} en Villas`;
}

/** ¿Hay consenso? Reportes recientes del mismo tipo y zona, contando vecinos distintos. */
export function hasConsensus(
  reports: Array<{ residentId: string; kind: NoticeKind; zone: string | null; createdAt: Date }>,
  kind: NoticeKind,
  zone: string | null,
  now: Date,
): { count: number; reached: boolean } {
  const key = normZone(zone);
  const since = now.getTime() - CONSENSUS_WINDOW_MS;
  const who = new Set(
    reports
      .filter((r) => r.kind === kind && normZone(r.zone) === key && r.createdAt.getTime() >= since)
      .map((r) => r.residentId),
  );
  return { count: who.size, reached: who.size >= CONSENSUS_RESIDENTS };
}

/** Cómo se escribe la zona en el aviso: la forma que más usaron los vecinos ("Privada Roma" gana a "priv. ROMA"). */
export function displayZone(zones: Array<string | null>): string | null {
  const counts = new Map<string, number>();
  for (const z of zones) {
    const t = z?.trim();
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [z, n] of counts) {
    const b = best ? counts.get(best)! : 0;
    if (n > b || (n === b && best && z.length > best.length)) best = z;
  }
  return best;
}

/** Si la zona coincide con una privada registrada por vecinos, se usa esa forma ("roma" → "Privada Roma"). */
export function canonicalZone(zone: string | null, known: string[]): string | null {
  const k = normZone(zone);
  if (!k) return null;
  return known.find((z) => normZone(z) === k) ?? zone!.trim();
}

export const noticeDto = (n: Notice) => ({
  id: n.id,
  kind: n.kind,
  title: n.title,
  body: n.body,
  zone: n.zone,
  source: n.source,
  confirmed: n.confirmed,
  expiresAt: n.expiresAt.toISOString(),
  createdAt: n.createdAt.toISOString(),
});

/** Vigentes: no cerrados y sin caducar. */
export async function activeNotices(now = new Date()): Promise<Notice[]> {
  return db
    .select()
    .from(noticesTable)
    .where(and(isNull(noticesTable.closedAt), gt(noticesTable.expiresAt, now)))
    .orderBy(desc(noticesTable.createdAt));
}

/**
 * Guarda el reporte y, si ya hay consenso, publica (o enlaza a un aviso vigente
 * del mismo tipo y zona). Devuelve si el vecino ya tiene un aviso publicado.
 */
export async function fileReport(input: {
  residentId: string;
  kind: NoticeKind;
  zone: string | null;
  text: string;
  now?: Date;
}): Promise<{ published: boolean }> {
  const now = input.now ?? new Date();
  const zone = input.zone?.trim() || null;
  const [report] = await db
    .insert(noticeReportsTable)
    .values({ residentId: input.residentId, kind: input.kind, zone, text: input.text.trim() })
    .returning({ id: noticeReportsTable.id });

  const key = normZone(zone);
  const sameActive = (await activeNotices(now)).find((n) => n.kind === input.kind && normZone(n.zone) === key);
  if (sameActive) {
    await db
      .update(noticeReportsTable)
      .set({ status: "published", noticeId: sameActive.id })
      .where(eq(noticeReportsTable.id, report!.id));
    return { published: true };
  }

  const recent = await db
    .select({
      id: noticeReportsTable.id,
      residentId: noticeReportsTable.residentId,
      kind: noticeReportsTable.kind,
      zone: noticeReportsTable.zone,
      createdAt: noticeReportsTable.createdAt,
    })
    .from(noticeReportsTable)
    .where(
      and(
        eq(noticeReportsTable.status, "pending"),
        eq(noticeReportsTable.kind, input.kind),
        gte(noticeReportsTable.createdAt, new Date(now.getTime() - CONSENSUS_WINDOW_MS)),
      ),
    );
  const { count, reached } = hasConsensus(recent, input.kind, zone, now);
  if (!reached) return { published: false };

  const group = recent.filter((r) => normZone(r.zone) === key);
  const shownZone = canonicalZone(displayZone(group.map((r) => r.zone)), await knownZones());
  const [notice] = await db
    .insert(noticesTable)
    .values({
      kind: input.kind,
      title: autoTitle(input.kind, shownZone),
      body: null,
      zone: shownZone,
      source: `Reportado por ${count} vecinos`,
      confirmed: false,
      expiresAt: new Date(now.getTime() + AUTO_HOURS * 3_600_000),
    })
    .returning();
  const ids = group.map((r) => r.id);
  await db
    .update(noticeReportsTable)
    .set({ status: "published", noticeId: notice!.id })
    .where(inArray(noticeReportsTable.id, ids));
  return { published: true };
}

/** Privadas que registraron los vecinos, sin repetir (para elegir a quién va un aviso). */
export async function knownZones(): Promise<string[]> {
  const { rows } = await db.execute(sql`
    select distinct on (lower(trim(zone))) trim(zone) as zone
    from residents where zone is not null and trim(zone) <> ''
    order by lower(trim(zone)), zone
  `);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows as Array<{ zone: string }>) {
    const k = normZone(r.zone);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(r.zone);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, "es"));
}
