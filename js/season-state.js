export function isCompleted(season) {
  const count=Number(season?.matchdayCount);
  return season?.status==='completed'||(count>0&&Number(season.currentPublishedMatchday)>=count);
}
export function berlinToday(now=new Date()) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(v=>[v.type,v.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function homeSeasonState(seasons,today=berlinToday()) {
  const sorted=[...seasons].sort((a,b)=>String(b.firstMatchdayDate||b.seasonId).localeCompare(String(a.firstMatchdayDate||a.seasonId)));
  const started=sorted.find(s=>Number(s.currentPublishedMatchday)>0||(s.firstMatchdayDate&&s.firstMatchdayDate<=today));
  if(started)return {mode:isCompleted(started)?'winners':'overview',season:started};
  const completed=sorted.find(isCompleted);
  return completed?{mode:'winners',season:completed}:{mode:'overview',season:sorted[0]??null};
}
