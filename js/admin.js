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
const ADMIN_VERSION = "15.12";
const LANE_PAIRS = ["1+2", "3+4", "5+6", "7+8", "9+10"];
const DUMMY_TEAM_ID = "Team 10";
const LEGACY_DUMMY_TEAM_ID = "team-10";
function isDummyTeam(team) { return team?.isDummy === true || team?.id === DUMMY_TEAM_ID || team?.id === LEGACY_DUMMY_TEAM_ID; }
function currentDummyTeamId() { return teams.find((team) => isDummyTeam(team))?.id ?? DUMMY_TEAM_ID; }
function currentMatchdayCount() { return Number(currentSeason?.matchdayCount ?? (teams.length === 10 ? 18 : 14)); }
function currentLanePairs() { return LANE_PAIRS.slice(0, teams.length === 10 ? 5 : 4); }
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
  checkDeploymentButton: $("#checkDeploymentButton"),
  frontendVersion: $("#frontendVersion"),
  backendVersion: $("#backendVersion"),
  deployStatus: $("#deployStatus"),
  rebuildPublicButton: $("#rebuildPublicButton"),
  activateSeasonButton: $("#activateSeasonButton"),
  activateSeasonStatus: $("#activateSeasonStatus"),
  deleteSeasonButton: $("#deleteSeasonButton"),
  deleteSeasonStatus: $("#deleteSeasonStatus"),
  clearLeaderboardButton: $("#clearLeaderboardButton"),
  clearLeaderboardStatus: $("#clearLeaderboardStatus"),
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
  seasonCorrectionPanel: $("#seasonCorrectionPanel"),
  correctionTeamSetup: $("#correctionTeamSetup"),
  correctionPlayerSetup: $("#correctionPlayerSetup"),
  correctionNote: $("#correctionNote"),
  correctSeasonButton: $("#correctSeasonButton"),
  correctionStatus: $("#correctionStatus"),
  rosterTransferPanel: $("#rosterTransferPanel"),
  transferMatchday: $("#transferMatchday"),
  transferPlayer: $("#transferPlayer"),
  transferTargetTeam: $("#transferTargetTeam"),
  transferSwapInfo: $("#transferSwapInfo"),
  transferPreview: $("#transferPreview"),
  transferPlayerButton: $("#transferPlayerButton"),
  transferStatus: $("#transferStatus"),
  schedulePanel: $("#schedulePanel"),
  scheduleEditor: $("#scheduleEditor"),
  generateScheduleButton: $("#generateScheduleButton"),
  scheduleGeneratorStatus: $("#scheduleGeneratorStatus"),
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
let currentAdminRole = "none";
let isBusy = false;
let previousSeasonPlayers = [];
let previousAverageByName = new Map();


function isResultsEditor() {
  return currentAdmin && currentAdminRole === "results";
}

function isFullAdmin() {
  return currentAdmin && currentAdminRole === "admin";
}

function applyRoleUi() {
  const limited = isResultsEditor();
  for (const button of workspaceButtons) {
    button.hidden = limited && button.dataset.workspaceTarget !== "results";
  }
  if (limited) activateWorkspace("results", false);
  elements.seasonSelect.disabled = isBusy || limited;
  if (elements.clearLeaderboardButton) elements.clearLeaderboardButton.hidden = limited;
}

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
  elements.importButton.disabled = busy || !isFullAdmin();
  elements.auditSeasonButton.disabled = busy || !currentSeason || !isFullAdmin();
  elements.rebuildPublicButton.disabled = busy || !currentSeason || Number(currentSeason?.currentPublishedMatchday ?? 0) < 1 || !isFullAdmin();
  elements.deleteSeasonButton.disabled = busy || !currentSeason || !isFullAdmin();
  elements.refreshButton.disabled = busy;
  elements.saveButton.disabled = busy || !currentSeason;
  elements.previewButton.disabled = busy || !currentSeason;
  elements.publishButton.disabled = busy || !currentSeason;
  elements.reloadHistoryButton.disabled = busy || !currentSeason;
  elements.seasonSelect.disabled = busy || isResultsEditor();
  elements.createSeasonButton.disabled = busy || Number(currentSeason?.currentPublishedMatchday ?? 0) < currentMatchdayCount() || !isFullAdmin();
  const setupEditable = currentSeason?.status === "setup" && Number(currentSeason?.currentPublishedMatchday ?? 0) === 0;
  elements.saveSetupButton.disabled = busy || !setupEditable || !isFullAdmin();
  if (elements.correctSeasonButton) elements.correctSeasonButton.disabled = busy || !currentSeason || !isFullAdmin();
  elements.saveScheduleButton.disabled = busy || !currentSeason || !isFullAdmin();
  if (elements.generateScheduleButton) {
    elements.generateScheduleButton.disabled = busy || !currentSeason || teams.length !== 10 || Number(currentSeason?.currentPublishedMatchday ?? 0) > 0 || !isFullAdmin();
  }
  if (elements.transferPlayerButton) elements.transferPlayerButton.disabled = busy || !currentSeason || !isFullAdmin();
  updateMatchdayNavigation();
  if (currentSeason) updatePublicationGuidance();
  if (elements.transferMatchday && isFullAdmin()) renderRosterTransferPanel();
}

function formatAverage(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "–";
  return Number(value).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function normalizePlayerNameKey(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE");
}

function playerAssignmentAtClient(player, matchdayNumber) {
  const number = Math.max(1, Number(matchdayNumber) || 1);
  const fallbackTeamId = String(player?.initialTeamId ?? player?.teamId ?? "");
  const fallbackSlot = Number(player?.rosterSlot);
  const assignments = Array.isArray(player?.teamAssignments)
    ? player.teamAssignments
      .map((item) => ({
        fromMatchday: Number(item?.fromMatchday),
        teamId: String(item?.teamId ?? ""),
        rosterSlot: Number(item?.rosterSlot ?? fallbackSlot),
      }))
      .filter((item) => Number.isInteger(item.fromMatchday) && item.fromMatchday >= 1 && item.teamId && [1, 2, 3].includes(item.rosterSlot))
      .sort((a, b) => a.fromMatchday - b.fromMatchday)
    : [];
  if (!assignments.some((item) => item.fromMatchday === 1) && fallbackTeamId && [1, 2, 3].includes(fallbackSlot)) {
    assignments.unshift({ fromMatchday: 1, teamId: fallbackTeamId, rosterSlot: fallbackSlot });
  }
  let selected = assignments[0] ?? { fromMatchday: 1, teamId: fallbackTeamId, rosterSlot: fallbackSlot };
  for (const item of assignments) {
    if (item.fromMatchday > number) break;
    selected = item;
  }
  return selected;
}

function teamName(teamId) {
  return teams.find((team) => team.id === teamId)?.name ?? teamId ?? "–";
}

function rosterAtClient(teamId, matchdayNumber) {
  return players
    .map((player) => ({ player, assignment: playerAssignmentAtClient(player, matchdayNumber) }))
    .filter(({ assignment }) => assignment.teamId === teamId)
    .sort((a, b) => a.assignment.rosterSlot - b.assignment.rosterSlot || Number(a.player.order ?? 999) - Number(b.player.order ?? 999));
}

function transferSelection() {
  const matchdayNumber = Number(elements.transferMatchday?.value ?? 0);
  const player = players.find((item) => item.id === elements.transferPlayer?.value) ?? null;
  const targetTeamId = elements.transferTargetTeam?.value ?? "";
  const assignment = player ? playerAssignmentAtClient(player, matchdayNumber) : null;
  const swap = assignment && targetTeamId
    ? rosterAtClient(targetTeamId, matchdayNumber).find(({ assignment: item }) => Number(item.rosterSlot) === Number(assignment.rosterSlot))?.player ?? null
    : null;
  return { matchdayNumber, player, targetTeamId, assignment, swap };
}

function updateTransferPreview() {
  if (!elements.transferPreview || !elements.transferSwapInfo || !elements.transferPlayerButton) return;
  const { matchdayNumber, player, targetTeamId, assignment, swap } = transferSelection();
  const publishedThrough = Number(currentSeason?.currentPublishedMatchday ?? 0);
  const allowed = Boolean(currentSeason && publishedThrough >= 1 && matchdayNumber > publishedThrough && matchdayNumber <= currentMatchdayCount());
  if (!allowed) {
    elements.transferSwapInfo.value = "–";
    elements.transferPreview.innerHTML = publishedThrough < 1
      ? "Vor der ersten Veröffentlichung kannst du die Teamzuordnung direkt unter <strong>Neue Saison → Teams und Kader</strong> ändern."
      : "Die Saison ist bereits vollständig veröffentlicht; es gibt keinen zukünftigen Spieltag mehr für einen Teamwechsel.";
    elements.transferPlayerButton.disabled = true;
    return;
  }
  if (!player || !assignment || !targetTeamId || assignment.teamId === targetTeamId || !swap) {
    elements.transferSwapInfo.value = "–";
    elements.transferPreview.textContent = "Wähle einen Spieler und ein anderes Zielteam. Der Tauschpartner derselben Position wird automatisch ermittelt.";
    elements.transferPlayerButton.disabled = true;
    return;
  }
  elements.transferSwapInfo.value = `${swap.name} · Position ${assignment.rosterSlot}`;
  elements.transferPreview.innerHTML = `<strong>Ab Spieltag ${matchdayNumber}:</strong> ${escapeHtml(player.name)} wechselt von ${escapeHtml(teamName(assignment.teamId))} zu ${escapeHtml(teamName(targetTeamId))}. Gleichzeitig wechselt ${escapeHtml(swap.name)} auf Position ${Number(assignment.rosterSlot)} in die Gegenrichtung. Spieltag 1 bis ${publishedThrough} bleibt unverändert.`;
  elements.transferPlayerButton.disabled = isBusy;
}

function renderRosterTransferPanel() {
  if (!elements.transferMatchday || !elements.transferPlayer || !elements.transferTargetTeam) return;
  const publishedThrough = Number(currentSeason?.currentPublishedMatchday ?? 0);
  const matchdayCount = currentMatchdayCount();
  const firstAllowed = publishedThrough + 1;
  const previousMatchday = Number(elements.transferMatchday.value || firstAllowed);
  const allowedMatchdays = publishedThrough >= 1 && firstAllowed <= matchdayCount
    ? Array.from({ length: matchdayCount - firstAllowed + 1 }, (_, index) => firstAllowed + index)
    : [];
  elements.transferMatchday.innerHTML = allowedMatchdays.length
    ? allowedMatchdays.map((number) => `<option value="${number}"${number === previousMatchday ? " selected" : ""}>Spieltag ${number}</option>`).join("")
    : '<option value="">Kein Wechsel möglich</option>';
  if (allowedMatchdays.length && !allowedMatchdays.includes(Number(elements.transferMatchday.value))) {
    elements.transferMatchday.value = String(allowedMatchdays[0]);
  }

  const matchdayNumber = Number(elements.transferMatchday.value || firstAllowed || 1);
  const previousPlayerId = elements.transferPlayer.value;
  const realPlayers = [...players].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "de"));
  elements.transferPlayer.innerHTML = realPlayers.map((player) => {
    const assignment = playerAssignmentAtClient(player, matchdayNumber);
    return `<option value="${escapeHtml(player.id)}"${player.id === previousPlayerId ? " selected" : ""}>${escapeHtml(player.name)} · ${escapeHtml(teamName(assignment.teamId))} · Pos. ${Number(assignment.rosterSlot)}</option>`;
  }).join("");
  if (realPlayers.length && !realPlayers.some((player) => player.id === elements.transferPlayer.value)) {
    elements.transferPlayer.value = realPlayers[0].id;
  }

  const player = players.find((item) => item.id === elements.transferPlayer.value) ?? null;
  const sourceTeamId = player ? playerAssignmentAtClient(player, matchdayNumber).teamId : "";
  const previousTarget = elements.transferTargetTeam.value;
  const targetTeams = teams.filter((team) => !isDummyTeam(team) && team.id !== sourceTeamId);
  elements.transferTargetTeam.innerHTML = targetTeams.map((team) => `<option value="${escapeHtml(team.id)}"${team.id === previousTarget ? " selected" : ""}>${escapeHtml(team.name)}</option>`).join("");
  if (targetTeams.length && !targetTeams.some((team) => team.id === elements.transferTargetTeam.value)) {
    elements.transferTargetTeam.value = targetTeams[0].id;
  }

  elements.transferMatchday.disabled = !allowedMatchdays.length || isBusy;
  elements.transferPlayer.disabled = !allowedMatchdays.length || isBusy;
  elements.transferTargetTeam.disabled = !allowedMatchdays.length || isBusy;
  updateTransferPreview();
}

function buildPreviousAverageLookup(rows = []) {
  const lookup = new Map();
  const duplicates = new Set();
  for (const row of rows) {
    const key = normalizePlayerNameKey(row?.name);
    const average = Number(row?.average);
    if (!key || !Number.isFinite(average) || average <= 0) continue;
    if (lookup.has(key)) {
      duplicates.add(key);
      continue;
    }
    lookup.set(key, {
      playerId: String(row?.playerId ?? row?.id ?? ""),
      name: String(row?.name ?? "").trim(),
      average: Math.round((average + Number.EPSILON) * 10) / 10,
    });
  }
  for (const key of duplicates) lookup.delete(key);
  return lookup;
}

async function loadPreviousSeasonPlayerLookup() {
  previousSeasonPlayers = [];
  previousAverageByName = new Map();
  const previousSeasonId = String(currentSeason?.previousSeasonId ?? "").trim();

  if (previousSeasonId) {
    try {
      const snapshot = await getDoc(doc(db, "publicResults", previousSeasonId, "results", "current"));
      const rows = snapshot.exists() ? snapshot.data()?.individualStandings?.rows : null;
      if (Array.isArray(rows) && rows.length) {
        previousSeasonPlayers = rows
          .filter((row) => !isDummyTeam({ id: row.teamId, isDummy: row.isDummy }))
          .map((row) => ({
            playerId: String(row.playerId ?? ""),
            name: String(row.name ?? "").trim(),
            average: Number(row.average),
          }))
          .filter((row) => row.name && Number.isFinite(row.average) && row.average > 0);
        previousAverageByName = buildPreviousAverageLookup(previousSeasonPlayers);
        return;
      }
    } catch (error) {
      console.warn("Vorsaisonsschnitte konnten nicht aus den veröffentlichten Daten geladen werden:", error);
    }
  }

  // Fallback für ältere/noch nicht öffentlich verfügbare Saisons.
  previousSeasonPlayers = players
    .map((player) => ({
      playerId: String(player.id ?? ""),
      name: String(player.name ?? "").trim(),
      average: Number(player.carriedAverage ?? player.previousSeasonAverage),
    }))
    .filter((row) => row.name && Number.isFinite(row.average) && row.average > 0);
  previousAverageByName = buildPreviousAverageLookup(previousSeasonPlayers);
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

async function transferPlayerBetweenTeams() {
  const selection = transferSelection();
  if (!selection.player || !selection.assignment || !selection.targetTeamId || !selection.swap) {
    showStatus(elements.transferStatus, "Bitte Spieler, Spieltag und Zielteam vollständig auswählen.", "error");
    return;
  }
  const text = `${selection.player.name} wechselt ab Spieltag ${selection.matchdayNumber} von ${teamName(selection.assignment.teamId)} zu ${teamName(selection.targetTeamId)}. ${selection.swap.name} wechselt auf derselben Position in die Gegenrichtung. Fortfahren?`;
  if (!window.confirm(text)) return;

  setBusy(true);
  showStatus(elements.transferStatus, "Kaderwechsel wird gespeichert …");
  try {
    const transferPlayer = httpsCallable(functions, "transferPlayer");
    const response = await transferPlayer({
      seasonId: currentSeasonId,
      playerId: selection.player.id,
      targetTeamId: selection.targetTeamId,
      effectiveFromMatchday: selection.matchdayNumber,
    });
    showStatus(
      elements.transferStatus,
      `${response.data.player.name} und ${response.data.swapPlayer.name} tauschen ab Spieltag ${response.data.effectiveFromMatchday} die Teams. Bereits veröffentlichte Spieltage bleiben unverändert.`,
      "success",
    );
    await refreshSeasonData();
  } catch (error) {
    showStatus(elements.transferStatus, error?.message ?? String(error), "error");
  } finally {
    setBusy(false);
    renderRosterTransferPanel();
  }
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
  if (isResultsEditor()) {
    elements.previousMatchdayButton.disabled = true;
    elements.nextMatchdayButton.disabled = true;
    return;
  }
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
    if (isResultsEditor()) {
      return { allowed: false, mode: "blocked", message: `Dieses Konto darf nur den nächsten Spieltag ${current + 1} erfassen und veröffentlichen.` };
    }
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

function teamOptions(selected = "", includeDummy = true) {
  const availableTeams = includeDummy ? teams : teams.filter((team) => !isDummyTeam(team));
  return ["<option value=\"\">Team wählen</option>", ...availableTeams.map((team) => (
    `<option value="${escapeHtml(team.id)}"${team.id === selected ? " selected" : ""}>${escapeHtml(team.id)}${team.name && team.name !== team.id ? ` · ${escapeHtml(team.name)}` : ""}</option>`
  ))].join("");
}

function currentSetupTeamNames() {
  const map = new Map();
  for (const team of teams.filter((item) => !isDummyTeam(item))) {
    const row = [...elements.teamSetup.querySelectorAll("tr[data-team-id]")].find((item) => item.dataset.teamId === team.id);
    const inputName = row?.querySelector(".team-name")?.value?.trim();
    map.set(team.id, inputName || team.name || team.id);
  }
  return map;
}

function seasonSetupTeamOptions(selected = "") {
  const labels = currentSetupTeamNames();
  const availableTeams = teams.filter((team) => !isDummyTeam(team));
  return ["<option value=\"\">Team wählen</option>", ...availableTeams.map((team) => (
    `<option value="${escapeHtml(team.id)}"${team.id === selected ? " selected" : ""}>${escapeHtml(labels.get(team.id) ?? team.name ?? team.id)}</option>`
  ))].join("");
}

function refreshSeasonSetupTeamLabels() {
  const labels = currentSetupTeamNames();
  for (const select of elements.playerSetup.querySelectorAll("select.player-team")) {
    const selected = select.value;
    for (const option of select.options) {
      if (!option.value) continue;
      option.textContent = labels.get(option.value) ?? option.value;
    }
    select.value = selected;
  }
}


function correctionPositionOptions(selected) {
  const current = Number(selected);
  return [1, 2, 3].map((slot) => (
    `<option value="${slot}"${slot === current ? " selected" : ""}>Position ${slot}</option>`
  )).join("");
}

function renderSeasonCorrection() {
  if (!elements.correctionPlayerSetup) return;
  if (!currentSeason) {
    if (elements.correctionTeamSetup) elements.correctionTeamSetup.innerHTML = "";
    elements.correctionPlayerSetup.innerHTML = "";
    return;
  }

  if (elements.correctionTeamSetup) elements.correctionTeamSetup.innerHTML = "";
  const rows = players
    .map((player) => ({ player, assignment: playerAssignmentAtClient(player, 1) }))
    .sort((a, b) => {
      const teamOrderA = teams.findIndex((team) => team.id === a.assignment.teamId);
      const teamOrderB = teams.findIndex((team) => team.id === b.assignment.teamId);
      return teamOrderA - teamOrderB
        || Number(a.assignment.rosterSlot) - Number(b.assignment.rosterSlot)
        || Number(a.player.order ?? 999) - Number(b.player.order ?? 999);
    });

  elements.correctionPlayerSetup.innerHTML = `<table class="setup-table correction-player-table position-correction-table">
    <thead><tr><th class="left">Team</th><th class="left">Spieler</th><th>Aktuell</th><th>Neue Position</th></tr></thead>
    <tbody>${rows.map(({ player, assignment }) => `<tr data-player-id="${escapeHtml(player.id)}" data-team-id="${escapeHtml(assignment.teamId)}">
      <td class="left"><strong>${escapeHtml(teamName(assignment.teamId))}</strong></td>
      <td class="left">${escapeHtml(player.name)}</td>
      <td><span class="badge">Position ${Number(assignment.rosterSlot)}</span></td>
      <td><select class="correction-player-position" aria-label="Neue Position für ${escapeHtml(player.name)}">${correctionPositionOptions(assignment.rosterSlot)}</select></td>
    </tr>`).join("")}</tbody>
  </table>`;

  elements.correctSeasonButton.disabled = isBusy || !currentSeason;
}

function readSeasonCorrection() {
  const correctionPlayers = [...elements.correctionPlayerSetup.querySelectorAll("tr[data-player-id]")].map((row) => ({
    id: row.dataset.playerId,
    rosterSlot: Number(row.querySelector(".correction-player-position")?.value),
  }));
  return { players: correctionPlayers };
}

function syncPreviousAverageForPlayerRow(row, { autoCarry = true } = {}) {
  const nameInput = row.querySelector(".player-name");
  const averageCell = row.querySelector(".previous-average-value");
  const carryCheckbox = row.querySelector(".carry-average");
  if (!nameInput || !averageCell || !carryCheckbox) return;

  const match = previousAverageByName.get(normalizePlayerNameKey(nameInput.value)) ?? null;
  averageCell.textContent = formatAverage(match?.average ?? null);
  averageCell.title = match ? `Vorsaison: ${match.name}` : "Kein passender Spieler in der Vorsaison gefunden";
  row.dataset.previousPlayerId = match?.playerId ?? "";

  const editable = !nameInput.disabled;
  carryCheckbox.disabled = !editable || !match;
  if (autoCarry) carryCheckbox.checked = Boolean(match);
  if (!match) carryCheckbox.checked = false;
}

function renderPairings(pairings = []) {
  elements.pairings.innerHTML = "";
  const editable = Number(currentSeason?.currentPublishedMatchday ?? 0) === 0
    && currentSeason?.scheduleStatus !== "configured";
  const lanePairs = currentLanePairs();
  const dummyTeamId = currentDummyTeamId();
  for (let index = 0; index < lanePairs.length; index += 1) {
    const pairing = pairings[index] ?? {};
    const row = document.createElement("div");
    row.className = "pairing pairing-with-lane";
    row.dataset.pairingIndex = String(index);
    const tenTeamSeason = teams.length === 10;
    const homeOptions = teamOptions(pairing.homeTeamId, !tenTeamSeason);
    const awayOptions = tenTeamSeason && index === 4
      ? `<option value="${escapeHtml(dummyTeamId)}" selected>${escapeHtml(teams.find((team) => team.id === dummyTeamId)?.name ?? "DummyTeam")}</option>`
      : teamOptions(pairing.awayTeamId, !tenTeamSeason);
    row.innerHTML = `
      <span class="lane-badge">Bahn ${lanePairs[index]}</span>
      <select class="home-team" aria-label="Team auf Bahn ${lanePairs[index]}" ${editable ? "" : "disabled"}>${homeOptions}</select>
      <strong>gegen</strong>
      <select class="away-team" aria-label="Gegner auf Bahn ${lanePairs[index]}" ${editable && !(tenTeamSeason && index === 4) ? "" : "disabled"}>${awayOptions}</select>
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

  const matchdayNumber = Number(elements.matchdayNumber.value || (Number(currentSeason?.currentPublishedMatchday ?? 0) + 1) || 1);
  const playersByTeam = new Map(teams.map((team) => [team.id, []]));
  for (const player of players) {
    const assignment = playerAssignmentAtClient(player, matchdayNumber);
    const roster = playersByTeam.get(assignment.teamId) ?? [];
    roster.push({ ...player, effectiveRosterSlot: assignment.rosterSlot });
    playersByTeam.set(assignment.teamId, roster);
  }

  elements.scoreGrid.innerHTML = teams.filter((team) => !isDummyTeam(team)).map((team) => {
    const roster = (playersByTeam.get(team.id) ?? []).sort((a, b) => Number(a.effectiveRosterSlot) - Number(b.effectiveRosterSlot));
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
              <span class="score-player-meta">Position ${Number(player.effectiveRosterSlot ?? player.rosterSlot)} · Ersatz ${Number(player.replacementScore)}</span>
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
      <thead><tr><th>Team-ID</th><th class="left">Teamname</th></tr></thead>
      <tbody>${teams.map((team) => `
        <tr data-team-id="${escapeHtml(team.id)}">
          <td><code>${escapeHtml(team.id)}</code>${isDummyTeam(team) ? ' <span class="badge">Dummy</span>' : ""}</td>
          <td><input class="team-name" value="${escapeHtml(team.name)}" ${editable && !isDummyTeam(team) ? "" : "disabled"}>${isDummyTeam(team) ? '<small class="muted"> feste Vorgabe: 160 · 150 · 140</small>' : ""}</td>
        </tr>
      `).join("")}</tbody>
    </table>
  `;

  const previousPlayerSuggestions = [...previousSeasonPlayers]
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((player) => `<option value="${escapeHtml(player.name)}">Ø ${formatAverage(player.average)}</option>`)
    .join("");

  elements.playerSetup.innerHTML = `
    <table class="setup-table player-setup-table">
      <thead><tr>
        <th class="left">Spieler</th><th>Team</th><th>Position</th><th>Finaler Ø Vorsaison</th><th>Vorsaison übernehmen</th><th>Aktiv</th>
      </tr></thead>
      <tbody>${players.map((player) => {
        const previousMatch = previousAverageByName.get(normalizePlayerNameKey(player.name)) ?? null;
        const carriedAverage = previousMatch?.average ?? player.carriedAverage ?? player.previousSeasonAverage ?? null;
        const carryChecked = carriedAverage !== null && player.carryPreviousAverage !== false && player.previousSeasonAverage !== null;
        const displayMatchday = editable ? 1 : Math.min(currentMatchdayCount(), Math.max(1, Number(currentSeason?.currentPublishedMatchday ?? 0) + 1));
        const displayAssignment = playerAssignmentAtClient(player, displayMatchday);
        return `
          <tr data-player-id="${escapeHtml(player.id)}" data-previous-player-id="${escapeHtml(previousMatch?.playerId ?? "")}">
            <td><input class="player-name" list="previousPlayerNames" value="${escapeHtml(player.name)}" ${editable ? "" : "disabled"}></td>
            <td><select class="player-team" ${editable ? "" : "disabled"}>${seasonSetupTeamOptions(displayAssignment.teamId)}</select></td>
            <td><select class="player-slot" ${editable ? "" : "disabled"}>
              ${[1, 2, 3].map((slot) => `<option value="${slot}"${Number(displayAssignment.rosterSlot) === slot ? " selected" : ""}>${slot}</option>`).join("")}
            </select></td>
            <td><span class="previous-average-value" title="${previousMatch ? `Vorsaison: ${escapeHtml(previousMatch.name)}` : "Kein passender Spieler in der Vorsaison gefunden"}">${formatAverage(carriedAverage)}</span></td>
            <td><input class="carry-average checkbox" type="checkbox" ${carryChecked ? "checked" : ""} ${carriedAverage === null || !editable ? "disabled" : ""}></td>
            <td><input class="player-active checkbox" type="checkbox" ${player.active !== false ? "checked" : ""} ${editable ? "" : "disabled"}></td>
          </tr>
        `;
      }).join("")}</tbody>
    </table>
    <datalist id="previousPlayerNames">${previousPlayerSuggestions}</datalist>
  `;

  if (editable) {
    for (const input of elements.teamSetup.querySelectorAll(".team-name")) {
      input.addEventListener("input", refreshSeasonSetupTeamLabels);
      input.addEventListener("change", refreshSeasonSetupTeamLabels);
    }
    for (const input of elements.playerSetup.querySelectorAll(".player-name")) {
      const row = input.closest("tr[data-player-id]");
      input.addEventListener("input", () => syncPreviousAverageForPlayerRow(row, { autoCarry: true }));
      input.addEventListener("change", () => syncPreviousAverageForPlayerRow(row, { autoCarry: true }));
    }
  }

  refreshSeasonSetupTeamLabels();
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
  const dummyTeamId = currentDummyTeamId();
  const publishedThrough = Number(currentSeason.currentPublishedMatchday ?? 0);
  const automaticLaneSeason = teams.length === 10;
  elements.scheduleEditor.innerHTML = ordered.map((matchday) => {
    const lanePairs = currentLanePairs();
    const pairings = lanePairs.map((lanePair, index) => ({
      lanePair,
      ...(matchday.pairings?.[index] ?? {}),
    }));
    return `<section class="schedule-day${Number(matchday.number) === 1 ? " schedule-day-first" : ""}" data-matchday-number="${Number(matchday.number)}" data-matchday-id="${escapeHtml(matchday.id)}">
      <div class="schedule-day-head">
        <div><h3>Spieltag ${Number(matchday.number)}</h3>${Number(matchday.number) === 1 && teams.length === 10 ? '<small class="schedule-first-hint">Diesen Spieltag frei festlegen</small>' : ""}</div>
        <label>Datum
          <input class="schedule-date" type="date" value="${escapeHtml(matchday.date ?? "")}">
        </label>
      </div>
      <div class="schedule-pairings">
        ${pairings.map((pairing, index) => {
          const tenTeamSeason = teams.length === 10;
          const teamAssignmentsEditable = automaticLaneSeason
            ? publishedThrough === 0 && Number(matchday.number) === 1
            : Number(matchday.number) > publishedThrough;
          const homeOptions = teamOptions(pairing.homeTeamId, !tenTeamSeason);
          const awayOptions = tenTeamSeason && index === 4
            ? `<option value="${escapeHtml(dummyTeamId)}" selected>${escapeHtml(teams.find((team) => team.id === dummyTeamId)?.name ?? "DummyTeam")}</option>`
            : teamOptions(pairing.awayTeamId, !tenTeamSeason);
          return `<div class="schedule-pairing" data-pairing-index="${index}">
            <span class="lane-badge${tenTeamSeason && index === 4 ? " dummy-lane" : ""}">Bahn ${escapeHtml(pairing.lanePair)}</span>
            <select class="schedule-home" aria-label="Spieltag ${Number(matchday.number)}, Bahn ${escapeHtml(pairing.lanePair)}, Team 1" ${teamAssignmentsEditable ? "" : "disabled"}>${homeOptions}</select>
            <strong>gegen</strong>
            <select class="schedule-away" aria-label="Spieltag ${Number(matchday.number)}, Bahn ${escapeHtml(pairing.lanePair)}, Team 2" ${teamAssignmentsEditable && !(tenTeamSeason && index === 4) ? "" : "disabled"}>${awayOptions}</select>
          </div>`;
        }).join("")}
      </div>
    </section>`;
  }).join("");

  if (publishedThrough > 0) {
    for (const day of elements.scheduleEditor.querySelectorAll("[data-matchday-number]")) {
      const number = Number(day.dataset.matchdayNumber);
      if (number <= publishedThrough) {
        day.querySelector(".schedule-date").disabled = true;
      }
    }
    showStatus(elements.scheduleStatus,
      `Spieltag 1 bis ${publishedThrough} ist bereits veröffentlicht. Deren Datum und Gegner sind geschützt.`);
  } else if (currentSeason.scheduleStatus === "configured") {
    showStatus(elements.scheduleStatus, "Der Spielplan ist öffentlich. Änderungen werden erst nach erneutem Speichern sichtbar.", "success");
  } else {
    hideStatus(elements.scheduleStatus);
  }
}

function readSeasonSchedule() {
  const lanePairs = currentLanePairs();
  return [...elements.scheduleEditor.querySelectorAll("[data-matchday-number]")].map((day) => ({
    id: day.dataset.matchdayId,
    number: Number(day.dataset.matchdayNumber),
    date: day.querySelector(".schedule-date").value,
    pairings: [...day.querySelectorAll("[data-pairing-index]")].map((row, index) => ({
      lanePair: lanePairs[index],
      homeTeamId: row.querySelector(".schedule-home").value,
      awayTeamId: row.querySelector(".schedule-away").value,
    })),
  }));
}

function validateScheduleClient(schedule) {
  const matchdayCount = currentMatchdayCount();
  const lanePairs = currentLanePairs();
  if (schedule.length !== matchdayCount) throw new Error(`Der Spielplan muss ${matchdayCount} Spieltage enthalten.`);
  const pairCounts = new Map();
  let previousDate = "";
  for (const day of schedule) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) throw new Error(`Spieltag ${day.number}: Datum fehlt.`);
    if (previousDate && day.date <= previousDate) throw new Error(`Spieltag ${day.number}: Termine müssen chronologisch aufsteigend sein.`);
    previousDate = day.date;
    if (day.pairings.length !== lanePairs.length) throw new Error(`Spieltag ${day.number}: ${lanePairs.length} Paarungen werden benötigt.`);
    const selected = day.pairings.flatMap((pairing) => [pairing.homeTeamId, pairing.awayTeamId]);
    if (selected.some((teamId) => !teamId)) throw new Error(`Spieltag ${day.number}: Alle Bahnpaarungen müssen vollständig sein.`);
    if (new Set(selected).size !== teams.length) throw new Error(`Spieltag ${day.number}: Jedes der ${teams.length} Teams muss genau einmal vorkommen.`);
    if (teams.length === 10) {
      const dummyPairing = day.pairings[4];
      const dummyTeamId = currentDummyTeamId();
      if (dummyPairing.awayTeamId !== dummyTeamId) {
        throw new Error(`Spieltag ${day.number}: DummyTeam muss in der Begegnung auf Bahn 9+10 stehen.`);
      }
    }
    for (const pairing of day.pairings) {
      if (pairing.homeTeamId === pairing.awayTeamId) throw new Error(`Spieltag ${day.number}: Ein Team kann nicht gegen sich selbst spielen.`);
      const key = [pairing.homeTeamId, pairing.awayTeamId].sort().join("|");
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }
  }
  const expectedPairs = teams.length * (teams.length - 1) / 2;
  if (pairCounts.size !== expectedPairs || [...pairCounts.values()].some((count) => count !== 2)) {
    throw new Error(`Über ${matchdayCount} Spieltage muss jede mögliche Teampaarung genau zweimal vorkommen.`);
  }
  if (teams.length === 10 && currentSeason?.rulesVersion === "10-teams-dummy-v4") {
    validateBalancedPairRotationClient(schedule);
  }
  return schedule;
}

function validateBalancedPairRotationClient(schedule) {
  const dummyTeamId = currentDummyTeamId();
  const realTeams = teams.filter((team) => !isDummyTeam(team));
  const pairsByTeam = new Map(realTeams.map((team) => [team.id, []]));
  const ordered = [...schedule].sort((a, b) => a.number - b.number);

  for (const day of ordered.slice(0, 9)) {
    day.pairings.forEach((pairing, index) => {
      if (pairing.homeTeamId !== dummyTeamId) pairsByTeam.get(pairing.homeTeamId)?.push(index);
      if (pairing.awayTeamId !== dummyTeamId) pairsByTeam.get(pairing.awayTeamId)?.push(index);
    });
  }

  for (const team of realTeams) {
    const pairIndexes = pairsByTeam.get(team.id) ?? [];
    const counts = [0, 0, 0, 0, 0];
    pairIndexes.forEach((index) => { counts[index] += 1; });
    if (pairIndexes.length !== 9 || counts[0] !== 2 || counts[1] !== 2 || counts[2] !== 2 || counts[3] !== 2 || counts[4] !== 1) {
      throw new Error(`${team.name}: In Spieltag 1 bis 9 müssen die Bahnpaare 1+2, 3+4, 5+6 und 7+8 jeweils zweimal sowie 9+10 einmal vorkommen.`);
    }
    for (let index = 1; index < pairIndexes.length; index += 1) {
      if (pairIndexes[index] === pairIndexes[index - 1]) {
        throw new Error(`${team.name}: Zwei aufeinanderfolgende Spieltage auf demselben Bahnpaar sind nicht erlaubt.`);
      }
    }
  }

  for (let round = 0; round < 9; round += 1) {
    const first = ordered[round];
    const repeat = ordered[round + 9];
    for (let index = 0; index < 5; index += 1) {
      if (first.pairings[index].homeTeamId !== repeat.pairings[index].homeTeamId
        || first.pairings[index].awayTeamId !== repeat.pairings[index].awayTeamId) {
        throw new Error(`Spieltag ${round + 10} muss Spieltag ${round + 1} inklusive Bahnpaar wiederholen.`);
      }
    }
  }
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

async function checkDeployment() {
  if (elements.frontendVersion) elements.frontendVersion.textContent = ADMIN_VERSION;
  if (elements.backendVersion) elements.backendVersion.textContent = "wird geprüft …";
  hideStatus(elements.deployStatus);
  try {
    const deploymentInfo = httpsCallable(functions, "adminDeploymentInfo");
    const response = await deploymentInfo();
    const data = response.data ?? {};
    const correct = data.version === ADMIN_VERSION
      && Number(data.targetTeamCount) === 10
      && Number(data.matchdayCount) === 18
      && data.dummyTeamId === DUMMY_TEAM_ID
      && data.scheduleGenerator === "balanced-lane-pairs-v2"
      && data.rosterTransfers === "effective-matchday-swap-v1";
    if (elements.backendVersion) {
      elements.backendVersion.textContent = correct
        ? `${data.version} · 10 Teams · 18 Spieltage`
        : `${data.version ?? "unbekannt"} · ${data.targetTeamCount ?? "?"} Teams · ${data.matchdayCount ?? "?"} Spieltage`;
    }
    showStatus(
      elements.deployStatus,
      correct
        ? "Frontend und Functions sind auf Phase 15.12. Kaderwechsel und rückwirkende Positionsänderungen werden historisch korrekt berücksichtigt."
        : "Frontend ist neu, aber die Functions sind nicht auf dem erwarteten Stand. Bitte 2_DEPLOYEN.bat erneut ausführen und auf den Abschnitt FUNCTIONS achten.",
      correct ? "success" : "error",
    );
    return correct;
  } catch (error) {
    if (elements.backendVersion) elements.backendVersion.textContent = "ALT / nicht erreichbar";
    showStatus(
      elements.deployStatus,
      `Die neue Diagnose-Function ist nicht erreichbar. Damit läuft sehr wahrscheinlich noch das alte Functions-Deployment. ${error?.message ?? ""}`.trim(),
      "error",
    );
    return false;
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

async function generateScheduleFromFirstMatchday() {
  if (!currentSeason || teams.length !== 10) {
    showStatus(elements.scheduleGeneratorStatus, "Die Automatik ist für die 10-Team-Liga vorgesehen.", "error");
    return;
  }
  if (Number(currentSeason.currentPublishedMatchday ?? 0) > 0) {
    showStatus(elements.scheduleGeneratorStatus, "Nach der ersten Ergebnisveröffentlichung kann der komplette Spielplan nicht mehr neu erzeugt werden.", "error");
    return;
  }

  const firstDay = elements.scheduleEditor.querySelector('[data-matchday-number="1"]');
  if (!firstDay) {
    showStatus(elements.scheduleGeneratorStatus, "Spieltag 1 wurde nicht gefunden.", "error");
    return;
  }

  const firstMatchdayDate = firstDay.querySelector(".schedule-date")?.value ?? "";
  const lanePairs = currentLanePairs();
  const firstRoundPairings = [...firstDay.querySelectorAll("[data-pairing-index]")].map((row, index) => ({
    lanePair: lanePairs[index],
    homeTeamId: row.querySelector(".schedule-home").value,
    awayTeamId: row.querySelector(".schedule-away").value,
  }));

  const selectedRealTeams = firstRoundPairings.flatMap((pairing) => [pairing.homeTeamId, pairing.awayTeamId])
    .filter((teamId) => teamId && teamId !== currentDummyTeamId());
  if (selectedRealTeams.length !== 9 || new Set(selectedRealTeams).size !== 9) {
    showStatus(elements.scheduleGeneratorStatus, "Spieltag 1 muss alle neun echten Teams genau einmal enthalten; DummyTeam ist fest auf Bahn 9+10.", "error");
    return;
  }
  if (firstRoundPairings[4]?.awayTeamId !== currentDummyTeamId()) {
    showStatus(elements.scheduleGeneratorStatus, "DummyTeam muss fest in der Begegnung auf Bahn 9+10 stehen.", "error");
    return;
  }

  setBusy(true);
  showStatus(elements.scheduleGeneratorStatus, "Spielplan wird aus den Begegnungen und Bahnpaaren von Spieltag 1 berechnet …");
  try {
    const generateSchedule = httpsCallable(functions, "generateSeasonSchedule");
    const response = await generateSchedule({
      seasonId: currentSeasonId,
      firstMatchdayDate,
      firstRoundPairings,
    });
    const generated = Array.isArray(response.data?.schedule) ? response.data.schedule : [];
    if (generated.length !== 18) throw new Error("Die Functions haben keinen vollständigen 18-Spieltage-Spielplan zurückgegeben.");

    const generatedByNumber = new Map(generated.map((day) => [Number(day.number), day]));
    matchdays = matchdays.map((day) => {
      const replacement = generatedByNumber.get(Number(day.number));
      return replacement ? { ...day, date: replacement.date, pairings: replacement.pairings } : day;
    });
    renderSeasonSchedule();
    showStatus(
      elements.scheduleGeneratorStatus,
      "Spielplan erstellt: In Spieltag 1–9 spielt jedes echte Team auf 1+2, 3+4, 5+6 und 7+8 jeweils zweimal sowie einmal auf 9+10. Kein Team hat an zwei aufeinanderfolgenden Spieltagen dasselbe Bahnpaar. Spieltag 10–18 wiederholt die ersten neun Spieltage. Noch nicht gespeichert – anschließend bitte „Spielplan prüfen und veröffentlichen“ wählen.",
      "success",
    );
  } catch (error) {
    showStatus(elements.scheduleGeneratorStatus, error?.message ?? String(error), "error");
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
      `${response.data.matchdays} Spieltage mit ${response.data.lanePairs} Bahnpaarungen wurden gespeichert und auf spielplan.html veröffentlicht.${response.data.balancedLaneSchedule ? " Bahnpaarrotation geprüft und als neue Regel aktiviert." : ""}`,
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
  const lanePairs = currentLanePairs();
  return [...elements.pairings.querySelectorAll("[data-pairing-index]")].map((row, index) => ({
    lanePair: lanePairs[index],
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
  if (!Number.isInteger(number) || number < 1 || number > currentMatchdayCount()) throw new Error("Ungültige Spieltagsnummer.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Bitte ein Datum wählen.");

  const selectedTeams = pairings.flatMap((pairing) => [pairing.homeTeamId, pairing.awayTeamId]);
  if (selectedTeams.some((teamId) => !teamId)) throw new Error(`Alle ${currentLanePairs().length} Paarungen müssen vollständig sein.`);
  if (new Set(selectedTeams).size !== selectedTeams.length) throw new Error("Jedes Team darf pro Spieltag nur einmal vorkommen.");
  if (selectedTeams.length !== teams.length) throw new Error(`Alle ${teams.length} Teams müssen genau einmal angesetzt sein.`);
  if (teams.length === 10) {
    const dummyPairing = pairings[4];
    const dummyTeamId = currentDummyTeamId();
    if (dummyPairing?.awayTeamId !== dummyTeamId) {
      throw new Error("DummyTeam muss in der Begegnung auf Bahn 9+10 stehen.");
    }
  }

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

  if (isResultsEditor()) {
    const configSnapshot = await getDoc(doc(db, "publicConfig", "current"));
    const activeSeasonId = configSnapshot.data()?.activeSeasonId;
    seasons = seasons.filter((season) => season.id === activeSeasonId);
  }

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
    if (isFullAdmin()) await loadPreviousSeasonPlayerLookup();

    elements.seasonSummary.textContent = `${currentSeason.name ?? currentSeason.id} · ${teams.length} Teams · ${currentMatchdayCount()} Spieltage · Status ${currentSeason.status ?? "–"} · veröffentlicht bis Spieltag ${currentSeason.currentPublishedMatchday ?? 0}`;
    elements.matchdayNumber.max = String(currentMatchdayCount());
    if (teams.length === 10 && (Number(currentSeason.matchdayCount ?? 0) !== 18 || matchdays.length !== 18)) {
      showStatus(elements.seasonStatus, "Diese 10-Team-Saison wurde noch mit der alten 14-Spieltage-Struktur angelegt. Wenn es die Testsaison ist: unter System löschen und anschließend neu anlegen.", "error");
    } else {
      hideStatus(elements.seasonStatus);
    }
    elements.sourceSeasonName.value = currentSeason.name ?? currentSeason.id;
    elements.createSeasonButton.disabled = Number(currentSeason.currentPublishedMatchday ?? 0) < currentMatchdayCount();
    if (isFullAdmin()) {
      renderSeasonSetup();
      renderSeasonCorrection();
      renderSeasonSchedule();
      renderRosterTransferPanel();
    }

    const publishedThrough = Number(currentSeason.currentPublishedMatchday ?? 0);
    const selectableMatchdays = isResultsEditor()
      ? matchdays.filter((matchday) => Number(matchday.number) === publishedThrough + 1)
      : matchdays;
    elements.matchdaySelect.innerHTML = selectableMatchdays.map((matchday) => (
      `<option value="${matchday.id}">Spieltag ${matchday.number} · ${matchday.date}</option>`
    )).join("");

    if (selectableMatchdays.length) {
      const seasonMatchdays = currentMatchdayCount();
      const preferredNumber = publishedThrough >= seasonMatchdays ? seasonMatchdays : Math.max(1, publishedThrough + 1);
      const preferred = selectableMatchdays.find((matchday) => Number(matchday.number) === preferredNumber) ?? selectableMatchdays[0];
      elements.matchdaySelect.value = preferred.id;
      await loadMatchday(preferred.id);
    } else {
      renderPairings();
      renderScoreGrid({});
    }

    if (isFullAdmin()) {
      suggestNextSeason();
      await loadPublicationHistory();
    }
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

async function activateSelectedSeason() {
  if (!currentSeasonId) return;
  const seasonName = currentSeason?.name ?? currentSeasonId;
  const confirmed = window.confirm(`Soll ${seasonName} (${currentSeasonId}) wirklich als öffentliche Ergebnissaison gesetzt werden?`);
  if (!confirmed) return;

  setBusy(true);
  showStatus(elements.activateSeasonStatus, `Öffentliche Ergebnissaison wird auf ${currentSeasonId} umgestellt …`);
  try {
    const activateSeason = httpsCallable(functions, "activatePublicSeason");
    const response = await activateSeason({ seasonId: currentSeasonId });
    showStatus(
      elements.activateSeasonStatus,
      `${response.data.seasonName ?? currentSeasonId} ist jetzt die aktive Ergebnissaison (Stand Spieltag ${response.data.currentMatchday}).`,
      "success",
    );
  } catch (error) {
    showStatus(elements.activateSeasonStatus, error?.message ?? String(error), "error");
  } finally {
    setBusy(false);
  }
}

async function deleteSelectedSeason() {
  if (!currentSeasonId || !currentSeason) return;
  const seasonLabel = currentSeason.name ?? currentSeasonId;
  const confirmation = window.prompt(
    `Saison „${seasonLabel}“ wirklich vollständig löschen?\n\nZum Bestätigen bitte die Saison-ID eingeben: ${currentSeasonId}`,
    "",
  );
  if (confirmation === null) return;
  if (confirmation.trim().toLowerCase() !== currentSeasonId.toLowerCase()) {
    showStatus(elements.deleteSeasonStatus, "Abgebrochen: Die eingegebene Saison-ID stimmt nicht überein.", "error");
    return;
  }

  setBusy(true);
  showStatus(elements.deleteSeasonStatus, `Saison ${currentSeasonId} wird vollständig gelöscht …`);
  try {
    const deleteSeason = httpsCallable(functions, "deleteSeason");
    const response = await deleteSeason({ seasonId: currentSeasonId, confirmation });
    const deletedSeasonId = response.data.seasonId;
    currentSeasonId = "";
    currentSeason = null;
    teams = [];
    players = [];
    matchdays = [];
    await refreshSeasonList();
    showStatus(elements.seasonStatus, `Saison ${deletedSeasonId} wurde vollständig gelöscht.`, "success");
    activateWorkspace("season");
  } catch (error) {
    showStatus(elements.deleteSeasonStatus, error?.message ?? String(error), "error");
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
    if (Number(response.data?.teams) !== 10 || Number(response.data?.matchdays) !== 18) {
      throw new Error(`Die aufgerufene Cloud Function ist noch veraltet: zurückgegeben wurden ${response.data?.teams ?? "?"} Teams und ${response.data?.matchdays ?? "?"} Spieltage statt 10/18. Bitte zuerst das Functions-Deployment aktualisieren. Die gerade erzeugte Testsaison anschließend löschen und neu anlegen.`);
    }
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


async function correctCurrentSeasonData() {
  const correctionNote = elements.correctionNote?.value?.trim() ?? "";
  if (correctionNote.length < 5) {
    showStatus(elements.correctionStatus, "Bitte eine kurze Begründung mit mindestens fünf Zeichen angeben.", "error");
    return;
  }
  const correction = readSeasonCorrection();
  const publishedThrough = Number(currentSeason?.currentPublishedMatchday ?? 0);
  const warning = publishedThrough > 0
    ? `Die neuen Spielerpositionen gelten rückwirkend ab Spieltag 1 und berechnen alle veröffentlichten Ergebnisse bis Spieltag ${publishedThrough} neu. Namen und Teamzugehörigkeiten bleiben unverändert. Fortfahren?`
    : "Die neuen Spielerpositionen gelten rückwirkend ab Spieltag 1. Namen und Teamzugehörigkeiten bleiben unverändert. Fortfahren?";
  if (!window.confirm(warning)) return;

  setBusy(true);
  showStatus(elements.correctionStatus, "Spielerpositionen werden geprüft und rückwirkend neu berechnet …");
  try {
    const correctData = httpsCallable(functions, "correctSeasonData");
    const response = await correctData({
      seasonId: currentSeasonId,
      correctionNote,
      ...correction,
    });
    const recalculated = response.data?.recalculated
      ? ` Veröffentlichte Ergebnisse bis Spieltag ${response.data.throughMatchday} wurden neu berechnet.`
      : " Es gab noch keine veröffentlichten Ergebnisse.";
    showStatus(elements.correctionStatus, `${response.data.players} Spielerpositionen wurden gespeichert.${recalculated}`, "success");
    elements.correctionNote.value = "";
    await refreshSeasonData();
  } catch (error) {
    showStatus(elements.correctionStatus, error?.message ?? String(error), "error");
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

async function clearBowlingLeaderboard() {
  const confirmation = window.prompt("Beide Minispiel-Ranglisten (Classic und Strike Rush) vollständig leeren? Zum Bestätigen LEEREN eingeben:");
  if (confirmation === null) return;
  if (confirmation.trim().toUpperCase() !== "LEEREN") {
    showStatus(elements.clearLeaderboardStatus, "Nicht gelöscht: Bestätigung war nicht LEEREN.", "error");
    return;
  }
  setBusy(true);
  showStatus(elements.clearLeaderboardStatus, "Minispiel-Ranglisten werden gelöscht …");
  try {
    const clearLeaderboard = httpsCallable(functions, "clearBowlingLeaderboard");
    await clearLeaderboard({ confirmation: "LEEREN" });
    showStatus(elements.clearLeaderboardStatus, "Classic und Strike Rush wurden vollständig geleert.", "success");
  } catch (error) {
    showStatus(elements.clearLeaderboardStatus, error?.message ?? String(error), "error");
  } finally {
    setBusy(false);
  }
}

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
elements.checkDeploymentButton?.addEventListener("click", checkDeployment);
elements.rebuildPublicButton.addEventListener("click", rebuildPublicStatistics);
elements.activateSeasonButton?.addEventListener("click", activateSelectedSeason);
elements.deleteSeasonButton.addEventListener("click", deleteSelectedSeason);
elements.clearLeaderboardButton?.addEventListener("click", clearBowlingLeaderboard);
elements.refreshButton.addEventListener("click", () => refreshSeasonList(currentSeasonId));
elements.createSeasonButton.addEventListener("click", createNextSeason);
elements.saveSetupButton.addEventListener("click", saveSeasonSetup);
elements.correctSeasonButton?.addEventListener("click", correctCurrentSeasonData);
elements.transferPlayerButton?.addEventListener("click", transferPlayerBetweenTeams);
elements.transferMatchday?.addEventListener("change", renderRosterTransferPanel);
elements.transferPlayer?.addEventListener("change", renderRosterTransferPanel);
elements.transferTargetTeam?.addEventListener("change", updateTransferPreview);
elements.generateScheduleButton?.addEventListener("click", generateScheduleFromFirstMatchday);
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
  currentAdminRole = "none";
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
    const adminData = adminSnapshot.exists() ? adminSnapshot.data() : null;
    currentAdmin = Boolean(adminData?.active === true);
    currentAdminRole = currentAdmin ? (adminData?.role === "results" ? "results" : "admin") : "none";
  } catch (error) {
    currentAdmin = false;
    currentAdminRole = "none";
  }

  if (!currentAdmin) {
    showStatus(elements.adminStatus, "Angemeldet, aber nicht als Admin freigeschaltet.", "error");
    elements.bootstrapPanel.classList.remove("hidden");
    elements.securedArea.classList.add("hidden");
    return;
  }

  const roleLabel = isResultsEditor() ? "Ergebniseingabe" : "Administrator";
  elements.accountInfo.textContent = `${user.email ?? "Konto"} · ${roleLabel}`;
  showStatus(elements.adminStatus, isResultsEditor() ? "Zugriff auf aktuelle Ergebniseingabe aktiv." : "Administratorzugriff aktiv.", "success");
  elements.bootstrapPanel.classList.add("hidden");
  elements.securedArea.classList.remove("hidden");
  applyRoleUi();
  await checkDeployment();
  await refreshSeasonList(currentSeasonId);
});
