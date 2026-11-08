import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pushPrefsTable, pushSubscriptionsTable } from "@workspace/db";
import { AdminAddPushSubscriptionBody, AdminRemovePushSubscriptionBody, AdminUpdatePushPrefsBody } from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth";
import { DEFAULT_PREFS, PUSH_KINDS, pushAvailable, sendDigest, sendTest, vapidPublicKey } from "../lib/push";

const router: IRouter = Router();
const KIND_IDS = new Set<string>(PUSH_KINDS.map((k) => k.id));

router.get("/admin/push", requireAdmin, async (req, res) => {
  const id = req.resident!.id;
  const [prefs] = await db.select().from(pushPrefsTable).where(eq(pushPrefsTable.residentId, id));
  const devices = await db
    .select({ endpoint: pushSubscriptionsTable.endpoint, label: pushSubscriptionsTable.label, createdAt: pushSubscriptionsTable.createdAt })
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.residentId, id));
  res.json({
    available: pushAvailable(),
    publicKey: vapidPublicKey(),
    kinds: PUSH_KINDS,
    muted: (prefs ?? DEFAULT_PREFS).muted,
    quietStart: (prefs ?? DEFAULT_PREFS).quietStart,
    quietEnd: (prefs ?? DEFAULT_PREFS).quietEnd,
    digest: (prefs ?? DEFAULT_PREFS).digest,
    devices: devices.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
  });
});

router.put("/admin/push/prefs", requireAdmin, async (req, res) => {
  const body = AdminUpdatePushPrefsBody.parse(req.body);
  const values = {
    residentId: req.resident!.id,
    muted: body.muted.filter((k) => KIND_IDS.has(k)),
    quietStart: body.quietStart ?? null,
    quietEnd: body.quietEnd ?? null,
    digest: body.digest,
    updatedAt: new Date(),
  };
  await db.insert(pushPrefsTable).values(values).onConflictDoUpdate({ target: pushPrefsTable.residentId, set: values });
  res.status(204).end();
});

router.post("/admin/push/subscriptions", requireAdmin, async (req, res) => {
  const body = AdminAddPushSubscriptionBody.parse(req.body);
  if (!/^https:\/\//.test(body.endpoint)) {
    res.status(400).json({ message: "Suscripción inválida." });
    return;
  }
  const values = {
    endpoint: body.endpoint,
    residentId: req.resident!.id,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    label: body.label?.trim() || null,
  };
  await db
    .insert(pushSubscriptionsTable)
    .values(values)
    .onConflictDoUpdate({ target: pushSubscriptionsTable.endpoint, set: values });
  res.status(204).end();
});

router.post("/admin/push/subscriptions/remove", requireAdmin, async (req, res) => {
  const { endpoint } = AdminRemovePushSubscriptionBody.parse(req.body);
  await db
    .delete(pushSubscriptionsTable)
    .where(and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.residentId, req.resident!.id)));
  res.status(204).end();
});

router.post("/admin/push/test", requireAdmin, async (req, res) => {
  res.json({ sent: await sendTest(req.resident!.id) });
});

/**
 * Resumen diario. Lo llama el cron de Vercel (vercel.json) a las 8 am de Irapuato
 * con «Authorization: Bearer CRON_SECRET». Sin CRON_SECRET configurado, no corre.
 */
router.get("/cron/digest", async (req, res) => {
  const secret = process.env["CRON_SECRET"] ?? "";
  const got = req.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const ok = secret.length > 0 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!ok) {
    res.status(401).json({ message: "No autorizado." });
    return;
  }
  res.json({ sent: await sendDigest() });
});

export default router;
