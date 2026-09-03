// Copyright (C) 2026 Zovo.one contributors
// SPDX-License-Identifier: GPL-3.0-or-later

(function exposeTrimForgeCore(scope) {
    "use strict";

    const MAX_URLS = 5000;
    const MAX_REGIONS_PER_URL = 500;

    function finiteTime(value) {
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? Math.round(number * 1000) / 1000 : null;
    }

    function normalizeRegion(input) {
        const start = finiteTime(input?.start);
        const end = finiteTime(input?.end);
        if (start === null || end === null || end - start < 0.05) return null;
        return {
            id: typeof input.id === "string" && input.id.length <= 80 ? input.id : makeId(),
            start,
            end,
            mode: input.mode === "mute" ? "mute" : "skip",
            createdAt: finiteTime(input.createdAt) || Date.now(),
        };
    }

    function normalizeStore(input) {
        if (!input || typeof input !== "object" || Array.isArray(input)) return {};
        const output = {};
        for (const [rawUrl, rawEntry] of Object.entries(input).slice(0, MAX_URLS)) {
            if (typeof rawUrl !== "string" || rawUrl.length > 4096 || !rawEntry || typeof rawEntry !== "object") continue;
            const regions = Array.isArray(rawEntry.regions)
                ? rawEntry.regions.slice(0, MAX_REGIONS_PER_URL).map(normalizeRegion).filter(Boolean)
                : [];
            if (!regions.length) continue;
            output[rawUrl] = {
                title: String(rawEntry.title || "Untitled video").slice(0, 240),
                updatedAt: finiteTime(rawEntry.updatedAt) || Date.now(),
                regions: regions.sort((a, b) => a.start - b.start || a.end - b.end),
            };
        }
        return output;
    }

    function makeId() {
        if (scope.crypto?.randomUUID) return scope.crypto.randomUUID();
        return `tfg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function formatTime(value) {
        const total = Math.max(0, Number(value) || 0);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = (total % 60).toFixed(total < 600 ? 1 : 0).padStart(total < 600 ? 4 : 2, "0");
        return hours
            ? `${hours}:${String(minutes).padStart(2, "0")}:${String(Math.floor(total % 60)).padStart(2, "0")}`
            : `${minutes}:${seconds}`;
    }

    function mergeStores(current, incoming, replace = false) {
        const base = replace ? {} : normalizeStore(current);
        const addition = normalizeStore(incoming);
        for (const [url, entry] of Object.entries(addition)) {
            if (replace || !base[url]) {
                base[url] = entry;
                continue;
            }
            const ids = new Set(base[url].regions.map((region) => region.id));
            const signatures = new Set(base[url].regions.map((region) => `${region.start}|${region.end}|${region.mode}`));
            for (const region of entry.regions) {
                const signature = `${region.start}|${region.end}|${region.mode}`;
                if (!ids.has(region.id) && !signatures.has(signature)) base[url].regions.push(region);
            }
            base[url].regions.sort((a, b) => a.start - b.start || a.end - b.end);
            base[url].title = entry.title || base[url].title;
            base[url].updatedAt = Math.max(base[url].updatedAt, entry.updatedAt);
        }
        return normalizeStore(base);
    }

    scope.TrimForgeCore = Object.freeze({
        MAX_URLS,
        MAX_REGIONS_PER_URL,
        formatTime,
        makeId,
        mergeStores,
        normalizeRegion,
        normalizeStore,
    });
})(globalThis);

