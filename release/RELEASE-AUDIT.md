# Zovo Trim 1.0.0 release audit

Audit date: 2026-09-03 (Asia/Ho_Chi_Minh)

## Baseline and build

- Upstream baseline: ajayyy/SponsorBlock commit `16dd5604c989a3ee8eab86416cc5ad35ee4fd746`.
- The unmodified upstream build completed as MV3 and loaded in Chrome for Testing 152.0.7977.75 before fork work began.
- The inherited pinned ChromeDriver 140 does not match Chrome 152; QA therefore used matching Chrome for Testing tooling rather than altering upstream behavior.
- Release build: `SUPABASE_ANON_KEY=<public publishable key> npm run build`.
- Missing-key and privileged-key guards fail the build before changing `dist/`.

## Automated behavior verification

- Unit tests: 6 passed, 0 failed.
- Real-browser MV3 load: passed.
- HTML5 playback skip: passed.
- Mute entry and prior-state restoration: passed.
- Active-video start/end capture: passed.
- JSON Blob download and local file-input import: passed.
- Embedded-frame and top-level URL handling: passed.
- Onboarding navigation: passed.
- Axe serious/critical findings across popup, library, and all onboarding steps: 0.

## Mandatory gates

- Design capture command: `HEADLESS=1 node 7-design/capture.mjs <dist> --slug zovo-trim` — completed.
- Design loop: four corrective rounds plus final evidence; self-review score 9.4/10, PASS.
- Compliance scan: CLEAN, 0 violations.
- Fleet-divergence scan: `ready: true`; 0 BLOCK, 0 WARN, 0 FIX; reviewer-facing Zovo brand count 0 after allowed self-name/URL exclusions; residual `zovo-` namespace count 0.

## License and privacy invariants

- Key input accepts only `ZOVO-XXXX-XXXX-XXXX-XXXX` shape.
- Entitlement is granted only when the verifier response is successful and contains `valid === true`; tier labels are never consulted.
- Video URLs, page titles, personal ranges, and actions remain in `chrome.storage.local`.
- No community database, submissions, voting, or playback telemetry exists in the packaged runtime.
- The sole network path is optional license verification against the declared Supabase Edge Function host.

## Publication state

- Complete modified source is published at https://github.com/theluckystrike/zovo-trim under GPL-3.0.
- Chrome Web Store upload: intentionally not attempted.

