// Copyright (C) 2026 Zovo.one contributors
// SPDX-License-Identifier: GPL-3.0-or-later

(function runTrimForgePopup() {
    "use strict";
    const ENABLED_KEY = "trimforge_v1_enabled";
    const core = globalThis.TrimForgeCore;
    const byId = (id) => document.getElementById(id);
    let lastStatus = null;
    let busy = false;

    async function command(command, payload) {
        return chrome.runtime.sendMessage({ type: "tfg:commandActive", command, payload });
    }

    function note(message, kind = "") {
        const status = byId("tfg-popup-status");
        status.textContent = message || "";
        status.dataset.kind = kind;
    }

    function pageLabel(pageKey) {
        if (!pageKey) return "Looking for a video…";
        try {
            const url = new URL(pageKey);
            return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
        } catch {
            return pageKey;
        }
    }

    function renderRegions(regions) {
        const list = byId("tfg-region-list");
        const empty = byId("tfg-empty");
        list.replaceChildren();
        byId("tfg-region-count").textContent = String(regions.length);
        empty.hidden = regions.length > 0;
        for (const region of regions) {
            const row = document.createElement("div");
            row.className = "tfg-region-row";

            const mode = document.createElement("span");
            mode.className = "tfg-mode-pill";
            mode.dataset.mode = region.mode;
            mode.textContent = region.mode;

            const time = document.createElement("div");
            time.className = "tfg-region-time";
            time.textContent = `${core.formatTime(region.start)} – ${core.formatTime(region.end)}`;
            const duration = document.createElement("small");
            duration.textContent = `${(region.end - region.start).toFixed(1)} seconds`;
            time.append(duration);

            const remove = document.createElement("button");
            remove.className = "tfg-delete";
            remove.type = "button";
            remove.dataset.id = region.id;
            remove.setAttribute("aria-label", `Delete ${region.mode} region ${core.formatTime(region.start)} to ${core.formatTime(region.end)}`);
            remove.textContent = "×";
            row.append(mode, time, remove);
            list.append(row);
        }
    }

    function render(status) {
        lastStatus = status;
        byId("tfg-current-time").textContent = core.formatTime(status?.time || 0);
        byId("tfg-page-label").textContent = pageLabel(status?.pageKey);
        byId("tfg-start-value").textContent = Number.isFinite(status?.pendingStart)
            ? core.formatTime(status.pendingStart)
            : "Not set";
        byId("tfg-end-value").textContent = status?.ok ? core.formatTime(status.time) : "At playhead";
        byId("tfg-start").disabled = !status?.ok || busy;
        byId("tfg-end").disabled = !status?.ok || !Number.isFinite(status?.pendingStart) || busy;
        byId("tfg-start").classList.toggle("tfg-button--primary", !Number.isFinite(status?.pendingStart));
        byId("tfg-end").classList.toggle("tfg-button--primary", Number.isFinite(status?.pendingStart));
        byId("tfg-cancel").hidden = !Number.isFinite(status?.pendingStart);
        byId("tfg-enabled").checked = status?.enabled !== false;
        renderRegions(status?.regions || []);
        if (!status?.ok && status?.error) note(status.error, "error");
    }

    async function refresh(quiet = false) {
        try {
            const response = await command("status");
            render(response || { ok: false, error: "No HTML5 video is available on this page." });
            if (!quiet && response?.ok) note("Ready. Move the playhead to mark a region.");
        } catch {
            render({ ok: false, error: "This page does not allow video controls." });
        }
    }

    async function act(commandName, payload, success) {
        if (busy) return;
        busy = true;
        render(lastStatus || {});
        try {
            const response = await command(commandName, payload);
            if (!response?.ok) {
                note(response?.error || "That action could not be completed.", "error");
            } else {
                render(response.status || lastStatus);
                note(success(response), "success");
            }
        } catch {
            note("The page stopped responding. Reload it and try once more.", "error");
        } finally {
            busy = false;
            render(lastStatus || {});
        }
    }

    byId("tfg-start").addEventListener("click", () => act("captureStart", null, (response) => `Start set at ${core.formatTime(response.pendingStart)}.`));
    byId("tfg-end").addEventListener("click", () => {
        const mode = document.querySelector('input[name="tfg-mode"]:checked').value;
        void act("captureEnd", { mode }, (response) => `${response.region.mode === "mute" ? "Mute" : "Skip"} region saved locally.`);
    });
    byId("tfg-cancel").addEventListener("click", () => act("clearPending", null, () => "Start point cleared."));
    byId("tfg-region-list").addEventListener("click", (event) => {
        const button = event.target.closest("button[data-id]");
        if (button) void act("deleteRegion", { id: button.dataset.id }, () => "Region deleted.");
    });
    byId("tfg-enabled").addEventListener("change", async (event) => {
        await chrome.storage.local.set({ [ENABLED_KEY]: event.target.checked });
        note(event.target.checked ? "Automatic regions enabled." : "Automatic regions paused.", "success");
    });
    byId("tfg-library").addEventListener("click", () => chrome.runtime.openOptionsPage());

    chrome.runtime.sendMessage({ type: "tfg:getEntitlement" }).then((state) => {
        byId("tfg-plan-badge").textContent = state?.pro ? "Unlimited" : "Free";
        byId("tfg-plan-badge").dataset.pro = String(Boolean(state?.pro));
    });
    void refresh();
    setInterval(() => void refresh(true), 500);
})();
