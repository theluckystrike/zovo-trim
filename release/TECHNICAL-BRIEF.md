# Technical brief

## Product boundary

Zovo Trim is an offline-first personal segment editor for arbitrary HTML5 video. It is not a community skip client and does not connect to a shared segment database.

## Architecture

- Manifest V3 service worker for active-frame routing, first-install onboarding, and optional license verification.
- Declarative all-frame content scripts discover the largest active video and attach play, seek, rate, and media-lifecycle listeners.
- A scheduler derived from the upstream proven pattern cancels and reschedules at playback boundaries, seeks across overlapping skip regions, owns mute only when needed, and restores the viewer's prior mute state.
- Top-level tab URLs key rules even when the chosen player is inside an embedded frame.
- `trimforge_v1_*` keys in `chrome.storage.local` hold rules, settings, totals, and entitlement cache.
- Popup captures the live playhead. Library edits numeric boundaries and actions, deletes URL sets, and performs JSON Blob download/file-input restore.

## Licensing

Builds fail when `SUPABASE_ANON_KEY` is absent and reject secret/service-role patterns. Client keys must match `ZOVO-XXXX-XXXX-XXXX-XXXX`. A successful HTTP response grants only when `valid === true`; the client never checks a `tier` label. Successful verification is cached for up to 30 days for offline use, bounded by any verifier expiry.

## Free and paid boundary

Free use can create regions for 10 distinct URLs and export them. A current verified license removes the URL cap and permits importing larger libraries. The full fork remains GPL-3.0-or-later, so anyone may study, modify, or rebuild the source without the packaged product policy.

