# Wakey Wakey

Wakey Wakey is an open-source iOS alarm app that plays a Spotify track when an alarm goes off.

## What this repository includes

- A SwiftUI starter architecture for alarms + Spotify App Remote control
- Spotify authorization callback handling through URL schemes
- Alarm scheduling with local notifications
- Secure credential pattern using ignored xcconfig files and Keychain token storage

This repository currently contains app source files and setup templates, so you can quickly wire them into an Xcode iOS project.

The repository also includes an XcodeGen spec (`project.yml`) for reproducible project generation.

## Important iOS behavior constraints

iOS does not allow a third-party app to auto-launch and start playback silently at an exact alarm time while fully in the background.

Current flow in this starter:

1. The app schedules a repeating local notification.
2. At alarm time, the user taps the notification.
3. The app opens and sends playback command to Spotify App Remote for the configured track URI.

This is the practical model used by many alarm-like apps that integrate external music platforms.

## Spotify SDK references

- iOS SDK repository: [spotify/ios-sdk](https://github.com/spotify/ios-sdk)
- Developer dashboard: [Spotify Dashboard](https://developer.spotify.com/dashboard/)
- Developer terms: [Spotify Developer Terms](https://developer.spotify.com/terms)

## Setup

### 1) Create a Spotify app

1. Go to Spotify Developer Dashboard and create an app.
2. Copy your Client ID.
3. Add a redirect URI (example: wakeywakey://spotify-callback).

### 2) Generate your iOS app target with XcodeGen

1. Install XcodeGen on macOS: `brew install xcodegen`
2. From repository root run: `xcodegen generate`
3. Open the generated project: `open WakeyWakey.xcodeproj`

The Spotify SDK supports older iOS versions, but this starter currently targets iOS 16+ because it uses modern SwiftUI APIs.

### 3) Spotify iOS SDK dependency

SpotifyiOS is already declared in `project.yml` as a Swift Package dependency, so Xcode resolves it after project generation.

### 4) Add your private Spotify config

1. Copy WakeyWakey/Config/SpotifySecrets.xcconfig.example to:
   WakeyWakey/Config/SpotifySecrets.xcconfig
2. Fill your own values.

This file is ignored by git.

### 5) Info.plist wiring

`WakeyWakey/Resources/Info.plist` already maps these keys from build settings:

- SPOTIFY_CLIENT_ID = $(SPOTIFY_CLIENT_ID)
- SPOTIFY_REDIRECT_URI = $(SPOTIFY_REDIRECT_URI)
- SPOTIFY_URL_SCHEME = $(SPOTIFY_URL_SCHEME)

It also preconfigures URL types and adds `spotify` to `LSApplicationQueriesSchemes`.

### 6) Build configuration

`project.yml` already maps Debug/Release to `WakeyWakey/Config/Base.xcconfig`.

`Base.xcconfig` loads `SpotifySecrets.xcconfig` when present.

### 7) Run and connect

1. Install Spotify app on your iPhone and log in.
2. Build and run Wakey Wakey.
3. Tap Connect Spotify.
4. Add an alarm and a Spotify track URI.

## Security notes for open source

- Never commit Client IDs, redirect secrets, or OAuth tokens.
- Keep SpotifySecrets.xcconfig local only.
- Access tokens are stored in iOS Keychain, not plain text files.
- Rotate credentials if accidentally exposed.

## Folder structure

- WakeyWakey/App: app entrypoint and delegate callbacks
- WakeyWakey/Config: runtime config readers and secret template
- WakeyWakey/Models: alarm model
- WakeyWakey/Services/Spotify: auth and App Remote playback client
- WakeyWakey/Services/Alarm: notification-based alarm scheduling
- WakeyWakey/ViewModels: alarm list state and persistence
- WakeyWakey/Views: SwiftUI screens for connect/add/list alarms

## Next improvements

- Alarm repeat days (weekdays/weekends/custom)
- Better track picker UX from search and previews
- Premium/account checks and clearer Spotify error handling
- Background reconnect strategy and richer connection diagnostics
- Unit tests for alarm persistence and scheduling mapping
