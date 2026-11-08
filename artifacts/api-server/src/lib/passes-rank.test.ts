import { test } from "node:test";
import assert from "node:assert/strict";
import { rankCandidates } from "./passes-rank";

const c = (name: string, issued: number, otherConstellation = true, distance: number | null = null) => ({
  name,
  issued,
  otherConstellation,
  distance,
});

test("reparto parejo: primero el que menos pases recibió este mes", () => {
  const r = rankCandidates([c("Popular", 9), c("Nuevo", 0), c("Medio", 3)]);
  assert.deepEqual(r.map((x) => x.name), ["Nuevo", "Medio", "Popular"]);
});

test("empate: otra categoría antes que la misma", () => {
  const r = rankCandidates([c("Misma", 1, false), c("Otra", 1, true)]);
  assert.equal(r[0]!.name, "Otra");
});

test("empate total: el más cercano; sin ubicación al final", () => {
  const r = rankCandidates([c("Sin mapa", 0, true, null), c("Lejos", 0, true, 900), c("Cerca", 0, true, 120)]);
  assert.deepEqual(r.map((x) => x.name), ["Cerca", "Lejos", "Sin mapa"]);
});

test("la cercanía nunca le gana al reparto parejo", () => {
  const r = rankCandidates([c("Cerca y popular", 5, true, 50), c("Lejos sin pases", 0, true, 2000)]);
  assert.equal(r[0]!.name, "Lejos sin pases");
});
