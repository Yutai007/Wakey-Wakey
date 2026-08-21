# Wakey Wakey (PWA)

Wakey Wakey is a Spotify-focused alarm reminder Progressive Web App that can be hosted on GitHub Pages.

## What this PWA does

- Installable web app with manifest + service worker
- Alarm CRUD stored in localStorage
- Notification permission flow for browsers and iOS Home Screen web app mode
- Spotify OAuth PKCE login skeleton (no client secret in frontend)
- One-click GitHub Pages deployment workflow

## iOS limitation you should expect

This is not a native alarm clock replacement on iPhone.

- iOS PWAs cannot guarantee exact-time alarm behavior when the app is fully closed.
- iOS PWAs cannot silently auto-play Spotify in background at alarm time.
- The practical flow is reminder notification + tap to open Spotify quickly.

## Quick start on Linux

1. Clone the repo.
2. Set `spotifyClientId` in `config.public.js`.
3. Leave `spotifyRedirectUri` empty to auto-use the current URL.
4. Optional: set `spotifyRedirectUri` only if you serve from one fixed URL.
5. Optional: copy `config.example.js` to `config.js` for local-only overrides.
6. Start a local static server, for example:
   - `python3 -m http.server 8080`
7. Open `http://localhost:8080`.

## Spotify setup

1. Create an app at [Spotify Dashboard](https://developer.spotify.com/dashboard/).
2. Use Authorization Code with PKCE for browser apps.
3. Add redirect URIs:
   - Local: `http://localhost:8080/`
   - GitHub Pages: `https://Yutai007.github.io/Wakey-Wakey/`
   - Custom domain example: `https://yutailong.dev/Wakey-Wakey/`
   - Add every URL you will actually open from browser (exact match, including trailing slash).
4. Put your Client ID in `config.public.js` (and optionally override in local `config.js`).

Client ID is public in PKCE apps. Never put client secret in frontend code.

## Deploy to GitHub Pages

1. Push to `main`.
2. In repository settings, enable GitHub Pages source as GitHub Actions.
3. Workflow at `.github/workflows/pages.yml` deploys the site automatically.

## First-Launch Setup (In-App)

On first open, the app shows a setup modal and asks for required permissions up front.

1. Tap `Allow Notifications` and approve the browser/iOS permission prompt.
2. Tap `Connect Spotify` and finish Spotify login.
3. Return to the app if redirected.
4. Tap `Finish Setup` once both checklist items show ready.

Notes:

- `Finish Setup` stays disabled until both notification permission and Spotify connection are completed.
- If setup looks stuck after login redirect, reload once and reopen the app.
- If you revoke permissions later, setup can appear again until requirements are satisfied.

## iPhone testing steps

1. Deploy to GitHub Pages first (HTTPS required for many web APIs).
2. Open the Pages URL in Safari.
3. Share -> Add to Home Screen.
4. Launch from Home Screen.
5. Enable notifications in app and iOS settings.
6. Connect Spotify and add alarms.

## Security for open source

- Keep secrets out of git (no client secret, private keys, or tokens in repo).
- Local config files are ignored by git so you can keep machine-specific values out of commits.
- OAuth access tokens are stored in browser localStorage in this starter.
- `config.public.js` is expected to be public and safe to publish.

### Safe file pattern for public repos

Tracked example files (safe to publish):

- `config.example.js`
- `config.public.js`
- `WakeyWakey/Config/SpotifySecrets.xcconfig.example`

Ignored local files (can contain private values):

- `config.js`
- `config.local.js`
- `WakeyWakey/Config/SpotifySecrets.xcconfig`

Typical setup:

1. Copy `config.example.js` to `config.js` and edit locally.
2. Copy `WakeyWakey/Config/SpotifySecrets.xcconfig.example` to `WakeyWakey/Config/SpotifySecrets.xcconfig` if you use the native iOS prototype.
3. Never commit `.env`, `.key`, `.pem`, `.p12`, or any private cert/provisioning files.

## Project layout

- `index.html`: app shell and sections
- `styles.css`: UI styles
- `app.js`: alarm logic, notifications, Spotify PKCE skeleton
- `sw.js`: service worker caching and notification click handling
- `manifest.webmanifest`: installability metadata
- `.github/workflows/pages.yml`: GitHub Pages deployment

## Native iOS prototype status

The repository still contains the earlier native iOS prototype under `WakeyWakey/`, but the active no-fee path is the PWA in repository root.
