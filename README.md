# Zovo Trim

Zovo Trim is a fully personal, offline-first segment editor for HTML5 video. A viewer captures a start and end point on the active video, chooses skip or mute, and the rule replays automatically whenever the same page URL is opened again.

Rules are stored only in `chrome.storage.local`. The packaged extension does not read a community segment database, submit segments, vote, or send playback telemetry. Its only network path is optional license verification.

## Build

The public Supabase key is required at build time so license activation cannot silently ship broken:

```bash
npm install
SUPABASE_ANON_KEY=sb_publishable_... npm run build
```

The output is `dist/`. A missing key or a secret/service-role key stops the build.

## Test

```bash
npm test
npx playwright install chromium
node test/zovo-trim/runtime-chrome.mjs
```

The Chrome runtime test covers MV3 loading, global content-script access, skip seeks, mute restoration, popup-style start/end capture, JSON Blob export, file-input import, onboarding navigation, and serious/critical accessibility findings.

## Upstream and license

This GPL-3.0-or-later fork begins at ajayyy/SponsorBlock commit `16dd5604c989a3ee8eab86416cc5ad35ee4fd746`. It retains upstream history, copyright notices, licensing, the segment/action model, and the proven scheduler principles described in `CHANGES-ZOVO.md`. The packaged product is a distinct offline personal editor for arbitrary HTML5 video rather than a shared-database YouTube client.

See `BASELINE-REPORT.md` for the unmodified build/load record and `LICENSE` for the complete license text.
