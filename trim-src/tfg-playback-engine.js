// Copyright (C) 2026 Zovo.one contributors
// SPDX-License-Identifier: GPL-3.0-or-later

(function startTrimForgePlayback() {
    "use strict";

    const RULES_KEY = "trimforge_v1_rules";
    const ENABLED_KEY = "trimforge_v1_enabled";
    const STATS_KEY = "trimforge_v1_stats";
    const core = globalThis.TrimForgeCore;
    const controllers = new Map();
    let rules = {};
    let enabled = true;
    let pageKey = "";
    let pendingStart = null;
    let lastLocation = location.href;

    class PlaybackController {
        constructor(video) {
            this.video = video;
            this.timer = null;
            this.ownedMute = false;
            this.mutedBeforeRegion = false;
            this.lastSkipId = "";
            this.lastSkipAt = 0;
            this.boundEvaluate = () => this.evaluate();
            for (const event of ["play", "playing", "seeking", "seeked", "ratechange", "loadedmetadata", "durationchange", "emptied"]) {
                video.addEventListener(event, this.boundEvaluate, { passive: true });
            }
            this.evaluate();
        }

        destroy() {
            clearTimeout(this.timer);
            this.restoreMute();
            for (const event of ["play", "playing", "seeking", "seeked", "ratechange", "loadedmetadata", "durationchange", "emptied"]) {
                this.video.removeEventListener(event, this.boundEvaluate);
            }
        }

        restoreMute() {
            if (this.ownedMute) this.video.muted = this.mutedBeforeRegion;
            this.ownedMute = false;
        }

        schedule(seconds) {
            clearTimeout(this.timer);
            if (this.video.paused || !Number.isFinite(seconds)) return;
            const delay = Math.max(16, Math.min(10_000, seconds * 1000 / Math.max(0.1, this.video.playbackRate || 1)));
            this.timer = setTimeout(this.boundEvaluate, delay);
        }

        evaluate() {
            clearTimeout(this.timer);
            if (!enabled || !pageKey || !document.contains(this.video)) {
                this.restoreMute();
                return;
            }
            const regions = rules[pageKey]?.regions || [];
            const now = Number(this.video.currentTime || 0);
            const muteRegion = regions.find((region) => region.mode === "mute" && region.start <= now && now < region.end);

            if (muteRegion) {
                if (!this.ownedMute) {
                    this.mutedBeforeRegion = this.video.muted;
                    this.ownedMute = !this.video.muted;
                }
                if (this.ownedMute && !this.video.muted) this.video.muted = true;
            } else {
                this.restoreMute();
            }

            const skipRegion = regions.find((region) => region.mode === "skip" && region.start <= now && now < region.end);
            if (skipRegion && (this.lastSkipId !== skipRegion.id || Date.now() - this.lastSkipAt > 1000)) {
                let target = skipRegion.end;
                let extended = true;
                while (extended) {
                    extended = false;
                    for (const region of regions) {
                        if (region.mode === "skip" && region.start <= target + 0.02 && region.end > target) {
                            target = region.end;
                            extended = true;
                        }
                    }
                }
                this.lastSkipId = skipRegion.id;
                this.lastSkipAt = Date.now();
                const capped = Number.isFinite(this.video.duration) ? Math.min(target, this.video.duration) : target;
                this.video.currentTime = capped;
                void recordAction("skip", Math.max(0, capped - now));
                this.schedule(0.05);
                return;
            }

            const futureBoundaries = [];
            for (const region of regions) {
                if (region.start > now + 0.0005) futureBoundaries.push(region.start - now);
                if (region.mode === "mute" && region.end > now + 0.0005) futureBoundaries.push(region.end - now);
            }
            this.schedule(futureBoundaries.length ? Math.min(...futureBoundaries) : 10);
        }
    }

    async function recordAction(mode, seconds) {
        const state = await chrome.storage.local.get(STATS_KEY);
        const stats = state[STATS_KEY] || {};
        await chrome.storage.local.set({
            [STATS_KEY]: {
                actions: Number(stats.actions || 0) + 1,
                seconds: Math.round((Number(stats.seconds || 0) + seconds) * 1000) / 1000,
                lastMode: mode,
            },
        });
    }

    function activeVideo() {
        return [...controllers.keys()]
            .filter((video) => document.contains(video))
            .sort((a, b) => Number(a.paused) - Number(b.paused)
                || (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0] || null;
    }

    function scanVideos() {
        for (const video of document.querySelectorAll("video")) {
            if (!controllers.has(video)) controllers.set(video, new PlaybackController(video));
        }
        for (const [video, controller] of controllers) {
            if (!document.contains(video)) {
                controller.destroy();
                controllers.delete(video);
            }
        }
    }

    function evaluateAll() {
        scanVideos();
        for (const controller of controllers.values()) controller.evaluate();
    }

    async function resolvePageKey() {
        try {
            const response = await chrome.runtime.sendMessage({ type: "tfg:getPageKey" });
            if (response?.pageKey && response.pageKey !== pageKey) {
                pageKey = response.pageKey;
                pendingStart = null;
                evaluateAll();
            }
        } catch {
            pageKey = location.href.split("#")[0];
        }
    }

    async function refreshState() {
        const state = await chrome.storage.local.get([RULES_KEY, ENABLED_KEY]);
        rules = core.normalizeStore(state[RULES_KEY]);
        enabled = state[ENABLED_KEY] !== false;
        evaluateAll();
    }

    async function getStatus() {
        scanVideos();
        const video = activeVideo();
        return {
            ok: Boolean(video),
            pageKey,
            title: document.title,
            time: video ? Number(video.currentTime || 0) : 0,
            duration: video && Number.isFinite(video.duration) ? video.duration : 0,
            paused: video ? video.paused : true,
            pendingStart,
            enabled,
            regions: rules[pageKey]?.regions || [],
            error: video ? "" : "No HTML5 video is available in this frame.",
        };
    }

    async function captureStart() {
        const video = activeVideo();
        if (!video) return { ok: false, error: "No HTML5 video is available on this page." };
        pendingStart = Math.round(Number(video.currentTime || 0) * 1000) / 1000;
        return { ok: true, pendingStart, status: await getStatus() };
    }

    async function captureEnd(mode) {
        const video = activeVideo();
        if (!video) return { ok: false, error: "No HTML5 video is available on this page." };
        if (!Number.isFinite(pendingStart)) return { ok: false, error: "Set the start point first." };
        const end = Math.round(Number(video.currentTime || 0) * 1000) / 1000;
        if (end - pendingStart < 0.05) return { ok: false, error: "Move at least 0.05 seconds past the start point." };

        const entitlement = await chrome.runtime.sendMessage({ type: "tfg:getEntitlement" });
        const isNewUrl = !rules[pageKey];
        if (isNewUrl && !entitlement?.pro && Object.keys(rules).length >= Number(entitlement?.freeUrlLimit || 10)) {
            return { ok: false, capped: true, error: "The free saved-URL allowance is full. Export remains available in Library." };
        }

        const region = core.normalizeRegion({
            id: core.makeId(),
            start: pendingStart,
            end,
            mode: mode === "mute" ? "mute" : "skip",
            createdAt: Date.now(),
        });
        const entry = rules[pageKey] || { title: document.title, regions: [], updatedAt: 0 };
        entry.title = document.title || entry.title;
        entry.updatedAt = Date.now();
        entry.regions = [...entry.regions, region].sort((a, b) => a.start - b.start || a.end - b.end);
        rules = { ...rules, [pageKey]: entry };
        pendingStart = null;
        await chrome.storage.local.set({ [RULES_KEY]: rules });
        evaluateAll();
        return { ok: true, region, status: await getStatus() };
    }

    async function deleteRegion(id) {
        const entry = rules[pageKey];
        if (!entry) return { ok: false, error: "This page has no saved regions." };
        const regions = entry.regions.filter((region) => region.id !== id);
        if (regions.length) {
            rules = { ...rules, [pageKey]: { ...entry, regions, updatedAt: Date.now() } };
        } else {
            const next = { ...rules };
            delete next[pageKey];
            rules = next;
        }
        await chrome.storage.local.set({ [RULES_KEY]: rules });
        evaluateAll();
        return { ok: true, status: await getStatus() };
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type !== "tfg:command") return undefined;
        const jobs = {
            status: getStatus,
            captureStart,
            captureEnd: () => captureEnd(message.payload?.mode),
            deleteRegion: () => deleteRegion(message.payload?.id),
            clearPending: async () => {
                pendingStart = null;
                return { ok: true, status: await getStatus() };
            },
        };
        const job = jobs[message.command];
        if (!job) return false;
        Promise.resolve(job()).then(sendResponse);
        return true;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && (changes[RULES_KEY] || changes[ENABLED_KEY])) void refreshState();
    });

    new MutationObserver(scanVideos).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("pointerdown", () => {
        const video = activeVideo();
        if (video) void chrome.runtime.sendMessage({
            type: "tfg:videoActivity",
            playing: !video.paused,
            area: video.clientWidth * video.clientHeight,
        });
    }, { capture: true, passive: true });

    setInterval(() => {
        scanVideos();
        const video = activeVideo();
        if (video) void chrome.runtime.sendMessage({
            type: "tfg:videoActivity",
            playing: !video.paused,
            area: video.clientWidth * video.clientHeight,
        });
        if (lastLocation !== location.href) {
            lastLocation = location.href;
            void resolvePageKey();
        } else {
            // The top-level URL can change while an embedded frame's location does not.
            void resolvePageKey();
        }
    }, 1000);

    void resolvePageKey().then(refreshState);
    scanVideos();
})();
