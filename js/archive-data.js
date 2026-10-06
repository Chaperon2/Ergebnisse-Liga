import {normalizePlayerNames} from './player-names.js?v=31';
import {loadPublicSeasons,loadPublicResults} from './public-api.js?v=31';

async function readArchive(filename){
  const response=await fetch(new URL(`../data/archive/${filename}`,import.meta.url),{cache:'no-store'});
  if(!response.ok)throw new Error('Archivdatei konnte nicht geladen werden.');
  return normalizePlayerNames(await response.json());
}

export function mergeArchiveSeasons(live,historical){
  const merged=new Map(historical.map(s=>[s.seasonId,{...s,archivedFromImages:true}]));
  for(const season of live){
    // Never replace an active or unfinished season with a static import.
    const completed=season.status==='completed'||(Number(season.matchdayCount)>0&&Number(season.currentPublishedMatchday)>=Number(season.matchdayCount));
    if(!completed||!merged.has(season.seasonId))merged.set(season.seasonId,season);
  }
  return [...merged.values()].sort((a,b)=>b.seasonId.localeCompare(a.seasonId,undefined,{numeric:true}));
}

export async function loadArchiveSeasons(){
  const [live,history]=await Promise.allSettled([loadPublicSeasons(),readArchive('catalog.json')]);
  if(live.status==='rejected'&&history.status==='rejected')throw new Error('Archiv nicht erreichbar.');
  const meta=live.status==='fulfilled'?live.value:{activeSeasonId:null,warning:'Aktuelle Saisonübersicht nicht erreichbar. Historische Abschlüsse sind verfügbar.'};
  return {...meta,data:mergeArchiveSeasons(live.status==='fulfilled'?live.value.data:[],history.status==='fulfilled'?history.value.seasons:[]),warning:history.status==='rejected'?'Historische Abschlüsse konnten nicht geladen werden. Bitte die Seite erneut laden.':meta.warning};
}

export async function loadArchiveResults(season){
  if(!season.archivedFromImages)return loadPublicResults(season.seasonId);
  // The file name comes from our bundled manifest, but constrain it nonetheless.
  if(!/^\d{4}-s\d+\.json$/.test(season.archiveFile))throw new Error('Ungültige Archivdatei.');
  const data=await readArchive(season.archiveFile);
  if(data.seasonId!==season.seasonId)throw new Error('Archivzuordnung stimmt nicht überein.');
  return {data,seasonId:season.seasonId,source:'historical-images',warning:null};
}
