import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq, gte, isNull, like, sql } from "drizzle-orm";
import { waitUntil } from "@vercel/functions";
import {
  db,
  accessKeysTable,
  residentsTable,
  invitesTable,
  placesTable,
  searchesTable,
  complaintsTable,
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
  AdminMarkSearchHandledParams,
  AdminResolveComplaintParams,
} from "@workspace/api-zod";
import { requireAdmin, issueAccessKey, normalizePhone } from "../lib/auth";
import { endorsementCounts, refreshEmbedding } from "../lib/places";
import { DEMO_PLACES, DEMO_WHATSAPP_PREFIX } from "../lib/demo-places";
import { embedMany } from "../lib/ai";
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
const toAdminPlace = (p: Place, counts: Map<string, number>) => ({
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
});

function cleanPlaceInput(body: ReturnType<typeof AdminCreatePlaceBody.parse>) {
  const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  return {
    constellation: body.constellation,
    name: body.name.trim(),
    category: body.category.trim(),
    description: body.description.trim(),
    contactName: blank(body.contactName),
    whatsapp: normalizePhone(body.whatsapp),
    zone: blank(body.zone),
    // Operación y precio solo aplican a casas.
    operation: body.constellation === "casas" ? (body.operation ?? null) : null,
    priceLabel: body.constellation === "casas" ? blank(body.priceLabel) : null,
    imageUrl: blank(body.imageUrl),
    verified: body.verified,
    active: body.active,
  };
}

router.get("/admin/places", async (_req, res) => {
  const [rows, counts] = await Promise.all([
    db.select().from(placesTable).orderBy(desc(placesTable.updatedAt)),
    endorsementCounts(),
  ]);
  res.json(rows.map((p) => toAdminPlace(p, counts)));
});

router.post("/admin/places", async (req, res) => {
  const body = AdminCreatePlaceBody.parse(req.body);
  const [place] = await db.insert(placesTable).values(cleanPlaceInput(body)).returning();
  refreshEmbedding(place!);
  res.status(201).json(toAdminPlace(place!, new Map()));
});

router.put("/admin/places/:id", async (req, res) => {
  const { id } = AdminUpdatePlaceParams.parse(req.params);
  const body = AdminUpdatePlaceBody.parse(req.body);
  const [place] = await db
    .update(placesTable)
    .set({ ...cleanPlaceInput(body), embedding: null, updatedAt: new Date() })
    .where(eq(placesTable.id, id))
    .returning();
  if (!place) {
    res.status(404).json({ message: "Lugar no encontrado." });
    return;
  }
  refreshEmbedding(place);
  res.json(toAdminPlace(place, await endorsementCounts()));
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

// --------------------------------------------------------- datos de ejemplo
const isDemo = like(placesTable.whatsapp, `${DEMO_WHATSAPP_PREFIX}%`);

/** Carga las 30 estrellas de ejemplo (si ya están, no las duplica). */
router.post("/admin/demo-places", async (_req, res) => {
  const existing = new Set(
    (await db.select({ whatsapp: placesTable.whatsapp }).from(placesTable).where(isDemo)).map((r) => r.whatsapp),
  );
  const missing = DEMO_PLACES.filter((p) => !existing.has(p.whatsapp));
  const fresh = missing.length ? await db.insert(placesTable).values(missing).returning() : [];
  // Los ejemplos ya cargados se actualizan con las descripciones más recientes.
  const refreshed = await Promise.all(
    DEMO_PLACES.filter((p) => existing.has(p.whatsapp)).map((p) =>
      db
        .update(placesTable)
        .set({ name: p.name, category: p.category, description: p.description, contactName: p.contactName, zone: p.zone, operation: p.operation, priceLabel: p.priceLabel, embedding: null, updatedAt: new Date() })
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
