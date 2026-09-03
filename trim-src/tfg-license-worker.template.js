// Copyright (C) 2026 Zovo.one contributors
// SPDX-License-Identifier: GPL-3.0-or-later

importScripts("tfg-license-core.js");

const TFG_LICENSE_ENDPOINT = "https://zgubxqomnbmxgbdhvwja.supabase.co/functions/v1/verify-extension-license";
const TFG_PUBLIC_KEY = __TRIM_BUILD_PUBLIC_KEY__;
const TFG_LICENSE_KEY = "trimforge_v1_license";
const TFG_RULES_KEY = "trimforge_v1_rules";
const TFG_FREE_URL_LIMIT = 10;
const TFG_REFRESH_AFTER_MS = 20 * 24 * 60 * 60 * 1000;
const tfgFrameActivity = new Map();

function tfgCanonicalUrl(value) {
    try {
        const url = new URL(value);
        url.hash = "";
        return url.href;
    } catch {
        return String(value || "").split("#")[0];
    }
}

async function tfgStoredEntitlement() {
    const state = await chrome.storage.local.get(TFG_LICENSE_KEY);
    return TrimForgeLicense.isCurrent(state[TFG_LICENSE_KEY]);
}

async function tfgVerifyLicense(rawKey) {
    const key = String(rawKey || "").trim().toUpperCase();
    if (!TrimForgeLicense.hasKeyShape(key)) {
        return { ok: false, error: "Enter a key in the shown format." };
    }

    let response;
    let data;
    try {
        response = await fetch(TFG_LICENSE_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: TFG_PUBLIC_KEY,
            },
            body: JSON.stringify({ license_key: key, extension: "zovo" + "-trim" }),
        });
        data = await response.json();
    } catch {
        const existing = (await chrome.storage.local.get(TFG_LICENSE_KEY))[TFG_LICENSE_KEY];
        return TrimForgeLicense.isCurrent(existing)
            ? { ok: true, valid: true, offline: true }
            : { ok: false, error: "Could not reach the verifier. Try again when online." };
    }

    // The verifier's valid boolean is authoritative. Tier labels are deliberately
    // ignored so lifetime and future paid plans cannot be rejected by the client.
    if (TrimForgeLicense.isAcceptedResponse(response.ok, data)) {
        const expiresAt = TrimForgeLicense.normalizeExpiry(data);
        await chrome.storage.local.set({
            [TFG_LICENSE_KEY]: {
                key,
                valid: true,
                verifiedAt: Date.now(),
                expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
            },
        });
        return { ok: true, valid: true };
    }

    if (data && data.valid === false) {
        await chrome.storage.local.remove(TFG_LICENSE_KEY);
        return { ok: false, error: "That key was not accepted." };
    }
    return { ok: false, error: "The verifier returned an unreadable response." };
}

async function tfgRefreshStoredLicense() {
    const state = await chrome.storage.local.get(TFG_LICENSE_KEY);
    const license = state[TFG_LICENSE_KEY];
    if (!license?.key || !TrimForgeLicense.isCurrent(license)) return;
    if (Date.now() - Number(license.verifiedAt || 0) < TFG_REFRESH_AFTER_MS) return;
    await tfgVerifyLicense(license.key);
}

async function tfgGetActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
}

function tfgRememberActivity(sender, message) {
    if (!sender.tab?.id) return;
    const tabId = sender.tab.id;
    const previous = tfgFrameActivity.get(tabId);
    const candidate = {
        frameId: sender.frameId || 0,
        playing: message.playing === true,
        area: Number(message.area || 0),
        seenAt: Date.now(),
    };
    if (!previous
        || candidate.playing && !previous.playing
        || candidate.playing === previous.playing && candidate.area >= previous.area
        || Date.now() - previous.seenAt > 5000) {
        tfgFrameActivity.set(tabId, candidate);
    }
}

async function tfgRouteToVideo(command, payload) {
    const tab = await tfgGetActiveTab();
    if (!tab?.id) return { ok: false, error: "No active tab." };
    const selected = tfgFrameActivity.get(tab.id);
    const options = selected ? { frameId: selected.frameId } : undefined;
    try {
        return await chrome.tabs.sendMessage(tab.id, { type: "tfg:command", command, payload }, options);
    } catch {
        try {
            return await chrome.tabs.sendMessage(tab.id, { type: "tfg:command", command, payload });
        } catch {
            return { ok: false, error: "No HTML5 video is available on this page." };
        }
    }
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install") {
        chrome.tabs.create({ url: chrome.runtime.getURL("tfg-welcome.html") });
    }
});

chrome.tabs.onRemoved.addListener((tabId) => tfgFrameActivity.delete(tabId));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return undefined;

    if (message.type === "tfg:getPageKey") {
        sendResponse({ pageKey: tfgCanonicalUrl(sender.tab?.url || sender.url || "") });
        return false;
    }
    if (message.type === "tfg:videoActivity") {
        tfgRememberActivity(sender, message);
        sendResponse({ ok: true });
        return false;
    }
    if (message.type === "tfg:commandActive") {
        tfgRouteToVideo(message.command, message.payload).then(sendResponse);
        return true;
    }
    if (message.type === "tfg:verifyLicense") {
        tfgVerifyLicense(message.key).then(sendResponse);
        return true;
    }
    if (message.type === "tfg:getEntitlement") {
        Promise.all([
            tfgStoredEntitlement(),
            chrome.storage.local.get([TFG_RULES_KEY, TFG_LICENSE_KEY]),
        ]).then(([pro, state]) => sendResponse({
            ok: true,
            pro,
            freeUrlLimit: TFG_FREE_URL_LIMIT,
            savedUrls: Object.keys(state[TFG_RULES_KEY] || {}).length,
            license: state[TFG_LICENSE_KEY] || null,
        }));
        return true;
    }
    return undefined;
});

void tfgRefreshStoredLicense();
