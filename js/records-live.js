import {
  escapeHtml,
  formatDate,
  formatInteger,
  formatNumber,
  watchPublicResults,
} from "./public-data.js";

const recordsGrid = document.getElementById("recordsGrid");
const header = document.querySelector(".header");
const state = document.createElement("div");
state.className = "live-data-state";
state.innerHTML = '<i class="fa-solid fa-satellite-dish"></i><span>Daten werden geladen …</span>';
header?.after(state);

function card({ label, value, detail, chip, icon, featured = false, players = "" }) {
  return `<article class="record-card${featured ? " featured" : ""}">
    <div class="record-inner">
      <span class="record-label">${escapeHtml(label)}</span>
      <div class="record-value">${escapeHtml(value)}</div>
      <div class="record-detail">${escapeHtml(detail)}</div>
      ${players ? `<div class="record-players">${escapeHtml(players)}</div>` : ""}
      <div class="record-chip"><i class="${escapeHtml(icon)}"></i><span>${escapeHtml(chip)}</span></div>
    </div>
  </article>`;
}

function teamPlayers(data, teamId) {
  return (data.analytics?.players ?? [])
    .filter((player) => player.teamId === teamId)
    .sort((a, b) => Number(b.average ?? 0) - Number(a.average ?? 0))
    .map((player) => player.name)
    .join(" · ");
}

function render(data) {
  if (Number(data.schemaVersion ?? 1) < 2 || !data.records || !data.analytics?.players) {
    showError("Der veröffentlichte Saisonstand enthält noch keine Live-Analyse. Im Adminbereich einmal „Öffentliche Statistiken neu berechnen“ ausführen.");
    return;
  }

  const r = data.records;
  const series = r.bestSeries;
  const game = r.bestGame;
  const average = r.highestAverage;
  const games200 = r.most200Games;
  const consistency = r.bestConsistency;
  const improvement = r.bestImprovement;
  const team = r.bestTeamOverall;
  const teamDay = r.bestTeamMatchday;

  const records = [
    {
      label: "Bester Spieltag",
      value: series?.name ?? "–",
      detail: series ? `${formatInteger(series.pins)} Pins · Ø ${formatNumber(series.average)}` : "Noch kein vollständiger Wert",
      chip: series ? `Spieltag ${series.matchdayNumber} · ${formatDate(series.date)}` : "Wird automatisch berechnet",
      icon: "fa-solid fa-trophy",
      featured: true,
    },
    {
      label: "Bestes Einzelspiel",
      value: game?.name ?? "–",
      detail: game ? `${formatInteger(game.score)} Pins · Spiel ${game.gameNumber}` : "Noch kein Einzelspiel",
      chip: game ? `Spieltag ${game.matchdayNumber} · ${formatDate(game.date)}` : "Wird automatisch berechnet",
      icon: "fa-solid fa-bolt",
    },
    {
      label: "Höchster Saisonschnitt",
      value: average?.name ?? "–",
      detail: average ? `Ø ${formatNumber(average.average)} · ${formatInteger(average.games)} Spiele` : "Noch kein Saisonwert",
      chip: average ? `${formatInteger(average.pins)} Pins gesamt` : "Wird automatisch berechnet",
      icon: "fa-solid fa-chart-line",
    },
    {
      label: "Meiste Spiele ab 200",
      value: games200?.name ?? "–",
      detail: games200 ? `${formatInteger(games200.games200)} Spiele ab 200 Pins` : "Noch kein Wert",
      chip: games200 ? `Bestes Spiel: ${formatInteger(games200.bestGame)}` : "Wird automatisch berechnet",
      icon: "fa-solid fa-fire",
    },
    {
      label: "Beste Konstanz",
      value: consistency?.name ?? "–",
      detail: consistency ? `${formatInteger(consistency.score)} / 100 · Schwankung ${formatNumber(consistency.standardDeviation)}` : "Mindestens 8 Einzelspiele erforderlich",
      chip: consistency ? `${formatInteger(consistency.games)} ausgewertete Spiele` : "Noch nicht genügend Daten",
      icon: "fa-solid fa-wave-square",
    },
    {
      label: "Beste Verbesserung",
      value: improvement?.name ?? "–",
      detail: improvement ? `+${formatNumber(improvement.delta)} Pins im Schnitt` : "Kein Vorsaisonvergleich verfügbar",
      chip: improvement ? `${formatNumber(improvement.previousSeasonAverage)} → ${formatNumber(improvement.currentAverage)} · +${formatNumber(improvement.percent)} %` : "Nur Spieler mit Vorsaisonwert",
      icon: "fa-solid fa-arrow-trend-up",
    },
    {
      label: "Führendes Team",
      value: team?.name ?? "–",
      detail: team ? `${formatInteger(team.points)} Punkte · ${formatInteger(team.pins)} Pins` : "Noch keine Teamwertung",
      chip: team ? `Ø ${formatNumber(team.average)} · Platz ${team.rank}` : "Wird automatisch berechnet",
      players: team ? `Kader: ${teamPlayers(data, team.teamId) || "–"}` : "",
      icon: "fa-solid fa-people-group",
    },
    {
      label: "Stärkster Team-Spieltag",
      value: teamDay?.name ?? "–",
      detail: teamDay ? `${formatInteger(teamDay.scoringPins)} Wertungspins` : "Noch kein Teamwert",
      chip: teamDay ? `Spieltag ${teamDay.matchdayNumber} · ${formatDate(teamDay.date)}${teamDay.bonusPins ? ` · davon ${formatInteger(teamDay.bonusPins)} Bonus` : ""}` : "Wird automatisch berechnet",
      icon: "fa-solid fa-gears",
    },
  ];

  recordsGrid.innerHTML = records.map(card).join("");
  state.classList.remove("error");
  state.innerHTML = `<i class="fa-solid fa-signal"></i><span>${escapeHtml(data.seasonName ?? data.seasonId)} · berechnet bis Spieltag ${formatInteger(data.matchday?.number)} · Hausligaschnitt ${formatNumber(r.weightedHouseAverage)}</span>`;
}

function showError(message) {
  recordsGrid.innerHTML = `<div class="error-box">${escapeHtml(message)}</div>`;
  state.classList.add("error");
  state.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span>${escapeHtml(message)}</span>`;
}

watchPublicResults({
  onData: (data, _seasonId, meta) => {
    render(data);
    if (meta?.warning) {
      state.classList.add("fallback");
      state.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span>${escapeHtml(meta.warning)}</span>`;
    }
  },
  onError: showError,
  onSeasonChange: (seasonId) => {
    state.classList.remove("error");
    state.innerHTML = `<i class="fa-solid fa-satellite-dish"></i><span>${escapeHtml(seasonId)} wird geladen …</span>`;
  },
});
