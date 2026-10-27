/**
 * Pruebas del núcleo de búsqueda. Correr con:
 *   pnpm --filter @workspace/api-server run test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MATCH_MIN,
  buildIdf,
  keywordScore,
  normalize,
  rankMatches,
  calibrateSimilarity,
  type SearchablePlace,
} from "./search-core";

const place = (p: Partial<SearchablePlace>): SearchablePlace => ({
  id: "x",
  constellation: "confianza",
  name: "",
  category: "",
  description: "",
  contactName: null,
  zone: null,
  operation: null,
  priceLabel: null,
  boost: 0,
  ...p,
});

const plomero = place({ name: "Plomería Don Beto", category: "Plomería", description: "Fugas y tinacos" });
const tacos = place({ constellation: "comercios", name: "Taquería La Privada", category: "Tacos" });
const casa = place({
  constellation: "casas",
  name: "Casa en Privada Encino",
  category: "Casa en venta",
  description: "Tres recámaras, a dos calles del colegio",
  operation: "venta",
});

test("ignora acentos y mayúsculas", () => {
  assert.equal(normalize("PLOMERÍA  Recámaras!"), "plomeria recamaras");
});

test("plomero encuentra plomería; tacos no", () => {
  assert.ok(keywordScore("necesito un plomero", plomero) >= MATCH_MIN);
  assert.ok(keywordScore("necesito un plomero", tacos) < MATCH_MIN);
});

test("sinónimo: fuga lleva a plomería", () => {
  assert.ok(keywordScore("tengo una fuga", plomero) >= MATCH_MIN);
});

test("descripción libre de casa coincide", () => {
  assert.ok(keywordScore("casa de tres recamaras cerca del colegio", casa) >= MATCH_MIN);
  assert.ok(keywordScore("casa de tres recamaras cerca del colegio", tacos) < MATCH_MIN);
});

test("solo palabras vacías no coincide con nada", () => {
  assert.equal(keywordScore("necesito algo para mi", plomero), 0);
});

test("el impulso pagado no supera a algo mucho más relevante", () => {
  const ranked = rankMatches([
    { id: "pagado", score: 0.5, boost: 100 },
    { id: "relevante", score: 0.75, boost: 0 },
  ]);
  assert.equal(ranked[0]!.id, "relevante");
});

test("el impulso sí desempata resultados parecidos", () => {
  const ranked = rankMatches([
    { id: "normal", score: 0.6, boost: 0 },
    { id: "pagado", score: 0.55, boost: 10 },
  ]);
  assert.equal(ranked[0]!.id, "pagado");
});

test("calibración acotada entre 0 y 1", () => {
  assert.equal(calibrateSimilarity(0.1), 0);
  assert.equal(calibrateSimilarity(0.9), 1);
});

test("IDF: 'casa con alberca' solo coincide con la casa que tiene alberca", () => {
  const casas = Array.from({ length: 9 }, (_, i) =>
    place({ id: `c${i}`, constellation: "casas", name: `Casa en Privada ${i}`, category: "Casa en venta", description: "Tres recámaras y jardín" }),
  );
  const conAlberca = place({ id: "alb", constellation: "casas", name: "Casa Sección Sur", category: "Casa en venta", description: "Cuatro recámaras, alberca y jardín" });
  const corpus = [...casas, conAlberca, plomero, tacos];
  const w = buildIdf(corpus);
  const hits = corpus.filter((p) => keywordScore("casa con alberca", p, w) >= MATCH_MIN).map((p) => p.id);
  assert.deepEqual(hits, ["alb"]);
});

test("IDF: palabras de relleno no hunden una búsqueda válida", () => {
  const w = buildIdf([plomero, tacos, casa]);
  assert.ok(keywordScore("necesito plomero urgente porfa", plomero, w) >= MATCH_MIN);
});

// ---------------------------------------------------------------- match con IA
import { parseMatchResponse, AI_MATCH_MIN } from "./ai-match";

const cands = [
  { id: "a", name: "Pizzas del Parque", category: "Pizzería", description: "a domicilio", zone: null, operation: null, priceLabel: null },
  { id: "b", name: "Tortillería", category: "Tortillería", description: "", zone: null, operation: null, priceLabel: null },
];

test("match IA: ordena por % y descarta lo que no sirve", () => {
  const out = parseMatchResponse(
    JSON.stringify({ matches: [{ i: 1, score: 30, reason: "no" }, { i: 0, score: 92, reason: "Pizza a domicilio" }] }),
    cands,
  );
  assert.deepEqual(out, [{ placeId: "a", score: 0.92, reason: "Pizza a domicilio" }]);
});

test("match IA: ignora índices inventados, repetidos y JSON roto", () => {
  assert.equal(parseMatchResponse("no es json", cands), null);
  const out = parseMatchResponse(
    JSON.stringify({ matches: [{ i: 7, score: 99 }, { i: 0, score: 80, reason: "x" }, { i: 0, score: 95, reason: "dup" }] }),
    cands,
  );
  assert.equal(out!.length, 1);
  assert.equal(out![0]!.score, 0.8);
  assert.ok(AI_MATCH_MIN === 50);
});

// ------------------------------------------------- IA: no esconder lo obvio
import { keepKeywordHits, wantsNow } from "./ai-match";

test("la IA no puede descartar una coincidencia obvia por palabra", () => {
  const ai = [{ placeId: "guarderia", score: 0.8, reason: "Cuida niños" }];
  const out = keepKeywordHits(ai, [
    { placeId: "guarderia", keyword: 0.3 },
    { placeId: "colegio", keyword: 0.62 },
    { placeId: "tacos", keyword: 0.1 },
  ]);
  assert.deepEqual(out.map((m) => m.placeId), ["guarderia", "colegio"]);
  assert.equal(out[1]!.reason, null);
  assert.ok(out[1]!.score <= 0.8, "lo rescatado va después de lo que la IA aprobó");
});

test("si la IA no aprueba nada, igual sale lo obvio", () => {
  const out = keepKeywordHits([], [{ placeId: "colegio", keyword: 0.62 }]);
  assert.deepEqual(out.map((m) => m.placeId), ["colegio"]);
});

test("el horario solo cuenta si el vecino tiene prisa", () => {
  assert.equal(wantsNow("busco un colegio para mi niña"), false);
  assert.equal(wantsNow("tacos abiertos ahorita"), true);
  assert.equal(wantsNow("plomero que venga hoy"), true);
});
