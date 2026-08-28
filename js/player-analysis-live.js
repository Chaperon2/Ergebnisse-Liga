import {
  escapeHtml,
  formatDate,
  formatInteger,
  formatNumber,
  watchPublicResults,
} from "./public-data.js";

const playerSelect = document.getElementById("playerSelect");
const playerChip = document.getElementById("playerChip");
const playedInfo = document.getElementById("playedInfo");
const statAverage = document.getElementById("statAverage");
const statBest = document.getElementById("statBest");
const statPlayed = document.getElementById("statPlayed");
const statAbsent = document.getElementById("statAbsent");
const statConsistency = document.getElementById("statConsistency");
const statDeviation = document.getElementById("statDeviation");
const statRange = document.getElementById("statRange");
const chartCanvas = document.getElementById("playerChart");
const chartDetailBox = document.getElementById("chartDetailBox");
const infoModalOverlay = document.getElementById("infoModalOverlay");
const infoModalTitle = document.getElementById("infoModalTitle");
const infoModalText = document.getElementById("infoModalText");
const infoModalClose = document.getElementById("infoModalClose");

let currentData = null;
let chart = null;
let chartRows = [];

function selectedPlayerFromUrl() {
  const value = new URLSearchParams(window.location.search).get("spieler");
  return value && value.length <= 120 ? value : null;
}

function updatePlayerUrl(playerId) {
  const url = new URL(window.location.href);
  url.searchParams.set("spieler", playerId);
  history.replaceState(null, "", url);
}

function runningRows(player) {
  let pins = 0;
  let games = 0;
  const rows = [];

  for (const entry of player.entries ?? []) {
    const scores = (entry.scores ?? []).filter((score) => Number.isInteger(score) && score > 0);
    if (!scores.length) {
      rows.push({
        label: `ST ${entry.matchdayNumber}`,
        gameValue: null,
        averageValue: games > 0 ? pins / games : null,
        isGap: true,
        entry,
      });
      continue;
    }

    scores.forEach((score, index) => {
      pins += score;
      games += 1;
      rows.push({
        label: `ST ${entry.matchdayNumber}.${index + 1}`,
        gameValue: score,
        averageValue: pins / games,
        isGap: false,
        gameNumber: index + 1,
        entry,
      });
    });
  }

  return rows;
}

function showChartDetail(row) {
  if (!row) return;
  const entry = row.entry;
  if (row.isGap) {
    chartDetailBox.innerHTML = `<span class="chart-detail-title">Ausgewählter Spieltag</span>
      <div class="chart-detail-values">
        <span class="chart-detail-chip">Spieltag ${formatInteger(entry.matchdayNumber)}</span>
        <span class="chart-detail-chip">${escapeHtml(formatDate(entry.date))}</span>
        <span class="chart-detail-chip">Kein Einzelspiel</span>
        <span class="chart-detail-chip">Saison bleibt ${formatNumber(entry.cumulativeAverage)}</span>
      </div>`;
  } else {
    chartDetailBox.innerHTML = `<span class="chart-detail-title">Ausgewähltes Einzelspiel</span>
      <div class="chart-detail-values">
        <span class="chart-detail-chip">Spieltag ${formatInteger(entry.matchdayNumber)}</span>
        <span class="chart-detail-chip">${escapeHtml(formatDate(entry.date))}</span>
        <span class="chart-detail-chip">Spiel ${formatInteger(row.gameNumber)}</span>
        <span class="chart-detail-chip">${formatInteger(row.gameValue)} Pins</span>
        <span class="chart-detail-chip">Tagesschnitt ${formatNumber(entry.dayAverage)}</span>
        <span class="chart-detail-chip">Saison nach Spiel ${formatNumber(row.averageValue)}</span>
      </div>`;
  }
  chartDetailBox.classList.remove("hidden");
}

function buildChart(player) {
  chartRows = runningRows(player);
  chart?.destroy();
  chartDetailBox.classList.add("hidden");
  chartDetailBox.innerHTML = "";

  if (!window.Chart) {
    chartDetailBox.classList.remove("hidden");
    chartDetailBox.textContent = "Das Diagramm-Modul konnte nicht geladen werden.";
    return;
  }

  chart = new window.Chart(chartCanvas, {
    type: "line",
    data: {
      labels: chartRows.map((row) => row.label),
      datasets: [
        {
          label: "Einzelspiel",
          data: chartRows.map((row) => row.gameValue),
          borderColor: "#40f4ef",
          backgroundColor: "rgba(64,244,239,.22)",
          pointBackgroundColor: chartRows.map((row) => row.isGap ? "#ff59b6" : "#40f4ef"),
          pointBorderColor: "#071012",
          pointRadius: chartRows.map((row) => row.isGap ? 5 : 3),
          pointHoverRadius: 7,
          borderWidth: 2,
          spanGaps: false,
          tension: 0.18,
        },
        {
          label: "Laufender Saison-Schnitt",
          data: chartRows.map((row) => row.averageValue),
          borderColor: "#ffc85b",
          backgroundColor: "transparent",
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          borderDash: [8, 6],
          spanGaps: true,
          tension: 0.22,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      onClick: (_event, elements) => {
        const index = elements?.[0]?.index;
        if (Number.isInteger(index)) showChartDetail(chartRows[index]);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const row = chartRows[items?.[0]?.dataIndex];
              return row ? `Spieltag ${row.entry.matchdayNumber} · ${formatDate(row.entry.date)}` : "";
            },
            label: (item) => {
              const row = chartRows[item.dataIndex];
              if (!row) return "";
              if (item.datasetIndex === 0) return row.isGap ? "Kein Einzelspiel" : `Spiel ${row.gameNumber}: ${formatInteger(row.gameValue)} Pins`;
              return `Saisonschnitt: ${formatNumber(row.averageValue)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#c7b894", maxRotation: 0, autoSkip: true, maxTicksLimit: 18, font: { size: 10 } },
          grid: { color: "rgba(200,151,70,.10)" },
        },
        y: {
          suggestedMin: 70,
          suggestedMax: 250,
          ticks: { color: "#c7b894", font: { size: 10 } },
          grid: { color: "rgba(200,151,70,.13)" },
        },
      },
    },
  });
}

function renderPlayer(playerId) {
  const players = currentData?.analytics?.players ?? [];
  const player = players.find((item) => item.playerId === playerId) ?? players[0];
  if (!player) return;

  playerSelect.value = player.playerId;
  updatePlayerUrl(player.playerId);
  playerChip.textContent = `${player.name} · ${player.team}`;
  playedInfo.textContent = `${formatInteger(player.playedMatchdays)} von ${formatInteger(currentData.analytics.matchdayCount)} Spieltagen gespielt`;
  statAverage.textContent = formatNumber(player.average);
  statBest.textContent = formatInteger(player.bestGame);
  statPlayed.textContent = formatInteger(player.games);
  statAbsent.textContent = formatInteger(player.absentMatchdays);
  statConsistency.textContent = player.consistency?.score == null ? "–" : `${formatInteger(player.consistency.score)} / 100`;
  statDeviation.textContent = player.consistency?.standardDeviation == null ? "–" : formatNumber(player.consistency.standardDeviation);
  statRange.textContent = player.consistency?.range == null ? "–" : `${formatInteger(player.consistency.range)} Pins`;

  buildChart(player);
}

function render(data) {
  if (Number(data.schemaVersion ?? 1) < 2 || !Array.isArray(data.analytics?.players)) {
    showError("Der veröffentlichte Saisonstand enthält noch keine Live-Analyse. Im Adminbereich einmal „Öffentliche Statistiken neu berechnen“ ausführen.");
    return;
  }

  currentData = data;
  const players = [...data.analytics.players]
    .filter((player) => player.games > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  playerSelect.innerHTML = players.map((player) => (
    `<option value="${escapeHtml(player.playerId)}">${escapeHtml(player.name)} · ${escapeHtml(player.team)}</option>`
  )).join("");

  const requested = selectedPlayerFromUrl();
  renderPlayer(players.some((player) => player.playerId === requested) ? requested : players[0]?.playerId);
}

function showError(message) {
  currentData = null;
  playerSelect.innerHTML = `<option>${escapeHtml(message)}</option>`;
  playerSelect.disabled = true;
  playerChip.textContent = "Keine Live-Daten";
  playedInfo.textContent = "–";
  [statAverage, statBest, statPlayed, statAbsent, statConsistency, statDeviation, statRange].forEach((element) => { element.textContent = "–"; });
  chartDetailBox.classList.remove("hidden");
  chartDetailBox.textContent = message;
  chart?.destroy();
}

playerSelect.addEventListener("change", () => renderPlayer(playerSelect.value));

document.querySelectorAll(".info-icon-btn").forEach((button) => {
  button.addEventListener("click", () => {
    infoModalTitle.textContent = button.dataset.infoTitle ?? "Info";
    infoModalText.textContent = button.dataset.infoText ?? "";
    infoModalOverlay.classList.remove("hidden");
    infoModalOverlay.setAttribute("aria-hidden", "false");
    infoModalClose.focus();
  });
});

function closeInfoModal() {
  infoModalOverlay.classList.add("hidden");
  infoModalOverlay.setAttribute("aria-hidden", "true");
}

infoModalClose.addEventListener("click", closeInfoModal);
infoModalOverlay.addEventListener("click", (event) => {
  if (event.target === infoModalOverlay) closeInfoModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeInfoModal();
});

watchPublicResults({
  onData: (data, _seasonId, meta) => {
    playerSelect.disabled = false;
    render(data);
    if (meta?.warning) playerChip.textContent += ` · Sicherungsstand`;
  },
  onError: showError,
  onSeasonChange: (seasonId) => {
    playerSelect.disabled = true;
    playerSelect.innerHTML = `<option>${escapeHtml(seasonId)} wird geladen …</option>`;
    playerChip.textContent = "Live-Daten werden geladen";
  },
});
