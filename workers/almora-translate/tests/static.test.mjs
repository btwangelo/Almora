import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const frontend = await readFile(new URL("../../../translate/app.js", import.meta.url), "utf8");

test("Worker normalizes Supabase REST/Auth suffixes before building endpoints", () => {
  assert.match(worker, /function supabaseBase\(env\)/);
  assert.ok(worker.includes("(?:rest|auth)"));
  assert.match(worker, /supabaseBase\(env\) \+ "\/rest\/v1\/" \+ path/);
  assert.match(worker, /supabaseBase\(env\) \+ "\/auth\/v1\/user"/);
});

test("health reports degraded until critical bindings and database are available", () => {
  assert.match(worker, /status: ready \? "ready" : "degraded"/);
  assert.match(worker, /checks: \{ \.\.\.config, database \}/);
});

test("batch page writes persist a deterministic idempotency key", () => {
  assert.match(worker, /batch_key: input\.batch_key/);
  assert.match(frontend, /completedKeys\.has\(batchKey\)/);
  assert.match(frontend, /page_number:nextPageNumber\+\+/);
});

test("review submission requires translated pages and a review package", () => {
  assert.match(worker, /translation_incomplete/);
  assert.match(worker, /review_package_required/);
  assert.match(worker, /status: "superseded"/);
  assert.match(worker, /action === "versions"/);
});

test("frontend restores saved work and avoids HTML injection in notices", () => {
  assert.match(frontend, /node\.textContent=String\(message/);
  assert.match(frontend, /Páginas processadas/);
  assert.match(frontend, /download-version/);
});

test("CORS allows the review-package format header", () => {
  assert.match(worker, /X-Output-Format/);
});
