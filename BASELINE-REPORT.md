# Upstream baseline report

- Upstream: `ajayyy/SponsorBlock`
- Commit: `16dd5604c989a3ee8eab86416cc5ad35ee4fd746`
- Commit date: 2026-08-24
- Baseline source: fresh recursive clone made from the on-disk fundamental after macOS cloud placeholders prevented a reliable read of that working copy
- Build command: `cp config.json.example config.json && npm install && npm run build`
- Build result: PASS on Node 20.17.0; webpack 5.105.0 compiled successfully
- Output manifest: Manifest V3, service worker `js/background.js`
- Output manifest SHA-256: `93bb0ba1badb5443eafbf2a133d241a1e4bc0b91f9c535b848633f42b3c7a8d3`
- Chrome load: PASS in Google Chrome for Testing 152.0.7977.75. Chrome exposed the first-run help page and the MV3 service worker under extension ID `nedajandpnloidemifmknioidjkohmig`.

The package index said this upstream was MV2 at HEAD. That note is stale for the recorded commit: the Chrome build merges `manifest/chrome-manifest-extra.json`, which declares `manifest_version: 3` and an MV3 service worker. No MV3 port was required.

One separate upstream test-tooling drift was observed. The upstream dependency pins ChromeDriver 140, which cannot create a session against the installed Chrome 152. Baseline load verification therefore used the matching official Chrome-for-Testing 152 browser and driver without changing upstream source.

