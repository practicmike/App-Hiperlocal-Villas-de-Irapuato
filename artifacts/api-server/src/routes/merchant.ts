import { Router, type IRouter } from "express";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db, placesTable, residentsTable, visitsTable, merchantSessionsTable } from "@workspace/db";
import { MerchantLoginBody, MerchantLookupMemberParams, MerchantRecordVisitBody } from "@workspace/api-zod";
import { hashToken, requireResident } from "../lib/auth";
import { rateLimit } from "../lib/rate-limit";
import {
  endMerchantSession,
  ensureMemberCode,
  firstName,
  normalizeMemberCode,
  requireMerchant,
  startMerchantSession,
} from "../lib/merchant";

const router: IRouter = Router();

/** Un segundo escaneo dentro de esta ventana no cuenta como otra visita. */
const DUPLICATE_WINDOW_MS = 2 * 60 * 60_000;
const TZ = "America/Mexico_City";

// ---------------------------------------------------------- vecino: su cielo
router.get("/me/sky", requireResident, async (req, res) => {
  const r = req.resident!;
  const [memberCode, visits] = await Promise.all([
    ensureMemberCode(r.id, r.memberCode),
    db
      .select({
        placeId: visitsTable.placeId,
        count: sql<number>`count(*)::int`,
        lastAt: sql<Date>`max(${visitsTable.createdAt})`,
      })
      .from(visitsTable)
      .where(eq(visitsTable.residentId, r.id))
      .groupBy(visitsTable.placeId),
  ]);
  res.json({
    memberCode,
    visits: visits.map((v) => ({ placeId: v.placeId, count: v.count, lastAt: new Date(v.lastAt).toISOString() })),
  });
});

// ---------------------------------------------------------- modo comercio
router.post("/merchant/login", rateLimit("merchant-login", 20, 15 * 60_000), async (req, res) => {
  const { token } = MerchantLoginBody.parse(req.body);
  const [place] = await db
    .select()
    .from(placesTable)
    .where(eq(placesTable.merchantKeyHash, hashToken(token)))
    .limit(1);
  if (!place) {
    res.status(401).json({ message: "Este link del comercio ya no es válido. Pide uno nuevo al creador." });
    return;
  }
  await startMerchantSession(res, place.id);
  req.merchantPlace = place;
  res.json(await merchantSummary(place.id, place.name, place.welcomeOffer, place.kind));
});

router.post("/merchant/logout", async (req, res) => {
  await endMerchantSession(req, res);
  res.status(204).end();
});

router.get("/merchant/me", requireMerchant, async (req, res) => {
  const p = req.merchantPlace!;
  res.json(await merchantSummary(p.id, p.name, p.welcomeOffer, p.kind));
});

async function merchantSummary(placeId: string, placeName: string, welcomeOffer: string | null, kind: "comercio" | "oficio") {
  const [[stats], recent] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        neighbors: sql<number>`count(distinct ${visitsTable.residentId})::int`,
        today: sql<number>`count(*) filter (where (${visitsTable.createdAt} at time zone ${TZ})::date = (now() at time zone ${TZ})::date)::int`,
      })
      .from(visitsTable)
      .where(eq(visitsTable.placeId, placeId)),
    db
      .select({ name: residentsTable.name, at: visitsTable.createdAt, welcomeApplied: visitsTable.welcomeApplied })
      .from(visitsTable)
      .innerJoin(residentsTable, eq(visitsTable.residentId, residentsTable.id))
      .where(eq(visitsTable.placeId, placeId))
      .orderBy(desc(visitsTable.createdAt))
      .limit(10),
  ]);
  return {
    placeId,
    placeName,
    welcomeOffer,
    kind,
    todayVisits: stats?.today ?? 0,
    totalVisits: stats?.total ?? 0,
    neighbors: stats?.neighbors ?? 0,
    recent: recent.map((v) => ({ firstName: firstName(v.name), at: v.at.toISOString(), welcomeApplied: v.welcomeApplied })),
  };
}

async function memberState(placeId: string, rawCode: string) {
  const code = normalizeMemberCode(rawCode);
  const [resident] = await db.select().from(residentsTable).where(eq(residentsTable.memberCode, code)).limit(1);
  if (!resident || resident.status !== "approved") return null;
  const [[agg], [recent]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(visitsTable)
      .where(and(eq(visitsTable.placeId, placeId), eq(visitsTable.residentId, resident.id))),
    db
      .select({ id: visitsTable.id })
      .from(visitsTable)
      .where(
        and(
          eq(visitsTable.placeId, placeId),
          eq(visitsTable.residentId, resident.id),
          gt(visitsTable.createdAt, new Date(Date.now() - DUPLICATE_WINDOW_MS)),
        ),
      )
      .limit(1),
  ]);
  return { resident, visitsHere: agg?.n ?? 0, recentlyRecorded: !!recent };
}

/** Lo que ve el comercio al escanear, antes de confirmar. */
router.get("/merchant/members/:code", requireMerchant, rateLimit("merchant-lookup", 120, 15 * 60_000), async (req, res) => {
  const { code } = MerchantLookupMemberParams.parse(req.params);
  const p = req.merchantPlace!;
  const s = await memberState(p.id, code);
  if (!s) {
    res.status(404).json({ message: "Esta credencial no es válida o el vecino ya no está activo." });
    return;
  }
  res.json({
    firstName: firstName(s.resident.name),
    visitsHere: s.visitsHere,
    welcomeOffer: s.visitsHere === 0 ? p.welcomeOffer : null,
    recentlyRecorded: s.recentlyRecorded,
  });
});

router.post("/merchant/visits", requireMerchant, rateLimit("merchant-visit", 120, 15 * 60_000), async (req, res) => {
  const { code } = MerchantRecordVisitBody.parse(req.body);
  const p = req.merchantPlace!;
  const s = await memberState(p.id, code);
  if (!s) {
    res.status(404).json({ message: "Esta credencial no es válida o el vecino ya no está activo." });
    return;
  }
  const name = firstName(s.resident.name);
  if (s.recentlyRecorded) {
    // Doble escaneo: se responde igual pero sin sumar otra visita.
    res.json({ firstName: name, visitsHere: s.visitsHere, welcomeApplied: false, welcomeOffer: null, duplicate: true });
    return;
  }
  const welcome = s.visitsHere === 0 && !!p.welcomeOffer;
  await db.insert(visitsTable).values({
    placeId: p.id,
    residentId: s.resident.id,
    welcomeApplied: welcome,
    welcomeOffer: welcome ? p.welcomeOffer : null,
  });
  void db
    .update(merchantSessionsTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(merchantSessionsTable.placeId, p.id))
    .catch(() => {});
  res.json({
    firstName: name,
    visitsHere: s.visitsHere + 1,
    welcomeApplied: welcome,
    welcomeOffer: welcome ? p.welcomeOffer : null,
    duplicate: false,
  });
});

export default router;
