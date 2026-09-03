// Copyright (C) 2026 Zovo.one contributors
// SPDX-License-Identifier: GPL-3.0-or-later

(function runTrimForgeLibrary() {
    "use strict";
    const RULES_KEY = "trimforge_v1_rules";
    const STATS_KEY = "trimforge_v1_stats";
    const core = globalThis.TrimForgeCore;
    const byId = (id) => document.getElementById(id);
    let rules = {};
    let pro = false;
    let freeUrlLimit = 10;
    let filter = "";

    function note(id, message, kind = "") {
        const element = byId(id);
        element.textContent = message || "";
        element.dataset.kind = kind;
    }

    function makeField(labelText, type, value, attributes = {}) {
        const label = document.createElement("label");
        label.textContent = labelText;
        const input = document.createElement(type === "select" ? "select" : "input");
        if (type !== "select") input.type = type;
        input.value = value;
        for (const [key, attributeValue] of Object.entries(attributes)) input.setAttribute(key, attributeValue);
        label.append(input);
        return { label, input };
    }

    async function saveRules(message = "Library updated.") {
        rules = core.normalizeStore(rules);
        await chrome.storage.local.set({ [RULES_KEY]: rules });
        render();
        note("tfg-library-status", message, "success");
    }

    function render() {
        const list = byId("tfg-library-list");
        const entries = Object.entries(rules).filter(([url, entry]) => `${url} ${entry.title}`.toLowerCase().includes(filter));
        list.replaceChildren();
        byId("tfg-url-count").textContent = String(Object.keys(rules).length);
        byId("tfg-library-empty").hidden = entries.length > 0;

        for (const [url, entry] of entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt)) {
            const details = document.createElement("details");
            details.className = "tfg-url-card";
            const summary = document.createElement("summary");
            summary.className = "tfg-url-summary";
            const identity = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = entry.title || "Untitled video";
            const address = document.createElement("small");
            address.textContent = url;
            identity.append(title, address);
            const count = document.createElement("span");
            count.className = "tfg-url-count";
            count.textContent = `${entry.regions.length} ${entry.regions.length === 1 ? "region" : "regions"}`;
            const chevron = document.createElement("span");
            chevron.className = "tfg-chevron";
            chevron.setAttribute("aria-hidden", "true");
            chevron.textContent = "⌄";
            summary.append(identity, count, chevron);

            const editors = document.createElement("div");
            editors.className = "tfg-region-editors";
            for (const region of entry.regions) {
                const row = document.createElement("div");
                row.className = "tfg-region-editor";
                const start = makeField("Start (seconds)", "number", region.start, { min: "0", step: "0.001" });
                const end = makeField("End (seconds)", "number", region.end, { min: "0", step: "0.001" });
                const mode = makeField("Action", "select", region.mode);
                for (const value of ["skip", "mute"]) {
                    const option = document.createElement("option");
                    option.value = value;
                    option.textContent = value === "skip" ? "Skip" : "Mute";
                    mode.input.append(option);
                }
                mode.input.value = region.mode;
                const remove = document.createElement("button");
                remove.type = "button";
                remove.textContent = "Delete";
                remove.addEventListener("click", async () => {
                    entry.regions = entry.regions.filter((candidate) => candidate.id !== region.id);
                    if (!entry.regions.length) delete rules[url];
                    await saveRules("Region deleted.");
                });
                const update = async () => {
                    const candidate = core.normalizeRegion({ ...region, start: start.input.value, end: end.input.value, mode: mode.input.value });
                    if (!candidate) {
                        note("tfg-library-status", "End must be at least 0.05 seconds after start.", "error");
                        return;
                    }
                    Object.assign(region, candidate);
                    entry.updatedAt = Date.now();
                    await saveRules("Region changes saved.");
                };
                start.input.addEventListener("change", update);
                end.input.addEventListener("change", update);
                mode.input.addEventListener("change", update);
                row.append(start.label, end.label, mode.label, remove);
                editors.append(row);
            }
            const actions = document.createElement("div");
            actions.className = "tfg-url-actions";
            const open = document.createElement("a");
            open.href = url;
            open.target = "_blank";
            open.rel = "noopener";
            open.textContent = "Open video URL";
            const removeUrl = document.createElement("button");
            removeUrl.type = "button";
            removeUrl.className = "tfg-delete-url";
            removeUrl.textContent = "Delete this URL";
            removeUrl.addEventListener("click", async () => {
                delete rules[url];
                await saveRules("URL and its regions deleted.");
            });
            actions.append(open, removeUrl);
            editors.append(actions);
            details.append(summary, editors);
            list.append(details);
        }
    }

    function exportJson() {
        const payload = JSON.stringify({
            schema: "trimforge/1",
            exportedAt: new Date().toISOString(),
            urls: rules,
        }, null, 2);
        const blob = new Blob([payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `personal-video-regions-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        note("tfg-library-status", `${Object.keys(rules).length} URL rule sets exported.`, "success");
    }

    async function importJson(file) {
        let parsed;
        try {
            parsed = JSON.parse(await file.text());
        } catch {
            note("tfg-library-status", "That file is not valid JSON.", "error");
            return;
        }
        if (parsed?.schema !== "trimforge/1" || !parsed.urls) {
            note("tfg-library-status", "Choose a Zovo Trim JSON backup.", "error");
            return;
        }
        const replace = byId("tfg-import-mode").value === "replace";
        const next = core.mergeStores(rules, parsed.urls, replace);
        if (!pro && Object.keys(next).length > freeUrlLimit) {
            note("tfg-library-status", `This backup has more than the free ${freeUrlLimit}-URL allowance. Existing data was not changed.`, "error");
            return;
        }
        rules = next;
        await saveRules(`${Object.keys(core.normalizeStore(parsed.urls)).length} URL rule sets imported.`);
    }

    byId("tfg-export").addEventListener("click", exportJson);
    byId("tfg-import").addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) await importJson(file);
    });
    byId("tfg-filter").addEventListener("input", (event) => {
        filter = event.target.value.trim().toLowerCase();
        render();
    });
    byId("tfg-license-key").addEventListener("input", (event) => {
        event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
    });
    byId("tfg-activate").addEventListener("click", async () => {
        const key = byId("tfg-license-key").value;
        if (!/^ZOVO-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/.test(key)) {
            note("tfg-license-status", "Use four groups of four letters or numbers.", "error");
            return;
        }
        byId("tfg-activate").disabled = true;
        note("tfg-license-status", "Checking license…");
        const result = await chrome.runtime.sendMessage({ type: "tfg:verifyLicense", key });
        note("tfg-license-status", result?.valid ? "License verified. Unlimited rules are active." : result?.error, result?.valid ? "success" : "error");
        byId("tfg-activate").disabled = false;
        await load();
    });

    async function load() {
        const [state, entitlement] = await Promise.all([
            chrome.storage.local.get([RULES_KEY, STATS_KEY]),
            chrome.runtime.sendMessage({ type: "tfg:getEntitlement" }),
        ]);
        rules = core.normalizeStore(state[RULES_KEY]);
        pro = entitlement?.pro === true;
        freeUrlLimit = Number(entitlement?.freeUrlLimit || 10);
        const chip = byId("tfg-library-plan");
        chip.textContent = pro ? "Unlimited active" : `Free · ${freeUrlLimit} URLs`;
        chip.dataset.pro = String(pro);
        byId("tfg-license-key").value = entitlement?.license?.key || "";
        render();
    }

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[RULES_KEY]) void load();
    });
    void load();
})();
