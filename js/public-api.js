const API_URL = "https://europe-west3-liga-velten.cloudfunctions.net/publicLigaData";
const INITIAL_SEASON_ID = "2026-s2";
const POLL_INTERVAL_MS = 60_000;

function requestedSeasonId() {
  const value = new URLSearchParams(window.location.search).get("saison");
  return value && /^[a-z0-9-]{3,40}$/.test(value) ? value : null;
}

async function fetchJson(url, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}

async function fallbackJson(filename) {
  const url = new URL(`../data/${filename}`, import.meta.url);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Sicherungsdatei ${filename} fehlt.`);
  return response.json();
}

export async function loadPublicConfig() {
  try {
    const payload = await fetchJson(`${API_URL}?type=config`);
    return { data: payload.data, source: "live", warning: null };
  } catch (error) {
    const data = await fallbackJson("public-config-current.json");
    return {
      data,
      source: "fallback",
      warning: `Live-Verbindung nicht verfügbar. Sicherungsstand wird angezeigt (${error.message}).`,
    };
  }
}

export async function resolveSeasonId({ schedule = false } = {}) {
  const requested = requestedSeasonId();
  if (requested) return requested;
  const config = await loadPublicConfig();
  return schedule
    ? (config.data?.activeScheduleSeasonId ?? config.data?.activeSeasonId ?? INITIAL_SEASON_ID)
    : (config.data?.activeSeasonId ?? INITIAL_SEASON_ID);
}

export async function loadPublicResults(seasonId = null) {
  const resolved = seasonId ?? await resolveSeasonId();
  try {
    const payload = await fetchJson(`${API_URL}?type=results&season=${encodeURIComponent(resolved)}`);
    return { data: payload.data, seasonId: payload.seasonId ?? resolved, source: "live", warning: null };
  } catch (error) {
    if (resolved !== INITIAL_SEASON_ID) throw error;
    const data = await fallbackJson("public-results-current.json");
    return {
      data,
      seasonId: resolved,
      source: "fallback",
      warning: `Live-Verbindung nicht verfügbar. Sicherungsstand bis Spieltag ${data.matchday?.number ?? "–"} wird angezeigt.`,
    };
  }
}

export async function loadPublicSchedule(seasonId = null) {
  const resolved = seasonId ?? await resolveSeasonId({ schedule: true });
  try {
    const payload = await fetchJson(`${API_URL}?type=schedule&season=${encodeURIComponent(resolved)}`);
    return {
      data: payload.data,
      publishedThrough: Number(payload.publishedThrough ?? 0),
      seasonId: payload.seasonId ?? resolved,
      source: "live",
      warning: null,
    };
  } catch (error) {
    if (resolved !== INITIAL_SEASON_ID) throw error;
    const fallback = await fallbackJson("public-schedule-current.json");
    return {
      data: fallback.data,
      publishedThrough: Number(fallback.publishedThrough ?? 0),
      seasonId: resolved,
      source: "fallback",
      warning: "Live-Verbindung nicht verfügbar. Der zuletzt gebündelte Spielplan wird angezeigt.",
    };
  }
}

export async function loadPublicSeasons() {
  try {
    const payload = await fetchJson(`${API_URL}?type=seasons`);
    return { data: payload.data ?? [], activeSeasonId: payload.activeSeasonId ?? null, source: "live", warning: null };
  } catch (error) {
    const fallback = await fallbackJson("public-seasons-current.json");
    return {
      data: fallback.data ?? [],
      activeSeasonId: fallback.activeSeasonId ?? null,
      source: "fallback",
      warning: `Live-Verbindung nicht verfügbar. Sicherungsarchiv wird angezeigt (${error.message}).`,
    };
  }
}

export function watchLoader(loader, { onData, onError, onSeasonChange } = {}) {
  let stopped = false;
  let timer = null;
  let lastSeason = null;

  const run = async () => {
    try {
      const result = await loader();
      if (stopped) return;
      if (result.seasonId && result.seasonId !== lastSeason) {
        lastSeason = result.seasonId;
        onSeasonChange?.(result.seasonId);
      }
      onData?.(result.data, result);
    } catch (error) {
      if (!stopped) onError?.(error instanceof Error ? error.message : String(error));
    } finally {
      if (!stopped) timer = window.setTimeout(run, POLL_INTERVAL_MS);
    }
  };

  run();
  return () => {
    stopped = true;
    if (timer) window.clearTimeout(timer);
  };
}

export { requestedSeasonId, INITIAL_SEASON_ID };
