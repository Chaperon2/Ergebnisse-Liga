import {calculatePersonalAward} from './personal-performance.js?v=19';
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export const calculatePlayerOfWeek=calculatePersonalAward;
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

function pageHeadingMarkup(heading) {
  if (!heading) return "";
  const eyebrow = heading.eyebrow ? `<span class="pow-page-eyebrow">${escapeHtml(heading.eyebrow)}</span>` : "";
  const title = heading.title ? `<h1>${escapeHtml(heading.title)}${heading.accent ? ` <span>${escapeHtml(heading.accent)}</span>` : ""}</h1>` : "";
  const description = heading.description ? `<p>${escapeHtml(heading.description)}</p>` : "";
  const date = heading.date ? `<div class="pow-page-date"><small>${escapeHtml(heading.dateLabel ?? "Datum")}</small><strong>${escapeHtml(heading.date)}</strong></div>` : "";
  return `<header class="pow-page-head"><div class="pow-page-copy">${eyebrow}${title}${description}</div>${date}</header>`;
}

function actionMarkup(actions) {
  if (!Array.isArray(actions) || !actions.length) return "";
  return `<nav class="pow-page-actions" aria-label="Schnellzugriffe">${actions.map((action) => `<a class="pow-page-action ${escapeHtml(action.className ?? "")}" href="${escapeHtml(action.href ?? "#")}"><i class="${escapeHtml(action.icon ?? "fa-solid fa-arrow-right")}"></i><span>${escapeHtml(action.label ?? "Öffnen")}</span></a>`).join("")}</nav>`;
}

export function playerOfWeekMarkup(award, { compact = false, context = "", heading = null, actions = [] } = {}) {
  const classes = ["player-week-card", compact ? "is-compact" : "", context ? `is-${context}` : "", heading ? "has-page-heading" : ""].filter(Boolean).join(" ");
  const pageHead = pageHeadingMarkup(heading);
  const pageActions = actionMarkup(actions);

  if (!award) {
    return `<section class="${classes} is-empty">
      ${pageHead}
      <div class="pow-loading"><i class="fa-solid fa-satellite-dish"></i><span>Noch keine Auszeichnung: benötigt werden mindestens drei Tages-Spiele und ein persönlicher Vergleichsschnitt.</span></div>
      ${pageActions}
    </section>`;
  }

  const improvementLabel = award.improvement == null
    ? "Noch ohne Referenzschnitt"
    : `${signed(award.improvementPercent)} % · ${signed(award.improvement)} Pins`;

  return `<section class="${classes}" aria-label="Spieler der Woche: ${escapeHtml(award.name)}">
    ${pageHead}
    <div class="pow-main">
      <div class="pow-kicker"><span>Spieler der Woche</span><b>Spieltag ${award.matchdayNumber}</b></div>
      <div class="pow-name-row">
        <div class="pow-avatar"><i class="fa-solid fa-bowling-ball"></i><span>★</span></div>
        <div class="pow-name"><span class="pow-crown" aria-hidden="true"><i class="fa-solid fa-crown"></i></span><strong>${escapeHtml(award.name)}</strong><span>${escapeHtml(award.team)}</span></div>
      </div>
      <div class="pow-stats">
        <span><small>Tages-Ø</small><strong>${number(award.average)}</strong></span>
        <span><small>Eigener Vergleich</small><strong>${number(award.referenceAverage)}</strong></span>
        <span><small>Über eigenem Schnitt</small><strong>${award.aboveReference}/${award.games} Spiele</strong></span>
        <span><small>Form</small><strong>${escapeHtml(improvementLabel)}</strong></span>
      </div>
    </div>
    <div class="pow-score-panel">
      <span>Formpunkte</span>
      <strong>${number(award.score)}</strong>
      <small>von 100</small>
    </div>
    <div class="pow-breakdown">
      
      ${breakdownItem("Eigene Steigerung", award.breakdown.form, 50, "form")}
      ${breakdownItem("Spiele über eigenem Schnitt", award.breakdown.consistency, 25, "consistency")}
      ${breakdownItem("Tagesleistung", award.breakdown.performance, 15, "performance")}
      ${breakdownItem("200er-Spiele", award.breakdown.highlight, 10, "highlight")}
      <p class="pow-reference">${escapeHtml(award.referenceLabel)} · Ø ${number(award.referenceAverage)}</p>
    </div>
    <details class="pow-method">
      <summary>So wird gewertet</summary>
      <p><b>50 % persönliche Steigerung, 25 % Spiele über dem eigenen Schnitt, 15 % Tagesleistung und 10 % 200er-Spiele.</b> Vergleich: die letzten bis zu zwölf gültigen Spiele vor diesem Spieltag (mindestens drei), sonst der Vorsaison-Schnitt. Die heutigen Spiele zählen nicht zum Vergleich. Steigerungspunkte: 25 plus die prozentuale Veränderung, begrenzt auf 0–50. Für den Anteil der Spiele über dem eigenen Schnitt gibt es bis zu 25 Punkte. Tagesleistung: Tagesdurchschnitt / 300 × 15. 200er: Anteil der Spiele ab 200 Pins × 10 (ein 200er bei vier Spielen: 2,5 Punkte). Mindestens drei gültige Tages-Spiele und ein persönlicher Vergleichsschnitt sind erforderlich. Bei Gleichstand zählen die prozentuale Steigerung, dann die relative Gleichmäßigkeit und zuletzt die feste Spieler-ID. Archivtage werden nach dieser aktuellen Regel bewertet.</p>
    </details>
    ${pageActions}
  </section>`;
}

export function renderPlayerOfWeek(host, data, options) {
  if (!host) return null;
  const award = calculatePlayerOfWeek(data);
  host.innerHTML = playerOfWeekMarkup(award, options);
  return award;
}
