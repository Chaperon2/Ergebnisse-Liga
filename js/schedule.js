import { loadPublicSchedule, requestedSeasonId, watchLoader } from "./public-api.js";

const title = document.querySelector("#scheduleTitle");
const summary = document.querySelector("#scheduleSummary");
const message = document.querySelector("#scheduleMessage");
const container = document.querySelector("#publicSchedule");
const liveState = document.querySelector("#liveState");
const overview = document.querySelector("#scheduleOverview");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

  container.innerHTML = matchdays.map((day) => {
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
          <strong class="team home">${escapeHtml(pairing.homeTeam)}</strong>
          <span class="versus">VS</span>
          <strong class="team away">${escapeHtml(pairing.awayTeam)}</strong>
        </div>`).join("")}
      </div>
    </article>`;
  }).join("");

  liveState.className = `live-state ${meta.source === "fallback" ? "fallback" : "live"}`;
  liveState.innerHTML = `<i class="fa-solid ${meta.source === "fallback" ? "fa-triangle-exclamation" : "fa-signal"}"></i><span>${escapeHtml(meta.warning ?? "Live aus der Ligadatenbank · automatische Aktualisierung")}</span>`;
  hideMessage();

  const nextCard = nextNumber ? document.querySelector(`#spieltag-${nextNumber}`) : null;
  if (nextCard) nextCard.setAttribute("aria-current", "date");
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
    },
  },
);
