// Copyright (C) 2026 Zovo.one contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function loadGlobal(relativeFile, exportName) {
    const source = await readFile(path.join(root, relativeFile), "utf8");
    const context = { console, Date, Math, URL, crypto: { randomUUID: () => "generated-id" } };
    context.globalThis = context;
    vm.runInNewContext(source, context, { filename: relativeFile });
    return context[exportName];
}

test("rule normalization keeps valid personal skip and mute regions", async () => {
    const core = await loadGlobal("trim-src/tfg-rule-core.js", "TrimForgeCore");
    const store = core.normalizeStore({
        "https://example.test/watch?v=1": {
            title: "Example",
            regions: [
                { id: "skip-1", start: 4, end: 9.25, mode: "skip" },
                { id: "mute-1", start: 12, end: 14, mode: "mute" },
                { id: "bad", start: 20, end: 19, mode: "skip" },
            ],
        },
    });
    assert.equal(Object.keys(store).length, 1);
    assert.deepEqual(store["https://example.test/watch?v=1"].regions.map((region) => region.mode), ["skip", "mute"]);
    assert.equal(store["https://example.test/watch?v=1"].regions.length, 2);
});

test("backup merge de-duplicates equivalent regions", async () => {
    const core = await loadGlobal("trim-src/tfg-rule-core.js", "TrimForgeCore");
    const current = { "https://example.test/a": { title: "A", regions: [{ id: "one", start: 1, end: 2, mode: "skip" }] } };
    const incoming = { "https://example.test/a": { title: "A2", regions: [
        { id: "different", start: 1, end: 2, mode: "skip" },
        { id: "two", start: 3, end: 4, mode: "mute" },
    ] } };
    const merged = core.mergeStores(current, incoming);
    assert.equal(merged["https://example.test/a"].regions.length, 2);
    assert.equal(merged["https://example.test/a"].title, "A2");
});

test("time formatting is stable for popup and library", async () => {
    const core = await loadGlobal("trim-src/tfg-rule-core.js", "TrimForgeCore");
    assert.equal(core.formatTime(65.25), "1:05.3");
    assert.equal(core.formatTime(3661), "1:01:01");
});

test("license grant depends on valid true, never a tier label", async () => {
    const license = await loadGlobal("trim-src/tfg-license-core.js", "TrimForgeLicense");
    assert.equal(license.isAcceptedResponse(true, { valid: true }), true);
    assert.equal(license.isAcceptedResponse(true, { valid: true, tier: "lifetime" }), true);
    assert.equal(license.isAcceptedResponse(true, { valid: true, tier: "free" }), true);
    assert.equal(license.isAcceptedResponse(true, { valid: false, tier: "pro" }), false);
    assert.equal(license.isAcceptedResponse(false, { valid: true }), false);
});

test("verified licenses fail closed after the offline window", async () => {
    const license = await loadGlobal("trim-src/tfg-license-core.js", "TrimForgeLicense");
    const now = 2_000_000_000_000;
    assert.equal(license.isCurrent({ valid: true, verifiedAt: now - 1000, expiresAt: 0 }, now), true);
    assert.equal(license.isCurrent({ valid: true, verifiedAt: now - license.OFFLINE_WINDOW_MS - 1, expiresAt: 0 }, now), false);
    assert.equal(license.isCurrent({ valid: true, verifiedAt: now - 1000, expiresAt: now - 1 }, now), false);
});

test("source and build enforce the public-key and no-tier invariants", async () => {
    const worker = await readFile(path.join(root, "trim-src/tfg-license-worker.template.js"), "utf8");
    const build = await readFile(path.join(root, "scripts/build-zovo-trim.mjs"), "utf8");
    assert.match(build, /SUPABASE_ANON_KEY must be set at build time/);
    assert.doesNotMatch(worker, /tier\s*={2,3}|\.tier/);
    assert.match(worker, /TrimForgeLicense\.isAcceptedResponse/);
});
