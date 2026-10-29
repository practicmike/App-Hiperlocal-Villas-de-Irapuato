import crypto from "node:crypto";
import express, { Router, type IRouter } from "express";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, gte, isNull, like, ne, or, sql } from "drizzle-orm";
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
  sessionsTable,
  endorsementsTable,
  placePhotosTable,
  leadsTable,
  MAX_PHOTOS,
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
  AdminUpdateResidentParams,
  AdminUpdateResidentBody,
  AdminCreateResidentBody,
  AdminDeleteResidentParams,
  AdminDeleteVisitParams,
  AdminClearVisitsBody,
  AdminDeleteInviteParams,
  AdminDeleteSearchParams,
  AdminUploadPhotoParams,
  AdminReorderPhotosParams,
  AdminReorderPhotosBody,
  AdminDeletePhotoParams,
  AdminPublishNewsParams,
  AdminPublishNewsBody,
  AdminRemoveNewsParams,
  AdminNewsPhotoParams,
  AdminDeleteLeadParams,
  AdminMarkSearchHandledParams,
  AdminResolveComplaintParams,
} from "@workspace/api-zod";
import { requireAdmin, issueAccessKey, normalizePhone } from "../lib/auth";
import { endorsementCounts, refreshEmbedding } from "../lib/places";
import { issueMerchantKey } from "../lib/merchant";
import { photosByPlace, photoUrl, sniffImage, type PhotoRef } from "../lib/photos";
import { cleanHours } from "../lib/hours";
import { ensureSlug } from "../lib/slug";
import { activeNews, publishNews, removeNews, setNewsPhoto } from "../lib/news";
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

/**
 * Alta directa: el creador ya conoce al vecino en persona, así que entra
 * aprobado y con su llave. Sin código de invitación ni espera de aprobación.
 */
router.post("/admin/residents", async (req, res) => {
  const body = AdminCreateResidentBody.parse(req.body);
  const phone = normalizePhone(body.phone);
  if (phone.length < 12) {
    res.status(400).json({ message: "Revisa el WhatsApp (10 dígitos)." });
    return;
  }
  const [dup] = await db
    .select({ id: residentsTable.id, name: residentsTable.name })
    .from(residentsTable)
    .where(eq(residentsTable.phone, phone))
    .limit(1);
  if (dup) {
    res.status(409).json({ message: `Ese WhatsApp ya es de ${dup.name}. Búscalo en la lista y dale «Nuevo acceso».` });
    return;
  }
  const [r] = await db
    .insert(residentsTable)
    .values({
      name: body.name.trim(),
      phone,
      zone: body.zone?.trim() || null,
      status: "approved",
      approvedAt: new Date(),
      invitedById: req.resident!.id,
    })
    .returning({ id: residentsTable.id });
  res.status(201).json(await keyResponse(r!.id));
});

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

/** Corregir nombre, WhatsApp o privada de un vecino. */
router.put("/admin/residents/:id", async (req, res) => {
  const { id } = AdminUpdateResidentParams.parse(req.params);
  const body = AdminUpdateResidentBody.parse(req.body);
  const phone = normalizePhone(body.phone);
  if (phone.length < 12) {
    res.status(400).json({ message: "Revisa el WhatsApp (10 dígitos)." });
    return;
  }
  const [dup] = await db
    .select({ id: residentsTable.id })
    .from(residentsTable)
    .where(and(eq(residentsTable.phone, phone), ne(residentsTable.id, id)))
    .limit(1);
  if (dup) {
    res.status(400).json({ message: "Ese WhatsApp ya lo tiene otro vecino." });
    return;
  }
  const [row] = await db
    .update(residentsTable)
    .set({ name: body.name.trim(), phone, zone: body.zone?.trim() || null })
    .where(eq(residentsTable.id, id))
    .returning({ id: residentsTable.id });
  if (!row) {
    res.status(404).json({ message: "Vecino no encontrado." });
    return;
  }
  res.status(204).end();
});

/**
 * Borrar a un vecino por completo (pruebas, duplicados). Para alguien real que
 * ya no debe entrar es mejor "Bloquear": conserva el historial.
 */
router.delete("/admin/residents/:id", async (req, res) => {
  const { id } = AdminDeleteResidentParams.parse(req.params);
  const [target] = await db.select().from(residentsTable).where(eq(residentsTable.id, id)).limit(1);
  if (!target) {
    res.status(404).json({ message: "Vecino no encontrado." });
    return;
  }
  if (target.role === "admin" || target.id === req.resident!.id) {
    res.status(400).json({ message: "No puedes borrar la cuenta del creador." });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(sessionsTable).where(eq(sessionsTable.residentId, id));
    await tx.delete(accessKeysTable).where(eq(accessKeysTable.residentId, id));
    await tx.delete(endorsementsTable).where(eq(endorsementsTable.residentId, id));
    await tx.delete(visitsTable).where(eq(visitsTable.residentId, id));
    await tx.delete(complaintsTable).where(eq(complaintsTable.residentId, id));
    await tx.delete(searchesTable).where(eq(searchesTable.residentId, id));
    // Su código de invitación ya usado se borra (no debe volver a servir);
    // los que él creó y nadie usó, también; los que sí se usaron pasan al creador.
    await tx
      .delete(invitesTable)
      .where(or(eq(invitesTable.usedById, id), and(eq(invitesTable.createdById, id), isNull(invitesTable.usedById))));
    await tx.update(invitesTable).set({ createdById: req.resident!.id }).where(eq(invitesTable.createdById, id));
    await tx.update(residentsTable).set({ invitedById: null }).where(eq(residentsTable.invitedById, id));
    await tx.delete(residentsTable).where(eq(residentsTable.id, id));
  });
  res.status(204).end();
});

/** Solo códigos sin usar: uno usado es el registro de quién invitó a quién. */
router.delete("/admin/invites/:code", async (req, res) => {
  const { code } = AdminDeleteInviteParams.parse(req.params);
  await db.delete(invitesTable).where(and(eq(invitesTable.code, code), isNull(invitesTable.usedById)));
  res.status(204).end();
});

// ---------------------------------------------------------------- visitas
/** Historial de credenciales escaneadas: quién, dónde, cuándo y si se dio regalo. */
router.get("/admin/visits", async (_req, res) => {
  const rows = await db
    .select({
      id: visitsTable.id,
      at: visitsTable.createdAt,
      residentId: visitsTable.residentId,
      residentName: residentsTable.name,
      placeId: visitsTable.placeId,
      placeName: placesTable.name,
      welcomeApplied: visitsTable.welcomeApplied,
      welcomeOffer: visitsTable.welcomeOffer,
    })
    .from(visitsTable)
    .innerJoin(residentsTable, eq(visitsTable.residentId, residentsTable.id))
    .innerJoin(placesTable, eq(visitsTable.placeId, placesTable.id))
    .orderBy(desc(visitsTable.createdAt))
    .limit(500);
  res.json(rows.map((r) => ({ ...r, at: r.at.toISOString() })));
});

router.delete("/admin/visits/:id", async (req, res) => {
  const { id } = AdminDeleteVisitParams.parse(req.params);
  await db.delete(visitsTable).where(eq(visitsTable.id, id));
  res.status(204).end();
});

/** Borrado en bloque para limpiar pruebas: de un vecino, de un comercio o todas. */
router.post("/admin/visits/clear", async (req, res) => {
  const { residentId, placeId } = AdminClearVisitsBody.parse(req.body);
  const conds = [
    residentId ? eq(visitsTable.residentId, residentId) : undefined,
    placeId ? eq(visitsTable.placeId, placeId) : undefined,
  ].filter((c) => c !== undefined);
  const removed = await db
    .delete(visitsTable)
    .where(conds.length ? and(...conds) : sql`true`)
    .returning({ id: visitsTable.id });
  res.json({ removed: removed.length });
});

// ----------------------------------------------------------------- lugares
/** Visitas registradas por lugar, en una sola consulta. */
async function leadCounts(): Promise<Map<string, number>> {
  const rows = await db
    .select({ placeId: leadsTable.placeId, n: sql<number>`count(*)::int` })
    .from(leadsTable)
    .groupBy(leadsTable.placeId);
  return new Map(rows.map((r) => [r.placeId, r.n]));
}

async function visitCounts(): Promise<Map<string, number>> {
  const rows = await db
    .select({ placeId: visitsTable.placeId, n: sql<number>`count(*)::int` })
    .from(visitsTable)
    .groupBy(visitsTable.placeId);
  return new Map(rows.map((r) => [r.placeId, r.n]));
}

const toAdminPlace = (
  p: Place,
  counts: Map<string, number>,
  visits: Map<string, number> = new Map(),
  photos: Map<string, PhotoRef[]> = new Map(),
  leads: Map<string, number> = new Map(),
) => ({
  id: p.id,
  constellation: p.constellation,
  name: p.name,
  category: p.category,
  description: p.description,
  contactName: p.contactName,
  whatsapp: p.whatsapp,
  zone: p.zone,
  lat: p.lat,
  lng: p.lng,
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
  kind: p.kind,
  delivers: p.delivers,
  pickup: p.pickup,
  directContact: p.directContact,
  hours: p.hours ?? null,
  landM2: p.landM2,
  builtM2: p.builtM2,
  bedrooms: p.bedrooms,
  bathrooms: p.bathrooms,
  parking: p.parking,
  photos: photos.get(p.id) ?? [],
  leadCount: leads.get(p.id) ?? 0,
  slug: p.slug,
});

async function constellationById(id: string) {
  const [c] = await db.select().from(constellationsTable).where(eq(constellationsTable.id, id)).limit(1);
  return c;
}

/** Ambas o ninguna: una coordenada sola no sirve para el radar. */
function cleanCoords(lat: number | null | undefined, lng: number | null | undefined) {
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : { lat: null, lng: null };
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
    // Sin coordenadas en el cuerpo = conservar las guardadas (clientes viejos no las mandan).
    ...(body.lat !== undefined || body.lng !== undefined ? cleanCoords(body.lat, body.lng) : {}),
    // Operación y datos de la casa solo aplican a inmuebles; el precio, a todos.
    operation: isProperty ? (body.operation ?? null) : null,
    priceLabel: blank(body.priceLabel),
    imageUrl: blank(body.imageUrl),
    welcomeOffer: blank(body.welcomeOffer),
    kind: body.kind,
    delivers: body.delivers,
    pickup: isProperty ? false : body.pickup,
    directContact: isProperty ? body.directContact : false,
    hours: isProperty ? null : cleanHours(body.hours),
    landM2: isProperty ? (body.landM2 ?? null) : null,
    builtM2: isProperty ? (body.builtM2 ?? null) : null,
    bedrooms: isProperty ? (body.bedrooms ?? null) : null,
    bathrooms: isProperty ? (body.bathrooms ?? null) : null,
    parking: isProperty ? (body.parking ?? null) : null,
    verified: body.verified,
    active: body.active,
  };
}

router.get("/admin/places", async (_req, res) => {
  const [rows0, counts, visits, leads] = await Promise.all([
    db.select().from(placesTable).orderBy(desc(placesTable.updatedAt)),
    endorsementCounts(),
    visitCounts(),
    leadCounts(),
  ]);
  // Cada estrella recibe su link público la primera vez que se lista.
  const rows = await Promise.all(
    rows0.map(async (p) => (p.slug ? p : { ...p, slug: await ensureSlug(p).catch(() => null) })),
  );
  const photos = await photosByPlace(rows.map((p) => p.id));
  res.json(rows.map((p) => toAdminPlace(p, counts, visits, photos, leads)));
});

router.post("/admin/places", async (req, res) => {
  const body = AdminCreatePlaceBody.parse(req.body);
  const c = await constellationById(body.constellation);
  if (!c) {
    res.status(400).json({ message: "Esa categoría no existe." });
    return;
  }
  const [place0] = await db.insert(placesTable).values(cleanPlaceInput(body, c.isProperty)).returning();
  const place = { ...place0!, slug: await ensureSlug(place0!).catch(() => null) };
  refreshEmbedding(place);
  res.status(201).json(toAdminPlace(place, new Map()));
});

router.put("/admin/places/:id", async (req, res) => {
  const { id } = AdminUpdatePlaceParams.parse(req.params);
  const body = AdminUpdatePlaceBody.parse(req.body);
  const c = await constellationById(body.constellation);
  if (!c) {
    res.status(400).json({ message: "Esa categoría no existe." });
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
  res.json(toAdminPlace(place, await endorsementCounts(), await visitCounts(), await photosByPlace([place.id]), await leadCounts()));
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
      message: `Ya tienes ${MAX_CONSTELLATIONS} categorías, el máximo para que se lean bien en un celular. Junta o elimina una antes de crear otra.`,
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
    res.status(404).json({ message: "Categoría no encontrada." });
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
    res.status(404).json({ message: "Categoría no encontrada." });
    return;
  }
  if (all.length <= 1) {
    res.status(400).json({ message: "Necesitas al menos una categoría." });
    return;
  }
  if (target.starCount > 0) {
    if (!moveTo || moveTo === cid || !all.some((c) => c.id === moveTo)) {
      res.status(400).json({ message: `Tiene ${target.starCount} lugares. Elige a qué categoría moverlos.` });
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
// ------------------------------------------------------------- interesados
router.get("/admin/leads", async (_req, res) => {
  const rows = await db
    .select({
      id: leadsTable.id,
      placeId: leadsTable.placeId,
      placeName: placesTable.name,
      source: leadsTable.source,
      via: leadsTable.via,
      name: leadsTable.name,
      phone: leadsTable.phone,
      createdAt: leadsTable.createdAt,
    })
    .from(leadsTable)
    .innerJoin(placesTable, eq(leadsTable.placeId, placesTable.id))
    .orderBy(desc(leadsTable.createdAt))
    .limit(500);
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.delete("/admin/leads/:id", async (req, res) => {
  const { id } = AdminDeleteLeadParams.parse(req.params);
  await db.delete(leadsTable).where(eq(leadsTable.id, id));
  res.status(204).end();
});

router.post("/admin/leads/clear", async (_req, res) => {
  const removed = await db.delete(leadsTable).returning({ id: leadsTable.id });
  res.json({ removed: removed.length });
});

// --------------------------------------------------------- hoy en villas
router.get("/admin/news", async (_req, res) => {
  res.json(await activeNews());
});

router.post("/admin/places/:id/news", async (req, res) => {
  const { id } = AdminPublishNewsParams.parse(req.params);
  const { text } = AdminPublishNewsBody.parse(req.body);
  const [place] = await db.select({ id: placesTable.id }).from(placesTable).where(eq(placesTable.id, id)).limit(1);
  if (!place) {
    res.status(404).json({ message: "Lugar no encontrado." });
    return;
  }
  res.status(201).json(await publishNews(id, text));
});

router.delete("/admin/news/:id", async (req, res) => {
  const { id } = AdminRemoveNewsParams.parse(req.params);
  await removeNews({ id });
  res.status(204).end();
});

router.post("/admin/news/:id/photo", express.raw({ type: () => true, limit: "3mb" }), async (req, res) => {
  const { id } = AdminNewsPhotoParams.parse(req.params);
  const item = await setNewsPhoto(id, req.body);
  if (!item) {
    res.status(400).json({ message: "Eso no parece una foto (JPG, PNG o WebP)." });
    return;
  }
  res.json(item);
});

// ------------------------------------------------------------------ fotos
/**
 * Sube una foto como binario. El celular la manda ya reducida; aquí solo se
 * valida que de verdad sea imagen y se respeta el máximo de fotos por estrella.
 */
router.post(
  "/admin/places/:id/photos",
  express.raw({ type: () => true, limit: "3mb" }),
  async (req, res) => {
    const { id } = AdminUploadPhotoParams.parse(req.params);
    const buf = req.body as Buffer;
    const mime = Buffer.isBuffer(buf) ? sniffImage(buf) : null;
    if (!mime) {
      res.status(400).json({ message: "Eso no parece una foto (JPG, PNG o WebP)." });
      return;
    }
    const [place] = await db.select({ id: placesTable.id }).from(placesTable).where(eq(placesTable.id, id)).limit(1);
    if (!place) {
      res.status(404).json({ message: "Lugar no encontrado." });
      return;
    }
    const [count] = await db
      .select({ n: sql<number>`count(*)::int`, maxPos: sql<number>`coalesce(max(${placePhotosTable.position}), -1)::int` })
      .from(placePhotosTable)
      .where(eq(placePhotosTable.placeId, id));
    if ((count?.n ?? 0) >= MAX_PHOTOS) {
      res.status(400).json({ message: `Máximo ${MAX_PHOTOS} fotos por lugar. Borra una para subir otra.` });
      return;
    }
    const dim = (h: unknown) => Math.max(1, Math.min(10000, Number(h) || 1));
    const [photo] = await db
      .insert(placePhotosTable)
      .values({
        placeId: id,
        position: (count?.maxPos ?? -1) + 1,
        mime,
        width: dim(req.header("x-width")),
        height: dim(req.header("x-height")),
        data: buf,
      })
      .returning({ id: placePhotosTable.id, width: placePhotosTable.width, height: placePhotosTable.height });
    res.status(201).json({ id: photo!.id, url: photoUrl(photo!.id), width: photo!.width, height: photo!.height });
  },
);

router.put("/admin/places/:id/photos/order", async (req, res) => {
  const { id } = AdminReorderPhotosParams.parse(req.params);
  const { ids } = AdminReorderPhotosBody.parse(req.body);
  await db.transaction(async (tx) => {
    for (const [i, pid] of ids.entries()) {
      await tx
        .update(placePhotosTable)
        .set({ position: i })
        .where(and(eq(placePhotosTable.id, pid), eq(placePhotosTable.placeId, id)));
    }
  });
  res.status(204).end();
});

router.delete("/admin/photos/:id", async (req, res) => {
  const { id } = AdminDeletePhotoParams.parse(req.params);
  await db.delete(placePhotosTable).where(eq(placePhotosTable.id, id));
  res.status(204).end();
});

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
        .set({ constellation: p.constellation, name: p.name, category: p.category, description: p.description, contactName: p.contactName, zone: p.zone, lat: p.lat ?? null, lng: p.lng ?? null, operation: p.operation, priceLabel: p.priceLabel, welcomeOffer: p.welcomeOffer ?? null, kind: p.kind, delivers: p.delivers, pickup: p.pickup ?? false, hours: p.hours ?? null, landM2: p.landM2 ?? null, builtM2: p.builtM2 ?? null, bedrooms: p.bedrooms ?? null, bathrooms: p.bathrooms ?? null, parking: p.parking ?? null, embedding: null, updatedAt: new Date() })
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
      suggestion: s.suggestion,
      createdAt: s.createdAt.toISOString(),
    })),
  );
});

router.delete("/admin/searches/:id", async (req, res) => {
  const { id } = AdminDeleteSearchParams.parse(req.params);
  await db.delete(searchesTable).where(eq(searchesTable.id, id));
  res.status(204).end();
});

/** Limpia todas las búsquedas (pruebas); las métricas del resumen arrancan de cero. */
router.post("/admin/searches/clear", async (_req, res) => {
  const removed = await db.delete(searchesTable).returning({ id: searchesTable.id });
  res.json({ removed: removed.length });
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
