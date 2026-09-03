# Design QA

Mandatory command executed:

```bash
HEADLESS=1 node 7-design/capture.mjs /Users/mike/Desktop/zovo-ext/extensions/zovo-trim/dist --slug zovo-trim
```

The loop compared the real light/dark popup and library against the extension design system, then added the onboarding surface to the same Chrome-for-Testing capture.

## Rounds

1. The library passed hierarchy and spacing review, but the popup exceeded the viewport and hid its footer. Score: 8.3/10.
2. Hidden controls were corrected and the empty state entered the frame, but the footer still sat below the capture. Score: 8.8/10.
3. Popup vertical rhythm was tightened without reducing its main tap targets below 40px. Footer, empty-state art, and both actions became visible. Score: 9.2/10.
4. An extra onboarding capture exposed inactive steps leaking into layout. The `[hidden]` invariant was fixed and all three steps were exercised. Borderline light-theme contrast colors and progressbar semantics were then corrected. Final score: 9.4/10, PASS.

Final evidence is under `engine/7-design/shots/zovo-trim/final/`:

- `popup.light.png`, `popup.dark.png`
- `options.light.png`, `options.dark.png`
- `onboarding.light.png`, `onboarding.dark.png`
- `manifest.json`

Automated axe verification reports zero serious or critical issues on the popup, library, and all three onboarding steps.

