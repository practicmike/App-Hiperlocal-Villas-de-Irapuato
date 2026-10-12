import type { Request, Response, NextFunction } from "express";

/**
 * Límite simple en memoria por IP. Suficiente para una sola instancia;
 * evita que alguien pruebe códigos o llaves por fuerza bruta.
 */
export function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
      }
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > max) {
      res.status(429).json({ message: "Demasiados intentos. Espera unos minutos." });
      return;
    }
    next();
  };
}
