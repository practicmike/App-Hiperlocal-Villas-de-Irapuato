import { test } from "node:test";
import assert from "node:assert/strict";
import { statusFor, topShare, trendFor } from "./kpis";

test("semáforo: más es mejor", () => {
  assert.equal(statusFor(30, 30, 15), "good");
  assert.equal(statusFor(20, 30, 15), "warn");
  assert.equal(statusFor(5, 30, 15), "bad");
  assert.equal(statusFor(null, 30, 15), "none");
});

test("semáforo: menos es mejor (sin resultado, concentración)", () => {
  assert.equal(statusFor(10, 20, 35, false), "good");
  assert.equal(statusFor(30, 20, 35, false), "warn");
  assert.equal(statusFor(50, 20, 35, false), "bad");
});

test("tendencia: subir es bueno o malo según el KPI", () => {
  assert.deepEqual(trendFor(12, 8), { trend: "up", trendGood: true });
  assert.deepEqual(trendFor(12, 8, false), { trend: "up", trendGood: false });
  assert.deepEqual(trendFor(8, 8), { trend: "flat", trendGood: null });
  assert.deepEqual(trendFor(8, null), { trend: "none", trendGood: null });
});

test("equidad: % de pases que se lleva el 20% que más recibe", () => {
  assert.equal(topShare([0, 0, 0]), null);
  // 10 negocios, uno se lleva todo
  assert.equal(topShare([10, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 100);
  // reparto parejo entre 10: el 20% (2 negocios) se lleva 20%
  assert.equal(topShare([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), 20);
});
