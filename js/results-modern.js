import { escapeHtml, formatDate, formatNumber, watchPublicResults } from "./public-data.js";
import { renderPlayerOfWeek } from "./player-of-week.js?v=12.8";

const sectionsGrid = document.getElementById("sectionsGrid");
const warningPill = document.getElementById("warningPill");
const warningText = document.getElementById("warningText");
const summaryGrid = document.getElementById("summaryGrid");
const liveState = document.getElementById("liveState");
const playerWeekResults = document.getElementById("playerWeekResults");

function playerWeekOptions(data = null) {
  const matchday = data?.matchday;
  const seasonName = data?.seasonName ?? data?.seasonId ?? "Aktuelle Saison";
  const matchdayNumber = Number(matchday?.number ?? 0);
  return {
    compact: true,
    context: "results",
    heading: {
      eyebrow: "Aktuelle Ergebnisse",
      title: matchdayNumber ? `${seasonName} · Spieltag ${matchdayNumber}` : "Spieltag wird geladen",
      accent: "Ergebnisse im Überblick",
      description: "Spieler/in der Woche, aktuelle Serien und Tabellen in einer gemeinsamen Kopfkonsole.",
      dateLabel: "Datum",
      date: matchday?.date ? formatDate(matchday.date) : "–",
    },
  };
}

renderPlayerOfWeek(playerWeekResults, null, playerWeekOptions());

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

function playerAnalysisCell(playerId, name) {
  const id = String(playerId ?? "").trim();
  const safeName = escapeHtml(name ?? "");
  if (!id) return safeName;
  const params = new URLSearchParams();
  params.set("spieler", id);
  const seasonId = new URLSearchParams(window.location.search).get("saison");
  if (seasonId) params.set("saison", seasonId);
  const href = `spieleranalyse.html?${params.toString()}`;
  return {
    html: true,
    value: `<a class="player-analysis-link" href="${escapeHtml(href)}" aria-label="${safeName} in der Spieleranalyse öffnen">${safeName}</a>`,
  };
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
      const label = headerText(headers[index]).toLowerCase();
      const rawValue = cell && typeof cell === "object" ? cell.value : cell;
      const numericValue = Number(rawValue);
      const isGameScore = label.startsWith("spiel ") || label.includes("bestes spiel");
      const isScore200 = row.score200Indexes?.includes(index) || (isGameScore && Number.isFinite(numericValue) && numericValue >= 200);
      if (isScore200) classes.push("score-200", "score-200-strong");
      if (cell && typeof cell === "object" && cell.className) classes.push(cell.className);
      return `<td class="${classes.join(" ")}"${isScore200 ? ' data-score-200="true"' : ""}>${cell?.html === true ? cell.value : escapeHtml(cell?.value ?? cell ?? "")}</td>`;
    }).join("")}</tr>`;
  }).join("")}</tbody></table></div>`;
}


function markStrong200Cells(root = sectionsGrid) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll("table").forEach((table) => {
    const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
      String(th.querySelector(".header-full")?.textContent ?? th.textContent ?? "").trim().toLowerCase()
    );
    const scoreColumns = headers
      .map((label, index) => (/^spiel\s+\d+$/i.test(label) || label.includes("bestes spiel") ? index : -1))
      .filter((index) => index >= 0);

    if (!scoreColumns.length) return;
    table.querySelectorAll("tbody tr").forEach((row) => {
      if (row.classList.contains("separator-row") || row.classList.contains("blank-separator")) return;
      const cells = row.querySelectorAll("td");
      scoreColumns.forEach((index) => {
        const cell = cells[index];
        if (!cell) return;
        const text = String(cell.textContent ?? "").trim().replace(/\s+/g, "");
        if (!/^\d{2,3}$/.test(text)) return;
        if (Number(text) >= 200) {
          cell.classList.add("score-200", "score-200-strong");
          cell.dataset.score200 = "true";
        }
      });
    });
  });
}

function tableCard({ key, theme, title, subtitle, stats = [], content }) {
  return `<article class="table-card ${theme} section-${key}">
    <div class="table-head">
      <div class="table-title-wrap"><h2 class="table-title">${escapeHtml(title)}</h2><div class="table-subtitle">${escapeHtml(subtitle)}</div></div>
      <div class="stats-chips">${stats.map((stat) => {
        const item = typeof stat === "object" ? stat : { value: stat, className: "" };
        return `<span class="stat-chip ${escapeHtml(item.className ?? "")}">${escapeHtml(item.value)}</span>`;
      }).join("")}</div>
    </div>
    ${content}
  </article>`;
}

function render(data) {
  renderPlayerOfWeek(playerWeekResults, data, playerWeekOptions(data));
  const matchday = data.matchday;
  const seasonName = data.seasonName ?? data.seasonId;

  const dailyHeaders = [
    { label: "Platz", mobile: "Pl." },
    "Name",
    "Team",
    { label: "Spiel 1", mobile: "S1" },
    { label: "Spiel 2", mobile: "S2" },
    { label: "Spiel 3", mobile: "S3" },
    { label: "Spiel 4", mobile: "S4" },
    { label: "Pins Gesamt", mobile: "Pins" },
    { label: "Bestes Spiel", mobile: "Best" },
    "Ø",
  ];
  const dailyBestScore = Math.max(0, ...data.currentMatchday.rows.flatMap((row) => row.scores.map((score) => Number(score ?? 0))));
  const dailyRows = data.currentMatchday.rows.map((row) => {
    const rowBest = Math.max(0, ...row.scores.map((score) => Number(score ?? 0)));
    const scoreCells = row.scores.map((score) => ({
      value: score ?? "–",
      className: Number(score) === dailyBestScore && dailyBestScore > 0 ? "daily-best-score" : "",
    }));
    return {
      cells: [
        row.rank,
        playerAnalysisCell(row.playerId, row.name),
        row.team,
        ...scoreCells,
        row.total,
        { value: rowBest || "–", className: "metric-best" },
        { value: formatNumber(row.average), className: "metric-average" },
      ],
      score200Indexes: row.scores.map((score, index) => Number(score) >= 200 ? index + 3 : -1).filter((index) => index >= 0),
    };
  });

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
      playerAnalysisCell(row.playerId, row.name),
      row.team,
      row.games,
      { value: row.bestSeries, className: "metric-series" },
      { value: row.bestGame, className: "metric-best" },
      row.pins,
      { value: formatNumber(row.average), className: "metric-average" },
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
  const teamColorMap = new Map(data.teamStandings.rows.map((row, index) => [row.teamId, `duel-color-${(index % 10) + 1}`]));
  const teamDuels = data.teamStandings.matchups.map((matchup) => {
    const homeName = teamNames.get(matchup.home.teamId) ?? matchup.home.teamId;
    const awayName = teamNames.get(matchup.away.teamId) ?? matchup.away.teamId;
    const homeClass = teamColorMap.get(matchup.home.teamId) ?? "duel-color-1";
    const awayClass = teamColorMap.get(matchup.away.teamId) ?? "duel-color-2";
    const roundRows = matchup.home.rounds.map((round, roundIndex) => {
      const awayRound = matchup.away.rounds[roundIndex];
      return `<span class="duel-round"><b>R${roundIndex + 1}</b><span>${escapeHtml(round.display)}</span><i>:</i><span>${escapeHtml(awayRound?.display ?? "–")}</span></span>`;
    }).join("");
    return `<article class="team-duel">
      <div class="duel-team ${homeClass}"><span class="duel-color-dot"></span><strong>${escapeHtml(homeName)}</strong><small>${escapeHtml(matchup.home.scoringPins)} Pins</small></div>
      <div class="duel-score" aria-label="${escapeHtml(homeName)} ${escapeHtml(matchup.home.points)} zu ${escapeHtml(matchup.away.points)} ${escapeHtml(awayName)}">
        <span>${escapeHtml(matchup.home.points)}</span><b>:</b><span>${escapeHtml(matchup.away.points)}</span>
      </div>
      <div class="duel-team away ${awayClass}"><span class="duel-color-dot"></span><strong>${escapeHtml(awayName)}</strong><small>${escapeHtml(matchup.away.scoringPins)} Pins</small></div>
      <div class="duel-rounds">${roundRows}</div>
    </article>`;
  }).join("");

  const teamContent = `<div class="stacked-tables">
    <div class="subtable-shell"><div class="subtable-head"><h3 class="subtable-title">Mannschaftswertung</h3></div>${renderTable({ headers: teamHeaders, rows: teamRows })}</div>
    <div class="subtable-shell duel-shell"><div class="subtable-head"><h3 class="subtable-title">${escapeHtml(`Direkte Duelle · Spieltag ${matchday.number} · ${formatDate(matchday.date)}`)}</h3></div><div class="team-duels">${teamDuels}</div></div>
  </div>`;

  const leaderPlayer = data.individualStandings.rows?.[0];
  const leaderTeam = data.teamStandings.rows?.[0];
  const displayMatchdayCount = Number(data.matchdayCount ?? (data.teamStandings.rows?.length === 10 ? 18 : 14));
  if (summaryGrid) {
    summaryGrid.innerHTML = [
      ["Spieltag", `${matchday.number} / ${displayMatchdayCount}`, "fa-calendar-day"],
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
        { value: `Bestes Spiel: ${data.currentMatchday.bestGame?.name ?? "–"} · ${data.currentMatchday.bestGame?.score ?? "–"}`, className: "stat-best" },
        { value: `Hausligaschnitt: ${formatNumber(data.currentMatchday.houseAverage)}`, className: "stat-average" },
      ],
      content: renderTable({ headers: dailyHeaders, rows: dailyRows }),
    }),
    tableCard({
      key: "einzel",
      theme: "theme-einzel",
      title: "Einzelwertung",
      subtitle: `Saisonstand bis Spieltag ${matchday.number}`,
      stats: [
        { value: `Bestes Spiel: ${data.individualStandings.bestGame?.name ?? "–"} · ${data.individualStandings.bestGame?.score ?? "–"}`, className: "stat-best" },
        { value: `Hausligaschnitt: ${formatNumber(data.individualStandings.houseAverage)}`, className: "stat-average" },
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

  markStrong200Cells(sectionsGrid);
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
    const loadingOptions = playerWeekOptions();
    loadingOptions.heading.title = `${seasonId} · Ergebnisse werden geladen`;
    loadingOptions.heading.date = "–";
    renderPlayerOfWeek(playerWeekResults, null, loadingOptions);
  },
});
