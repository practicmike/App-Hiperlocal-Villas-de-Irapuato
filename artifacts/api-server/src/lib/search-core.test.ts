/**
 * Pruebas del núcleo de búsqueda. Correr con:
 *   pnpm --filter @workspace/api-server run test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MATCH_MIN,
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
