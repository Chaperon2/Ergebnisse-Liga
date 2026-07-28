import { loadPublicResults, requestedSeasonId, watchLoader } from "./public-api.js";

export { requestedSeasonId };

export function watchPublicResults({ onData, onError, onSeasonChange, onStatus } = {}) {
  const requested = requestedSeasonId();
  return watchLoader(
    () => loadPublicResults(requested),
    {
      onData: (data, meta) => {
        onStatus?.(meta);
        onData?.(data, meta.seasonId, meta);
      },
      onError,
      onSeasonChange,
    },
  );
}

export function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "–";
  return Number(value).toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatInteger(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "–";
  return Number(value).toLocaleString("de-DE", { maximumFractionDigits: 0 });
}

export function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return String(value ?? "–");
  return new Date(`${value}T12:00:00`).toLocaleDateString("de-DE");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
