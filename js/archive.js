import { loadPublicSeasons, watchLoader } from "./public-api.js";

const message = document.querySelector("#archiveMessage");
const container = document.querySelector("#seasonArchive");

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return "–";
  return new Date(`${value}T12:00:00`).toLocaleDateString("de-DE");
}
function statusLabel(season) {
  if (season.status === "completed" || Number(season.currentPublishedMatchday) >= Number(season.matchdayCount ?? 14)) return "abgeschlossen";
  if (Number(season.currentPublishedMatchday ?? 0) > 0) return "laufend";
  return "vorbereitet";
}
function render(seasons, meta) {
  if (!seasons.length) {
    container.innerHTML = "";
    message.textContent = "Noch keine öffentliche Saison im Archiv.";
    message.className = "status";
    return;
  }
  message.textContent = meta.warning ?? "";
  message.className = meta.warning ? "status" : "status hidden";
  container.innerHTML = seasons.map((season) => {
    const isActive = season.seasonId === meta.activeSeasonId;
    const published = Number(season.currentPublishedMatchday ?? 0);
    const count = Number(season.matchdayCount ?? 14);
    const range = season.firstMatchdayDate || season.lastMatchdayDate ? `${formatDate(season.firstMatchdayDate)} bis ${formatDate(season.lastMatchdayDate)}` : "Termine nicht veröffentlicht";
    return `<article class="archive-card${isActive ? " is-active" : "}">
      <header><div><span class="schedule-state">${escapeHtml(isActive ? "aktuelle Saison" : statusLabel(season))}</span><h2>${escapeHtml(season.seasonName ?? season.seasonId)}</h2></div><strong>${published}/${count} Spieltage</strong></header>
      <p class="muted">${escapeHtml(range)}</p>
      <div class="archive-progress"><span style="width:${Math.max(0, Math.min(100, count ? published / count * 100 : 0))}%"></span></div>
      <div class="actions">
        ${season.hasResults ? `<a class="button" href="ergebnisse.html?saison=${encodeURIComponent(season.seasonId)}">Ergebnisse</a>` : ""}
        ${season.hasSchedule ? `<a class="button secondary" href="spielplan.html?saison=${encodeURIComponent(season.seasonId)}">Spielplan</a>` : ""}
      </div>
    </article>`;
  }).join("");
}
watchLoader(loadPublicSeasons, {
  onData: (data, meta) => render(data, meta),
  onError: (error) => { message.textContent = `Saisonarchiv konnte nicht geladen werden: ${error}`; message.className = "status error"; container.innerHTML = ""; },
});
