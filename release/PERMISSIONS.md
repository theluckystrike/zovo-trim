# Chrome Web Store privacy answers

## Single purpose

Create and replay a viewer's own per-URL skip or mute regions for HTML5 video.

## Storage justification

Stores personal URL rule sets, start/end times, skip/mute action choices, enabled preference, local action totals, and an optional verified-license cache. These values are required for rules to persist between visits.

## Site access justification

The declarative content script must see HTML5 video elements on pages where the user watches video. It reads and changes only the active player's playback time or mute state according to user-created rules. Arbitrary page content is not collected or transmitted.

## Host justification

Access to `https://zgubxqomnbmxgbdhvwja.supabase.co/*` is used only when a user enters a license key or when the cached license is refreshed. The request contains the key and product identifier, not video or browsing data.

## Remote code

No. All executable JavaScript ships inside the extension package. There is no `eval`, remote script, WebAssembly download, or dynamic code execution.

## Data-use certifications

- Data is not sold or transferred for unrelated purposes.
- Data is not used for lending or creditworthiness.
- Personal video rules remain local; optional license data is used only to verify entitlement.

