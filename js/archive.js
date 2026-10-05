import {loadPublicSeasons,loadPublicResults,watchLoader} from './public-api.js';
import {escapeHtml as esc} from './public-data.js';
import {isCompleted} from './season-state.js?v=19';
import {finalMarkup} from './season-final.js?v=19';
const message=document.querySelector('#archiveMessage'),container=document.querySelector('#seasonArchive');
const finals=document.createElement('section');finals.id='seasonFinal';finals.setAttribute('aria-live','polite');container.after(finals);
let selected=null,token=0,seasons=[];
async function selectSeason(id){
  const season=seasons.find(s=>s.seasonId===id);if(!season)return;
  selected=id;const current=++token;
  container.querySelectorAll('[data-season]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.season===id)));
  if(!isCompleted(season)){
    const count=Math.max(1,Number(season.matchdayCount)||1),published=Math.max(0,Math.min(count,Number(season.currentPublishedMatchday)||0));
    finals.innerHTML=`<section class="panel" style="margin-top:20px"><h2>${esc(season.seasonName??id)}</h2><p>Saison noch nicht abgeschlossen</p><progress aria-label="Saisonfortschritt" value="${published}" max="${count}" style="width:100%;height:16px;accent-color:#087e8b"></progress><p>${published} von ${count} Spieltagen veröffentlicht</p><a class="button" href="ergebnisse.html?saison=${encodeURIComponent(id)}">Zu den aktuellen Ergebnissen</a></section>`;
    return;
  }
  finals.textContent='Finale Auswertung wird geladen …';
  try{const result=await loadPublicResults(id);if(current!==token)return;
    finals.innerHTML=finalMarkup(result.data,{completed:true});
    if(result.warning){const p=document.createElement('p');p.textContent=result.warning;finals.prepend(p)}
  }catch{if(current!==token)return;finals.innerHTML='<p>Diese Auswertung konnte nicht geladen werden.</p><button type="button">Erneut versuchen</button>';finals.querySelector('button').onclick=()=>selectSeason(id)}
}
watchLoader(loadPublicSeasons,{
  onData:(data,meta)=>{
    seasons=[...data].sort((a,b)=>String(b.firstMatchdayDate||b.seasonId).localeCompare(String(a.firstMatchdayDate||a.seasonId)));
    message.textContent=meta.warning||(!seasons.length?'Noch keine Saisons verfügbar.':'');
    container.innerHTML=seasons.map(s=>`<article class="archive-card"><header><div><span class="schedule-state">${isCompleted(s)?'Abgeschlossen':s.seasonId===meta.activeSeasonId?'Aktuelle Saison':'Noch nicht abgeschlossen'}</span><h2>${esc(s.seasonName??s.seasonId)}</h2></div></header><div class="actions"><button class="button" type="button" data-season="${esc(s.seasonId)}" aria-pressed="${s.seasonId===selected}">Saison auswählen</button></div></article>`).join('');
    container.querySelectorAll('[data-season]').forEach(b=>b.onclick=()=>selectSeason(b.dataset.season));
    // No default season: details appear only after a click in this page session.
    if(selected&&seasons.some(s=>s.seasonId===selected))selectSeason(selected);
    else{selected=null;token++;finals.innerHTML=''}
  },
  onError:()=>{message.textContent='Das Saisonarchiv ist gerade nicht erreichbar. Bitte lade die Seite erneut.'}
});
