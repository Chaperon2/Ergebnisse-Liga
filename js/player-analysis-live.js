import {loadCareerData} from './career-data.js?v=23';
import {nameKey,favourite} from './player-profile.js?v=23';
import {renderCareer} from './player-career.js?v=23';
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
let career={data:[],partial:false};
let renderToken=0;
const careerHost=document.createElement("section");careerHost.className="career-panel";document.querySelector(".chart-wrap").before(careerHost);
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
          borderColor: "#087e80",
          backgroundColor: "rgba(64,244,239,.22)",
          pointBackgroundColor: chartRows.map((row) => row.isGap ? "#ff59b6" : "#087e80"),
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
          borderColor: "#a36500",
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
          ticks: { color: "#35534d", maxRotation: 0, autoSkip: true, maxTicksLimit: 18, font: { size: 10 } },
          grid: { color: "rgba(200,151,70,.10)" },
        },
        y: {
          suggestedMin: 70,
          suggestedMax: 250,
          ticks: { color: "#35534d", font: { size: 10 } },
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

  renderCareer(careerHost,career.data,player.name,career.partial);
  if(player.entries?.length){chartCanvas.closest('.chart-wrap').hidden=false;buildChart(player)}
  else{chart?.destroy();chartCanvas.closest('.chart-wrap').hidden=true;playedInfo.textContent='Saisonabschluss · '+(player.sourceSeasonName||currentData.seasonName);}
  document.querySelector('.panel-title').textContent=player.name;
  document.querySelector('.panel-subtitle').textContent=player.sourceSeasonName||currentData.seasonName;

}

async function render(data) {
 const token=++renderToken;
 let loaded;try{loaded=await loadCareerData(data)}catch{loaded={data:[data],partial:true}}
 if(token!==renderToken)return;career=loaded;
 const profiles=new Map();for(const season of career.data)for(const row of season.individualStandings?.rows??[])if(row.games>0)profiles.set(nameKey(row.name),{...row,sourceSeasonName:season.seasonName});
 for(const player of (data.analytics?.players??[]).filter(p=>p.teamId!==data.dummyTeamId))profiles.set(nameKey(player.name),{...player,sourceSeasonName:data.seasonName});
 const players=[...profiles.values()].sort((a,b)=>a.name.localeCompare(b.name,'de'));
 currentData={...data,analytics:{...data.analytics,players}};
 playerSelect.disabled=false;
 playerSelect.innerHTML=players.map(p=>'<option value="'+escapeHtml(p.playerId)+'">'+escapeHtml(p.name)+'</option>').join('');
 const wanted=selectedPlayerFromUrl(),saved=favourite();
 const chosen=players.find(p=>p.playerId===wanted)||players.find(p=>nameKey(p.name)===nameKey(saved?.name))||players[0];
 renderPlayer(chosen?.playerId);
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
