import { watchPublicResults } from "./public-data.js";
import { playerOfWeekMarkup, calculatePlayerOfWeek } from "./player-of-week.js?v=12.5";

const desktopHost = document.getElementById("playerWeekHomeDesktop");
const mobileHost = document.getElementById("playerWeekHomeMobile");

const heading = {
  eyebrow: "Liga-Terminal online",
  title: "Strikeclub",
  accent: "Velten",
  description: "Aktuelle Auszeichnung des zuletzt veröffentlichten Spieltags.",
};

const actions = [
  {
    href: "aktuelle_ergebnisse.html",
    icon: "fa-solid fa-chart-column",
    label: "Aktuelle Ergebnisse",
  },
  {
    href: "spielplan.html",
    icon: "fa-solid fa-calendar-days",
    label: "Zum Spielplan",
    className: "schedule",
  },
];

function options() {
  return { compact: true, context: "home", heading, actions };
}

function showLoading() {
  const markup = playerOfWeekMarkup(null, options());
  if (desktopHost) desktopHost.innerHTML = markup;
  if (mobileHost) mobileHost.innerHTML = markup;
}

function render(data) {
  const award = calculatePlayerOfWeek(data);
  const markup = playerOfWeekMarkup(award, options());
  if (desktopHost) desktopHost.innerHTML = markup;
  if (mobileHost) mobileHost.innerHTML = markup;
}

function showError(message) {
  const text = String(message ?? "Auszeichnung konnte nicht geladen werden.");
  for (const host of [desktopHost, mobileHost]) {
    if (!host) continue;
    host.innerHTML = playerOfWeekMarkup(null, options());
    const label = host.querySelector(".pow-loading span");
    const icon = host.querySelector(".pow-loading i");
    if (label) label.textContent = text;
    if (icon) icon.className = "fa-solid fa-triangle-exclamation";
  }
}

showLoading();
watchPublicResults({ onData: render, onError: showError });
