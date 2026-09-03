// Copyright (C) 2026 Zovo.one contributors
// SPDX-License-Identifier: GPL-3.0-or-later

import { mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "store-assets");
const candidates = [
    process.env.QA_CHROME_PATH,
    "/tmp/zovo-trim-chrome/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    chromium.executablePath(),
].filter(Boolean);
let executablePath;
for (const candidate of candidates) {
    try { await readFile(candidate); executablePath = candidate; break; } catch {}
}
if (!executablePath) throw new Error("Chrome for Testing is unavailable");
await mkdir(output, { recursive: true });
const profile = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp(path.join(tmpdir(), "tfg-assets-")));
const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath,
    ignoreDefaultArgs: ["--disable-extensions"],
    viewport: { width: 1280, height: 800 },
    args: [
        `--disable-extensions-except=${path.join(root, "dist")}`,
        `--load-extension=${path.join(root, "dist")}`,
        "--no-first-run",
        "--disable-default-apps",
    ],
});

try {
    let worker = context.serviceWorkers().find((item) => item.url().endsWith("/tfg-license-worker.js"));
    if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 10_000 });
    const extensionId = new URL(worker.url()).host;
    await worker.evaluate(async () => chrome.storage.local.set({
        trimforge_v1_rules: {
            "https://video.example/documentary": { title: "The deep-ocean documentary", updatedAt: Date.now(), regions: [
                { id: "a", start: 18.2, end: 42.8, mode: "skip", createdAt: Date.now() },
                { id: "b", start: 301, end: 318.5, mode: "mute", createdAt: Date.now() },
            ] },
            "https://learning.example/course/lesson-4": { title: "Course lesson 4", updatedAt: Date.now() - 1000, regions: [
                { id: "c", start: 0, end: 11.4, mode: "skip", createdAt: Date.now() },
            ] },
            "https://media.example/interview": { title: "Studio interview", updatedAt: Date.now() - 2000, regions: [
                { id: "d", start: 93, end: 106, mode: "mute", createdAt: Date.now() },
            ] },
        },
    }));
    for (const existing of context.pages()) await existing.close();
    const page = await context.newPage();

    for (const [scheme, filename] of [["light", "screenshot-01.png"], ["dark", "screenshot-02.png"]]) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(`chrome-extension://${extensionId}/tfg-library.html`, { waitUntil: "load" });
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(output, filename) });
    }

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`chrome-extension://${extensionId}/tfg-welcome.html`, { waitUntil: "load" });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(output, "screenshot-03.png") });
    await page.click("#tfg-next");
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, "screenshot-04.png") });
    console.log(`Store screenshots written to ${output}`);
} finally {
    await context.close();
    const { rm } = await import("node:fs/promises");
    await rm(profile, { recursive: true, force: true });
}
