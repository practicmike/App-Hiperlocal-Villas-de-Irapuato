import express, { Router, type IRouter } from "express";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db, placesTable, residentsTable, visitsTable, merchantSessionsTable, type Place } from "@workspace/db";
import {
  MerchantLoginBody,
  MerchantLookupMemberParams,
  MerchantRecordVisitBody,
  MerchantPublishNewsBody,
  MerchantNewsPhotoParams,
  MerchantChangePassParams,
  MerchantChangePassBody,
} from "@workspace/api-zod";
import { changePass, givePass, livePassTo, monthScore, redeemPass, residentPasses } from "../lib/passes";
import { activeNews, newsById, publishNews, removeNews, setNewsPhoto } from "../lib/news";
import { ensureSlug } from "../lib/slug";
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
/** El dueño no puede encenderse su propia estrella ni darse el regalo. */
const OWN_PLACE = "Es la credencial del dueño de este comercio. La credencial es para registrar a clientes.";

// ---------------------------------------------------------- vecino: su cielo
router.get("/me/sky", requireResident, async (req, res) => {
  const r = req.resident!;
  const [memberCode, visits, passes] = await Promise.all([
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
    residentPasses(r.id),
  ]);
  res.json({
    memberCode,
    passes,
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
  res.json(await merchantSummary(place, await ensureSlug(place).catch(() => null)));
});

router.post("/merchant/logout", async (req, res) => {
  await endMerchantSession(req, res);
  res.status(204).end();
});

router.get("/merchant/me", requireMerchant, async (req, res) => {
  const p = req.merchantPlace!;
  res.json(await merchantSummary(p, await ensureSlug(p).catch(() => null)));
});

async function merchantSummary(place: Place, slug: string | null) {
  const placeId = place.id;
  const [[stats], recent, score] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        neighbors: sql<number>`count(distinct ${visitsTable.residentId})::int`,
        today: sql<number>`count(*) filter (where (${visitsTable.createdAt} at time zone ${TZ})::date = (now() at time zone ${TZ})::date)::int`,
      })
      .from(visitsTable)
      .where(eq(visitsTable.placeId, placeId)),
    db
      .select({
        name: residentsTable.name,
        at: visitsTable.createdAt,
        welcomeApplied: visitsTable.welcomeApplied,
        referredBy: sql<string | null>`(select p."name" from "passes" x join "places" p on p."id" = x."from_place_id" where x."redeemed_visit_id" = ${visitsTable.id} limit 1)`,
      })
      .from(visitsTable)
      .innerJoin(residentsTable, eq(visitsTable.residentId, residentsTable.id))
      .where(eq(visitsTable.placeId, placeId))
      .orderBy(desc(visitsTable.createdAt))
      .limit(10),
    monthScore(placeId),
  ]);
  const [news] = await activeNews([placeId]);
  return {
    placeId,
    placeName: place.name,
    welcomeOffer: place.welcomeOffer,
    kind: place.kind,
    slug,
    sentThisMonth: score.sent,
    receivedThisMonth: score.received,
    news: news ?? null,
    todayVisits: stats?.today ?? 0,
    totalVisits: stats?.total ?? 0,
    neighbors: stats?.neighbors ?? 0,
    recent: recent.map((v) => ({
      firstName: firstName(v.name),
      at: v.at.toISOString(),
      welcomeApplied: v.welcomeApplied,
      referredBy: v.referredBy ?? null,
    })),
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
  const pass = await livePassTo(resident.id, placeId);
  return { resident, visitsHere: agg?.n ?? 0, recentlyRecorded: !!recent, referredBy: pass?.fromPlaceName ?? null };
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
  if (s.resident.phone === p.whatsapp) {
    res.status(400).json({ message: OWN_PLACE });
    return;
  }
  res.json({
    firstName: firstName(s.resident.name),
    visitsHere: s.visitsHere,
    welcomeOffer: s.visitsHere === 0 ? p.welcomeOffer : null,
    recentlyRecorded: s.recentlyRecorded,
    referredBy: s.referredBy,
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
  if (s.resident.phone === p.whatsapp) {
    res.status(400).json({ message: OWN_PLACE });
    return;
  }
  const name = firstName(s.resident.name);
  if (s.recentlyRecorded) {
    // Doble escaneo: se responde igual pero sin sumar otra visita.
    res.json({
      firstName: name,
      visitsHere: s.visitsHere,
      welcomeApplied: false,
      welcomeOffer: null,
      duplicate: true,
      referredBy: null,
      pass: null,
      passOptions: [],
    });
    return;
  }
  const welcome = s.visitsHere === 0 && !!p.welcomeOffer;
  const [visit] = await db
    .insert(visitsTable)
    .values({
      placeId: p.id,
      residentId: s.resident.id,
      welcomeApplied: welcome,
      welcomeOffer: welcome ? p.welcomeOffer : null,
    })
    .returning({ id: visitsTable.id });
  // «Te lo paso»: primero se canjea el pase con el que llegó (si traía uno),
  // luego este comercio le pasa el vecino a uno de sus socios.
  const referredBy = await redeemPass(s.resident.id, p.id, visit!.id);
  const given = await givePass(p, s.resident.id, visit!.id);
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
    referredBy,
    pass: given.pass,
    passOptions: given.options,
  });
});

/** Un toque: el pase que se acaba de dar se va a otro socio. */
router.put("/merchant/passes/:id", requireMerchant, rateLimit("merchant-pass", 60, 15 * 60_000), async (req, res) => {
  const { id } = MerchantChangePassParams.parse(req.params);
  const { toPlaceId } = MerchantChangePassBody.parse(req.body);
  const r = await changePass(req.merchantPlace!, id, toPlaceId);
  if (r.error === 404) {
    res.status(404).json({ message: "Ese pase ya no se puede cambiar." });
    return;
  }
  if (r.error === 400 || !r.pass) {
    res.status(400).json({ message: "A ese comercio ya no se le puede pasar este vecino." });
    return;
  }
  res.json(r.pass);
});

// ---------------------------------------------------------- hoy en villas
router.post("/merchant/news", requireMerchant, rateLimit("merchant-news", 12, 60 * 60_000), async (req, res) => {
  const { text } = MerchantPublishNewsBody.parse(req.body);
  res.status(201).json(await publishNews(req.merchantPlace!.id, text));
});

router.delete("/merchant/news", requireMerchant, async (req, res) => {
  await removeNews({ placeId: req.merchantPlace!.id });
  res.status(204).end();
});

router.post(
  "/merchant/news/:id/photo",
  requireMerchant,
  express.raw({ type: () => true, limit: "3mb" }),
  async (req, res) => {
    const { id } = MerchantNewsPhotoParams.parse(req.params);
    const n = await newsById(id);
    if (!n || n.placeId !== req.merchantPlace!.id) {
      res.status(404).json({ message: "Novedad no encontrada." });
      return;
    }
    const item = await setNewsPhoto(id, req.body);
    if (!item) {
      res.status(400).json({ message: "Eso no parece una foto (JPG, PNG o WebP)." });
      return;
    }
    res.json(item);
  },
);

export default router;
