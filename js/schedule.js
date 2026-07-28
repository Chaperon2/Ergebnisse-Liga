import { loadPublicSchedule, requestedSeasonId, watchLoader } from "./public-api.js";

const title = document.querySelector("#scheduleTitle");
const summary = document.querySelector("#scheduleSummary");
const message = document.querySelector("#scheduleMessage");
const container = document.querySelector("#publicSchedule");
const liveState = document.querySelector("#liveState");
const overview = document.querySelector("#scheduleOverview");
const jumpToCurrentBtn = document.querySelector("#jumpToCurrentBtn");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const TEAM_COLOR_CLASSES = [
  "team-color-1",
  "team-color-2",
  "team-color-3",
  "team-color-4",
  "team-color-5",
  "team-color-6",
  "team-color-7",
  "team-color-8",
];

function normalizeTeamName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[´'’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* Feste Farben für die derzeitigen Teams. Neue Namen erhalten automatisch
   eine noch freie Farbe. Dadurch bleiben Farben innerhalb einer Saison stabil. */
const KNOWN_TEAM_COLORS = new Map([
  ["3 bowler", "team-color-1"],
  ["die schraagen", "team-color-2"],
  ["pincesses", "team-color-3"],
  ["tigers", "team-color-4"],
  ["scooter", "team-color-5"],
  ["malibu", "team-color-6"],
  ["lady dianas", "team-color-7"],
  ["all stars", "team-color-8"],
]);

function buildTeamColorMap(matchdays) {
  const teamNames = [...new Set(
    matchdays.flatMap((day) => (day.pairings ?? []).flatMap((pairing) => [pairing.homeTeam, pairing.awayTeam])),
  )]
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b), "de", { sensitivity: "base" }));

  const assigned = new Map();
  const used = new Set();

  teamNames.forEach((name) => {
    const knownClass = KNOWN_TEAM_COLORS.get(normalizeTeamName(name));
    if (knownClass) {
      assigned.set(name, knownClass);
      used.add(knownClass);
    }
  });

  const freeClasses = TEAM_COLOR_CLASSES.filter((className) => !used.has(className));
  teamNames.forEach((name) => {
    if (assigned.has(name)) return;
    assigned.set(name, freeClasses.shift() ?? TEAM_COLOR_CLASSES[assigned.size % TEAM_COLOR_CLASSES.length]);
  });

  return assigned;
}

function teamColorClass(teamName, colorMap) {
  return colorMap.get(teamName) ?? TEAM_COLOR_CLASSES[0];
}

function renderTeamLegend(colorMap) {
  return `<section class="team-color-legend schedule-team-legend" aria-label="Teamfarben">
    <div class="team-color-chips">${[...colorMap.entries()].map(([teamName, colorClass]) => (
      `<span class="team-color-chip ${colorClass}"><i class="fa-solid fa-gear" aria-hidden="true"></i>${escapeHtml(teamName)}</span>`
    )).join("")}</div>
  </section>`;
}

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function getBerlinNow() {
  const formatter = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    key: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function relevantMatchday(matchdays) {
  if (!matchdays.length) return null;
  const now = getBerlinNow();
  const cutoffMinutes = 18 * 60 + 45;
  const sameDay = matchdays.find((day) => day.date === now.key);
  if (sameDay && now.minutes <= cutoffMinutes) return sameDay;
  const nextFuture = matchdays.find((day) => day.date > now.key);
  if (nextFuture) return nextFuture;
  if (sameDay) return sameDay;
  return matchdays[matchdays.length - 1];
}

function compactDate(value) {
  return formatDate(value) === "–" ? "Datum" : formatDate(value);
}

function configureJumpButton(matchdays) {
  if (!jumpToCurrentBtn) return;
  const target = relevantMatchday(matchdays);
  if (!target) {
    jumpToCurrentBtn.classList.add("hidden");
    jumpToCurrentBtn.onclick = null;
    return;
  }

  const label = jumpToCurrentBtn.querySelector("span");
  if (label) label.textContent = `Zum ${compactDate(target.date)}`;
  jumpToCurrentBtn.classList.remove("hidden");
  jumpToCurrentBtn.onclick = () => {
    const card = document.querySelector(`#spieltag-${Number(target.number)}`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    card.classList.add("pulse-target");
    window.setTimeout(() => card.classList.remove("pulse-target"), 1900);
  };
}

function nextMatchdayNumber(matchdays, publishedThrough) {
  if (publishedThrough > 0 && publishedThrough < 14) return publishedThrough + 1;
  if (publishedThrough >= 14) return null;
  const today = new Date().toISOString().slice(0, 10);
  return matchdays.find((day) => day.date >= today)?.number ?? matchdays[0]?.number ?? null;
}

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `status-message${type ? ` ${type}` : ""}`;
}

function hideMessage() {
  message.textContent = "";
  message.className = "status-message hidden";
}

function render(scheduleData, meta) {
  const matchdays = [...(scheduleData?.matchdays ?? [])].sort((a, b) => Number(a.number) - Number(b.number));
  if (!matchdays.length) {
    showMessage("Der veröffentlichte Spielplan enthält keine Spieltage.", "error");
    return;
  }

  const publishedThrough = Number(meta.publishedThrough ?? 0);
  const nextNumber = nextMatchdayNumber(matchdays, publishedThrough);
  const focusDay = relevantMatchday(matchdays);
  const seasonLabel = scheduleData.seasonName ?? scheduleData.seasonId ?? "Saison";
  title.textContent = `Spielplan · ${seasonLabel}`;
  summary.textContent = publishedThrough >= 14
    ? "Die Saison ist abgeschlossen. Alle Begegnungen und Bahnpaarungen bleiben sichtbar."
    : publishedThrough > 0
      ? `Ergebnisse sind bis Spieltag ${publishedThrough} veröffentlicht. Spieltag ${nextNumber} ist als Nächstes vorgesehen.`
      : `Alle ${matchdays.length} Spieltage mit festen Bahnpaarungen.`;

  if (overview) {
    overview.className = "schedule-overview-bar";
    overview.innerHTML = [
      ["fa-calendar-days", `${matchdays.length} Spieltage`],
      ["fa-people-group", "8 Teams"],
      ["fa-road", "Bahnen 1+2 · 3+4 · 5+6 · 7+8"],
      ["fa-signal", `${publishedThrough} veröffentlicht`],
    ].map(([icon, value]) => `<span><i class="fa-solid ${icon}"></i>${escapeHtml(value)}</span>`).join("");
  }

  const teamColors = buildTeamColorMap(matchdays);
  container.innerHTML = renderTeamLegend(teamColors) + matchdays.map((day) => {
    const played = Number(day.number) <= publishedThrough;
    const next = Number(day.number) === nextNumber;
    const focused = Number(day.number) === Number(focusDay?.number);
    const stateClass = [played ? "is-played" : "", next ? "is-next" : "", focused ? "is-current" : ""].filter(Boolean).join(" ");
    const stateLabel = next ? "Nächster Spieltag" : played ? "Gespielt" : "Geplant";
    return `<article class="schedule-day ${stateClass}" id="spieltag-${Number(day.number)}" aria-label="Spieltag ${Number(day.number)} · ${escapeHtml(stateLabel)}">
      <header class="schedule-day-head">
        <div class="schedule-day-title"><i class="fa-solid fa-star" aria-hidden="true"></i><h2>Spieltag ${Number(day.number)}</h2></div>
        <time datetime="${escapeHtml(day.date)}">${escapeHtml(formatDate(day.date))}</time>
      </header>
      <div class="pairing-list">
        ${(day.pairings ?? []).map((pairing) => `<div class="pairing-row">
          <strong class="team team-colored home ${teamColorClass(pairing.homeTeam, teamColors)}">${escapeHtml(pairing.homeTeam)}</strong>
          <span class="versus"><small>Bahn ${escapeHtml(pairing.lanePair)}</small><b>VS</b></span>
          <strong class="team team-colored away ${teamColorClass(pairing.awayTeam, teamColors)}">${escapeHtml(pairing.awayTeam)}</strong>
        </div>`).join("")}
      </div>
    </article>`;
  }).join("");

  liveState.className = `live-state ${meta.source === "fallback" ? "fallback" : "live"}`;
  liveState.innerHTML = `<i class="fa-solid ${meta.source === "fallback" ? "fa-triangle-exclamation" : "fa-signal"}"></i><span>${escapeHtml(meta.warning ?? "Live aus der Ligadatenbank · automatische Aktualisierung")}</span>`;
  hideMessage();

  const currentCard = focusDay ? document.querySelector(`#spieltag-${Number(focusDay.number)}`) : null;
  if (currentCard) currentCard.setAttribute("aria-current", "date");
  configureJumpButton(matchdays);
}

const requested = requestedSeasonId();
watchLoader(
  () => loadPublicSchedule(requested),
  {
    onData: (data, meta) => render(data, meta),
    onError: (error) => {
      container.innerHTML = "";
      title.textContent = "Spielplan nicht verfügbar";
      summary.textContent = "Die öffentliche Datenquelle konnte nicht erreicht werden.";
      showMessage(error, "error");
      liveState.className = "live-state error";
      liveState.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span>${escapeHtml(error)}</span>`;
      if (jumpToCurrentBtn) jumpToCurrentBtn.classList.add("hidden");
    },
  },
);
