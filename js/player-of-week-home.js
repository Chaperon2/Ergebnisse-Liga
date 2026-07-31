import { watchPublicResults } from "./public-data.js";
import { playerOfWeekMarkup, calculatePlayerOfWeek } from "./player-of-week.js?v=12.4";

const desktopHost = document.getElementById("playerWeekHomeDesktop");
const mobileHost = document.getElementById("playerWeekHomeMobile");

function showLoading() {
  const markup = playerOfWeekMarkup(null, { compact: true, fused: true, context: "home" });
  if (desktopHost) desktopHost.innerHTML = markup;
  if (mobileHost) mobileHost.innerHTML = markup;
}

function render(data) {
  const award = calculatePlayerOfWeek(data);
  const markup = playerOfWeekMarkup(award, { compact: true, fused: true, context: "home" });
  if (desktopHost) desktopHost.innerHTML = markup;
  if (mobileHost) mobileHost.innerHTML = markup;
}

function showError(message) {
  const text = String(message ?? "Auszeichnung konnte nicht geladen werden.");
  for (const host of [desktopHost, mobileHost]) {
    if (!host) continue;
    host.innerHTML = '<section class="player-week-card is-empty is-compact is-fused is-home"><div class="pow-loading"><i class="fa-solid fa-triangle-exclamation"></i><span></span></div></section>';
    host.querySelector(".pow-loading span").textContent = text;
  }
}

showLoading();
watchPublicResults({ onData: render, onError: showError });
