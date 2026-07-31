import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-functions.js";
import { auth, db, functions } from "./firebase-client.js";
import { initialSeasonId } from "./firebase-config.js";

const $ = (selector) => document.querySelector(selector);
const LANE_PAIRS = ["1+2", "3+4", "5+6", "7+8"];
const elements = {
  loginPanel: $("#loginPanel"),
  loginForm: $("#loginForm"),
  email: $("#email"),
  password: $("#password"),
  loginStatus: $("#loginStatus"),
  adminArea: $("#adminArea"),
  accountInfo: $("#accountInfo"),
  adminStatus: $("#adminStatus"),
  bootstrapPanel: $("#bootstrapPanel"),
  uidText: $("#uidText"),
  securedArea: $("#securedArea"),
  logoutButton: $("#logoutButton"),
  importButton: $("#importButton"),
  refreshButton: $("#refreshButton"),
  importStatus: $("#importStatus"),
  auditSeasonButton: $("#auditSeasonButton"),
  rebuildPublicButton: $("#rebuildPublicButton"),
  auditSummary: $("#auditSummary"),
  auditStatus: $("#auditStatus"),
  auditIssues: $("#auditIssues"),
  seasonSelect: $("#seasonSelect"),
  seasonSummary: $("#seasonSummary"),
  seasonStatus: $("#seasonStatus"),
  sourceSeasonName: $("#sourceSeasonName"),
  newSeasonId: $("#newSeasonId"),
  newSeasonName: $("#newSeasonName"),
  firstMatchdayDate: $("#firstMatchdayDate"),
  createSeasonButton: $("#createSeasonButton"),
  createSeasonStatus: $("#createSeasonStatus"),
  seasonSetupPanel: $("#seasonSetupPanel"),
  teamSetup: $("#teamSetup"),
  playerSetup: $("#playerSetup"),
  saveSetupButton: $("#saveSetupButton"),
  setupStatus: $("#setupStatus"),
  schedulePanel: $("#schedulePanel"),
  scheduleEditor: $("#scheduleEditor"),
  saveScheduleButton: $("#saveScheduleButton"),
  scheduleStatus: $("#scheduleStatus"),
  matchdaySelect: $("#matchdaySelect"),
  previousMatchdayButton: $("#previousMatchdayButton"),
  nextMatchdayButton: $("#nextMatchdayButton"),
  scoreEntryProgress: $("#scoreEntryProgress"),
  matchdayNumber: $("#matchdayNumber"),
  matchdayDate: $("#matchdayDate"),
  matchdayStatus: $("#matchdayStatus"),
  pairings: $("#pairings"),
  scoreGrid: $("#scoreGrid"),
  saveButton: $("#saveButton"),
  previewButton: $("#previewButton"),
  publishButton: $("#publishButton"),
  publicationGuidance: $("#publicationGuidance"),
  publicationNote: $("#publicationNote"),
  previewStatus: $("#previewStatus"),
  editorStatus: $("#editorStatus"),
  publicationHistory: $("#publicationHistory"),
  historyStatus: $("#historyStatus"),
  reloadHistoryButton: $("#reloadHistoryButton"),
};

const workspaceButtons = [...document.querySelectorAll("[data-workspace-target]")];
const workspacePanels = [...document.querySelectorAll("[data-workspace-panel]")];

let seasons = [];
let currentSeasonId = initialSeasonId;
let currentSeason = null;
let teams = [];
let players = [];
let matchdays = [];
let currentUser = null;
let currentAdmin = false;
let isBusy = false;

function showStatus(element, message, type = "") {
  element.textContent = message;
  element.className = `status${type ? ` ${type}` : ""}`;
}

function hideStatus(element) {
  element.className = "status hidden";
  element.textContent = "";
}

function setBusy(busy) {
  isBusy = busy;
  elements.importButton.disabled = busy;
  elements.auditSeasonButton.disabled = busy || !currentSeason;
  elements.rebuildPublicButton.disabled = busy || !currentSeason || Number(currentSeason?.currentPublishedMatchday ?? 0) < 1;
  elements.refreshButton.disabled = busy;
  elements.saveButton.disabled = busy || !currentSeason;
  elements.previewButton.disabled = busy || !currentSeason;
  elements.publishButton.disabled = busy || !currentSeason;
  elements.reloadHistoryButton.disabled = busy || !currentSeason;
  elements.seasonSelect.disabled = busy;
  elements.createSeasonButton.disabled = busy || Number(currentSeason?.currentPublishedMatchday ?? 0) < 14;
  const setupEditable = currentSeason?.status === "setup" && Number(currentSeason?.currentPublishedMatchday ?? 0) === 0;
  elements.saveSetupButton.disabled = busy || !setupEditable;
  elements.saveScheduleButton.disabled = busy || !currentSeason;
  updateMatchdayNavigation();
  if (currentSeason) updatePublicationGuidance();
}

function formatAverage(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "–";
  return Number(value).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatTimestamp(value) {
  const date = value?.toDate?.();
  return date instanceof Date ? date.toLocaleString("de-DE") : "–";
}

function publicationTypeLabel(value) {
  if (value === "correction") return "Korrektur";
  if (value === "restore") return "Wiederherstellung";
  if (value === "technical-rebuild") return "Technische Neuberechnung";
  return "Veröffentlichung";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function activateWorkspace(name, updateHash = true) {
  const validName = workspacePanels.some((panel) => panel.dataset.workspacePanel === name) ? name : "results";
  for (const button of workspaceButtons) {
    const active = button.dataset.workspaceTarget === validName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
  for (const panel of workspacePanels) {
    panel.classList.toggle("hidden", panel.dataset.workspacePanel !== validName);
  }
  if (updateHash) history.replaceState(null, "", `#${validName}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateMatchdayNavigation() {
  const index = matchdays.findIndex((matchday) => matchday.id === elements.matchdaySelect.value);
  elements.previousMatchdayButton.disabled = isBusy || index <= 0;
  elements.nextMatchdayButton.disabled = isBusy || index < 0 || index >= matchdays.length - 1;
}

function moveMatchday(direction) {
  const index = matchdays.findIndex((matchday) => matchday.id === elements.matchdaySelect.value);
  const target = matchdays[index + direction];
  if (!target) return;
  elements.matchdaySelect.value = target.id;
  loadMatchday(target.id).catch((error) => showStatus(elements.editorStatus, error.message, "error"));
}

function updateScoreProgress() {
  const cards = [...elements.scoreGrid.querySelectorAll(".score-team-card")];
  let filled = 0;
  let total = 0;
  for (const card of cards) {
    const inputs = [...card.querySelectorAll(".score-input")];
    const cardFilled = inputs.filter((input) => input.value.trim() !== "").length;
    filled += cardFilled;
    total += inputs.length;
    card.classList.toggle("is-complete", inputs.length > 0 && cardFilled === inputs.length);
    const label = card.querySelector(".score-team-progress");
    if (label) label.textContent = `${cardFilled}/${inputs.length} Werte`;
  }
  elements.scoreEntryProgress.textContent = total ? `${filled} von ${total} Werten eingetragen` : "Keine Eingabefelder";
}

function getClientPublicationPlan() {
  const current = Number(currentSeason?.currentPublishedMatchday ?? 0);
  const edited = Number(elements.matchdayNumber.value || 0);
  if (!edited) return { allowed: false, mode: "blocked", message: "Bitte zuerst einen Spieltag laden." };
  if (current === 0) {
    return edited === 1
      ? { allowed: true, mode: "initial", throughMatchday: 1, requiresNote: false, message: "Erste Veröffentlichung der Saison: Spieltag 1." }
      : { allowed: false, mode: "blocked", message: "Die Saison muss mit Spieltag 1 veröffentlicht werden." };
  }
  if (edited === current + 1) {
    return { allowed: true, mode: "advance", throughMatchday: edited, requiresNote: false, message: `Reguläre nächste Veröffentlichung: Spieltag ${edited}.` };
  }
  if (edited <= current) {
    return {
      allowed: true,
      mode: "correction",
      throughMatchday: current,
      requiresNote: true,
      message: `Korrektur an Spieltag ${edited}. Öffentlich bleibt der Stand bis Spieltag ${current}; alle Werte werden daraus neu berechnet.`,
    };
  }
  return { allowed: false, mode: "blocked", message: `Zuerst muss Spieltag ${current + 1} veröffentlicht werden.` };
}

function updatePublicationGuidance() {
  const plan = getClientPublicationPlan();
  elements.publicationGuidance.textContent = plan.message;
  elements.publicationGuidance.className = `notice mode-${plan.mode === "correction" ? "correction" : plan.allowed ? "advance" : "blocked"}`;
  elements.publicationNote.required = plan.requiresNote === true;
  if (!plan.requiresNote) elements.publicationNote.removeAttribute("aria-invalid");
  elements.publishButton.disabled = isBusy || !currentSeason || !plan.allowed;
  elements.previewButton.disabled = isBusy || !currentSeason || !plan.allowed;
  return plan;
}

function teamOptions(selected = "") {
  return ["<option value=\"\">Team wählen</option>", ...teams.map((team) => (
    `<option value="${escapeHtml(team.id)}"${team.id === selected ? " selected" : ""}>${escapeHtml(team.name)}</option>`
  ))].join("");
}

function renderPairings(pairings = []) {
  elements.pairings.innerHTML = "";
  const editable = Number(currentSeason?.currentPublishedMatchday ?? 0) === 0
    && currentSeason?.scheduleStatus !== "configured";
  for (let index = 0; index < 4; index += 1) {
    const pairing = pairings[index] ?? {};
    const row = document.createElement("div");
    row.className = "pairing pairing-with-lane";
    row.dataset.pairingIndex = String(index);
    row.innerHTML = `
      <span class="lane-badge">Bahn ${LANE_PAIRS[index]}</span>
      <select class="home-team" aria-label="Team auf Bahn ${LANE_PAIRS[index]}" ${editable ? "" : "disabled"}>${teamOptions(pairing.homeTeamId)}</select>
      <strong>gegen</strong>
      <select class="away-team" aria-label="Gegner auf Bahn ${LANE_PAIRS[index]}" ${editable ? "" : "disabled"}>${teamOptions(pairing.awayTeamId)}</select>
    `;
    elements.pairings.appendChild(row);
  }
}

function renderScoreGrid(results = {}) {
  if (!players.length) {
    elements.scoreGrid.innerHTML = "<div class=\"status\">Noch keine Spieler vorhanden.</div>";
    updateScoreProgress();
    return;
  }

  const playersByTeam = new Map(teams.map((team) => [team.id, []]));
  for (const player of players) {
    const roster = playersByTeam.get(player.teamId) ?? [];
    roster.push(player);
    playersByTeam.set(player.teamId, roster);
  }

  elements.scoreGrid.innerHTML = teams.map((team) => {
    const roster = (playersByTeam.get(team.id) ?? []).sort((a, b) => a.rosterSlot - b.rosterSlot);
    return `<section class="score-team-card" data-team-id="${escapeHtml(team.id)}">
      <header class="score-team-head">
        <strong>${escapeHtml(team.name)}</strong>
        <span class="score-team-progress">0/${roster.length * 4} Werte</span>
      </header>
      <div class="score-team-players">
        ${roster.map((player) => {
          const scores = results[player.id]?.scores ?? [null, null, null, null];
          return `<div class="score-player" data-player-id="${escapeHtml(player.id)}">
            <div class="score-player-head">
              <strong>${escapeHtml(player.name)}${player.active === false ? ' <span class="badge">inaktiv</span>' : ""}</strong>
              <span class="score-player-meta">Position ${Number(player.rosterSlot)} · Ersatz ${Number(player.replacementScore)}</span>
            </div>
            <div class="score-rounds">
              ${scores.map((score, index) => `<label><span>S${index + 1}</span><input class="score-input" data-score-index="${index}" type="number" min="1" max="300" inputmode="numeric" enterkeyhint="next" autocomplete="off" placeholder="–" aria-label="${escapeHtml(player.name)}, Spiel ${index + 1}" value="${score ?? ""}"></label>`).join("")}
            </div>
          </div>`;
        }).join("")}
      </div>
    </section>`;
  }).join("");
  updateScoreProgress();
}
function renderSeasonSetup() {
  const editable = currentSeason?.status === "setup" && Number(currentSeason.currentPublishedMatchday ?? 0) === 0;
  elements.seasonSetupPanel.classList.toggle("hidden", !currentSeason);

  elements.teamSetup.innerHTML = `
    <table class="setup-table">
      <thead><tr><th>Interne ID</th><th class="left">Teamname</th></tr></thead>
      <tbody>${teams.map((team) => `
        <tr data-team-id="${escapeHtml(team.id)}">
          <td><code>${escapeHtml(team.id)}</code></td>
          <td><input class="team-name" value="${escapeHtml(team.name)}" ${editable ? "" : "disabled"}></td>
        </tr>
      `).join("")}</tbody>
    </table>
  `;

  elements.playerSetup.innerHTML = `
    <table class="setup-table player-setup-table">
      <thead><tr>
        <th class="left">Spieler</th><th>Team</th><th>Position</th><th>Finaler Ø Vorsaison</th><th>Vorsaison übernehmen</th><th>Aktiv</th>
      </tr></thead>
      <tbody>${players.map((player) => {
        const carriedAverage = player.carriedAverage ?? player.previousSeasonAverage ?? null;
        const carryChecked = carriedAverage !== null && player.carryPreviousAverage !== false && player.previousSeasonAverage !== null;
        return `
          <tr data-player-id="${escapeHtml(player.id)}">
            <td><input class="player-name" value="${escapeHtml(player.name)}" ${editable ? "" : "disabled"}></td>
            <td><select class="player-team" ${editable ? "" : "disabled"}>${teamOptions(player.teamId)}</select></td>
            <td><select class="player-slot" ${editable ? "" : "disabled"}>
              ${[1, 2, 3].map((slot) => `<option value="${slot}"${Number(player.rosterSlot) === slot ? " selected" : ""}>${slot}</option>`).join("")}
            </select></td>
            <td>${formatAverage(carriedAverage)}</td>
            <td><input class="carry-average checkbox" type="checkbox" ${carryChecked ? "checked" : ""} ${carriedAverage === null || !editable ? "disabled" : ""}></td>
            <td><input class="player-active checkbox" type="checkbox" ${player.active !== false ? "checked" : ""} ${editable ? "" : "disabled"}></td>
          </tr>
        `;
      }).join("")}</tbody>
    </table>
  `;

  elements.saveSetupButton.disabled = !editable;
  if (!editable) {
    showStatus(elements.setupStatus, "Teams und Kader sind nach der ersten Veröffentlichung gesperrt.");
  } else {
    hideStatus(elements.setupStatus);
  }
}

function renderSeasonSchedule() {
  elements.schedulePanel.classList.toggle("hidden", !currentSeason);
  if (!currentSeason || !matchdays.length) {
    elements.scheduleEditor.innerHTML = "";
    return;
  }

  const ordered = [...matchdays].sort((a, b) => Number(a.number) - Number(b.number));
  elements.scheduleEditor.innerHTML = ordered.map((matchday) => {
    const pairings = LANE_PAIRS.map((lanePair, index) => ({
      lanePair,
      ...(matchday.pairings?.[index] ?? {}),
    }));
    return `<section class="schedule-day" data-matchday-number="${Number(matchday.number)}" data-matchday-id="${escapeHtml(matchday.id)}">
      <div class="schedule-day-head">
        <h3>Spieltag ${Number(matchday.number)}</h3>
        <label>Datum
          <input class="schedule-date" type="date" value="${escapeHtml(matchday.date ?? "")}">
        </label>
      </div>
      <div class="schedule-pairings">
        ${pairings.map((pairing, index) => `<div class="schedule-pairing" data-pairing-index="${index}">
          <span class="lane-badge">Bahn ${LANE_PAIRS[index]}</span>
          <select class="schedule-home" aria-label="Spieltag ${Number(matchday.number)}, Bahn ${LANE_PAIRS[index]}, Team 1">${teamOptions(pairing.homeTeamId)}</select>
          <strong>gegen</strong>
          <select class="schedule-away" aria-label="Spieltag ${Number(matchday.number)}, Bahn ${LANE_PAIRS[index]}, Team 2">${teamOptions(pairing.awayTeamId)}</select>
        </div>`).join("")}
      </div>
    </section>`;
  }).join("");

  const publishedThrough = Number(currentSeason.currentPublishedMatchday ?? 0);
  if (publishedThrough > 0) {
    for (const day of elements.scheduleEditor.querySelectorAll("[data-matchday-number]")) {
      const number = Number(day.dataset.matchdayNumber);
      if (number <= publishedThrough) {
        day.querySelector(".schedule-date").disabled = true;
      }
    }
    showStatus(elements.scheduleStatus,
      `Spieltag 1 bis ${publishedThrough} ist bereits veröffentlicht. Deren Datum und Gegner sind geschützt; die Bahnpaar-Zuordnung kann weiterhin veröffentlicht werden.`);
  } else if (currentSeason.scheduleStatus === "configured") {
    showStatus(elements.scheduleStatus, "Der Spielplan ist öffentlich. Änderungen werden erst nach erneutem Speichern sichtbar.", "success");
  } else {
    hideStatus(elements.scheduleStatus);
  }
}

function readSeasonSchedule() {
  return [...elements.scheduleEditor.querySelectorAll("[data-matchday-number]")].map((day) => ({
    id: day.dataset.matchdayId,
    number: Number(day.dataset.matchdayNumber),
    date: day.querySelector(".schedule-date").value,
    pairings: [...day.querySelectorAll("[data-pairing-index]")].map((row, index) => ({
      lanePair: LANE_PAIRS[index],
      homeTeamId: row.querySelector(".schedule-home").value,
      awayTeamId: row.querySelector(".schedule-away").value,
    })),
  }));
}

function validateScheduleClient(schedule) {
  if (schedule.length !== 14) throw new Error("Der Spielplan muss 14 Spieltage enthalten.");
  const pairCounts = new Map();
  let previousDate = "";
  for (const day of schedule) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) throw new Error(`Spieltag ${day.number}: Datum fehlt.`);
    if (previousDate && day.date <= previousDate) throw new Error(`Spieltag ${day.number}: Termine müssen chronologisch aufsteigend sein.`);
    previousDate = day.date;
    const selected = day.pairings.flatMap((pairing) => [pairing.homeTeamId, pairing.awayTeamId]);
    if (selected.some((teamId) => !teamId)) throw new Error(`Spieltag ${day.number}: Alle vier Bahnpaarungen müssen vollständig sein.`);
    if (new Set(selected).size !== 8) throw new Error(`Spieltag ${day.number}: Jedes Team muss genau einmal vorkommen.`);
    for (const pairing of day.pairings) {
      if (pairing.homeTeamId === pairing.awayTeamId) throw new Error(`Spieltag ${day.number}: Ein Team kann nicht gegen sich selbst spielen.`);
      const key = [pairing.homeTeamId, pairing.awayTeamId].sort().join("|");
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }
  }
  if (pairCounts.size !== 28 || [...pairCounts.values()].some((count) => count !== 2)) {
    throw new Error("Über 14 Spieltage muss jede mögliche Teampaarung genau zweimal vorkommen.");
  }
  return schedule;
}

function renderAuditReport(report) {
  const summary = report.summary ?? {};
  elements.auditSummary.classList.remove("hidden");
  elements.auditSummary.innerHTML = [
    ["Teams", summary.teams ?? 0],
    ["Kaderplätze", summary.players ?? 0],
    ["Spieltage", summary.matchdays ?? 0],
    ["Ergebnisdatensätze", summary.resultDocuments ?? 0],
    ["Veröffentlicht bis", summary.publishedThrough ?? 0],
    ["Fehler / Warnungen", `${report.errors ?? 0} / ${report.warnings ?? 0}`],
  ].map(([label, value]) => `<div class="integrity-stat"><span class="muted">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");

  if (!report.issues?.length) {
    elements.auditIssues.innerHTML = '<div class="integrity-item success"><strong>Keine Inkonsistenzen gefunden.</strong> Die Saison ist technisch vollständig.</div>';
  } else {
    elements.auditIssues.innerHTML = report.issues.map((item) => (
      `<div class="integrity-item ${item.level === "error" ? "error" : "warning"}"><strong>${item.level === "error" ? "Fehler" : "Hinweis"}</strong> · ${escapeHtml(item.message)}</div>`
    )).join("");
  }
}

async function auditCurrentSeason() {
  setBusy(true);
  elements.auditSummary.classList.add("hidden");
  elements.auditIssues.innerHTML = "";
  showStatus(elements.auditStatus, "Saison wird vollständig geprüft …");
  try {
    const auditSeason = httpsCallable(functions, "auditSeason");
    const response = await auditSeason({ seasonId: currentSeasonId });
    renderAuditReport(response.data);
    const archiveText = response.data.catalogUpdated
      ? " Die öffentliche Saisonliste wurde aktualisiert."
      : " Die Saison ist noch nicht öffentlich und wurde daher nicht ins Archiv aufgenommen.";
    showStatus(
      elements.auditStatus,
      response.data.ok
        ? `Systemprüfung erfolgreich.${archiveText}`
        : `Systemprüfung abgeschlossen: ${response.data.errors} Fehler und ${response.data.warnings} Hinweise.${archiveText}`,
      response.data.ok ? "success" : "error",
    );
  } catch (error) {
    showStatus(elements.auditStatus, error?.message ?? String(error), "error");
  } finally {
    setBusy(false);
  }
}

async function rebuildPublicStatistics() {
  setBusy(true);
  showStatus(elements.auditStatus, "Öffentliche Ergebnisse, Rekorde und Analyseverläufe werden neu berechnet …");
  try {
    const rebuild = httpsCallable(functions, "rebuildPublicResults");
    const response = await rebuild({ seasonId: currentSeasonId });
    showStatus(
      elements.auditStatus,
      `Live-Daten neu berechnet: Schema ${response.data.schemaVersion}, ${response.data.players} Spieler, Stand Spieltag ${response.data.throughMatchday}.`,
      "success",
    );
    await loadPublicationHistory();
  } catch (error) {
    showStatus(elements.auditStatus, error?.message ?? String(error), "error");
  } finally {
    setBusy(false);
  }
}

async function saveSeasonSchedule() {
  setBusy(true);
  showStatus(elements.scheduleStatus, "Spielplan wird geprüft und veröffentlicht …");
  try {
    const schedule = validateScheduleClient(readSeasonSchedule());
    const saveSchedule = httpsCallable(functions, "saveSeasonSchedule");
    const response = await saveSchedule({ seasonId: currentSeasonId, schedule });
    showStatus(
      elements.scheduleStatus,
      `${response.data.matchdays} Spieltage mit vier Bahnpaarungen wurden gespeichert und auf spielplan.html veröffentlicht.`,
      "success",
    );
    await refreshSeasonData();
  } catch (error) {
    showStatus(elements.scheduleStatus, error?.message ?? String(error), "error");
  } finally {
    setBusy(false);
  }
}

function readPairings() {
  return [...elements.pairings.querySelectorAll("[data-pairing-index]")].map((row, index) => ({
    lanePair: LANE_PAIRS[index],
    homeTeamId: row.querySelector(".home-team").value,
    awayTeamId: row.querySelector(".away-team").value,
  }));
}

function readResults() {
  const results = {};
  for (const row of elements.scoreGrid.querySelectorAll(".score-player[data-player-id]")) {
    const scores = [...row.querySelectorAll(".score-input")].map((input) => {
      input.classList.remove("input-error");
      if (input.value.trim() === "") return null;
      const value = Number(input.value);
      if (!Number.isInteger(value) || value < 1 || value > 300) {
        input.classList.add("input-error");
        throw new Error(`Ungültiger Wert bei ${row.dataset.playerId}: ${input.value}`);
      }
      return value;
    });
    results[row.dataset.playerId] = { scores };
  }
  return results;
}
function readSeasonSetup() {
  const setupTeams = [...elements.teamSetup.querySelectorAll("tr[data-team-id]")].map((row) => ({
    id: row.dataset.teamId,
    name: row.querySelector(".team-name").value.trim(),
  }));
  const setupPlayers = [...elements.playerSetup.querySelectorAll("tr[data-player-id]")].map((row) => ({
    id: row.dataset.playerId,
    name: row.querySelector(".player-name").value.trim(),
    teamId: row.querySelector(".player-team").value,
    rosterSlot: Number(row.querySelector(".player-slot").value),
    carryPreviousAverage: row.querySelector(".carry-average").checked,
    active: row.querySelector(".player-active").checked,
  }));
  return { teams: setupTeams, players: setupPlayers };
}

function validateEditor() {
  if (!currentSeasonId) throw new Error("Keine Saison ausgewählt.");
  const number = Number(elements.matchdayNumber.value);
  const date = elements.matchdayDate.value;
  const pairings = readPairings();
  if (!Number.isInteger(number) || number < 1 || number > 14) throw new Error("Ungültige Spieltagsnummer.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Bitte ein Datum wählen.");

  const selectedTeams = pairings.flatMap((pairing) => [pairing.homeTeamId, pairing.awayTeamId]);
  if (selectedTeams.some((teamId) => !teamId)) throw new Error("Alle vier Paarungen müssen vollständig sein.");
  if (new Set(selectedTeams).size !== selectedTeams.length) throw new Error("Jedes Team darf pro Spieltag nur einmal vorkommen.");
  if (selectedTeams.length !== teams.length) throw new Error("Alle acht Teams müssen genau einmal angesetzt sein.");

  return { number, date, pairings, results: readResults() };
}

async function commitWrites(writes) {
  const chunkSize = 400;
  for (let start = 0; start < writes.length; start += chunkSize) {
    const batch = writeBatch(db);
    for (const write of writes.slice(start, start + chunkSize)) {
      batch.set(write.reference, write.data, write.options ?? {});
    }
    await batch.commit();
  }
}

function suggestNextSeason() {
  const match = /^(\d{4})-s([12])$/.exec(currentSeasonId ?? "");
  if (!match) return;
  const year = Number(match[1]);
  const half = Number(match[2]);
  const nextYear = half === 1 ? year : year + 1;
  const nextHalf = half === 1 ? 2 : 1;
  const nextId = `${nextYear}-s${nextHalf}`;
  elements.newSeasonId.value = nextId;
  elements.newSeasonName.value = `Liga ${nextYear} S${nextHalf}`;

  const lastDate = matchdays.at(-1)?.date;
  if (lastDate) {
    const date = new Date(`${lastDate}T12:00:00`);
    date.setDate(date.getDate() + 7);
    elements.firstMatchdayDate.value = date.toISOString().slice(0, 10);
  }
}

async function importInitialData() {
  setBusy(true);
  showStatus(elements.importStatus, "Initialdaten werden vorbereitet …");
  try {
    const response = await fetch("/data/season-2026-s2.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Quelldatei konnte nicht geladen werden (${response.status}).`);
    const data = await response.json();
    const seasonReference = doc(db, "seasons", data.season.id);
    const writes = [{
      reference: seasonReference,
      data: { ...data.season, matchdayCount: 14, importedAt: serverTimestamp(), updatedAt: serverTimestamp() },
      options: { merge: true },
    }];

    data.teams.forEach((team, order) => {
      writes.push({ reference: doc(db, "seasons", data.season.id, "teams", team.id), data: { ...team, order }, options: { merge: true } });
    });
    data.players.forEach((player, order) => {
      writes.push({ reference: doc(db, "seasons", data.season.id, "players", player.id), data: { ...player, order }, options: { merge: true } });
    });
    data.matchdays.forEach((matchday) => {
      const { results, ...metadata } = matchday;
      writes.push({
        reference: doc(db, "seasons", data.season.id, "matchdays", matchday.id),
        data: { ...metadata, updatedAt: serverTimestamp() },
        options: { merge: true },
      });
      for (const [playerId, result] of Object.entries(results)) {
        writes.push({
          reference: doc(db, "seasons", data.season.id, "matchdays", matchday.id, "results", playerId),
          data: { scores: result.scores, updatedAt: serverTimestamp() },
          options: { merge: true },
        });
      }
    });

    await commitWrites(writes);
    showStatus(elements.importStatus, `${writes.length} Datensätze wurden importiert.`, "success");
    await refreshSeasonList(data.season.id);
  } catch (error) {
    showStatus(elements.importStatus, error instanceof Error ? error.message : String(error), "error");
  } finally {
    setBusy(false);
  }
}

async function refreshSeasonList(preferredSeasonId = currentSeasonId) {
  if (!currentAdmin) return;
  const snapshot = await getDocs(collection(db, "seasons"));
  seasons = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => a.id.localeCompare(b.id, "de", { numeric: true }));

  elements.seasonSelect.innerHTML = seasons.length
    ? seasons.map((season) => `<option value="${season.id}">${season.name ?? season.id}</option>`).join("")
    : "<option value=\"\">Noch keine Saison</option>";

  if (!seasons.length) {
    currentSeasonId = initialSeasonId;
    currentSeason = null;
    teams = [];
    players = [];
    matchdays = [];
    elements.schedulePanel.classList.add("hidden");
    showStatus(elements.seasonStatus, "Noch keine Saison vorhanden. Importiere zunächst 2026 S2.");
    return;
  }

  currentSeasonId = seasons.some((season) => season.id === preferredSeasonId)
    ? preferredSeasonId
    : seasons.at(-1).id;
  elements.seasonSelect.value = currentSeasonId;
  await refreshSeasonData();
}

async function loadPublicationHistory() {
  if (!currentSeasonId) return;
  showStatus(elements.historyStatus, "Veröffentlichungsverlauf wird geladen …");
  try {
    const snapshot = await getDocs(query(
      collection(db, "seasons", currentSeasonId, "publications"),
      orderBy("createdAt", "desc"),
      limit(15),
    ));
    if (snapshot.empty) {
      elements.publicationHistory.innerHTML = '<div class="status">Noch keine Veröffentlichung vorhanden.</div>';
      hideStatus(elements.historyStatus);
      return;
    }
    const rows = snapshot.docs.map((item) => {
      const value = item.data();
      const currentClass = item.id === currentSeason?.currentPublicationId ? "current-version" : "";
      const samePublishedRange = Number(value.throughMatchday ?? 0) === Number(currentSeason?.currentPublishedMatchday ?? 0);
      const restoreDisabled = currentClass || !samePublishedRange;
      return `<tr class="${currentClass}">
        <td>${escapeHtml(formatTimestamp(value.createdAt))}</td>
        <td>${escapeHtml(publicationTypeLabel(value.type))}</td>
        <td>${Number(value.changedMatchday ?? value.throughMatchday ?? 0)}</td>
        <td>${Number(value.throughMatchday ?? 0)}</td>
        <td class="note-cell">${escapeHtml(value.note || "–")}</td>
        <td><code>${escapeHtml(item.id)}</code></td>
        <td><button class="secondary restore-publication" data-revision-id="${escapeHtml(item.id)}" ${restoreDisabled ? "disabled" : ""} title="${samePublishedRange ? "Diesen Stand erneut veröffentlichen" : "Nur Versionen mit demselben veröffentlichten Spieltagsstand sind wiederherstellbar"}">Diesen Stand wiederherstellen</button></td>
      </tr>`;
    }).join("");
    elements.publicationHistory.innerHTML = `<table class="history-table">
      <thead><tr><th>Zeitpunkt</th><th>Typ</th><th>Geändert</th><th>Stand bis</th><th class="left">Hinweis</th><th>Versions-ID</th><th>Aktion</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
    hideStatus(elements.historyStatus);
  } catch (error) {
    showStatus(elements.historyStatus, error?.message ?? String(error), "error");
  }
}

async function restorePublication(revisionId) {
  const restoreNote = window.prompt("Warum soll dieser frühere Stand wiederhergestellt werden?");
  if (restoreNote === null) return;
  if (restoreNote.trim().length < 5) {
    showStatus(elements.historyStatus, "Bitte einen nachvollziehbaren Grund mit mindestens fünf Zeichen angeben.", "error");
    return;
  }
  setBusy(true);
  showStatus(elements.historyStatus, "Früherer Stand wird wiederhergestellt …");
  try {
    const restore = httpsCallable(functions, "restorePublication");
    const response = await restore({ seasonId: currentSeasonId, revisionId, restoreNote });
    showStatus(elements.historyStatus, `Stand bis Spieltag ${response.data.throughMatchday} wurde als neue Version wiederhergestellt.`, "success");
    await refreshSeasonList(currentSeasonId);
  } catch (error) {
    showStatus(elements.historyStatus, error?.message ?? String(error), "error");
  } finally {
    setBusy(false);
  }
}

async function refreshSeasonData() {
  if (!currentAdmin || !currentSeasonId) return;
  setBusy(true);
  showStatus(elements.editorStatus, "Saisondaten werden geladen …");
  try {
    const seasonReference = doc(db, "seasons", currentSeasonId);
    const [seasonSnapshot, teamSnapshot, playerSnapshot, matchdaySnapshot] = await Promise.all([
      getDoc(seasonReference),
      getDocs(query(collection(db, "seasons", currentSeasonId, "teams"), orderBy("order"))),
      getDocs(query(collection(db, "seasons", currentSeasonId, "players"), orderBy("order"))),
      getDocs(query(collection(db, "seasons", currentSeasonId, "matchdays"), orderBy("number"))),
    ]);
    if (!seasonSnapshot.exists()) throw new Error(`Saison ${currentSeasonId} wurde nicht gefunden.`);

    currentSeason = { id: seasonSnapshot.id, ...seasonSnapshot.data() };
    teams = teamSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    players = playerSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    matchdays = matchdaySnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

    elements.seasonSummary.textContent = `${currentSeason.name ?? currentSeason.id} · Status ${currentSeason.status ?? "–"} · veröffentlicht bis Spieltag ${currentSeason.currentPublishedMatchday ?? 0}`;
    elements.sourceSeasonName.value = currentSeason.name ?? currentSeason.id;
    elements.createSeasonButton.disabled = Number(currentSeason.currentPublishedMatchday ?? 0) < 14;
    renderSeasonSetup();
    renderSeasonSchedule();

    elements.matchdaySelect.innerHTML = matchdays.map((matchday) => (
      `<option value="${matchday.id}">Spieltag ${matchday.number} · ${matchday.date}</option>`
    )).join("");

    if (matchdays.length) {
      const publishedThrough = Number(currentSeason.currentPublishedMatchday ?? 0);
      const preferredNumber = publishedThrough >= 14 ? 14 : Math.max(1, publishedThrough + 1);
      const preferred = matchdays.find((matchday) => Number(matchday.number) === preferredNumber) ?? matchdays[0];
      elements.matchdaySelect.value = preferred.id;
      await loadMatchday(preferred.id);
    } else {
      renderPairings();
      renderScoreGrid({});
    }

    suggestNextSeason();
    await loadPublicationHistory();
    showStatus(elements.editorStatus, `${teams.length} Teams, ${players.length} Kaderplätze und ${matchdays.length} Spieltage geladen.`, "success");
  } catch (error) {
    showStatus(elements.editorStatus, error instanceof Error ? error.message : String(error), "error");
  } finally {
    setBusy(false);
  }
}

async function loadMatchday(matchdayId) {
  if (!matchdayId || !currentSeasonId) return;
  const metadata = matchdays.find((matchday) => matchday.id === matchdayId);
  if (!metadata) throw new Error("Spieltag wurde nicht gefunden.");
  const resultsSnapshot = await getDocs(collection(db, "seasons", currentSeasonId, "matchdays", matchdayId, "results"));
  const results = Object.fromEntries(resultsSnapshot.docs.map((item) => [item.id, item.data()]));

  elements.matchdayNumber.value = metadata.number;
  elements.matchdayDate.value = metadata.date;
  elements.matchdayStatus.value = metadata.status ?? "draft";
  renderPairings(metadata.pairings ?? []);
  renderScoreGrid(results);
  hideStatus(elements.previewStatus);
  updatePublicationGuidance();
  updateMatchdayNavigation();
}

async function persistDraft(data) {
  const matchdayId = `spieltag-${String(data.number).padStart(2, "0")}`;
  const metadataReference = doc(db, "seasons", currentSeasonId, "matchdays", matchdayId);
  const writes = [{
    reference: metadataReference,
    data: {
      id: matchdayId,
      number: data.number,
      date: data.date,
      status: "draft",
      pairings: data.pairings,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
    },
    options: { merge: true },
  }];

  for (const [playerId, result] of Object.entries(data.results)) {
    writes.push({
      reference: doc(db, "seasons", currentSeasonId, "matchdays", matchdayId, "results", playerId),
      data: { scores: result.scores, updatedAt: serverTimestamp(), updatedBy: currentUser.uid },
      options: { merge: true },
    });
  }
  await commitWrites(writes);
  return matchdayId;
}

async function saveDraft() {
  setBusy(true);
  showStatus(elements.editorStatus, "Entwurf wird gespeichert …");
  try {
    const data = validateEditor();
    const matchdayId = await persistDraft(data);
    await refreshSeasonData();
    elements.matchdaySelect.value = matchdayId;
    await loadMatchday(matchdayId);
    showStatus(elements.editorStatus, `Spieltag ${data.number} wurde als Entwurf gespeichert.`, "success");
  } catch (error) {
    showStatus(elements.editorStatus, error instanceof Error ? error.message : String(error), "error");
  } finally {
    setBusy(false);
  }
}

async function previewCurrent() {
  setBusy(true);
  showStatus(elements.previewStatus, "Entwurf wird gespeichert und unverbindlich geprüft …");
  try {
    const data = validateEditor();
    const plan = updatePublicationGuidance();
    if (!plan.allowed) throw new Error(plan.message);
    await persistDraft(data);
    const previewSeason = httpsCallable(functions, "previewSeason");
    const response = await previewSeason({ seasonId: currentSeasonId, editedMatchday: data.number });
    const modeText = response.data.mode === "correction"
      ? `Korrektur; veröffentlicht bleibt Spieltag ${response.data.throughMatchday}`
      : `neuer Stand bis Spieltag ${response.data.throughMatchday}`;
    showStatus(
      elements.previewStatus,
      `Vorschau erfolgreich: ${modeText}. ${response.data.playerRows} Spieler, ${response.data.teamRows} Teams. Tabellenführer: ${response.data.leaderPlayer?.name ?? "–"}; führendes Team: ${response.data.leaderTeam?.name ?? "–"}.`,
      "success",
    );
  } catch (error) {
    showStatus(elements.previewStatus, error?.message ?? String(error), "error");
  } finally {
    setBusy(false);
  }
}

async function publishCurrent() {
  setBusy(true);
  showStatus(elements.editorStatus, "Entwurf wird gespeichert und serverseitig berechnet …");
  try {
    const data = validateEditor();
    const plan = updatePublicationGuidance();
    if (!plan.allowed) throw new Error(plan.message);
    const publicationNote = elements.publicationNote.value.trim();
    if (plan.requiresNote && publicationNote.length < 5) {
      elements.publicationNote.setAttribute("aria-invalid", "true");
      throw new Error("Bei einer Korrektur ist eine kurze Begründung mit mindestens fünf Zeichen erforderlich.");
    }
    const matchdayId = await persistDraft(data);
    const publishSeason = httpsCallable(functions, "publishSeason");
    const response = await publishSeason({
      seasonId: currentSeasonId,
      editedMatchday: data.number,
      publicationNote,
    });
    elements.publicationNote.value = "";
    await refreshSeasonList(currentSeasonId);
    elements.matchdaySelect.value = matchdayId;
    await loadMatchday(matchdayId);
    const action = response.data.mode === "correction"
      ? `Spieltag ${data.number} wurde korrigiert; der öffentliche Stand bleibt bis Spieltag ${response.data.throughMatchday}.`
      : `Spieltag ${response.data.throughMatchday} ist veröffentlicht.`;
    showStatus(
      elements.editorStatus,
      `${action} ${response.data.playerRows} Spieler- und ${response.data.teamRows} Teamzeilen wurden erzeugt.${response.data.seasonCompleted ? " Die Saison ist abgeschlossen." : ""}`,
      "success",
    );
  } catch (error) {
    showStatus(elements.editorStatus, error?.message ?? String(error), "error");
  } finally {
    setBusy(false);
  }
}

async function createNextSeason() {
  setBusy(true);
  showStatus(elements.createSeasonStatus, "Neue Saison wird vorbereitet …");
  try {
    const newSeasonId = elements.newSeasonId.value.trim().toLowerCase();
    const newSeasonName = elements.newSeasonName.value.trim();
    const firstMatchdayDate = elements.firstMatchdayDate.value;
    if (!/^[a-z0-9-]{3,40}$/.test(newSeasonId)) throw new Error("Ungültige Saison-ID, zum Beispiel 2027-s1.");
    if (newSeasonName.length < 3) throw new Error("Bitte einen Saisonnamen angeben.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstMatchdayDate)) throw new Error("Bitte das Datum von Spieltag 1 angeben.");

    const createSeason = httpsCallable(functions, "createNextSeason");
    const response = await createSeason({
      sourceSeasonId: currentSeasonId,
      newSeasonId,
      newSeasonName,
      firstMatchdayDate,
    });
    showStatus(
      elements.createSeasonStatus,
      `${response.data.seasonId} wurde mit ${response.data.matchdays} Spieltagen angelegt. Für ${response.data.carriedAverages} Spieler wurde der finale Vorsaisonschnitt übernommen.`,
      "success",
    );
    await refreshSeasonList(newSeasonId);
  } catch (error) {
    showStatus(elements.createSeasonStatus, error?.message ?? String(error), "error");
  } finally {
    setBusy(false);
  }
}

async function saveSeasonSetup() {
  setBusy(true);
  showStatus(elements.setupStatus, "Teams und Kader werden geprüft …");
  try {
    const setup = readSeasonSetup();
    const saveSetup = httpsCallable(functions, "saveSeasonSetup");
    const response = await saveSetup({ seasonId: currentSeasonId, ...setup });
    showStatus(elements.setupStatus, `${response.data.teams} Teams und ${response.data.players} Kaderplätze wurden gespeichert.`, "success");
    await refreshSeasonData();
  } catch (error) {
    showStatus(elements.setupStatus, error?.message ?? String(error), "error");
  } finally {
    setBusy(false);
  }
}

for (const button of workspaceButtons) {
  button.addEventListener("click", () => activateWorkspace(button.dataset.workspaceTarget));
}

elements.previousMatchdayButton.addEventListener("click", () => moveMatchday(-1));
elements.nextMatchdayButton.addEventListener("click", () => moveMatchday(1));
elements.scoreGrid.addEventListener("input", (event) => {
  if (event.target.matches(".score-input")) {
    event.target.classList.remove("input-error");
    updateScoreProgress();
  }
});
elements.scoreGrid.addEventListener("focusin", (event) => {
  if (event.target.matches(".score-input")) requestAnimationFrame(() => event.target.select());
});
elements.scoreGrid.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || !event.target.matches(".score-input")) return;
  event.preventDefault();
  const inputs = [...elements.scoreGrid.querySelectorAll(".score-input")];
  const next = inputs[inputs.indexOf(event.target) + 1];
  next?.focus();
});

const requestedWorkspace = location.hash.replace("#", "");
activateWorkspace(requestedWorkspace || "results", false);

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideStatus(elements.loginStatus);
  try {
    await signInWithEmailAndPassword(auth, elements.email.value.trim(), elements.password.value);
    elements.password.value = "";
  } catch (error) {
    showStatus(elements.loginStatus, error?.message ?? "Anmeldung fehlgeschlagen.", "error");
  }
});

elements.logoutButton.addEventListener("click", () => signOut(auth));
elements.importButton.addEventListener("click", importInitialData);
elements.auditSeasonButton.addEventListener("click", auditCurrentSeason);
elements.rebuildPublicButton.addEventListener("click", rebuildPublicStatistics);
elements.refreshButton.addEventListener("click", () => refreshSeasonList(currentSeasonId));
elements.createSeasonButton.addEventListener("click", createNextSeason);
elements.saveSetupButton.addEventListener("click", saveSeasonSetup);
elements.saveScheduleButton.addEventListener("click", saveSeasonSchedule);
elements.saveButton.addEventListener("click", saveDraft);
elements.previewButton.addEventListener("click", previewCurrent);
elements.publishButton.addEventListener("click", publishCurrent);
elements.reloadHistoryButton.addEventListener("click", loadPublicationHistory);
elements.publicationHistory.addEventListener("click", (event) => {
  const button = event.target.closest(".restore-publication");
  if (!button || button.disabled) return;
  restorePublication(button.dataset.revisionId);
});
elements.seasonSelect.addEventListener("change", async () => {
  currentSeasonId = elements.seasonSelect.value;
  await refreshSeasonData();
});
elements.matchdaySelect.addEventListener("change", () => loadMatchday(elements.matchdaySelect.value).catch((error) => {
  showStatus(elements.editorStatus, error.message, "error");
}));

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  currentAdmin = false;
  if (!user) {
    elements.loginPanel.classList.remove("hidden");
    elements.adminArea.classList.add("hidden");
    return;
  }

  elements.loginPanel.classList.add("hidden");
  elements.adminArea.classList.remove("hidden");
  elements.accountInfo.textContent = `${user.email ?? "Konto"} · UID ${user.uid}`;
  elements.uidText.textContent = user.uid;
  showStatus(elements.adminStatus, "Admin-Berechtigung wird geprüft …");

  try {
    const adminSnapshot = await getDoc(doc(db, "admins", user.uid));
    currentAdmin = adminSnapshot.exists() && adminSnapshot.data()?.active === true;
  } catch (error) {
    currentAdmin = false;
  }

  if (!currentAdmin) {
    showStatus(elements.adminStatus, "Angemeldet, aber nicht als Admin freigeschaltet.", "error");
    elements.bootstrapPanel.classList.remove("hidden");
    elements.securedArea.classList.add("hidden");
    return;
  }

  showStatus(elements.adminStatus, "Administratorzugriff aktiv.", "success");
  elements.bootstrapPanel.classList.add("hidden");
  elements.securedArea.classList.remove("hidden");
  await refreshSeasonList(currentSeasonId);
});
