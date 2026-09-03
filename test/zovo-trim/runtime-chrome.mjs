// Copyright (C) 2026 Zovo.one contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const axeSource = await readFile("/Users/mike/Desktop/zovo-ext/engine/7-live-qa/node_modules/axe-core/axe.min.js", "utf8");
const chromeCandidates = [
    process.env.QA_CHROME_PATH,
    "/tmp/zovo-trim-chrome/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    chromium.executablePath(),
].filter(Boolean);
let executablePath = null;
for (const candidate of chromeCandidates) {
    try {
        await readFile(candidate);
        executablePath = candidate;
        break;
    } catch {}
}
if (!executablePath) throw new Error("Chrome for Testing is unavailable");

const fixtureDir = path.join(root, "test/zovo-trim");
const server = createServer(async (request, response) => {
    const name = request.url === "/fixture.mp4" ? "fixture.mp4" : "fixture.html";
    try {
        const body = await readFile(path.join(fixtureDir, name));
        if (name.endsWith(".mp4") && request.headers.range) {
            const match = /bytes=(\d+)-(\d*)/.exec(request.headers.range);
            const start = Number(match?.[1] || 0);
            const end = Math.min(Number(match?.[2] || body.length - 1), body.length - 1);
            response.writeHead(206, {
                "Accept-Ranges": "bytes",
                "Content-Length": end - start + 1,
                "Content-Range": `bytes ${start}-${end}/${body.length}`,
                "Content-Type": "video/mp4",
            });
            response.end(body.subarray(start, end + 1));
        } else {
            response.writeHead(200, {
                "Accept-Ranges": name.endsWith(".mp4") ? "bytes" : "none",
                "Content-Length": body.length,
                "Content-Type": name.endsWith(".mp4") ? "video/mp4" : "text/html; charset=utf-8",
            });
            response.end(body);
        }
    } catch {
        response.writeHead(404).end();
    }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const fixtureUrl = `http://127.0.0.1:${address.port}/fixture.html`;
const profile = await mkdtemp(path.join(tmpdir(), "zovo-trim-runtime-"));
let context;

async function assertA11y(page, name) {
    await page.evaluate(axeSource);
    const result = await page.evaluate(() => axe.run());
    const blocking = result.violations.filter((violation) => ["critical", "serious"].includes(violation.impact));
    assert.equal(blocking.length, 0, `${name} accessibility violations: ${blocking.map((item) => `${item.id}: ${item.nodes.map((node) => `${node.target.join(" ")} (${node.failureSummary})`).join("; ")}`).join(", ")}`);
}

try {
    context = await chromium.launchPersistentContext(profile, {
        headless: process.env.HEADFUL_TEST !== "1",
        executablePath,
        ignoreDefaultArgs: ["--disable-extensions"],
        acceptDownloads: true,
        args: [
            `--disable-extensions-except=${path.join(root, "dist")}`,
            `--load-extension=${path.join(root, "dist")}`,
            "--autoplay-policy=no-user-gesture-required",
            "--no-first-run",
            "--disable-default-apps",
        ],
    });
    let worker = context.serviceWorkers().find((item) => item.url().endsWith("/tfg-license-worker.js"));
    if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const extensionId = new URL(worker.url()).host;
    const extensionState = await worker.evaluate(async () => ({ manifest: chrome.runtime.getManifest().content_scripts, permissions: await chrome.permissions.getAll() }));
    assert.equal(extensionState.manifest[0].all_frames, true);
    assert(extensionState.permissions.origins.includes("<all_urls>"));

    await worker.evaluate(async ({ fixtureUrl }) => {
        await chrome.storage.local.set({
            trimforge_v1_enabled: true,
            trimforge_v1_rules: {
                [fixtureUrl]: {
                    title: "Trim runtime fixture",
                    updatedAt: Date.now(),
                    regions: [
                        { id: "runtime-skip", start: 1, end: 3, mode: "skip", createdAt: Date.now() },
                        { id: "runtime-mute", start: 4, end: 6, mode: "mute", createdAt: Date.now() },
                    ],
                },
            },
        });
    }, { fixtureUrl });

    for (const page of context.pages()) await page.close();
    const page = await context.newPage();
    await page.goto(fixtureUrl, { waitUntil: "load" });
    await page.waitForSelector("video");
    await page.waitForFunction(() => document.querySelector("video").readyState >= 1, null, { timeout: 5000 });
    await page.waitForTimeout(1200);
    const routedStatus = await worker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return chrome.tabs.sendMessage(tab.id, { type: "tfg:command", command: "status" });
    });
    assert.equal(routedStatus.ok, true, JSON.stringify(routedStatus));
    assert.equal(routedStatus.pageKey, fixtureUrl);

    await page.evaluate(async () => {
        const video = document.querySelector("video");
        video.muted = true;
        video.currentTime = 0.8;
        await video.play();
    });
    const skipSamples = [];
    for (let index = 0; index < 40; index += 1) {
        await page.waitForTimeout(100);
        skipSamples.push(await page.locator("video").evaluate((video) => ({ time: video.currentTime, paused: video.paused, ready: video.readyState })));
        if (skipSamples.at(-1).time >= 3) break;
    }
    const afterSkip = skipSamples.at(-1).time;
    assert(afterSkip >= 3, `skip region did not seek to its end: ${JSON.stringify(skipSamples)}`);

    await page.locator("video").evaluate((video) => {
        video.currentTime = 3.9;
        video.muted = false;
    });
    const muteSamples = [];
    for (let index = 0; index < 30; index += 1) {
        await page.waitForTimeout(100);
        muteSamples.push(await page.locator("video").evaluate((video) => ({ time: video.currentTime, muted: video.muted })));
        if (muteSamples.at(-1).time >= 6.1) break;
    }
    assert(muteSamples.some((sample) => sample.muted && sample.time >= 4 && sample.time < 6), `mute region was not observed: ${JSON.stringify(muteSamples)}`);
    assert.equal(muteSamples.at(-1).muted, false, `mute state was not restored: ${JSON.stringify(muteSamples)}`);

    await page.locator("video").evaluate((video) => { video.pause(); video.currentTime = 7; });
    await page.waitForTimeout(1200);
    const start = await worker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return chrome.tabs.sendMessage(tab.id, { type: "tfg:command", command: "captureStart" });
    });
    assert.equal(start.ok, true);
    assert(Math.abs(start.pendingStart - 7) < 0.2, `captured start was ${start.pendingStart}`);
    await page.locator("video").evaluate((video) => { video.currentTime = 8.5; });
    const end = await worker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return chrome.tabs.sendMessage(tab.id, { type: "tfg:command", command: "captureEnd", payload: { mode: "mute" } });
    });
    assert.equal(end.ok, true);
    assert.equal(end.region.mode, "mute");

    const library = await context.newPage();
    await library.goto(`chrome-extension://${extensionId}/tfg-library.html`, { waitUntil: "load" });
    await library.waitForSelector("#tfg-export:not([disabled])");
    const downloadPromise = library.waitForEvent("download");
    await library.click("#tfg-export");
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^personal-video-regions-\d{4}-\d{2}-\d{2}\.json$/);
    const downloadText = await readFile(await download.path(), "utf8");
    const exported = JSON.parse(downloadText);
    assert.equal(exported.schema, "trimforge/1");
    assert.equal(exported.urls[fixtureUrl].regions.length, 3);

    const importedUrl = `${fixtureUrl}?imported=1`;
    await library.setInputFiles("#tfg-import", {
        name: "personal-regions.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({
            schema: "trimforge/1",
            urls: {
                [importedUrl]: {
                    title: "Imported personal video",
                    updatedAt: Date.now(),
                    regions: [{ id: "imported", start: 2, end: 5, mode: "skip", createdAt: Date.now() }],
                },
            },
        })),
    });
    await library.waitForFunction(() => document.querySelector("#tfg-library-status").textContent.includes("imported"));
    const stored = await worker.evaluate(() => chrome.storage.local.get("trimforge_v1_rules"));
    assert.equal(stored.trimforge_v1_rules[importedUrl].regions[0].mode, "skip");
    await assertA11y(library, "library");

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/tfg-popup.html`, { waitUntil: "load" });
    await popup.waitForTimeout(500);
    await assertA11y(popup, "popup");

    const welcome = await context.newPage();
    await welcome.goto(`chrome-extension://${extensionId}/tfg-welcome.html`, { waitUntil: "load" });
    await welcome.waitForTimeout(500);
    await assertA11y(welcome, "onboarding step 1");
    await welcome.click("#tfg-next");
    await welcome.waitForTimeout(500);
    assert.equal(await welcome.locator('[data-step="1"]').isVisible(), true);
    await assertA11y(welcome, "onboarding step 2");
    await welcome.click("#tfg-next");
    await welcome.waitForTimeout(500);
    assert.equal(await welcome.locator('[data-step="2"]').isVisible(), true);
    await assertA11y(welcome, "onboarding step 3");

    console.log(JSON.stringify({
        browser: await context.browser().version(),
        extensionId,
        skip: "pass",
        muteAndRestore: "pass",
        captureStartEnd: "pass",
        jsonExportImport: "pass",
        accessibility: "pass",
        onboardingNavigation: "pass",
    }, null, 2));
} finally {
    await context?.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    await rm(profile, { recursive: true, force: true });
}
