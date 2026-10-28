import express, { Router, type IRouter } from "express";
import { and, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";
import {
  db,
  constellationsTable,
  placesTable,
  endorsementsTable,
  searchesTable,
  complaintsTable,
  placePhotosTable,
  newsTable,
  leadsTable,
  visitsTable,
  savedPlacesTable,
} from "@workspace/db";
import {
  GetPlaceParams,
  EndorsePlaceParams,
  EndorsePlaceBody,
  RemoveEndorsementParams,
  RecordContactParams,
  RecordContactBody,
  SendComplaintParams,
  SendComplaintBody,
  SearchBody,
  RecordLeadParams,
  RecordLeadBody,
  SendSearchSuggestionParams,
  SavePlaceParams,
  UnsavePlaceParams,
  SendSearchSuggestionBody,
} from "@workspace/api-zod";
import { normalizePhone, requireResident } from "../lib/auth";
import { rateLimit } from "../lib/rate-limit";
import { endorsementCounts, getActivePlace, placeDetail } from "../lib/places";
import { photosByPlace } from "../lib/photos";
import { activeNews } from "../lib/news";
import { embed } from "../lib/ai";
import { audioExt, transcribe } from "../lib/transcribe";
import { aiMatch, keepKeywordHits, AI_MAX_CANDIDATES } from "../lib/ai-match";
import { logger } from "../lib/logger";
import {
  MATCH_MIN,
  calibrateSimilarity,
  cosineSimilarity,
  buildIdf,
  keywordScore,
  rankMatches,
} from "../lib/search-core";

/**
 * Visitantes sin llave: ven el universo, las tarjetas sin contacto y pueden
 * buscar (con límite). Contactar, recomendar y quejarse requiere ser vecino.
 */
const router: IRouter = Router();

router.get("/universe", async (_req, res) => {
  const [constellations, places, counts] = await Promise.all([
    db
      .select({
        id: constellationsTable.id,
        name: constellationsTable.name,
        hint: constellationsTable.hint,
        color: constellationsTable.color,
        isProperty: constellationsTable.isProperty,
        position: constellationsTable.position,
      })
      .from(constellationsTable)
      .orderBy(constellationsTable.position, constellationsTable.createdAt),
    db
      .select({
        id: placesTable.id,
        constellation: placesTable.constellation,
        name: placesTable.name,
        category: placesTable.category,
        verified: placesTable.verified,
        sponsored: placesTable.sponsored,
        welcomeOffer: placesTable.welcomeOffer,
        kind: placesTable.kind,
        delivers: placesTable.delivers,
        hours: placesTable.hours,
        lat: placesTable.lat,
        lng: placesTable.lng,
        createdAt: placesTable.createdAt,
      })
      .from(placesTable)
      .where(eq(placesTable.active, true))
      .orderBy(placesTable.createdAt),
    endorsementCounts(),
  ]);
  const [photos, news, visitRows] = await Promise.all([
    photosByPlace(places.map((p) => p.id)),
    activeNews(),
    db
      .select({ placeId: visitsTable.placeId, n: sql<number>`count(distinct ${visitsTable.residentId})::int` })
      .from(visitsTable)
      .groupBy(visitsTable.placeId),
  ]);
  const neighborsBy = new Map(visitRows.map((r) => [r.placeId, r.n]));
  const withNews = new Set(news.map((n) => n.placeId));
  res.json({
    constellations,
    places: places.map(({ welcomeOffer, createdAt, ...p }) => ({
      ...p,
      createdAt: createdAt.toISOString(),
      endorsementCount: counts.get(p.id) ?? 0,
      welcome: !!welcomeOffer,
      coverUrl: photos.get(p.id)?.[0]?.url ?? null,
      hasNews: withNews.has(p.id),
      neighbors: neighborsBy.get(p.id) ?? 0,
    })),
  });
});

/** Link público de una estrella: lo comparte el comercio en sus redes. */
router.get("/share/:slug", async (req, res) => {
  const slug = String(req.params.slug ?? "").toLowerCase().slice(0, 60);
  const [place] = await db
    .select()
    .from(placesTable)
    .where(and(eq(placesTable.slug, slug), eq(placesTable.active, true)))
    .limit(1);
  if (!place) {
    res.status(404).json({ message: "No encontramos ese lugar." });
    return;
  }
  res.json(await placeDetail(place, req.resident?.status === "approved" ? req.resident.id : null, { shared: true }));
});

/** Contacto desde fuera de Villas: queda como interesado para el anunciante. */
router.post("/places/:id/lead", rateLimit("lead", 20, 60 * 60_000), async (req, res) => {
  const { id } = RecordLeadParams.parse(req.params);
  const body = RecordLeadBody.parse(req.body);
  const place = await getActivePlace(id);
  if (!place) {
    res.status(404).json({ message: "No encontramos ese lugar." });
    return;
  }
  const name = body.name?.trim() || null;
  if (body.source === "casa" && (!name || name.length < 2)) {
    res.status(400).json({ message: "Escribe tu nombre para que el vendedor sepa quién eres." });
    return;
  }
  const digits = body.phone ? normalizePhone(body.phone) : "";
  const phone = digits.length >= 12 && digits.length <= 15 ? digits : null;
  const [c] = await db
    .select({ isProperty: constellationsTable.isProperty })
    .from(constellationsTable)
    .where(eq(constellationsTable.id, place.constellation))
    .limit(1);
  const via = c?.isProperty && !place.directContact ? "creador" : "vendedor";
  await db.insert(leadsTable).values({ placeId: id, source: body.source, via, name, phone });
  await db
    .update(placesTable)
    .set({ whatsappClicks: sql`${placesTable.whatsappClicks} + 1` })
    .where(eq(placesTable.id, id));
  res.status(204).end();
});

/**
 * Atajos del inicio. "mine": lo que el vecino repite (búsquedas con resultado,
 * últimos 90 días). "barrio": lo más buscado por al menos 2 vecinos distintos
 * (últimos 30 días), para que una búsqueda de una sola persona nunca se exponga.
 */
router.get("/searches/frequent", async (req, res) => {
  const norm = sql<string>`lower(trim(${searchesTable.query}))`;
  const since = (days: number) => new Date(Date.now() - days * 86_400_000);
  const isResident = req.resident?.status === "approved";
  const [mine, barrio] = await Promise.all([
    isResident
      ? db
          .select({ q: norm, n: sql<number>`count(*)::int` })
          .from(searchesTable)
          .where(
            and(
              eq(searchesTable.residentId, req.resident!.id),
              gt(searchesTable.resultCount, 0),
              gte(searchesTable.createdAt, since(90)),
            ),
          )
          .groupBy(norm)
          .orderBy(desc(sql`count(*)`), desc(sql`max(${searchesTable.createdAt})`))
          .limit(4)
      : Promise.resolve([]),
    db
      .select({ q: norm })
      .from(searchesTable)
      .where(and(gt(searchesTable.resultCount, 0), gte(searchesTable.createdAt, since(30))))
      .groupBy(norm)
      .having(sql`count(distinct ${searchesTable.residentId}) >= 2`)
      .orderBy(desc(sql`count(distinct ${searchesTable.residentId})`), desc(sql`count(*)`))
      .limit(6),
  ]);
  const short = (q: string) => q.length <= 40;
  res.json({
    mine: mine.map((r) => r.q).filter(short),
    barrio: barrio.map((r) => r.q).filter(short),
  });
});

router.get("/news", async (_req, res) => {
  res.json(await activeNews());
});

router.get("/news/:id/photo", async (req, res) => {
  const { id } = GetPlaceParams.parse(req.params);
  const [n] = await db
    .select({ mime: newsTable.photoMime, data: newsTable.photoData })
    .from(newsTable)
    .where(eq(newsTable.id, id))
    .limit(1);
  if (!n?.data || !n.mime) {
    res.status(404).json({ message: "Foto no encontrada." });
    return;
  }
  res.setHeader("content-type", n.mime);
  res.setHeader("cache-control", "public, max-age=86400, s-maxage=86400");
  res.end(n.data);
});

/** Foto pública (también la ven los visitantes): caché de un año, el id nunca cambia. */
router.get("/photos/:id", async (req, res) => {
  const { id } = GetPlaceParams.parse(req.params);
  const [photo] = await db
    .select({ mime: placePhotosTable.mime, data: placePhotosTable.data })
    .from(placePhotosTable)
    .where(eq(placePhotosTable.id, id))
    .limit(1);
  if (!photo) {
    res.status(404).json({ message: "Foto no encontrada." });
    return;
  }
  res.setHeader("content-type", photo.mime);
  res.setHeader("cache-control", "public, max-age=31536000, s-maxage=31536000, immutable");
  res.end(photo.data);
});

router.get("/places/:id", async (req, res) => {
  const { id } = GetPlaceParams.parse(req.params);
  const place = await getActivePlace(id);
  if (!place) {
    res.status(404).json({ message: "No encontramos ese lugar." });
    return;
  }
  res.json(await placeDetail(place, req.resident?.status === "approved" ? req.resident.id : null));
});

router.put("/places/:id/endorsement", requireResident, async (req, res) => {
  const { id } = EndorsePlaceParams.parse(req.params);
  const { showName } = EndorsePlaceBody.parse(req.body);
  const place = await getActivePlace(id);
  if (!place) {
    res.status(404).json({ message: "No encontramos ese lugar." });
    return;
  }
  await db
    .insert(endorsementsTable)
    .values({ placeId: id, residentId: req.resident!.id, showName })
    .onConflictDoUpdate({
      target: [endorsementsTable.placeId, endorsementsTable.residentId],
      set: { showName },
    });
  res.json(await placeDetail(place, req.resident!.id));
});

router.delete("/places/:id/endorsement", requireResident, async (req, res) => {
  const { id } = RemoveEndorsementParams.parse(req.params);
  const place = await getActivePlace(id);
  if (!place) {
    res.status(404).json({ message: "No encontramos ese lugar." });
    return;
  }
  await db
    .delete(endorsementsTable)
    .where(
      and(eq(endorsementsTable.placeId, id), eq(endorsementsTable.residentId, req.resident!.id)),
    );
  res.json(await placeDetail(place, req.resident!.id));
});

/** Guardados: privados del vecino; un toque guarda, otro quita. */
router.get("/me/saved", requireResident, async (req, res) => {
  const rows = await db
    .select({ placeId: savedPlacesTable.placeId })
    .from(savedPlacesTable)
    .innerJoin(placesTable, eq(savedPlacesTable.placeId, placesTable.id))
    .where(and(eq(savedPlacesTable.residentId, req.resident!.id), eq(placesTable.active, true)))
    .orderBy(desc(savedPlacesTable.createdAt));
  res.json({ placeIds: rows.map((r) => r.placeId) });
});

router.put("/places/:id/save", requireResident, async (req, res) => {
  const { id } = SavePlaceParams.parse(req.params);
  if (!(await getActivePlace(id))) {
    res.status(404).json({ message: "No encontramos ese lugar." });
    return;
  }
  await db.insert(savedPlacesTable).values({ residentId: req.resident!.id, placeId: id }).onConflictDoNothing();
  res.status(204).end();
});

router.delete("/places/:id/save", requireResident, async (req, res) => {
  const { id } = UnsavePlaceParams.parse(req.params);
  await db
    .delete(savedPlacesTable)
    .where(and(eq(savedPlacesTable.residentId, req.resident!.id), eq(savedPlacesTable.placeId, id)));
  res.status(204).end();
});

/** Base del KPI "búsquedas que terminan en WhatsApp" (idea del contador de TiendApp). */
router.post("/places/:id/contact", requireResident, async (req, res) => {
  const { id } = RecordContactParams.parse(req.params);
  const { searchId } = RecordContactBody.parse(req.body);
  await db
    .update(placesTable)
    .set({ whatsappClicks: sql`${placesTable.whatsappClicks} + 1` })
    .where(eq(placesTable.id, id));
  if (searchId) {
    // Solo la búsqueda propia y solo el primer contacto cuentan.
    await db
      .update(searchesTable)
      .set({ contactedPlaceId: id })
      .where(
        and(
          eq(searchesTable.id, searchId),
          eq(searchesTable.residentId, req.resident!.id),
          isNull(searchesTable.contactedPlaceId),
        ),
      );
  }
  res.status(204).end();
});

/**
 * Sin resultados: el vecino recomienda a alguien o propone algo. Queda pegado a
 * su búsqueda y el creador lo ve en Panel → Búsquedas. Solo la búsqueda propia
 * (o una de visitante) y solo si no tuvo resultados.
 */
router.post("/searches/:id/suggestion", rateLimit("suggestion", 10, 60 * 60_000), async (req, res) => {
  const { id } = SendSearchSuggestionParams.parse(req.params);
  const { text } = SendSearchSuggestionBody.parse(req.body);
  const owner =
    req.resident?.status === "approved" ? eq(searchesTable.residentId, req.resident.id) : isNull(searchesTable.residentId);
  const [row] = await db
    .update(searchesTable)
    .set({ suggestion: text.trim(), handled: false })
    .where(and(eq(searchesTable.id, id), eq(searchesTable.resultCount, 0), owner))
    .returning({ id: searchesTable.id });
  if (!row) {
    res.status(404).json({ message: "No encontramos esa búsqueda." });
    return;
  }
  res.status(204).end();
});

/** Quejas privadas: nunca se publican. */
router.post("/places/:id/complaints", requireResident, rateLimit("complaint", 10, 60 * 60_000), async (req, res) => {
  const { id } = SendComplaintParams.parse(req.params);
  const { message } = SendComplaintBody.parse(req.body);
  const place = await getActivePlace(id);
  if (!place) {
    res.status(404).json({ message: "No encontramos ese lugar." });
    return;
  }
  await db.insert(complaintsTable).values({ placeId: id, residentId: req.resident!.id, message });
  res.status(201).end();
});

// ---------------------------------------------------------- búsqueda por voz
const residentVoiceLimit = rateLimit("voice", 40, 60 * 60_000);
const guestVoiceLimit = rateLimit("voice-guest", 10, 60 * 60_000);

/** Pista de vocabulario: nombres y giros reales de Villas, para que el dictado no los invente. */
let hintCache: { at: number; text: string } | null = null;
async function voiceHint(): Promise<string> {
  if (hintCache && Date.now() - hintCache.at < 10 * 60_000) return hintCache.text;
  const rows = await db
    .select({ name: placesTable.name, category: placesTable.category })
    .from(placesTable)
    .where(eq(placesTable.active, true));
  const words = [...new Set(rows.flatMap((r) => [r.name, r.category]))].join(", ");
  const text = `Búsqueda de un vecino de Villas de Irapuato. Lugares y oficios: ${words}.`;
  hintCache = { at: Date.now(), text };
  return text;
}

router.post(
  "/transcribe",
  (req, res, next) => (req.resident?.status === "approved" ? residentVoiceLimit : guestVoiceLimit)(req, res, next),
  express.raw({ type: () => true, limit: "2mb" }),
  async (req, res) => {
    const mime = req.get("content-type") ?? "";
    if (!audioExt(mime) || !Buffer.isBuffer(req.body) || req.body.length < 1000) {
      res.status(400).json({ message: "No escuché nada. Intenta otra vez, un poco más cerca del celular." });
      return;
    }
    const text = await transcribe(req.body, mime, await voiceHint().catch(() => ""));
    if (text === null) {
      res.status(503).json({ message: "El dictado no está disponible ahorita. Escríbelo, porfa." });
      return;
    }
    res.json({ text });
  },
);

const residentSearchLimit = rateLimit("search", 60, 60_000);
const guestSearchLimit = rateLimit("search-guest", 15, 60 * 60_000);

router.post(
  "/search",
  (req, res, next) =>
    (req.resident?.status === "approved" ? residentSearchLimit : guestSearchLimit)(req, res, next),
  async (req, res) => {
    const body = SearchBody.parse(req.body);
    const raw = body.query.trim();
    const isResident = req.resident?.status === "approved";

    const effectiveQuery = raw;

    const places = await db.select().from(placesTable).where(eq(placesTable.active, true));
    const queryVector = await embed(effectiveQuery);

    // 1) Búsqueda rápida: palabras (con peso por rareza) + significado (embeddings).
    const weightOf = buildIdf(places);
    const all = places
      .map((p) => {
        const kw = keywordScore(effectiveQuery, p, weightOf);
        const sem =
          queryVector && p.embedding ? calibrateSimilarity(cosineSimilarity(queryVector, p.embedding)) : 0;
        return { place: p, placeId: p.id, score: Math.min(1, Math.max(kw, sem)), keyword: kw, boost: p.boost };
      })
      .sort((a, b) => b.score - a.score);

    // 2) Match con IA (solo vecinos): califica los mejores candidatos y explica por qué.
    let mode: "ai" | "semantic" | "keywords" = queryVector ? "semantic" : "keywords";
    let matches: Array<{ placeId: string; score: number; reason: string | null }> = [];
    if (isResident) {
      const candidates = all.filter((m) => m.score > 0.12).slice(0, AI_MAX_CANDIDATES);
      const ai = await aiMatch(raw, candidates.map((m) => m.place));
      if (ai) {
        mode = "ai";
        const boostOf = new Map(candidates.map((m) => [m.placeId, m.boost]));
        const approved = rankMatches(ai.map((m) => ({ ...m, boost: boostOf.get(m.placeId) ?? 0 }))).map(
          ({ placeId, score, reason }) => ({ placeId, score, reason }),
        );
        // Se revisa toda la lista, no solo los 12 candidatos: lo obvio nunca se pierde.
        matches = keepKeywordHits(approved, all);
        // Para diagnosticar "¿por qué no salió X?" en los logs de Vercel (sin datos del vecino).
        const nameOf = new Map(candidates.map((m) => [m.placeId, m.place.name]));
        logger.info(
          {
            query: raw,
            candidates: candidates.map((m) => `${m.place.name} kw=${m.keyword.toFixed(2)} s=${m.score.toFixed(2)}`),
            ai: ai.map((m) => `${nameOf.get(m.placeId)} ${Math.round(m.score * 100)}`),
            rescued: matches.length - approved.length,
          },
          "search ai",
        );
      }
    }
    if (mode !== "ai") {
      const scored = all.filter((m) => m.score >= MATCH_MIN);
      // Corte relativo: si hay coincidencias muy fuertes, las débiles estorban.
      const top = Math.max(0, ...scored.map((m) => m.score));
      matches = rankMatches(scored.filter((m) => m.score >= top * 0.6)).map(({ placeId, score }) => ({
        placeId,
        score: Math.round(score * 1000) / 1000,
        reason: null,
      }));
    }

    // Toda búsqueda se registra; las que no encuentran nada le llegan al creador.
    const [logged] = await db
      .insert(searchesTable)
      .values({
        residentId: isResident ? req.resident!.id : null,
        query: raw,
        refined: mode === "ai",
        refinedQuery: null,
        resultCount: matches.length,
        topScore: matches[0]?.score ?? null,
      })
      .returning({ id: searchesTable.id });

    res.json({
      searchId: logged!.id,
      matches,
      refinedQuery: null,
      constellation: null,
      mode,
    });
  },
);

export default router;
