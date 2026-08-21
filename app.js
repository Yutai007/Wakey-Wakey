const ALARM_KEY = "wakeywakey.pwa.alarms.v1";
const TOKEN_KEY = "wakeywakey.spotify.token";
const EXPIRES_AT_KEY = "wakeywakey.spotify.expires_at";
const CODE_VERIFIER_KEY = "wakeywakey.spotify.code_verifier";
const LAST_FIRED_DATE_KEY = "wakeywakey.alarm.last_fired";
const NOTIFICATION_EARLY_PROMPTED_KEY = "wakeywakey.notification.early_prompted";
const SPOTIFY_LOGIN_PRIMED_KEY = "wakeywakey.spotify.login_primed";
const FIRST_SETUP_DONE_KEY = "wakeywakey.setup.done";

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
const alarmHourEl = document.getElementById("alarm-hour");
const alarmMinuteEl = document.getElementById("alarm-minute");
const alarmTimezoneEl = document.getElementById("alarm-timezone");
const alarmRepeatDailyEl = document.getElementById("alarm-repeat-daily");
const alarmFormStatusEl = document.getElementById("alarm-form-status");
const alarmTrackEl = document.getElementById("alarm-track");
const spotifySearchInputEl = document.getElementById("spotify-search-input");
const spotifySearchBtn = document.getElementById("spotify-search-btn");
const spotifySearchStatusEl = document.getElementById("spotify-search-status");
const spotifySearchResultsEl = document.getElementById("spotify-search-results");
const setupModalEl = document.getElementById("setup-modal");
const setupNotificationStatusEl = document.getElementById("setup-notification-status");
const setupSpotifyStatusEl = document.getElementById("setup-spotify-status");
const setupNotificationBtn = document.getElementById("setup-notification-btn");
const setupSpotifyBtn = document.getElementById("setup-spotify-btn");
const setupDoneBtn = document.getElementById("setup-done-btn");

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
  populateTimeSelectors();
  populateTimezoneSelector();
  setDefaultAlarmFormValues();

  registerServiceWorker();
  handleSpotifyCallback();
  updateSpotifyStatus();
  updateNotificationStatus();
  initFirstRunSetupFlow();
  initSpotifySearch();
  renderAlarms();
  startAlarmEngine();

  spotifyLoginBtn.addEventListener("click", startSpotifyLogin);
  spotifyLogoutBtn.addEventListener("click", spotifyLogout);
  notificationBtn.addEventListener("click", requestNotificationPermission);

  alarmForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const hour = Number(alarmHourEl.value);
    const minute = Number(alarmMinuteEl.value);
    const timezone = alarmTimezoneEl.value;
    const recurrence = getSelectedRecurrence();
    const label = document.getElementById("alarm-label").value.trim() || "Alarm";
    const track = alarmTrackEl.value.trim();

    if (!Number.isInteger(hour) || !Number.isInteger(minute) || !timezone || !track) {
      setAlarmFormStatus("Please fill all required fields.");
      return;
    }

    const now = new Date();
    const zonedNow = getZonedDateParts(now, timezone);
    const hasTimePassedToday =
      hour < zonedNow.hour || (hour === zonedNow.hour && minute <= zonedNow.minute);

    if (recurrence === "once" && hasTimePassedToday) {
      setAlarmFormStatus("One-time today alarm must be set for a future minute in the selected time zone.");
      return;
    }

    clearAlarmFormStatus();

    alarms.push({
      id: crypto.randomUUID(),
      hour,
      minute,
      timezone,
      recurrence,
      onceDate: recurrence === "once" ? zonedNow.ymd : null,
      label,
      track,
      enabled: true
    });

    saveAlarms();
    renderAlarms();
    alarmForm.reset();
    setDefaultAlarmFormValues();
  });
}

function initSpotifySearch() {
  spotifySearchBtn.addEventListener("click", () => {
    performSpotifySearch();
  });

  spotifySearchInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      performSpotifySearch();
    }
  });
}

function getSpotifyAccessToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(localStorage.getItem(EXPIRES_AT_KEY) || 0);
  if (!token || Date.now() >= expiresAt) {
    return null;
  }
  return token;
}

async function performSpotifySearch() {
  const query = spotifySearchInputEl.value.trim();
  if (!query) {
    spotifySearchStatusEl.textContent = "Type a track or artist name to search.";
    spotifySearchResultsEl.innerHTML = "";
    return;
  }

  const token = getSpotifyAccessToken();
  if (!token) {
    spotifySearchStatusEl.textContent = "Connect Spotify first, then search.";
    spotifySearchResultsEl.innerHTML = "";
    return;
  }

  spotifySearchBtn.disabled = true;
  spotifySearchStatusEl.textContent = "Searching Spotify...";

  try {
    const params = new URLSearchParams({
      q: query,
      type: "track",
      limit: "8"
    });

    const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      spotifySearchStatusEl.textContent = "Spotify session expired. Reconnect Spotify and try again.";
      spotifySearchResultsEl.innerHTML = "";
      return;
    }

    if (!response.ok) {
      spotifySearchStatusEl.textContent = "Search failed. Please try again.";
      spotifySearchResultsEl.innerHTML = "";
      return;
    }

    const data = await response.json();
    const items = data?.tracks?.items || [];
    renderSpotifySearchResults(items);
    spotifySearchStatusEl.textContent = items.length
      ? `Found ${items.length} result${items.length === 1 ? "" : "s"}.`
      : "No songs found for that query.";
  } catch {
    spotifySearchStatusEl.textContent = "Network error during search. Please try again.";
    spotifySearchResultsEl.innerHTML = "";
  } finally {
    spotifySearchBtn.disabled = false;
  }
}

function renderSpotifySearchResults(items) {
  spotifySearchResultsEl.innerHTML = "";

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "search-item";

    const cover = document.createElement("img");
    cover.className = "search-cover";
    cover.alt = "Album art";
    cover.src = item?.album?.images?.[2]?.url || item?.album?.images?.[0]?.url || "";

    const main = document.createElement("div");
    main.className = "search-main";

    const title = document.createElement("div");
    title.className = "search-title";
    title.textContent = item.name || "Unknown track";

    const sub = document.createElement("div");
    sub.className = "search-sub";
    const artistNames = (item.artists || []).map((artist) => artist.name).join(", ");
    sub.textContent = artistNames || "Unknown artist";

    main.appendChild(title);
    main.appendChild(sub);

    const useBtn = document.createElement("button");
    useBtn.className = "btn btn-ghost";
    useBtn.type = "button";
    useBtn.textContent = "Use";
    useBtn.addEventListener("click", () => {
      alarmTrackEl.value = `spotify:track:${item.id}`;
      const labelInput = document.getElementById("alarm-label");
      if (!labelInput.value.trim()) {
        labelInput.value = item.name || "Alarm";
      }
      spotifySearchStatusEl.textContent = `Selected: ${item.name}`;
      clearAlarmFormStatus();
    });

    li.appendChild(cover);
    li.appendChild(main);
    li.appendChild(useBtn);
    spotifySearchResultsEl.appendChild(li);
  }
}

function initFirstRunSetupFlow() {
  setupNotificationBtn.addEventListener("click", async () => {
    await requestNotificationPermission();
    refreshSetupChecklist();
  });

  setupSpotifyBtn.addEventListener("click", () => {
    startSpotifyLogin();
  });

  setupDoneBtn.addEventListener("click", () => {
    localStorage.setItem(FIRST_SETUP_DONE_KEY, "1");
    hideSetupModal();
  });

  if (localStorage.getItem(FIRST_SETUP_DONE_KEY) !== "1") {
    showSetupModal();
  } else {
    refreshSetupChecklist();
    if (!isSetupComplete()) {
      showSetupModal();
    }
  }
}

function isSetupComplete() {
  const hasNotificationPermission = "Notification" in window && Notification.permission === "granted";
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(localStorage.getItem(EXPIRES_AT_KEY) || 0);
  const hasSpotifyToken = !!token && Date.now() < expiresAt;
  return hasNotificationPermission && hasSpotifyToken;
}

function refreshSetupChecklist() {
  const hasNotificationPermission = "Notification" in window && Notification.permission === "granted";
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(localStorage.getItem(EXPIRES_AT_KEY) || 0);
  const hasSpotifyToken = !!token && Date.now() < expiresAt;

  setupNotificationStatusEl.textContent = hasNotificationPermission
    ? "Notifications: granted"
    : "Notifications: pending";
  setupSpotifyStatusEl.textContent = hasSpotifyToken
    ? "Spotify connection: connected"
    : "Spotify connection: pending";

  setupDoneBtn.disabled = !(hasNotificationPermission && hasSpotifyToken);
}

function showSetupModal() {
  refreshSetupChecklist();
  setupModalEl.classList.remove("hidden");
}

function hideSetupModal() {
  setupModalEl.classList.add("hidden");
}

function setAlarmFormStatus(message) {
  alarmFormStatusEl.textContent = message;
  alarmFormStatusEl.style.color = "#ffb4b4";
}

function clearAlarmFormStatus() {
  alarmFormStatusEl.textContent = "";
  alarmFormStatusEl.style.color = "";
}

function populateTimeSelectors() {
  alarmHourEl.innerHTML = "";
  alarmMinuteEl.innerHTML = "";

  for (let i = 0; i < 24; i += 1) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = `${pad2(i)} h`;
    alarmHourEl.appendChild(option);
  }

  for (let i = 0; i < 60; i += 1) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = `${pad2(i)} m`;
    alarmMinuteEl.appendChild(option);
  }
}

function populateTimezoneSelector() {
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const zoneSet = new Set([localTimezone, "UTC"]);

  if (typeof Intl.supportedValuesOf === "function") {
    for (const timezone of Intl.supportedValuesOf("timeZone")) {
      zoneSet.add(timezone);
    }
  } else {
    ["America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo", "Asia/Shanghai"].forEach((zone) => {
      zoneSet.add(zone);
    });
  }

  const zones = Array.from(zoneSet);
  zones.sort((a, b) => a.localeCompare(b));

  alarmTimezoneEl.innerHTML = "";

  const localOption = document.createElement("option");
  localOption.value = localTimezone;
  localOption.textContent = `${localTimezone} (local)`;
  alarmTimezoneEl.appendChild(localOption);

  for (const zone of zones) {
    if (zone === localTimezone) {
      continue;
    }

    const option = document.createElement("option");
    option.value = zone;
    option.textContent = zone;
    alarmTimezoneEl.appendChild(option);
  }
}

function setDefaultAlarmFormValues() {
  const now = new Date();
  const roundedToNextMinute = new Date(now.getTime() + 60000);
  alarmHourEl.value = String(roundedToNextMinute.getHours());
  alarmMinuteEl.value = String(roundedToNextMinute.getMinutes());
  alarmTimezoneEl.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  alarmRepeatDailyEl.checked = false;
}

function getSelectedRecurrence() {
  return alarmRepeatDailyEl.checked ? "daily" : "once";
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function getZonedDateParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const partMap = {};
  formatter.formatToParts(date).forEach((part) => {
    if (part.type !== "literal") {
      partMap[part.type] = part.value;
    }
  });

  const year = Number(partMap.year || 0);
  const month = Number(partMap.month || 1);
  const day = Number(partMap.day || 1);
  const hour = Number(partMap.hour || 0);
  const minute = Number(partMap.minute || 0);

  return {
    year,
    month,
    day,
    hour,
    minute,
    ymd: `${partMap.year}-${partMap.month}-${partMap.day}`
  };
}

function loadAlarms() {
  try {
    const raw = localStorage.getItem(ALARM_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((alarm) => normalizeAlarm(alarm)).filter((alarm) => alarm !== null)
      : [];
  } catch {
    return [];
  }
}

function normalizeAlarm(alarm) {
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  if (typeof alarm !== "object" || alarm === null) {
    return null;
  }

  const timezone = typeof alarm.timezone === "string" && alarm.timezone ? alarm.timezone : localTimezone;
  const recurrence = alarm.recurrence === "once" ? "once" : "daily";
  const label = typeof alarm.label === "string" && alarm.label ? alarm.label : "Alarm";
  const track = typeof alarm.track === "string" ? alarm.track : "";
  const enabled = alarm.enabled !== false;

  if (Number.isInteger(alarm.hour) && Number.isInteger(alarm.minute)) {
    return {
      id: typeof alarm.id === "string" ? alarm.id : crypto.randomUUID(),
      hour: alarm.hour,
      minute: alarm.minute,
      timezone,
      recurrence,
      onceDate: recurrence === "once" ? alarm.onceDate || getZonedDateParts(new Date(), timezone).ymd : null,
      label,
      track,
      enabled
    };
  }

  if (typeof alarm.time === "string" && /^\d{2}:\d{2}$/.test(alarm.time)) {
    const [hh, mm] = alarm.time.split(":").map((value) => Number(value));
    if (!Number.isInteger(hh) || !Number.isInteger(mm)) {
      return null;
    }

    return {
      id: typeof alarm.id === "string" ? alarm.id : crypto.randomUUID(),
      hour: hh,
      minute: mm,
      timezone,
      recurrence: "daily",
      onceDate: null,
      label,
      track,
      enabled
    };
  }

  return null;
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
    title.textContent = `${pad2(alarm.hour)}:${pad2(alarm.minute)} - ${alarm.label}`;

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
    const recurrenceLabel = alarm.recurrence === "daily" ? "Every day" : "One-time today";
    meta.textContent = `${recurrenceLabel} - ${alarm.timezone}`;

    const trackMeta = document.createElement("div");
    trackMeta.className = "alarm-meta";
    trackMeta.textContent = alarm.track;

    const stateMeta = document.createElement("div");
    stateMeta.className = "alarm-meta";
    stateMeta.textContent = describeAlarmState(alarm);

    const actions = document.createElement("div");
    actions.className = "actions";

    const openBtn = document.createElement("button");
    openBtn.className = "btn btn-ghost";
    openBtn.textContent = "Open Spotify";
    openBtn.addEventListener("click", () => {
      openSpotifyPreferred(alarm.track);
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
    li.appendChild(trackMeta);
    li.appendChild(stateMeta);
    li.appendChild(actions);
    alarmListEl.appendChild(li);
  });
}

function describeAlarmState(alarm) {
  if (!alarm.enabled) {
    return "Status: disabled";
  }

  const now = getZonedDateParts(new Date(), alarm.timezone);
  const isPastTimeToday = alarm.hour < now.hour || (alarm.hour === now.hour && alarm.minute <= now.minute);

  if (alarm.recurrence === "once") {
    if (alarm.onceDate !== now.ymd) {
      return "Status: expired (one-time window passed)";
    }

    if (isPastTimeToday) {
      return "Status: waiting for next check or about to expire";
    }

    return `Status: one-time today at ${pad2(alarm.hour)}:${pad2(alarm.minute)}`;
  }

  return `Status: repeats daily at ${pad2(alarm.hour)}:${pad2(alarm.minute)}`;
}

function getSpotifyTargets(value) {
  const input = (value || "").trim();

  if (input.startsWith("spotify:track:")) {
    const trackId = input.replace("spotify:track:", "").trim();
    return {
      appUri: `spotify:track:${trackId}`,
      webUrl: `https://open.spotify.com/track/${encodeURIComponent(trackId)}`
    };
  }

  if (input.startsWith("spotify:album:")) {
    const albumId = input.replace("spotify:album:", "").trim();
    return {
      appUri: `spotify:album:${albumId}`,
      webUrl: `https://open.spotify.com/album/${encodeURIComponent(albumId)}`
    };
  }

  if (input.startsWith("spotify:playlist:")) {
    const playlistId = input.replace("spotify:playlist:", "").trim();
    return {
      appUri: `spotify:playlist:${playlistId}`,
      webUrl: `https://open.spotify.com/playlist/${encodeURIComponent(playlistId)}`
    };
  }

  if (input.startsWith("https://open.spotify.com/") || input.startsWith("http://open.spotify.com/")) {
    try {
      const parsed = new URL(input);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const type = parts[0];
      const id = parts[1];

      if (["track", "album", "playlist"].includes(type) && id) {
        return {
          appUri: `spotify:${type}:${id}`,
          webUrl: `https://open.spotify.com/${type}/${encodeURIComponent(id)}`
        };
      }

      return { appUri: "spotify://", webUrl: "https://open.spotify.com/" };
    } catch {
      return { appUri: "spotify://", webUrl: "https://open.spotify.com/" };
    }
  }

  if (input.startsWith("spotify:")) {
    return {
      appUri: input,
      webUrl: "https://open.spotify.com/"
    };
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    return { appUri: "spotify://", webUrl: input };
  }

  return {
    appUri: "spotify://",
    webUrl: `https://open.spotify.com/search/${encodeURIComponent(input)}`
  };
}

function openSpotifyPreferred(value) {
  const { appUri, webUrl } = getSpotifyTargets(value);
  openUrlPreferringApp(appUri, webUrl);
}

function openUrlPreferringApp(appUri, webUrl) {
  if (!appUri) {
    openWebUrl(webUrl);
    return;
  }

  let appOpened = false;
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      appOpened = true;
    }
  };

  document.addEventListener("visibilitychange", onVisibilityChange, { once: true });
  window.location.href = appUri;

  window.setTimeout(() => {
    if (!appOpened) {
      openWebUrl(webUrl);
    }
  }, 1100);
}

function openWebUrl(url) {
  const popup = window.open(url, "_blank", "noopener");
  if (!popup) {
    window.location.href = url;
  }
}

function startAlarmEngine() {
  checkAndFireAlarms();
  setInterval(checkAndFireAlarms, 15000);
}

async function checkAndFireAlarms() {
  const now = new Date();

  const lastFiredByAlarm = readLastFiredMap();
  let alarmsChanged = false;

  for (const alarm of alarms) {
    if (!alarm.enabled) {
      continue;
    }

    const zonedNow = getZonedDateParts(now, alarm.timezone);

    if (alarm.recurrence === "once" && alarm.onceDate !== zonedNow.ymd) {
      alarm.enabled = false;
      alarmsChanged = true;
      continue;
    }

    if (alarm.hour !== zonedNow.hour || alarm.minute !== zonedNow.minute) {
      continue;
    }

    if (lastFiredByAlarm[alarm.id] === zonedNow.ymd) {
      continue;
    }

    await fireAlarm(alarm);
    lastFiredByAlarm[alarm.id] = zonedNow.ymd;

    if (alarm.recurrence === "once") {
      alarm.enabled = false;
      alarmsChanged = true;
    }
  }

  localStorage.setItem(LAST_FIRED_DATE_KEY, JSON.stringify(lastFiredByAlarm));

  if (alarmsChanged) {
    saveAlarms();
    renderAlarms();
  }
}

function readLastFiredMap() {
  try {
    return JSON.parse(localStorage.getItem(LAST_FIRED_DATE_KEY) || "{}");
  } catch {
    return {};
  }
}

async function fireAlarm(alarm) {
  const targets = getSpotifyTargets(alarm.track);

  if ("Notification" in window && Notification.permission === "granted") {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      registration.showNotification(`Wakey Wakey: ${alarm.label}`, {
        body: "Tap to open Spotify",
        data: { url: targets.webUrl },
        tag: `alarm-${alarm.id}`,
        renotify: true
      });
      return;
    }
  }

  openSpotifyPreferred(alarm.track);
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

  if (Notification.permission === "granted") {
    notificationBtn.disabled = true;
    notificationBtn.textContent = "Notifications Enabled";
  } else {
    notificationBtn.disabled = false;
    notificationBtn.textContent = "Enable Notifications";
  }
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return;
  }
  await Notification.requestPermission();
  localStorage.setItem(NOTIFICATION_EARLY_PROMPTED_KEY, "1");
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
  spotifySearchStatusEl.textContent = "";
  spotifySearchResultsEl.innerHTML = "";
  refreshSetupChecklist();
}

async function startSpotifyLogin() {
  if (!spotifyClientId) {
    alert("Set spotifyClientId in config.public.js first.");
    return;
  }

  if (isLikelyIOS() && localStorage.getItem(SPOTIFY_LOGIN_PRIMED_KEY) !== "1") {
    localStorage.setItem(SPOTIFY_LOGIN_PRIMED_KEY, "1");
    spotifyStatusEl.textContent = "Opened Spotify app. Log in there, then return and tap Connect Spotify again.";
    openUrlPreferringApp("spotify://", "https://open.spotify.com/");
    return;
  }

  localStorage.removeItem(SPOTIFY_LOGIN_PRIMED_KEY);

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

function isLikelyIOS() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua);
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
    refreshSetupChecklist();
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
