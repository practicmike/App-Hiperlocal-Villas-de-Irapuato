import { test } from "node:test";
import assert from "node:assert/strict";
import { autoTitle, canonicalZone, displayZone, hasConsensus, normZone, visibleTo } from "./notices";

test("zonas escritas distinto se reconocen igual", () => {
  assert.equal(normZone("Privada Roma"), "roma");
  assert.equal(normZone("  priv. ROMA "), "roma");
  assert.equal(normZone("Sección Álamos"), "alamos");
  assert.equal(normZone(""), null);
  assert.equal(normZone(null), null);
});

test("quién ve qué aviso", () => {
  assert.equal(visibleTo({ zone: null, kind: "agua" }, "Roma"), true, "toda Villas: todos");
  assert.equal(visibleTo({ zone: "Privada Roma", kind: "agua" }, "roma"), true, "su privada");
  assert.equal(visibleTo({ zone: "Privada Roma", kind: "agua" }, "Álamos"), false, "otra privada no");
  assert.equal(visibleTo({ zone: "Privada Roma", kind: "calle" }, "Álamos"), true, "calle cerrada: todos");
  assert.equal(visibleTo({ zone: "Privada Roma", kind: "luz" }, null), true, "sin privada registrada: todos");
});

const now = new Date("2026-11-08T15:00:00Z");
const r = (residentId: string, minAgo: number, zone: string | null = "Roma", kind: "agua" | "luz" = "luz") => ({
  residentId,
  kind,
  zone,
  createdAt: new Date(now.getTime() - minAgo * 60_000),
});

test("consenso: 3 vecinos distintos, misma zona y tipo, en 1 hora", () => {
  assert.equal(hasConsensus([r("a", 5), r("b", 20), r("c", 50)], "luz", "Privada Roma", now).reached, true);
});

test("sin consenso: el mismo vecino 3 veces no cuenta", () => {
  assert.deepEqual(hasConsensus([r("a", 5), r("a", 6), r("a", 7)], "luz", "Roma", now), { count: 1, reached: false });
});

test("sin consenso: fuera de la hora, otra zona u otro tipo", () => {
  assert.equal(hasConsensus([r("a", 5), r("b", 20), r("c", 61)], "luz", "Roma", now).reached, false);
  assert.equal(hasConsensus([r("a", 5), r("b", 20), r("c", 30, "Álamos")], "luz", "Roma", now).reached, false);
  assert.equal(hasConsensus([r("a", 5), r("b", 20), r("c", 30, "Roma", "agua")], "luz", "Roma", now).reached, false);
});

test("título automático no usa texto de vecinos", () => {
  assert.equal(autoTitle("luz", "Privada Roma"), "Sin luz en Privada Roma");
  assert.equal(autoTitle("agua", null), "Sin agua en Villas");
});

test("la zona del aviso usa la forma que más escribieron los vecinos", () => {
  assert.equal(displayZone(["Privada Roma", "priv. ROMA", "Privada Roma"]), "Privada Roma");
  assert.equal(displayZone(["roma", "Privada Roma"]), "Privada Roma");
  assert.equal(displayZone([null, null]), null);
});

test("zona canónica: la que registraron los vecinos", () => {
  assert.equal(canonicalZone("roma", ["Álamos", "Privada Roma"]), "Privada Roma");
  assert.equal(canonicalZone("Paseo del Amor", ["Privada Roma"]), "Paseo del Amor");
  assert.equal(canonicalZone(null, ["Privada Roma"]), null);
});
