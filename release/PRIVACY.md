# Privacy disclosure

## Single purpose

Zovo Trim lets a viewer define personal skip or mute regions for HTML5 video and replay those choices automatically on the same page URL.

## Data handled

The extension reads the active page URL and title plus HTML5 video playback time, duration, play state, and mute state. It stores the URL, title, user-defined start/end times, chosen skip/mute action, enabled preference, local action totals, and optional license cache in `chrome.storage.local`.

That personal region data remains on the device. The extension does not operate a shared segment database, submit regions, vote, sell data, serve ads, or transmit playback telemetry.

## Network use

Playback and rule management work locally. If the user chooses to activate a license, the extension sends the entered license key and product identifier to the Zovo Supabase Edge Function at `zgubxqomnbmxgbdhvwja.supabase.co`. It does not include the video URL, title, region times, or browsing history in that request. A successful response is cached locally for offline entitlement checks.

Pricing, support, privacy, and source links open only when the user selects them.

## Permissions

- `storage`: keeps personal regions, settings, local totals, and the optional license cache.
- Access to web pages: runs the video controller on ordinary pages so it can discover HTML5 video elements and apply the user's rules. Page content is not sent elsewhere.
- `zgubxqomnbmxgbdhvwja.supabase.co`: permits the optional license-verification request.

Public policy URL: https://zovo.one/privacy-policy

