import { Router, type IRouter } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  placesTable,
  endorsementsTable,
  searchesTable,
  complaintsTable,
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
} from "@workspace/api-zod";
import { requireResident } from "../lib/auth";
import { rateLimit } from "../lib/rate-limit";
import { endorsementCounts, getActivePlace, placeDetail } from "../lib/places";
import { embed, refineQuery } from "../lib/ai";
import {
  MATCH_MIN,
  calibrateSimilarity,
  cosineSimilarity,
  keywordScore,
  rankMatches,
} from "../lib/search-core";

const router: IRouter = Router();
router.use(requireResident);

router.get("/universe", async (_req, res) => {
  const [places, counts] = await Promise.all([
    db
      .select({
        id: placesTable.id,
        constellation: placesTable.constellation,
        name: placesTable.name,
        category: placesTable.category,
        verified: placesTable.verified,
        sponsored: placesTable.sponsored,
      })
      .from(placesTable)
      .where(eq(placesTable.active, true))
      .orderBy(placesTable.createdAt),
    endorsementCounts(),
  ]);
  res.json({
    places: places.map((p) => ({ ...p, endorsementCount: counts.get(p.id) ?? 0 })),
  });
});

router.get("/places/:id", async (req, res) => {
  const { id } = GetPlaceParams.parse(req.params);
  const place = await getActivePlace(id);
  if (!place) {
    res.status(404).json({ message: "No encontramos esa estrella." });
    return;
  }
  res.json(await placeDetail(place, req.resident!.id));
});

router.put("/places/:id/endorsement", async (req, res) => {
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

router.delete("/places/:id/endorsement", async (req, res) => {
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
router.post("/places/:id/contact", async (req, res) => {
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
router.post("/places/:id/complaints", rateLimit(10, 60 * 60_000), async (req, res) => {
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

router.post("/search", rateLimit(60, 60_000), async (req, res) => {
  const body = SearchBody.parse(req.body);
  const raw = body.query.trim();

  const refinement = body.refine ? await refineQuery(raw) : null;
  const effectiveQuery = refinement?.query ?? raw;
  const constellation = refinement?.constellation ?? null;

  const places = await db.select().from(placesTable).where(eq(placesTable.active, true));
  const queryVector = await embed(effectiveQuery);

  const scored = places
    .filter((p) => !constellation || p.constellation === constellation)
    .map((p) => {
      const kw = Math.max(keywordScore(effectiveQuery, p), keywordScore(raw, p));
      const sem =
        queryVector && p.embedding
          ? calibrateSimilarity(cosineSimilarity(queryVector, p.embedding))
          : 0;
      return { placeId: p.id, score: Math.min(1, Math.max(kw, sem)), boost: p.boost };
    })
    .filter((m) => m.score >= MATCH_MIN);

  const matches = rankMatches(scored).map(({ placeId, score }) => ({
    placeId,
    score: Math.round(score * 1000) / 1000,
  }));

  // Toda búsqueda se registra; las que no encuentran nada le llegan al creador.
  const [logged] = await db
    .insert(searchesTable)
    .values({
      residentId: req.resident!.id,
      query: raw,
      refined: Boolean(refinement),
      refinedQuery: refinement?.query ?? null,
      resultCount: matches.length,
      topScore: matches[0]?.score ?? null,
    })
    .returning({ id: searchesTable.id });

  res.json({
    searchId: logged!.id,
    matches,
    refinedQuery: refinement?.query ?? null,
    constellation,
    mode: queryVector ? "semantic" : "keywords",
  });
});

export default router;
