import { test } from "node:test";
import assert from "node:assert/strict";
import { hourInMexico, isQuiet, shouldSend } from "./push";

test("hora de Irapuato (UTC-6, sin horario de verano)", () => {
  assert.equal(hourInMexico(new Date("2026-11-08T14:00:00Z")), 8);
  assert.equal(hourInMexico(new Date("2026-07-01T05:30:00Z")), 23);
});

test("horario silencioso que cruza medianoche", () => {
  assert.equal(isQuiet(23, 22, 7), true);
  assert.equal(isQuiet(3, 22, 7), true);
  assert.equal(isQuiet(7, 22, 7), false);
  assert.equal(isQuiet(15, 22, 7), false);
  assert.equal(isQuiet(15, null, null), false);
  assert.equal(isQuiet(14, 13, 16), true, "rango de día");
});

const night = new Date("2026-11-09T05:00:00Z"); // 11 pm en Irapuato
const day = new Date("2026-11-08T20:00:00Z"); // 2 pm

test("de noche solo pasa «interesado en casa»", () => {
  assert.equal(shouldSend("interesado", null, night), true);
  assert.equal(shouldSend("queja", null, night), false);
  assert.equal(shouldSend("queja", null, day), true);
});

test("tipos apagados y resumen desactivado", () => {
  const prefs = { muted: ["reporte"], quietStart: null, quietEnd: null, digest: false };
  assert.equal(shouldSend("reporte", prefs, day), false);
  assert.equal(shouldSend("aviso_auto", prefs, day), true);
  assert.equal(shouldSend("resumen", prefs, day), false);
});
