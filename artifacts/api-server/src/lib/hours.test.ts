import { test } from "node:test";
import assert from "node:assert/strict";
import { isOpenNow, cleanHours } from "./hours";

// Fechas en hora de Irapuato (UTC-6, sin horario de verano).
const at = (iso: string) => new Date(`${iso}-06:00`);
const h = (open: string, close: string) => ({ open, close });
// Jueves a domingo 19:00–24:00 (tacos).
const tacos = [h("19:00", "24:00"), null, null, null, h("19:00", "24:00"), h("19:00", "24:00"), h("19:00", "24:00")];
// Viernes y sábado 20:00–02:00 (cruza medianoche).
const bar = [null, null, null, null, null, h("20:00", "02:00"), h("20:00", "02:00")];

test("abierto y cerrado en horario normal", () => {
  assert.equal(isOpenNow(tacos, at("2026-10-15T20:00:00")), true); // jueves
  assert.equal(isOpenNow(tacos, at("2026-10-14T20:00:00")), false); // miércoles
  assert.equal(isOpenNow(tacos, at("2026-10-15T18:59:00")), false);
});

test("cierre a medianoche y horario que cruza la medianoche", () => {
  assert.equal(isOpenNow(tacos, at("2026-10-15T23:59:00")), true);
  assert.equal(isOpenNow(tacos, at("2026-10-16T00:30:00")), false); // ya es viernes 00:30
  assert.equal(isOpenNow(bar, at("2026-10-17T01:30:00")), true); // sábado 01:30, del viernes
  assert.equal(isOpenNow(bar, at("2026-10-18T01:30:00")), true); // domingo 01:30, del sábado
  assert.equal(isOpenNow(bar, at("2026-10-19T01:30:00")), false); // lunes
});

test("24 horas y sin horario", () => {
  const always = cleanHours(Array(7).fill(h("00:00", "00:00")));
  assert.equal(always?.[0]?.close, "24:00");
  assert.equal(isOpenNow(always, at("2026-10-15T03:00:00")), true);
  assert.equal(isOpenNow(null), null);
  assert.equal(cleanHours([1, 2]), null);
});
