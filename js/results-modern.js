import { escapeHtml, formatDate, formatNumber, watchPublicResults } from "./public-data.js";

const pageTitle = document.getElementById("pageTitle");
const pageDate = document.getElementById("pageDate");
const sectionsGrid = document.getElementById("sectionsGrid");
const warningPill = document.getElementById("warningPill");
const warningText = document.getElementById("warningText");
const summaryGrid = document.getElementById("summaryGrid");
const liveState = document.getElementById("liveState");

function tendency(value) {
  const number = Number(value ?? 0);
  if (number > 0) return `<span class="tendency up">▲ ${number}</span>`;
  if (number < 0) return `<span class="tendency down">▼ ${Math.abs(number)}</span>`;
  return '<span class="tendency flat">–</span>';
}

function headerText(header) {
  return typeof header === "object" ? header.label : header;
}

function headerMarkup(header) {
  const label = headerText(header);
  const mobile = typeof header === "object" ? (header.mobile ?? label) : label;
  return `<span class="header-full">${escapeHtml(label)}</span><span class="header-mobile">${escapeHtml(mobile)}</span>`;
}

function headerClass(header) {
  const value = headerText(header).toLowerCase();
  if (value.includes("platz")) return "col-rank";
  if (value.includes("tendenz")) return "col-trend";
  if (value === "name") return "col-name text-left";
  if (value === "team") return "col-team text-left";
  if (value.startsWith("spiel ")) return "col-game col-short";
  if (value.startsWith("runde ")) return "col-round";
  if (value.includes("beste serie")) return "col-series col-medium";
  if (value.includes("bestes spiel")) return "col-best col-medium";
  if (value === "punkte") return "col-points col-medium";
  if (value === "ergebnis") return "col-result";
  if (value.includes("pins") || value.includes("gesamt")) return "col-total col-long";
  if (value.includes("vorsaison")) return "col-average-last col-medium";
  if (value.includes("200")) return "col-200 col-medium";
  if (value.includes("ø") || value.includes("schnitt")) return "col-average col-medium";
  return "col-medium";
}

function renderTable({ headers, rows, sectionClass = "" }) {
  return `<div class="table-wrap ${sectionClass}"><table><thead><tr>${headers.map((header) => (
    `<th class="${headerClass(header)}">${headerMarkup(header)}</th>`
  )).join("")}</tr></thead><tbody>${rows.map((row) => {
    if (row.type === "separator") {
      return `<tr class="separator-row"><td colspan="${headers.length}"><span class="matchup-vs"><span></span>VS<span></span></span></td></tr>`;
    }
    if (row.type === "blank") {
      return `<tr class="blank-separator"><td colspan="${headers.length}"></td></tr>`;
    }
    const rowClasses = [row.pairStart ? "pair-start" : "", row.pairEnd ? "pair-end" : ""].filter(Boolean).join(" ");
    return `<tr class="${rowClasses}">${row.cells.map((cell, index) => {
      const classes = [headerClass(headers[index])];
      if (row.score200Indexes?.includes(index)) classes.push("score-200");
      return `<td class="${classes.join(" ")}">${cell?.html === true ? cell.value : escapeHtml(cell?.value ?? cell ?? "")}</td>`;
    }).join("")}</tr>`;
  }).join("")}</tbody></table></div>`;
}

function tableCard({ key, theme, title, subtitle, stats = [], content }) {
  return `<article class="table-card ${theme} section-${key}">
    <div class="table-head">
      <div class="table-title-wrap"><h2 class="table-title">${escapeHtml(title)}</h2><div class="table-subtitle">${escapeHtml(subtitle)}</div></div>
      <div class="stats-chips">${stats.map((stat) => `<span class="stat-chip">${escapeHtml(stat)}</span>`).join("")}</div>
    </div>
    ${content}
  </article>`;
}

function render(data) {
  const matchday = data.matchday;
  const seasonName = data.seasonName ?? data.seasonId;
  pageTitle.innerHTML = `${escapeHtml(seasonName)} · Spieltag ${Number(matchday.number)}. <span class="headline-accent">Ergebnisse im Überblick.</span>`;
  pageDate.textContent = formatDate(matchday.date);

  const dailyHeaders = [
    { label: "Platz", mobile: "Pl." },
    "Name",
    "Team",
    { label: "Spiel 1", mobile: "S1" },
    { label: "Spiel 2", mobile: "S2" },
    { label: "Spiel 3", mobile: "S3" },
    { label: "Spiel 4", mobile: "S4" },
    { label: "Pins Gesamt", mobile: "Pins" },
    "Ø",
  ];
  const dailyRows = data.currentMatchday.rows.map((row) => ({
    cells: [row.rank, row.name, row.team, ...row.scores.map((score) => score ?? "–"), row.total, formatNumber(row.average)],
    score200Indexes: row.scores.map((score, index) => Number(score) >= 200 ? index + 3 : -1).filter((index) => index >= 0),
  }));

  const playerHeaders = [
    { label: "Platz", mobile: "Pl." },
    { label: "Tendenz", mobile: "Tr." },
    "Name",
    "Team",
    { label: "Spiele", mobile: "Sp." },
    { label: "Beste Serie", mobile: "Serie" },
    { label: "Bestes Spiel", mobile: "Best" },
    { label: "Pins Gesamt", mobile: "Pins" },
    "Ø",
    { label: "Ø Vorsaison", mobile: "Ø alt" },
    { label: "Spiele ≥ 200", mobile: "200+" },
  ];
  const playerRows = data.individualStandings.rows.map((row) => ({
    cells: [
      row.rank,
      { html: true, value: tendency(row.trend) },
      row.name,
      row.team,
      row.games,
      row.bestSeries,
      row.bestGame,
      row.pins,
      formatNumber(row.average),
      row.previousSeasonAverage == null ? "–" : formatNumber(row.previousSeasonAverage),
      row.games200 || "–",
    ],
  }));

  const teamHeaders = [
    { label: "Platz", mobile: "Pl." },
    { label: "Tendenz", mobile: "Tr." },
    "Team",
    { label: "Punkte", mobile: "Pkt." },
    "Pins",
    { label: "Spieltage", mobile: "ST" },
    "Ø",
  ];
  const teamRows = data.teamStandings.rows.map((row) => ({
    cells: [row.rank, { html: true, value: tendency(row.trend) }, row.name, row.points, row.pins, row.matchdays, formatNumber(row.average)],
  }));
  const teamNames = new Map(data.teamStandings.rows.map((row) => [row.teamId, row.name]));
  const matchupHeaders = [
    "Team",
    { label: "Runde 1", mobile: "R1" },
    { label: "Runde 2", mobile: "R2" },
    { label: "Runde 3", mobile: "R3" },
    { label: "Runde 4", mobile: "R4" },
    { label: "Gesamt", mobile: "Ges." },
    { label: "Ergebnis", mobile: "Pkt." },
  ];
  const matchupRows = [];
  data.teamStandings.matchups.forEach((matchup, index) => {
    matchupRows.push({
      pairStart: true,
      cells: [teamNames.get(matchup.home.teamId) ?? matchup.home.teamId, ...matchup.home.rounds.map((round) => round.display), matchup.home.scoringPins, matchup.home.points],
    });
    matchupRows.push({ type: "separator" });
    matchupRows.push({
      pairEnd: true,
      cells: [teamNames.get(matchup.away.teamId) ?? matchup.away.teamId, ...matchup.away.rounds.map((round) => round.display), matchup.away.scoringPins, matchup.away.points],
    });
    if (index < data.teamStandings.matchups.length - 1) matchupRows.push({ type: "blank" });
  });

  const teamContent = `<div class="stacked-tables">
    <div class="subtable-shell"><div class="subtable-head"><h3 class="subtable-title">Mannschaftswertung</h3></div>${renderTable({ headers: teamHeaders, rows: teamRows })}</div>
    <div class="subtable-shell"><div class="subtable-head"><h3 class="subtable-title">${escapeHtml(`Spieltag ${matchday.number} · ${formatDate(matchday.date)}`)}</h3></div>${renderTable({ headers: matchupHeaders, rows: matchupRows })}</div>
  </div>`;

  const leaderPlayer = data.individualStandings.rows?.[0];
  const leaderTeam = data.teamStandings.rows?.[0];
  if (summaryGrid) {
    summaryGrid.innerHTML = [
      ["Spieltag", `${matchday.number} / ${data.matchdayCount ?? 14}`, "fa-calendar-day"],
      ["Bestes Spiel", `${data.currentMatchday.bestGame?.name ?? "–"} · ${data.currentMatchday.bestGame?.score ?? "–"}`, "fa-bolt"],
      ["Führender Spieler", leaderPlayer ? `${leaderPlayer.name} · Ø ${formatNumber(leaderPlayer.average)}` : "–", "fa-user-astronaut"],
      ["Führendes Team", leaderTeam ? `${leaderTeam.name} · ${leaderTeam.points} Punkte` : "–", "fa-people-group"],
    ].map(([label, value, icon]) => `<article class="summary-card"><i class="fa-solid ${icon}"></i><div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div></article>`).join("");
  }

  sectionsGrid.innerHTML = [
    tableCard({
      key: "spieltag",
      theme: "theme-spieltag",
      title: `Spieltag ${matchday.number}`,
      subtitle: formatDate(matchday.date),
      stats: [
        `Bestes Spiel: ${data.currentMatchday.bestGame?.name ?? "–"} · ${data.currentMatchday.bestGame?.score ?? "–"}`,
        `Hausligaschnitt: ${formatNumber(data.currentMatchday.houseAverage)}`,
      ],
      content: renderTable({ headers: dailyHeaders, rows: dailyRows }),
    }),
    tableCard({
      key: "einzel",
      theme: "theme-einzel",
      title: "Einzelwertung",
      subtitle: `Saisonstand bis Spieltag ${matchday.number}`,
      stats: [
        `Bestes Spiel: ${data.individualStandings.bestGame?.name ?? "–"} · ${data.individualStandings.bestGame?.score ?? "–"}`,
        `Hausligaschnitt: ${formatNumber(data.individualStandings.houseAverage)}`,
      ],
      content: renderTable({ headers: playerHeaders, rows: playerRows }),
    }),
    tableCard({
      key: "team",
      theme: "theme-team",
      title: "Teamwertung",
      subtitle: `Saisonstand bis Spieltag ${matchday.number}`,
      content: teamContent,
    }),
  ].join("");

  warningPill.classList.remove("show");
  warningText.textContent = "";
}

function showError(message) {
  warningText.textContent = message;
  warningPill.classList.add("show");
  sectionsGrid.innerHTML = "";
}

watchPublicResults({
  onData: (data, _seasonId, meta) => {
    render(data);
    if (liveState) {
      liveState.className = `live-state ${meta?.source === "fallback" ? "fallback" : "live"}`;
      liveState.innerHTML = `<i class="fa-solid ${meta?.source === "fallback" ? "fa-triangle-exclamation" : "fa-signal"}"></i><span>${escapeHtml(meta?.warning ?? "Live aus der Ligadatenbank · automatische Aktualisierung")}</span>`;
    }
  },
  onError: (message) => {
    showError(message);
    if (liveState) {
      liveState.className = "live-state error";
      liveState.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span>${escapeHtml(message)}</span>`;
    }
  },
  onSeasonChange: (seasonId) => {
    pageTitle.innerHTML = `Ergebnisse werden geladen. <span class="headline-accent">${escapeHtml(seasonId)}</span>`;
    pageDate.textContent = "–";
  },
});
