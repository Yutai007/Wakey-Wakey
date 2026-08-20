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
2. Copy `config.example.js` to `config.js`.
3. Fill `spotifyClientId` and `spotifyRedirectUri` in `config.js`.
4. Start a local static server, for example:
   - `python3 -m http.server 8080`
5. Open `http://localhost:8080`.

## Spotify setup

1. Create an app at [Spotify Dashboard](https://developer.spotify.com/dashboard/).
2. Use Authorization Code with PKCE for browser apps.
3. Add redirect URIs:
   - Local: `http://localhost:8080/`
   - GitHub Pages: `https://<username>.github.io/<repo>/`
4. Put your Client ID in `config.js`.

Client ID is public in PKCE apps. Never put client secret in frontend code.

## Deploy to GitHub Pages

1. Push to `main`.
2. In repository settings, enable GitHub Pages source as GitHub Actions.
3. Workflow at `.github/workflows/pages.yml` deploys the site automatically.

## iPhone testing steps

1. Deploy to GitHub Pages first (HTTPS required for many web APIs).
2. Open the Pages URL in Safari.
3. Share -> Add to Home Screen.
4. Launch from Home Screen.
5. Enable notifications in app and iOS settings.
6. Connect Spotify and add alarms.

## Security for open source

- Keep secrets out of git (no client secret, private keys, or tokens in repo).
- Treat `config.js` as local config; do not store sensitive values there.
- OAuth access tokens are stored in browser localStorage in this starter.

## Project layout

- `index.html`: app shell and sections
- `styles.css`: UI styles
- `app.js`: alarm logic, notifications, Spotify PKCE skeleton
- `sw.js`: service worker caching and notification click handling
- `manifest.webmanifest`: installability metadata
- `.github/workflows/pages.yml`: GitHub Pages deployment

## Native iOS prototype status

The repository still contains the earlier native iOS prototype under `WakeyWakey/`, but the active no-fee path is the PWA in repository root.
