import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  noticesTable,
  noticeReportsTable,
  noticeEventsTable,
  residentsTable,
  type NoticeKind,
} from "@workspace/db";
import {
  ReportNoticeBody,
  RecordNoticeEventParams,
  RecordNoticeEventBody,
  AdminCreateNoticeBody,
  AdminUpdateNoticeParams,
  AdminUpdateNoticeBody,
  AdminDismissNoticeReportsBody,
} from "@workspace/api-zod";
import { requireAdmin, requireResident } from "../lib/auth";
import { rateLimit } from "../lib/rate-limit";
import { hasProfanity } from "../lib/content-filter";
import { activeNotices, canonicalZone, displayZone, fileReport, knownZones, normZone, noticeDto, visibleTo } from "../lib/notices";

const router: IRouter = Router();

// ------------------------------------------------------------------ vecinos

router.get("/notices", requireResident, async (req, res) => {
  const zone = req.resident!.zone ?? null;
  const list = (await activeNotices()).filter((n) => req.resident!.role === "admin" || visibleTo(n, zone));
  res.json(list.map(noticeDto));
});

router.post("/notices/reports", requireResident, rateLimit("notice-report", 10, 60 * 60_000), async (req, res) => {
  const body = ReportNoticeBody.parse(req.body);
  if (hasProfanity(body.text)) {
    res.status(400).json({ message: "Cuéntalo sin groserías, por favor." });
    return;
  }
  const result = await fileReport({
    residentId: req.resident!.id,
    kind: body.kind as NoticeKind,
    zone: body.zone ?? null,
    text: body.text,
  });
  res.status(201).json(result);
});

router.post("/notices/:id/events", requireResident, async (req, res) => {
  const { id } = RecordNoticeEventParams.parse(req.params);
  const { kind } = RecordNoticeEventBody.parse(req.body);
  const [n] = await db.select({ id: noticesTable.id }).from(noticesTable).where(eq(noticesTable.id, id)).limit(1);
  if (!n) {
    res.status(404).json({ message: "Ese aviso ya no existe." });
    return;
  }
  await db.insert(noticeEventsTable).values({ noticeId: id, residentId: req.resident!.id, kind }).onConflictDoNothing();
  res.status(204).end();
});

// ------------------------------------------------------------------ creador

router.get("/admin/notices", requireAdmin, async (_req, res) => {
  const active = await activeNotices();
  const ids = active.map((n) => n.id);
  const counts = ids.length
    ? await db
        .select({
          noticeId: noticeEventsTable.noticeId,
          views: sql<number>`count(*) filter (where ${noticeEventsTable.kind} = 'view')::int`,
          shares: sql<number>`count(*) filter (where ${noticeEventsTable.kind} = 'share')::int`,
        })
        .from(noticeEventsTable)
        .where(inArray(noticeEventsTable.noticeId, ids))
        .groupBy(noticeEventsTable.noticeId)
    : [];
  const reportCounts = ids.length
    ? await db
        .select({ noticeId: noticeReportsTable.noticeId, n: sql<number>`count(*)::int` })
        .from(noticeReportsTable)
        .where(inArray(noticeReportsTable.noticeId, ids))
        .groupBy(noticeReportsTable.noticeId)
    : [];
  const byNotice = new Map(counts.map((c) => [c.noticeId, c]));
  const reportsBy = new Map(reportCounts.map((c) => [c.noticeId, c.n]));

  const pendingRows = await db
    .select({ r: noticeReportsTable, name: residentsTable.name })
    .from(noticeReportsTable)
    .innerJoin(residentsTable, eq(residentsTable.id, noticeReportsTable.residentId))
    .where(eq(noticeReportsTable.status, "pending"))
    .orderBy(desc(noticeReportsTable.createdAt))
    .limit(200);
  // Agrupados por tipo + zona: "3 vecinos: sin luz en Privada Roma".
  const groups = new Map<
    string,
    { kind: NoticeKind; zones: Array<string | null>; who: Set<string>; latestAt: Date; reports: Array<{ id: string; text: string; residentName: string; createdAt: string }> }
  >();
  for (const { r, name } of pendingRows) {
    const key = `${r.kind}|${normZone(r.zone) ?? ""}`;
    const g = groups.get(key) ?? { kind: r.kind, zones: [], who: new Set(), latestAt: r.createdAt, reports: [] };
    g.zones.push(r.zone);
    g.who.add(r.residentId);
    if (r.createdAt > g.latestAt) g.latestAt = r.createdAt;
    g.reports.push({ id: r.id, text: r.text, residentName: name, createdAt: r.createdAt.toISOString() });
    groups.set(key, g);
  }

  const zones = await knownZones();
  res.json({
    active: active.map((n) => ({
      ...noticeDto(n),
      views: byNotice.get(n.id)?.views ?? 0,
      shares: byNotice.get(n.id)?.shares ?? 0,
      reports: reportsBy.get(n.id) ?? 0,
    })),
    pending: [...groups.values()]
      .sort((a, b) => b.who.size - a.who.size || b.latestAt.getTime() - a.latestAt.getTime())
      .map((g) => ({
        kind: g.kind,
        zone: canonicalZone(displayZone(g.zones), zones),
        residents: g.who.size,
        latestAt: g.latestAt.toISOString(),
        reports: g.reports,
      })),
    zones,
  });
});

router.post("/admin/notices", requireAdmin, async (req, res) => {
  const body = AdminCreateNoticeBody.parse(req.body);
  const [notice] = await db
    .insert(noticesTable)
    .values({
      kind: body.kind as NoticeKind,
      title: body.title.trim(),
      body: body.body?.trim() || null,
      zone: body.zone?.trim() || null,
      source: body.source.trim(),
      confirmed: true,
      expiresAt: new Date(Date.now() + body.hours * 3_600_000),
      createdById: req.resident!.id,
    })
    .returning();
  if (body.reportIds?.length) {
    await db
      .update(noticeReportsTable)
      .set({ status: "published", noticeId: notice!.id })
      .where(and(inArray(noticeReportsTable.id, body.reportIds), eq(noticeReportsTable.status, "pending")));
  }
  res.status(201).json(noticeDto(notice!));
});

router.patch("/admin/notices/:id", requireAdmin, async (req, res) => {
  const { id } = AdminUpdateNoticeParams.parse(req.params);
  const body = AdminUpdateNoticeBody.parse(req.body);
  const set: Partial<typeof noticesTable.$inferInsert> = {};
  if (body.confirm) {
    set.confirmed = true;
  }
  if (body.close) set.closedAt = new Date();
  if (Object.keys(set).length === 0) {
    res.status(400).json({ message: "Nada que cambiar." });
    return;
  }
  const updated = await db.update(noticesTable).set(set).where(eq(noticesTable.id, id)).returning({ id: noticesTable.id });
  if (!updated.length) {
    res.status(404).json({ message: "Ese aviso ya no existe." });
    return;
  }
  res.status(204).end();
});

router.post("/admin/notice-reports/dismiss", requireAdmin, async (req, res) => {
  const { ids } = AdminDismissNoticeReportsBody.parse(req.body);
  await db
    .update(noticeReportsTable)
    .set({ status: "dismissed" })
    .where(and(inArray(noticeReportsTable.id, ids), eq(noticeReportsTable.status, "pending")));
  res.status(204).end();
});

export default router;
