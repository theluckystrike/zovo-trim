// Copyright (C) 2026 Zovo.one contributors
// SPDX-License-Identifier: GPL-3.0-or-later

(function exposeTrimForgeLicense(scope) {
    "use strict";
    const OFFLINE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

    function hasKeyShape(value) {
        return /^ZOVO-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/.test(String(value || "").trim().toUpperCase());
    }

    function isAcceptedResponse(responseOk, data) {
        return responseOk === true && Boolean(data) && typeof data === "object" && data.valid === true;
    }

    function normalizeExpiry(data) {
        const raw = Number(data?.exp || data?.expires_at || 0);
        if (!Number.isFinite(raw) || raw <= 0) return 0;
        return raw < 10_000_000_000 ? raw * 1000 : raw;
    }

    function isCurrent(license, now = Date.now()) {
        if (!license || license.valid !== true) return false;
        const verifiedAt = Number(license.verifiedAt);
        const expiresAt = Number(license.expiresAt || 0);
        return Number.isFinite(verifiedAt)
            && verifiedAt > 0
            && verifiedAt <= now
            && now - verifiedAt <= OFFLINE_WINDOW_MS
            && (!expiresAt || expiresAt >= now);
    }

    scope.TrimForgeLicense = Object.freeze({
        OFFLINE_WINDOW_MS,
        hasKeyShape,
        isAcceptedResponse,
        isCurrent,
        normalizeExpiry,
    });
})(globalThis);

