function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function validScores(scores) {
  return (Array.isArray(scores) ? scores : [])
    .filter((score) => score !== null && score !== undefined && score !== "")
    .map(Number)
    .filter((score) => Number.isFinite(score) && score >= 0 && score <= 300);
}

function populationStandardDeviation(values) {
  if (!values.length) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function percentileScore(items, value, selector) {
  if (items.length <= 1) return 1;
  const values = items.map(selector);
  const lower = values.filter((candidate) => candidate < value).length;
  const equal = values.filter((candidate) => candidate === value).length;
  return clamp((lower + Math.max(0, equal - 1) / 2) / (items.length - 1), 0, 1);
}

function previousReferenceAverage(data, playerId, matchdayNumber) {
  const player = data?.analytics?.players?.find((entry) => entry.playerId === playerId);
  if (!player) return null;

  const previousEntries = (player.entries ?? [])
    .filter((entry) => Number(entry.matchdayNumber) < Number(matchdayNumber) && Number(entry.cumulativeGames) > 0)
    .sort((a, b) => Number(a.matchdayNumber) - Number(b.matchdayNumber));

  const latestPrevious = previousEntries.at(-1)?.cumulativeAverage;
  if (latestPrevious !== null && latestPrevious !== undefined && latestPrevious !== "" && Number.isFinite(Number(latestPrevious))) {
    return Number(latestPrevious);
  }
  if (player.previousSeasonAverage !== null && player.previousSeasonAverage !== undefined && player.previousSeasonAverage !== "" && Number.isFinite(Number(player.previousSeasonAverage))) {
    return Number(player.previousSeasonAverage);
  }
  return null;
}

/**
 * Ermittelt den Spieler der Woche aus dem zuletzt veröffentlichten Spieltag.
 * Maximal 100 Punkte:
 * - Tagesleistung: 45
 * - Form gegenüber persönlichem Referenzschnitt: 25
 * - Konstanz der Serie: 20
 * - Highlight/Bestspiel: 10
 */
export function calculatePlayerOfWeek(data) {
  const matchdayNumber = Number(data?.matchday?.number ?? 0);
  const rows = Array.isArray(data?.currentMatchday?.rows) ? data.currentMatchday.rows : [];

  const candidates = rows.map((row) => {
    const scores = validScores(row.scores);
    if (scores.length < 3) return null;

    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const bestGame = Math.max(...scores);
    const standardDeviation = populationStandardDeviation(scores);
    const referenceAverage = previousReferenceAverage(data, row.playerId, matchdayNumber);

    return {
      playerId: row.playerId,
      name: row.name ?? "Unbekannt",
      team: row.team ?? row.teamId ?? "–",
      teamId: row.teamId ?? null,
      scores,
      games: scores.length,
      total: scores.reduce((sum, score) => sum + score, 0),
      average,
      bestGame,
      standardDeviation,
      referenceAverage,
      improvement: referenceAverage == null ? null : average - referenceAverage,
    };
  }).filter(Boolean);

  if (!candidates.length) return null;

  for (const candidate of candidates) {
    const performancePercentile = percentileScore(candidates, candidate.average, (item) => item.average);
    const bestGamePercentile = percentileScore(candidates, candidate.bestGame, (item) => item.bestGame);

    const performancePoints = 45 * performancePercentile;
    const consistencyPoints = 20 * clamp((42 - candidate.standardDeviation) / 37, 0, 1);
    const formPoints = candidate.improvement == null
      ? 12.5
      : clamp(12.5 + candidate.improvement * 0.625, 0, 25);
    const milestoneBonus = candidate.bestGame >= 200 ? 3 : candidate.bestGame >= 180 ? 1.5 : 0;
    const highlightPoints = clamp(7 * bestGamePercentile + milestoneBonus, 0, 10);
    const completenessFactor = candidate.games >= 4 ? 1 : 0.92;

    candidate.breakdown = {
      performance: performancePoints * completenessFactor,
      form: formPoints * completenessFactor,
      consistency: consistencyPoints * completenessFactor,
      highlight: highlightPoints * completenessFactor,
    };
    candidate.score = Object.values(candidate.breakdown).reduce((sum, value) => sum + value, 0);
  }

  candidates.sort((a, b) => (
    b.score - a.score
    || b.average - a.average
    || a.standardDeviation - b.standardDeviation
    || b.bestGame - a.bestGame
    || String(a.name).localeCompare(String(b.name), "de")
  ));

  const winner = candidates[0];
  return {
    ...winner,
    matchdayNumber,
    matchdayDate: data?.matchday?.date ?? null,
    seasonId: data?.seasonId ?? null,
    seasonName: data?.seasonName ?? data?.seasonId ?? "Saison",
    eligiblePlayers: candidates.length,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function number(value, digits = 1) {
  return Number(value).toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function signed(value) {
  if (value == null || !Number.isFinite(Number(value))) return "neutral";
  const numeric = Number(value);
  return `${numeric >= 0 ? "+" : ""}${number(numeric)}`;
}

function breakdownItem(label, value, max, className) {
  const width = clamp((value / max) * 100, 0, 100);
  return `<div class="pow-breakdown-item ${className}">
    <div class="pow-breakdown-label"><span>${escapeHtml(label)}</span><strong>${number(value)} / ${max}</strong></div>
    <div class="pow-bar"><i style="width:${width.toFixed(2)}%"></i></div>
  </div>`;
}

export function playerOfWeekMarkup(award, { compact = false, fused = false, context = "" } = {}) {
  if (!award) {
    const emptyClasses = ["player-week-card", "is-empty", compact ? "is-compact" : "", fused ? "is-fused" : "", context ? `is-${context}` : ""].filter(Boolean).join(" ");
    return `<section class="${emptyClasses}">
      <div class="pow-loading"><i class="fa-solid fa-satellite-dish"></i><span>Spieler der Woche wird geladen …</span></div>
    </section>`;
  }

  const improvementLabel = award.improvement == null
    ? "Noch ohne Referenzschnitt"
    : `${signed(award.improvement)} Pins zum Referenzschnitt`;

  const cardClasses = ["player-week-card", compact ? "is-compact" : "", fused ? "is-fused" : "", context ? `is-${context}` : ""].filter(Boolean).join(" ");

  return `<section class="${cardClasses}" aria-label="Spieler der Woche: ${escapeHtml(award.name)}">
    <div class="pow-crown" aria-hidden="true"><i class="fa-solid fa-crown"></i></div>
    <div class="pow-main">
      <div class="pow-kicker"><span>Spieler der Woche</span><b>Spieltag ${award.matchdayNumber}</b></div>
      <div class="pow-name-row">
        <div class="pow-avatar"><i class="fa-solid fa-bowling-ball"></i><span>★</span></div>
        <div class="pow-name"><strong>${escapeHtml(award.name)}</strong><span>${escapeHtml(award.team)}</span></div>
      </div>
      <div class="pow-stats">
        <span><small>Tages-Ø</small><strong>${number(award.average)}</strong></span>
        <span><small>Bestes Spiel</small><strong>${Math.round(award.bestGame)}</strong></span>
        <span><small>Konstanz</small><strong>± ${number(award.standardDeviation)}</strong></span>
        <span><small>Form</small><strong>${escapeHtml(improvementLabel)}</strong></span>
      </div>
    </div>
    <div class="pow-score-panel">
      <span>Wochenpunkte</span>
      <strong>${number(award.score)}</strong>
      <small>von 100</small>
    </div>
    ${fused ? "" : `<div class="pow-breakdown">
      ${breakdownItem("Tagesleistung", award.breakdown.performance, 45, "performance")}
      ${breakdownItem("Form", award.breakdown.form, 25, "form")}
      ${breakdownItem("Konstanz", award.breakdown.consistency, 20, "consistency")}
      ${breakdownItem("Highlight", award.breakdown.highlight, 10, "highlight")}
    </div>
    <details class="pow-method">
      <summary>So wird gewertet</summary>
      <p><b>45 Punkte</b> für die Tagesleistung im Vergleich zum Teilnehmerfeld, <b>25 Punkte</b> für die Form gegenüber dem persönlichen Schnitt vor diesem Spieltag, <b>20 Punkte</b> für eine gleichmäßige Serie und <b>10 Punkte</b> für das beste Einzelspiel. Gewertet werden Spieler mit mindestens drei gültigen Spielen.</p>
    </details>`}
  </section>`;
}

export function renderPlayerOfWeek(host, data, options) {
  if (!host) return null;
  const award = calculatePlayerOfWeek(data);
  host.innerHTML = playerOfWeekMarkup(award, options);
  return award;
}
