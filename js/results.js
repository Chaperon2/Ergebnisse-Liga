import {
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { db } from "./firebase-client.js";
import { initialSeasonId } from "./firebase-config.js";

const title = document.querySelector("#title");
const subtitle = document.querySelector("#subtitle");
const status = document.querySelector("#resultStatus");
const resultsRoot = document.querySelector("#results");
let activeSeasonId = null;
let unsubscribeResults = null;

function formatNumber(value, digits = 1) {
  return Number(value ?? 0).toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return value ?? "–";
  return new Date(`${value}T12:00:00`).toLocaleDateString("de-DE");
}

function trend(value) {
  if (value > 0) return `▲ ${value}`;
  if (value < 0) return `▼ ${Math.abs(value)}`;
  return "–";
}

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th${header.left ? " class=\"left\"" : ""}>${header.label}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell, index) => `<td${headers[index]?.left ? " class=\"left\"" : ""}>${cell ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function matchupTable(data, teamNames) {
  const rows = [];
  for (const matchup of data.teamStandings.matchups) {
    for (const side of [matchup.home, matchup.away]) {
      rows.push([
        teamNames.get(side.teamId) ?? side.teamId,
        ...side.rounds.map((round) => round.display),
        side.scoringPins,
        side.points,
      ]);
    }
    rows.push(["", "", "", "", "", "", ""]);
  }
  return table(
    [
      { label: "Team", left: true },
      { label: "Runde 1" },
      { label: "Runde 2" },
      { label: "Runde 3" },
      { label: "Runde 4" },
      { label: "Gesamt" },
      { label: "Punkte" },
    ],
    rows,
  );
}

function render(data) {
  const matchday = data.matchday;
  title.textContent = `${data.seasonName ?? data.seasonId} · Spieltag ${matchday.number}`;
  subtitle.textContent = `${formatDate(matchday.date)} · automatisch aus Firestore aktualisiert`;
  status.className = "status success";
  status.textContent = "Veröffentlichte Daten geladen.";

  const teamNames = new Map(data.teamStandings.rows.map((row) => [row.teamId, row.name]));
  const dailyRows = data.currentMatchday.rows.map((row) => [
    row.rank,
    row.name,
    row.team,
    ...row.scores.map((score) => score ?? "–"),
    row.total,
    formatNumber(row.average),
  ]);
  const playerRows = data.individualStandings.rows.map((row) => [
    row.rank,
    trend(row.trend),
    row.name,
    row.team,
    row.games,
    row.bestSeries,
    row.bestGame,
    row.pins,
    formatNumber(row.average),
    row.previousSeasonAverage == null ? "–" : formatNumber(row.previousSeasonAverage),
    row.games200 || "–",
  ]);
  const teamRows = data.teamStandings.rows.map((row) => [
    row.rank,
    trend(row.trend),
    row.name,
    row.points,
    row.pins,
    row.matchdays,
    formatNumber(row.average),
  ]);

  resultsRoot.innerHTML = `
    <section class="result-section">
      <h2>Spieltag ${matchday.number}</h2>
      <div class="kpi-row">
        <div class="kpi">Bestes Spiel: ${data.currentMatchday.bestGame.name} · ${data.currentMatchday.bestGame.score}</div>
        <div class="kpi">Hausligaschnitt: ${formatNumber(data.currentMatchday.houseAverage)}</div>
      </div>
      ${table(
        [
          { label: "Platz" }, { label: "Name", left: true }, { label: "Team", left: true },
          { label: "Spiel 1" }, { label: "Spiel 2" }, { label: "Spiel 3" }, { label: "Spiel 4" },
          { label: "Pins" }, { label: "Ø" },
        ],
        dailyRows,
      )}
    </section>

    <section class="result-section">
      <h2>Einzelwertung</h2>
      <div class="kpi-row">
        <div class="kpi">Bestes Spiel: ${data.individualStandings.bestGame.name} · ${data.individualStandings.bestGame.score}</div>
        <div class="kpi">Hausligaschnitt: ${formatNumber(data.individualStandings.houseAverage)}</div>
      </div>
      ${table(
        [
          { label: "Platz" }, { label: "Tendenz" }, { label: "Name", left: true }, { label: "Team", left: true },
          { label: "Spiele" }, { label: "Beste Serie" }, { label: "Bestes Spiel" }, { label: "Pins" },
          { label: "Ø" }, { label: "Ø Vorsaison" }, { label: "Spiele ≥ 200" },
        ],
        playerRows,
      )}
    </section>

    <section class="result-section">
      <h2>Mannschaftswertung</h2>
      ${table(
        [
          { label: "Platz" }, { label: "Tendenz" }, { label: "Team", left: true },
          { label: "Punkte" }, { label: "Pins" }, { label: "Spieltage" }, { label: "Ø" },
        ],
        teamRows,
      )}
      <h3 style="margin-top:20px">Paarungen des aktuellen Spieltags</h3>
      ${matchupTable(data, teamNames)}
    </section>
  `;
}

function listenToSeason(seasonId) {
  if (!seasonId || activeSeasonId === seasonId) return;
  activeSeasonId = seasonId;
  if (unsubscribeResults) unsubscribeResults();
  status.className = "status";
  status.textContent = `Ergebnisse für ${seasonId} werden geladen …`;

  unsubscribeResults = onSnapshot(
    doc(db, "publicResults", seasonId, "results", "current"),
    (snapshot) => {
      if (!snapshot.exists()) {
        status.className = "status";
        status.textContent = `Für ${seasonId} wurde noch kein Spieltag veröffentlicht.`;
        resultsRoot.innerHTML = "";
        return;
      }
      render(snapshot.data());
    },
    (error) => {
      status.className = "status error";
      status.textContent = `Firestore konnte nicht gelesen werden: ${error.message}`;
    },
  );
}

onSnapshot(
  doc(db, "publicConfig", "current"),
  (snapshot) => listenToSeason(snapshot.data()?.activeSeasonId ?? initialSeasonId),
  () => listenToSeason(initialSeasonId),
);
