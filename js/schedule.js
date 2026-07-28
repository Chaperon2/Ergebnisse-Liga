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

function buildTeamColorMap(matchdays) {
  const teamNames = [...new Set(
    matchdays.flatMap((day) => (day.pairings ?? []).flatMap((pairing) => [pairing.homeTeam, pairing.awayTeam])),
  )]
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b), "de", { sensitivity: "base" }));

  return new Map(teamNames.map((name, index) => [name, TEAM_COLOR_CLASSES[index % TEAM_COLOR_CLASSES.length]]));
}

function teamColorClass(teamName, colorMap) {
  return colorMap.get(teamName) ?? TEAM_COLOR_CLASSES[0];
}

function renderTeamLegend(colorMap) {
  return `<section class="team-color-legend" aria-label="Teamfarben">
    <div class="team-color-legend-title"><i class="fa-solid fa-palette"></i><span>Teamfarben</span></div>
    <div class="team-color-chips">${[...colorMap.entries()].map(([teamName, colorClass]) => (
      `<span class="team-color-chip ${colorClass}"><span class="team-color-dot"></span>${escapeHtml(teamName)}</span>`
    )).join("")}</div>
  </section>`;
}

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return "Datum";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
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
  title.textContent = scheduleData.seasonName ?? scheduleData.seasonId ?? "Spielplan";
  summary.textContent = publishedThrough >= 14
    ? "Die Saison ist abgeschlossen. Alle Begegnungen und Bahnpaarungen bleiben im Archiv sichtbar."
    : publishedThrough > 0
      ? `Ergebnisse sind bis Spieltag ${publishedThrough} veröffentlicht. Spieltag ${nextNumber} ist als Nächstes vorgesehen.`
      : `Alle ${matchdays.length} Spieltage mit festen Bahnpaarungen.`;

  if (overview) {
    overview.innerHTML = [
      ["Saison", scheduleData.seasonName ?? scheduleData.seasonId, "fa-gears"],
      ["Spieltage", `${matchdays.length}`, "fa-calendar-days"],
      ["Veröffentlicht", `${publishedThrough} / ${matchdays.length}`, "fa-signal"],
      ["Bahnen", "1+2 · 3+4 · 5+6 · 7+8", "fa-road"],
    ].map(([label, value, icon]) => `<article class="summary-card"><i class="fa-solid ${icon}"></i><div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div></article>`).join("");
  }

  const teamColors = buildTeamColorMap(matchdays);
  container.classList.add("schedule-grid-dashboard");
  container.innerHTML = renderTeamLegend(teamColors) + matchdays.map((day) => {
    const played = Number(day.number) <= publishedThrough;
    const next = Number(day.number) === nextNumber;
    const stateClass = played ? "is-played" : next ? "is-next" : "";
    const stateLabel = played ? "gespielt" : next ? "nächster Spieltag" : "geplant";
    return `<article class="schedule-day ${stateClass}" id="spieltag-${Number(day.number)}">
      <header class="schedule-day-head">
        <div><span class="schedule-state">${escapeHtml(stateLabel)}</span><h2>Spieltag ${Number(day.number)}</h2></div>
        <time datetime="${escapeHtml(day.date)}">${escapeHtml(formatDate(day.date))}</time>
      </header>
      <div class="pairing-list">
        ${(day.pairings ?? []).map((pairing) => `<div class="pairing-row">
          <span class="lane-badge">Bahn ${escapeHtml(pairing.lanePair)}</span>
          <strong class="team team-colored home ${teamColorClass(pairing.homeTeam, teamColors)}">${escapeHtml(pairing.homeTeam)}</strong>
          <span class="versus">VS</span>
          <strong class="team team-colored away ${teamColorClass(pairing.awayTeam, teamColors)}">${escapeHtml(pairing.awayTeam)}</strong>
        </div>`).join("")}
      </div>
    </article>`;
  }).join("");

  liveState.className = `live-state ${meta.source === "fallback" ? "fallback" : "live"}`;
  liveState.innerHTML = `<i class="fa-solid ${meta.source === "fallback" ? "fa-triangle-exclamation" : "fa-signal"}"></i><span>${escapeHtml(meta.warning ?? "Live aus der Ligadatenbank · automatische Aktualisierung")}</span>`;
  hideMessage();

  const nextCard = nextNumber ? document.querySelector(`#spieltag-${nextNumber}`) : null;
  if (nextCard) nextCard.setAttribute("aria-current", "date");
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
