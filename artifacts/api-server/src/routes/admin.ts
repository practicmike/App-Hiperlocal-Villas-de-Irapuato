import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq, gte, isNull, like, sql } from "drizzle-orm";
import { waitUntil } from "@vercel/functions";
import {
  db,
  constellationsTable,
  MAX_CONSTELLATIONS,
  accessKeysTable,
  residentsTable,
  invitesTable,
  placesTable,
  searchesTable,
  complaintsTable,
  visitsTable,
  type Place,
} from "@workspace/db";
import {
  AdminApproveResidentParams,
  AdminRegenerateKeyParams,
  AdminBlockResidentParams,
  AdminCreateInviteBody,
  AdminCreatePlaceBody,
  AdminUpdatePlaceParams,
  AdminUpdatePlaceBody,
  AdminDeletePlaceParams,
  AdminCreateConstellationBody,
  AdminReorderConstellationsBody,
  AdminUpdateConstellationParams,
  AdminUpdateConstellationBody,
  AdminRemoveConstellationParams,
  AdminRemoveConstellationBody,
  AdminSuggestConstellationBody,
  AdminIssueMerchantKeyParams,
  AdminMarkSearchHandledParams,
  AdminResolveComplaintParams,
} from "@workspace/api-zod";
import { requireAdmin, issueAccessKey, normalizePhone } from "../lib/auth";
import { endorsementCounts, refreshEmbedding } from "../lib/places";
import { issueMerchantKey } from "../lib/merchant";
import { DEMO_PLACES, DEMO_WHATSAPP_PREFIX } from "../lib/demo-places";
import { embedMany, suggestConstellation } from "../lib/ai";
import { placeEmbeddingText } from "../lib/search-core";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use("/admin", requireAdmin);

const inviter = alias(residentsTable, "inviter");

router.get("/admin/overview", async (_req, res) => {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [r] = await db
    .select({
      approved: sql<number>`count(*) filter (where ${residentsTable.status} = 'approved')::int`,
      pending: sql<number>`count(*) filter (where ${residentsTable.status} = 'pending')::int`,
      byInvite: sql<number>`count(*) filter (where ${residentsTable.inviteCode} is not null)::int`,
    })
    .from(residentsTable);
  const [p] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(placesTable)
    .where(eq(placesTable.active, true));
  // Las métricas de vecinos excluyen a visitantes (no pueden contactar por WhatsApp).
  const [s] = await db
    .select({
      total: sql<number>`count(*) filter (where ${searchesTable.residentId} is not null)::int`,
      contacted: sql<number>`count(*) filter (where ${searchesTable.contactedPlaceId} is not null)::int`,
      empty: sql<number>`count(*) filter (where ${searchesTable.resultCount} = 0 and ${searchesTable.residentId} is not null)::int`,
      guests: sql<number>`count(*) filter (where ${searchesTable.residentId} is null)::int`,
    })
    .from(searchesTable)
    .where(gte(searchesTable.createdAt, since));
  const [c] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(complaintsTable)
    .where(eq(complaintsTable.resolved, false));
  const [v] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(visitsTable)
    .where(gte(visitsTable.createdAt, since));

  res.json({
    residentsApproved: r!.approved,
    residentsPending: r!.pending,
    residentsByInvite: r!.byInvite,
    places: p!.n,
    searches30d: s!.total,
    searchesWithContact30d: s!.contacted,
    searchesNoResult30d: s!.empty,
    openComplaints: c!.n,
    guestSearches30d: s!.guests,
    visits30d: v!.n,
  });
});

// ---------------------------------------------------------------- vecinos
router.get("/admin/residents", async (_req, res) => {
  const rows = await db
    .select({ r: residentsTable, inviterName: inviter.name })
    .from(residentsTable)
    .leftJoin(inviter, eq(residentsTable.invitedById, inviter.id))
    .orderBy(
      sql`case ${residentsTable.status} when 'pending' then 0 when 'approved' then 1 else 2 end`,
      desc(residentsTable.createdAt),
    );
  // Llave vigente (no revocada) de cada vecino.
  const keys = await db
    .select({
      residentId: accessKeysTable.residentId,
      firstUsedAt: accessKeysTable.firstUsedAt,
      rejectedAttempts: accessKeysTable.rejectedAttempts,
    })
    .from(accessKeysTable)
    .where(isNull(accessKeysTable.revokedAt));
  const keyBy = new Map(keys.map((k) => [k.residentId, k]));
  res.json(
    rows.map(({ r, inviterName }) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      zone: r.zone,
      role: r.role,
      status: r.status,
      invitedBy: inviterName,
      inviteCode: r.inviteCode,
      createdAt: r.createdAt.toISOString(),
      keyStatus: !keyBy.has(r.id) ? "none" : keyBy.get(r.id)!.firstUsedAt ? "used" : "unused",
      keyUsedAt: keyBy.get(r.id)?.firstUsedAt?.toISOString() ?? null,
      keyRejectedAttempts: keyBy.get(r.id)?.rejectedAttempts ?? 0,
    })),
  );
});

async function keyResponse(residentId: string) {
  const [r] = await db.select().from(residentsTable).where(eq(residentsTable.id, residentId));
  if (!r) return null;
  const token = await issueAccessKey(r.id);
  return { token, phone: r.phone, name: r.name };
}

router.post("/admin/residents/:id/approve", async (req, res) => {
  const { id } = AdminApproveResidentParams.parse(req.params);
  await db
    .update(residentsTable)
    .set({ status: "approved", approvedAt: new Date() })
    .where(eq(residentsTable.id, id));
  const key = await keyResponse(id);
  if (!key) {
    res.status(404).json({ message: "Vecino no encontrado." });
    return;
  }
  res.json(key);
});

/** Teléfono perdido o link compartido por error: llave nueva, la anterior deja de servir. */
router.post("/admin/residents/:id/key", async (req, res) => {
  const { id } = AdminRegenerateKeyParams.parse(req.params);
  const [r] = await db.select().from(residentsTable).where(eq(residentsTable.id, id));
  if (!r || r.status !== "approved") {
    res.status(400).json({ message: "Primero aprueba a este vecino." });
    return;
  }
  res.json(await keyResponse(id));
});

router.post("/admin/residents/:id/block", async (req, res) => {
  const { id } = AdminBlockResidentParams.parse(req.params);
  if (id === req.resident!.id) {
    res.status(400).json({ message: "No puedes bloquearte a ti mismo." });
    return;
  }
  await db.update(residentsTable).set({ status: "blocked" }).where(eq(residentsTable.id, id));
  res.status(204).end();
});

// ------------------------------------------------------------ invitaciones
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () =>
  "VILLAS-" +
  Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");

router.get("/admin/invites", async (_req, res) => {
  const rows = await db
    .select({ i: invitesTable, usedBy: residentsTable.name })
    .from(invitesTable)
    .leftJoin(residentsTable, eq(invitesTable.usedById, residentsTable.id))
    .orderBy(desc(invitesTable.createdAt))
    .limit(200);
  res.json(
    rows.map(({ i, usedBy }) => ({
      code: i.code,
      note: i.note,
      usedBy,
      createdAt: i.createdAt.toISOString(),
    })),
  );
});

router.post("/admin/invites", async (req, res) => {
  const { note } = AdminCreateInviteBody.parse(req.body);
  const [invite] = await db
    .insert(invitesTable)
    .values({ code: newCode(), note: note.trim() || null, createdById: req.resident!.id })
    .returning();
  res.status(201).json({
    code: invite!.code,
    note: invite!.note,
    usedBy: null,
    createdAt: invite!.createdAt.toISOString(),
  });
});

// ----------------------------------------------------------------- lugares
/** Visitas registradas por lugar, en una sola consulta. */
async function visitCounts(): Promise<Map<string, number>> {
  const rows = await db
    .select({ placeId: visitsTable.placeId, n: sql<number>`count(*)::int` })
    .from(visitsTable)
    .groupBy(visitsTable.placeId);
  return new Map(rows.map((r) => [r.placeId, r.n]));
}

const toAdminPlace = (p: Place, counts: Map<string, number>, visits: Map<string, number> = new Map()) => ({
  id: p.id,
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
  whatsappClicks: p.whatsappClicks,
  endorsementCount: counts.get(p.id) ?? 0,
  hasEmbedding: Array.isArray(p.embedding) && p.embedding.length > 0,
  isDemo: p.whatsapp.startsWith(DEMO_WHATSAPP_PREFIX),
  welcomeOffer: p.welcomeOffer,
  visitCount: visits.get(p.id) ?? 0,
  hasMerchantKey: p.merchantKeyHash !== null,
});

async function constellationById(id: string) {
  const [c] = await db.select().from(constellationsTable).where(eq(constellationsTable.id, id)).limit(1);
  return c;
}

function cleanPlaceInput(body: ReturnType<typeof AdminCreatePlaceBody.parse>, isProperty: boolean) {
  const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  return {
    constellation: body.constellation,
    name: body.name.trim(),
    category: body.category.trim(),
    description: body.description.trim(),
    contactName: blank(body.contactName),
    whatsapp: normalizePhone(body.whatsapp),
    zone: blank(body.zone),
    // Operación y precio solo aplican a constelaciones de inmuebles.
    operation: isProperty ? (body.operation ?? null) : null,
    priceLabel: isProperty ? blank(body.priceLabel) : null,
    imageUrl: blank(body.imageUrl),
    welcomeOffer: blank(body.welcomeOffer),
    verified: body.verified,
    active: body.active,
  };
}

router.get("/admin/places", async (_req, res) => {
  const [rows, counts, visits] = await Promise.all([
    db.select().from(placesTable).orderBy(desc(placesTable.updatedAt)),
    endorsementCounts(),
    visitCounts(),
  ]);
  res.json(rows.map((p) => toAdminPlace(p, counts, visits)));
});

router.post("/admin/places", async (req, res) => {
  const body = AdminCreatePlaceBody.parse(req.body);
  const c = await constellationById(body.constellation);
  if (!c) {
    res.status(400).json({ message: "Esa constelación no existe." });
    return;
  }
  const [place] = await db.insert(placesTable).values(cleanPlaceInput(body, c.isProperty)).returning();
  refreshEmbedding(place!);
  res.status(201).json(toAdminPlace(place!, new Map()));
});

router.put("/admin/places/:id", async (req, res) => {
  const { id } = AdminUpdatePlaceParams.parse(req.params);
  const body = AdminUpdatePlaceBody.parse(req.body);
  const c = await constellationById(body.constellation);
  if (!c) {
    res.status(400).json({ message: "Esa constelación no existe." });
    return;
  }
  const [place] = await db
    .update(placesTable)
    .set({ ...cleanPlaceInput(body, c.isProperty), embedding: null, updatedAt: new Date() })
    .where(eq(placesTable.id, id))
    .returning();
  if (!place) {
    res.status(404).json({ message: "Lugar no encontrado." });
    return;
  }
  refreshEmbedding(place);
  res.json(toAdminPlace(place, await endorsementCounts(), await visitCounts()));
});

router.delete("/admin/places/:id", async (req, res) => {
  const { id } = AdminDeletePlaceParams.parse(req.params);
  const [gone] = await db.delete(placesTable).where(eq(placesTable.id, id)).returning({ id: placesTable.id });
  if (!gone) {
    res.status(404).json({ message: "Lugar no encontrado." });
    return;
  }
  res.status(204).end();
});

// ----------------------------------------------------------- constelaciones
async function listConstellations() {
  const rows = await db
    .select({
      c: constellationsTable,
      starCount: sql<number>`(select count(*)::int from "places" p where p."constellation" = "constellations"."id")`,
    })
    .from(constellationsTable)
    .orderBy(constellationsTable.position, constellationsTable.createdAt);
  return rows.map(({ c, starCount }) => ({
    id: c.id,
    name: c.name,
    hint: c.hint,
    color: c.color,
    isProperty: c.isProperty,
    position: c.position,
    starCount,
  }));
}

/** "Mi Constelación Nueva" → "mi-constelacion-nueva"; estable aunque se renombre después. */
function slugify(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "constelacion"
  );
}

router.get("/admin/constellations", async (_req, res) => {
  res.json(await listConstellations());
});

router.post("/admin/constellations", async (req, res) => {
  const body = AdminCreateConstellationBody.parse(req.body);
  const current = await listConstellations();
  if (current.length >= MAX_CONSTELLATIONS) {
    res.status(400).json({
      message: `Ya tienes ${MAX_CONSTELLATIONS} constelaciones, el máximo para que se lean bien en un celular. Junta o elimina una antes de crear otra.`,
    });
    return;
  }
  const taken = new Set(current.map((c) => c.id));
  const base = slugify(body.name);
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  await db.insert(constellationsTable).values({
    id,
    name: body.name.trim(),
    hint: body.hint.trim(),
    color: body.color,
    isProperty: body.isProperty,
    position: Math.max(-1, ...current.map((c) => c.position)) + 1,
  });
  res.status(201).json((await listConstellations()).find((c) => c.id === id));
});

router.put("/admin/constellations/order", async (req, res) => {
  const { ids } = AdminReorderConstellationsBody.parse(req.body);
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(constellationsTable).set({ position }).where(eq(constellationsTable.id, id));
    }
  });
  res.status(204).end();
});

router.put("/admin/constellations/:cid", async (req, res) => {
  const { cid } = AdminUpdateConstellationParams.parse(req.params);
  const body = AdminUpdateConstellationBody.parse(req.body);
  const [updated] = await db
    .update(constellationsTable)
    .set({ name: body.name.trim(), hint: body.hint.trim(), color: body.color, isProperty: body.isProperty })
    .where(eq(constellationsTable.id, cid))
    .returning({ id: constellationsTable.id });
  if (!updated) {
    res.status(404).json({ message: "Constelación no encontrada." });
    return;
  }
  res.json((await listConstellations()).find((c) => c.id === cid));
});

/** Eliminar: si tiene estrellas, primero se mueven a otra; ninguna se pierde. */
router.post("/admin/constellations/:cid/remove", async (req, res) => {
  const { cid } = AdminRemoveConstellationParams.parse(req.params);
  const { moveTo } = AdminRemoveConstellationBody.parse(req.body);
  const all = await listConstellations();
  const target = all.find((c) => c.id === cid);
  if (!target) {
    res.status(404).json({ message: "Constelación no encontrada." });
    return;
  }
  if (all.length <= 1) {
    res.status(400).json({ message: "El universo necesita al menos una constelación." });
    return;
  }
  if (target.starCount > 0) {
    if (!moveTo || moveTo === cid || !all.some((c) => c.id === moveTo)) {
      res.status(400).json({ message: `Tiene ${target.starCount} estrellas. Elige a qué constelación moverlas.` });
      return;
    }
  }
  await db.transaction(async (tx) => {
    if (target.starCount > 0 && moveTo) {
      await tx.update(placesTable).set({ constellation: moveTo, updatedAt: new Date() }).where(eq(placesTable.constellation, cid));
    }
    await tx.delete(constellationsTable).where(eq(constellationsTable.id, cid));
  });
  res.status(204).end();
});

/** La IA sugiere constelación y giro; el creador decide. */
/** Link del modo comercio. Generar uno nuevo apaga el anterior en todos sus teléfonos. */
router.post("/admin/places/:id/merchant-key", async (req, res) => {
  const { id } = AdminIssueMerchantKeyParams.parse(req.params);
  const [place] = await db.select().from(placesTable).where(eq(placesTable.id, id)).limit(1);
  if (!place) {
    res.status(404).json({ message: "Lugar no encontrado." });
    return;
  }
  const token = await issueMerchantKey(place.id);
  res.json({ token, whatsapp: place.whatsapp, placeName: place.name });
});

router.post("/admin/places/suggest", async (req, res) => {
  const body = AdminSuggestConstellationBody.parse(req.body);
  const [cs, cats] = await Promise.all([
    listConstellations(),
    db.selectDistinct({ category: placesTable.category }).from(placesTable),
  ]);
  const s = await suggestConstellation(body, cs, cats.map((c) => c.category));
  res.json(s ? { ...s, available: true } : { constellation: null, category: null, reason: null, available: false });
});

// --------------------------------------------------------- datos de ejemplo
const isDemo = like(placesTable.whatsapp, `${DEMO_WHATSAPP_PREFIX}%`);

/** Carga las 30 estrellas de ejemplo (si ya están, no las duplica). */
router.post("/admin/demo-places", async (_req, res) => {
  const existing = new Set(
    (await db.select({ whatsapp: placesTable.whatsapp }).from(placesTable).where(isDemo)).map((r) => r.whatsapp),
  );
  // Si borraste una constelación, sus ejemplos simplemente no se cargan.
  const ids = new Set((await db.select({ id: constellationsTable.id }).from(constellationsTable)).map((c) => c.id));
  const demos = DEMO_PLACES.filter((p) => ids.has(p.constellation));
  const missing = demos.filter((p) => !existing.has(p.whatsapp));
  const fresh = missing.length ? await db.insert(placesTable).values(missing).returning() : [];
  // Los ejemplos ya cargados se actualizan con las descripciones más recientes.
  const refreshed = await Promise.all(
    demos.filter((p) => existing.has(p.whatsapp)).map((p) =>
      db
        .update(placesTable)
        .set({ constellation: p.constellation, name: p.name, category: p.category, description: p.description, contactName: p.contactName, zone: p.zone, operation: p.operation, priceLabel: p.priceLabel, welcomeOffer: p.welcomeOffer ?? null, embedding: null, updatedAt: new Date() })
        .where(eq(placesTable.whatsapp, p.whatsapp))
        .returning(),
    ),
  );
  const inserted = [...fresh, ...refreshed.flat()];

  // Embeddings en una sola llamada, sin hacer esperar al panel.
  if (inserted.length) {
    const job = (async () => {
      const vectors = await embedMany(inserted.map((p) => placeEmbeddingText(p)));
      await Promise.all(
        inserted.map((p, i) =>
          vectors[i]
            ? db.update(placesTable).set({ embedding: vectors[i] }).where(eq(placesTable.id, p.id))
            : null,
        ),
      );
      logger.info({ withEmbedding: vectors.filter(Boolean).length, total: inserted.length }, "demo places embedded");
    })().catch((err) => logger.warn({ err }, "demo embedding failed"));
    waitUntil(job);
  }
  res.json({ inserted: fresh.length, removed: 0, updated: refreshed.flat().length });
});

/** Borra solo las estrellas de ejemplo; las reales no se tocan. */
router.delete("/admin/demo-places", async (_req, res) => {
  const removed = await db.delete(placesTable).where(isDemo).returning({ id: placesTable.id });
  res.json({ inserted: 0, removed: removed.length });
});

// --------------------------------------------------------------- búsquedas
router.get("/admin/searches", async (_req, res) => {
  const rows = await db
    .select({ s: searchesTable, name: residentsTable.name, phone: residentsTable.phone })
    .from(searchesTable)
    .leftJoin(residentsTable, eq(searchesTable.residentId, residentsTable.id))
    .orderBy(
      sql`case when ${searchesTable.resultCount} = 0 and not ${searchesTable.handled} then 0 else 1 end`,
      desc(searchesTable.createdAt),
    )
    .limit(200);
  res.json(
    rows.map(({ s, name, phone }) => ({
      id: s.id,
      query: s.query,
      refinedQuery: s.refinedQuery,
      residentName: name,
      residentPhone: phone,
      resultCount: s.resultCount,
      contacted: s.contactedPlaceId !== null,
      handled: s.handled,
      createdAt: s.createdAt.toISOString(),
    })),
  );
});

router.post("/admin/searches/:id/handled", async (req, res) => {
  const { id } = AdminMarkSearchHandledParams.parse(req.params);
  await db.update(searchesTable).set({ handled: true }).where(eq(searchesTable.id, id));
  res.status(204).end();
});

// ------------------------------------------------------------------ quejas
router.get("/admin/complaints", async (_req, res) => {
  const rows = await db
    .select({
      c: complaintsTable,
      placeName: placesTable.name,
      name: residentsTable.name,
      phone: residentsTable.phone,
    })
    .from(complaintsTable)
    .innerJoin(placesTable, eq(complaintsTable.placeId, placesTable.id))
    .innerJoin(residentsTable, eq(complaintsTable.residentId, residentsTable.id))
    .orderBy(complaintsTable.resolved, desc(complaintsTable.createdAt))
    .limit(200);
  res.json(
    rows.map(({ c, placeName, name, phone }) => ({
      id: c.id,
      placeName,
      residentName: name,
      residentPhone: phone,
      message: c.message,
      resolved: c.resolved,
      createdAt: c.createdAt.toISOString(),
    })),
  );
});

router.post("/admin/complaints/:id/resolve", async (req, res) => {
  const { id } = AdminResolveComplaintParams.parse(req.params);
  await db.update(complaintsTable).set({ resolved: true }).where(eq(complaintsTable.id, id));
  res.status(204).end();
});

export default router;
