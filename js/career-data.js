import {loadArchiveSeasons,loadArchiveResults} from './archive-data.js?v=30';
import {nameKey} from './player-profile.js?v=30';
export async function loadCareerData(current){
 const catalog=await loadArchiveSeasons();
 const settled=await Promise.allSettled(catalog.data.filter(s=>s.hasResults&&s.seasonId!==current?.seasonId).map(s=>loadArchiveResults(s)));
 const data=settled.filter(s=>s.status==='fulfilled').map(s=>s.value.data);
 if(current)data.push(current);
 return {data:data.sort((a,b)=>a.seasonId.localeCompare(b.seasonId,undefined,{numeric:true})),partial:!!catalog.warning||settled.some(s=>s.status==='rejected')};
}
export function careerRows(data,name){return data.map(s=>{const matches=(s.individualStandings?.rows??[]).filter(r=>nameKey(r.name)===nameKey(name));return {seasonId:s.seasonId,seasonName:s.seasonName,player:matches.length===1?matches[0]:null}})}
export function allTimeRecords(data){
 const rows=data.flatMap(s=>(s.individualStandings?.rows??[]).filter(r=>r.games>0&&(!s.dummyTeamId||r.teamId!==s.dummyTeamId)).map(r=>({...r,seasonName:s.seasonName})));
 return [['bestGame','Bestes Einzelspiel','Pins'],['bestSeries','Beste Serie','Pins'],['average','Höchster Saisonschnitt','Ø'],['games200','Meiste 200er in einer Saison','Spiele']].map(([field,label,unit])=>{
 const max=Math.max(0,...rows.map(r=>Number(r[field])||0));
 return {field,label,unit,value:max,winners:max?rows.filter(r=>Math.abs(Number(r[field])-max)<0.000001):[]};
 });
}
