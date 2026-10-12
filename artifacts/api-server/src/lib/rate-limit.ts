import type { Request, Response, NextFunction } from "express";
import { lt, sql } from "drizzle-orm";
import { db, rateLimitsTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Límite de intentos por IP, guardado en Postgres.
 * Antes vivía en memoria, pero en Vercel cada función tiene su propia memoria
 * y el contador se repartía: alguien podía probar códigos sin freno real.
 * Una sola consulta atómica suma el intento o reinicia la ventana si ya venció.
 */
export function rateLimit(bucket: string, max: number, windowMs: number) {
  const seconds = Math.ceil(windowMs / 1000);
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `${bucket}:${req.ip ?? "unknown"}`;
    try {
      const [row] = await db
        .insert(rateLimitsTable)
        .values({ key, count: 1, resetAt: sql`now() + make_interval(secs => ${seconds})` })
        .onConflictDoUpdate({
          target: rateLimitsTable.key,
          set: {
            count: sql`case when ${rateLimitsTable.resetAt} < now() then 1 else ${rateLimitsTable.count} + 1 end`,
            resetAt: sql`case when ${rateLimitsTable.resetAt} < now() then now() + make_interval(secs => ${seconds}) else ${rateLimitsTable.resetAt} end`,
          },
        })
        .returning({ count: rateLimitsTable.count });

      // Limpieza ocasional de ventanas viejas, sin tarea programada aparte.
      if (Math.random() < 0.01) {
        void db
          .delete(rateLimitsTable)
          .where(lt(rateLimitsTable.resetAt, sql`now() - interval '1 day'`))
          .catch(() => {});
      }

      if (row && row.count > max) {
        res.status(429).json({ message: "Demasiados intentos. Espera unos minutos." });
        return;
      }
    } catch (err) {
      // Si la base falla aquí, no se bloquea al vecino: la ruta igual valida todo.
      logger.warn({ err, bucket }, "rate limit check failed");
    }
    next();
  };
}
