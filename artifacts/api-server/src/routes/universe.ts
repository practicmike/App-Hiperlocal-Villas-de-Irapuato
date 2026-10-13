import { Router, type IRouter } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
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
} from "@workspace/api-zod";
import { normalizePhone, requireResident } from "../lib/auth";
import { rateLimit } from "../lib/rate-limit";
import { endorsementCounts, getActivePlace, placeDetail } from "../lib/places";
import { photosByPlace } from "../lib/photos";
import { activeNews } from "../lib/news";
import { embed } from "../lib/ai";
import { aiMatch, AI_MAX_CANDIDATES } from "../lib/ai-match";
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
      })
      .from(placesTable)
      .where(eq(placesTable.active, true))
      .orderBy(placesTable.createdAt),
    endorsementCounts(),
  ]);
  const [photos, news] = await Promise.all([photosByPlace(places.map((p) => p.id)), activeNews()]);
  const withNews = new Set(news.map((n) => n.placeId));
  res.json({
    constellations,
    places: places.map(({ welcomeOffer, ...p }) => ({
      ...p,
      endorsementCount: counts.get(p.id) ?? 0,
      welcome: !!welcomeOffer,
      coverUrl: photos.get(p.id)?.[0]?.url ?? null,
      hasNews: withNews.has(p.id),
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
    res.status(404).json({ message: "No encontramos esa estrella." });
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
    res.status(404).json({ message: "No encontramos esa estrella." });
    return;
  }
  const name = body.name?.trim() || null;
  if (body.source === "casa" && (!name || name.length < 2)) {
    res.status(400).json({ message: "Escribe tu nombre para que el vendedor sepa quién eres." });
    return;
  }
  const digits = body.phone ? normalizePhone(body.phone) : "";
  const phone = digits.length >= 12 && digits.length <= 15 ? digits : null;
  await db.insert(leadsTable).values({ placeId: id, source: body.source, name, phone });
  await db
    .update(placesTable)
    .set({ whatsappClicks: sql`${placesTable.whatsappClicks} + 1` })
    .where(eq(placesTable.id, id));
  res.status(204).end();
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
    res.status(404).json({ message: "No encontramos esa estrella." });
    return;
  }
  res.json(await placeDetail(place, req.resident?.status === "approved" ? req.resident.id : null));
});

router.put("/places/:id/endorsement", requireResident, async (req, res) => {
  const { id } = EndorsePlaceParams.parse(req.params);
  const { showName } = EndorsePlaceBody.parse(req.body);
  const place = await getActivePlace(id);
  if (!place) {
    res.status(404).json({ message: "No encontramos esa estrella." });
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
    res.status(404).json({ message: "No encontramos esa estrella." });
    return;
  }
  await db
    .delete(endorsementsTable)
    .where(
      and(eq(endorsementsTable.placeId, id), eq(endorsementsTable.residentId, req.resident!.id)),
    );
  res.json(await placeDetail(place, req.resident!.id));
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

/** Quejas privadas: nunca se publican. */
router.post("/places/:id/complaints", requireResident, rateLimit("complaint", 10, 60 * 60_000), async (req, res) => {
  const { id } = SendComplaintParams.parse(req.params);
  const { message } = SendComplaintBody.parse(req.body);
  const place = await getActivePlace(id);
  if (!place) {
    res.status(404).json({ message: "No encontramos esa estrella." });
    return;
  }
  await db.insert(complaintsTable).values({ placeId: id, residentId: req.resident!.id, message });
  res.status(201).end();
});

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
        return { place: p, placeId: p.id, score: Math.min(1, Math.max(kw, sem)), boost: p.boost };
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
        matches = rankMatches(ai.map((m) => ({ ...m, boost: boostOf.get(m.placeId) ?? 0 }))).map(
          ({ placeId, score, reason }) => ({ placeId, score, reason }),
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
