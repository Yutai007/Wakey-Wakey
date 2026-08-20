const ALARM_KEY = "wakeywakey.pwa.alarms.v1";
const TOKEN_KEY = "wakeywakey.spotify.token";
const EXPIRES_AT_KEY = "wakeywakey.spotify.expires_at";
const CODE_VERIFIER_KEY = "wakeywakey.spotify.code_verifier";
const LAST_FIRED_DATE_KEY = "wakeywakey.alarm.last_fired";

const config = window.WAKEY_CONFIG || {};
const spotifyClientId = config.spotifyClientId || "";
const currentPageRedirectUri = buildCurrentRedirectUri();
const spotifyRedirectUri = pickRedirectUri(config.spotifyRedirectUri, currentPageRedirectUri);
const spotifyScopes = [
  "user-read-private",
  "user-read-email",
  "user-modify-playback-state",
  "user-read-playback-state"
].join(" ");

const alarmForm = document.getElementById("alarm-form");
const alarmListEl = document.getElementById("alarm-list");
const spotifyStatusEl = document.getElementById("spotify-status");
const spotifyLoginBtn = document.getElementById("spotify-login-btn");
const spotifyLogoutBtn = document.getElementById("spotify-logout-btn");
const notificationBtn = document.getElementById("notification-btn");
const notificationStatusEl = document.getElementById("notification-status");

let alarms = loadAlarms();

bootstrap();

function normalizeRedirectUri(uri) {
  if (!uri) {
    return "";
  }

  try {
    const parsed = new URL(uri);
    parsed.search = "";
    parsed.hash = "";
    if (!parsed.pathname.endsWith("/")) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function buildCurrentRedirectUri() {
  const parsed = new URL(window.location.href);
  parsed.search = "";
  parsed.hash = "";
  if (!parsed.pathname.endsWith("/")) {
    parsed.pathname = `${parsed.pathname}/`;
  }
  return parsed.toString();
}

function pickRedirectUri(configuredUri, fallbackUri) {
  const normalizedConfigured = normalizeRedirectUri(configuredUri);
  if (!normalizedConfigured) {
    return fallbackUri;
  }

  // Prevent dashboard mismatch when serving from multiple domains/paths.
  return normalizedConfigured === fallbackUri ? normalizedConfigured : fallbackUri;
}

async function bootstrap() {
  registerServiceWorker();
  handleSpotifyCallback();
  updateSpotifyStatus();
  updateNotificationStatus();
  renderAlarms();
  startAlarmEngine();

  spotifyLoginBtn.addEventListener("click", startSpotifyLogin);
  spotifyLogoutBtn.addEventListener("click", spotifyLogout);
  notificationBtn.addEventListener("click", requestNotificationPermission);

  alarmForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const time = document.getElementById("alarm-time").value;
    const label = document.getElementById("alarm-label").value.trim() || "Alarm";
    const track = document.getElementById("alarm-track").value.trim();

    if (!time || !track) {
      return;
    }

    alarms.push({
      id: crypto.randomUUID(),
      time,
      label,
      track,
      enabled: true
    });

    saveAlarms();
    renderAlarms();
    alarmForm.reset();
  });
}

function loadAlarms() {
  try {
    const raw = localStorage.getItem(ALARM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAlarms() {
  localStorage.setItem(ALARM_KEY, JSON.stringify(alarms));
}

function renderAlarms() {
  alarmListEl.innerHTML = "";

  if (!alarms.length) {
    const empty = document.createElement("li");
    empty.className = "alarm-item";
    empty.textContent = "No alarms yet.";
    alarmListEl.appendChild(empty);
    return;
  }

  alarms.forEach((alarm) => {
    const li = document.createElement("li");
    li.className = "alarm-item";

    const head = document.createElement("div");
    head.className = "alarm-head";

    const title = document.createElement("strong");
    title.textContent = `${alarm.time} - ${alarm.label}`;

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.className = "toggle";
    toggle.checked = !!alarm.enabled;
    toggle.addEventListener("change", () => {
      alarm.enabled = toggle.checked;
      saveAlarms();
    });

    head.appendChild(title);
    head.appendChild(toggle);

    const meta = document.createElement("div");
    meta.className = "alarm-meta";
    meta.textContent = alarm.track;

    const actions = document.createElement("div");
    actions.className = "actions";

    const openBtn = document.createElement("button");
    openBtn.className = "btn btn-ghost";
    openBtn.textContent = "Open Spotify";
    openBtn.addEventListener("click", () => {
      window.open(normalizeSpotifyLink(alarm.track), "_blank", "noopener");
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      alarms = alarms.filter((candidate) => candidate.id !== alarm.id);
      saveAlarms();
      renderAlarms();
    });

    actions.appendChild(openBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(head);
    li.appendChild(meta);
    li.appendChild(actions);
    alarmListEl.appendChild(li);
  });
}

function normalizeSpotifyLink(value) {
  if (value.startsWith("spotify:track:")) {
    const trackId = value.replace("spotify:track:", "").trim();
    return `https://open.spotify.com/track/${encodeURIComponent(trackId)}`;
  }
  if (value.startsWith("spotify:album:")) {
    const albumId = value.replace("spotify:album:", "").trim();
    return `https://open.spotify.com/album/${encodeURIComponent(albumId)}`;
  }
  if (value.startsWith("spotify:playlist:")) {
    const playlistId = value.replace("spotify:playlist:", "").trim();
    return `https://open.spotify.com/playlist/${encodeURIComponent(playlistId)}`;
  }
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("spotify:")) {
    return value;
  }
  return `https://open.spotify.com/search/${encodeURIComponent(value)}`;
}

function startAlarmEngine() {
  checkAndFireAlarms();
  setInterval(checkAndFireAlarms, 15000);
}

async function checkAndFireAlarms() {
  const now = new Date();
  const hh = `${now.getHours()}`.padStart(2, "0");
  const mm = `${now.getMinutes()}`.padStart(2, "0");
  const today = now.toISOString().slice(0, 10);

  const lastFiredByAlarm = readLastFiredMap();

  for (const alarm of alarms) {
    if (!alarm.enabled || alarm.time !== `${hh}:${mm}`) {
      continue;
    }

    if (lastFiredByAlarm[alarm.id] === today) {
      continue;
    }

    await fireAlarm(alarm);
    lastFiredByAlarm[alarm.id] = today;
  }

  localStorage.setItem(LAST_FIRED_DATE_KEY, JSON.stringify(lastFiredByAlarm));
}

function readLastFiredMap() {
  try {
    return JSON.parse(localStorage.getItem(LAST_FIRED_DATE_KEY) || "{}");
  } catch {
    return {};
  }
}

async function fireAlarm(alarm) {
  const link = normalizeSpotifyLink(alarm.track);

  if ("Notification" in window && Notification.permission === "granted") {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      registration.showNotification(`Wakey Wakey: ${alarm.label}`, {
        body: "Tap to open Spotify",
        data: { url: link },
        tag: `alarm-${alarm.id}`,
        renotify: true
      });
      return;
    }
  }

  const shouldOpen = window.confirm(`${alarm.label}\nOpen Spotify now?`);
  if (shouldOpen) {
    window.open(link, "_blank", "noopener");
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.register("sw.js").catch((error) => {
    console.error("Service worker registration failed", error);
  });
}

function updateNotificationStatus() {
  if (!("Notification" in window)) {
    notificationStatusEl.textContent = "This browser does not support notifications.";
    notificationBtn.disabled = true;
    return;
  }

  notificationStatusEl.textContent = `Permission: ${Notification.permission}`;
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return;
  }
  await Notification.requestPermission();
  updateNotificationStatus();
}

function updateSpotifyStatus() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(localStorage.getItem(EXPIRES_AT_KEY) || 0);

  if (token && Date.now() < expiresAt) {
    spotifyStatusEl.textContent = "Connected (token available)";
  } else {
    spotifyStatusEl.textContent = spotifyClientId
      ? "Not connected"
      : "Missing Spotify client config (see config.example.js)";
  }
}

function spotifyLogout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  localStorage.removeItem(CODE_VERIFIER_KEY);
  updateSpotifyStatus();
}

async function startSpotifyLogin() {
  if (!spotifyClientId) {
    alert("Set spotifyClientId in config.js first.");
    return;
  }

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem(CODE_VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: spotifyClientId,
    response_type: "code",
    redirect_uri: spotifyRedirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: spotifyScopes
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function handleSpotifyCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    spotifyStatusEl.textContent = `Spotify auth error: ${error}`;
    cleanupAuthParams(url);
    return;
  }

  if (!code) {
    return;
  }

  const verifier = localStorage.getItem(CODE_VERIFIER_KEY);
  if (!verifier) {
    spotifyStatusEl.textContent = "Missing PKCE verifier. Retry login.";
    cleanupAuthParams(url);
    return;
  }

  try {
    const body = new URLSearchParams({
      client_id: spotifyClientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: spotifyRedirectUri,
      code_verifier: verifier
    });

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "Token exchange failed");
    }

    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + Number(data.expires_in || 0) * 1000));
    spotifyStatusEl.textContent = "Connected (token available)";
  } catch (err) {
    spotifyStatusEl.textContent = `Token exchange failed: ${String(err)}`;
  } finally {
    cleanupAuthParams(url);
  }
}

function cleanupAuthParams(url) {
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  window.history.replaceState({}, "", url.toString());
}

function generateCodeVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function generateCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

function toBase64Url(bytes) {
  const str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
