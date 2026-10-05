const TEAM_COLOR_CLASSES = [
  "team-color-1",
  "team-color-2",
  "team-color-3",
  "team-color-4",
  "team-color-5",
  "team-color-6",
  "team-color-7",
  "team-color-8",
  "team-color-9",
  "team-color-10",
];

function normalizeTeamName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[´'’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* Feste Farben für die derzeitigen Teams. Neue Namen erhalten automatisch
   eine noch freie Farbe. Dadurch bleiben Farben innerhalb einer Saison stabil. */
const KNOWN_TEAM_COLORS = new Map([
  ["3 bowler", "team-color-1"],
  ["die schraagen", "team-color-2"],
  ["pincesses", "team-color-3"],
  ["tigers", "team-color-4"],
  ["scooter", "team-color-5"],
  ["malibu", "team-color-6"],
  ["lady dianas", "team-color-7"],
  ["all stars", "team-color-8"],
  ["dummyteam", "team-color-10"],
  ["dummy team", "team-color-10"],
]);

export function buildTeamColorMap(matchdays) {
  const teamNames = [...new Set(
    matchdays.flatMap((day) => (day.pairings ?? []).flatMap((pairing) => [pairing.homeTeam, pairing.awayTeam])),
  )]
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b), "de", { sensitivity: "base" }));

  const assigned = new Map();
  const used = new Set();

  teamNames.forEach((name) => {
    const knownClass = KNOWN_TEAM_COLORS.get(normalizeTeamName(name));
    if (knownClass) {
      assigned.set(name, knownClass);
      used.add(knownClass);
    }
  });

  const freeClasses = TEAM_COLOR_CLASSES.filter((className) => !used.has(className));
  teamNames.forEach((name) => {
    if (assigned.has(name)) return;
    assigned.set(name, freeClasses.shift() ?? TEAM_COLOR_CLASSES[assigned.size % TEAM_COLOR_CLASSES.length]);
  });

  return assigned;
}

