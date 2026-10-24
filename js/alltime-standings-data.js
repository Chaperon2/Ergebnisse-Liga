import {nameKey} from './player-profile.js?v=31';
import {canonicalPlayerName} from './player-names.js?v=31';

export function alltimeStandings(seasons,sort='bestAverage'){
 const byName=new Map(),unique=new Map(seasons.map(s=>[s.seasonId,s]));let ambiguous=0;
 for(const season of unique.values()){
  const eligible=(season.individualStandings?.rows??[]).filter(r=>Number.isInteger(r.games)&&r.games>0&&Number.isFinite(r.pins)&&r.pins>=0&&(!season.dummyTeamId||r.teamId!==season.dummyTeamId));
  const counts=new Map();for(const r of eligible)counts.set(nameKey(r.name),(counts.get(nameKey(r.name))??0)+1);
  for(const r of eligible){const key=nameKey(r.name);if(!key||counts.get(key)>1){ambiguous++;continue;}
   let p=byName.get(key);if(!p){p={name:canonicalPlayerName(r.name),seasons:0,games:0,pins:0,bestSeries:0,bestGame:0,bestAverage:-1,bestAverageSeasons:[],games200:0,known200:0,missing200:0};byName.set(key,p)}
   p.seasons++;p.games+=r.games;p.pins+=r.pins;
   p.bestSeries=Math.max(p.bestSeries,Number(r.bestSeries)||0);p.bestGame=Math.max(p.bestGame,Number(r.bestGame)||0);
   const avg=r.pins/r.games;
   if(avg>p.bestAverage+1e-9){p.bestAverage=avg;p.bestAverageSeasons=[season.seasonName??season.seasonId]}
   else if(Math.abs(avg-p.bestAverage)<1e-9)p.bestAverageSeasons.push(season.seasonName??season.seasonId);
   if(Number.isInteger(r.games200)&&r.games200>=0){p.games200+=r.games200;p.known200++}else p.missing200++;
  }
 }
 const field=sort==='average'?'average':'bestAverage';const rows=[...byName.values()].map(p=>({...p,average:p.pins/p.games})).sort((a,b)=>b[field]-a[field]||a.name.localeCompare(b.name,'de'));
 rows.forEach((p,i)=>p.rank=i>0&&Math.abs(p[field]-rows[i-1][field])<1e-9?rows[i-1].rank:i+1);
 return {rows,ambiguous,seasonCount:unique.size};
}
