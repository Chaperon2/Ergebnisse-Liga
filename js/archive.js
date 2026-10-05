import {loadPublicSeasons,loadPublicResults,watchLoader} from './public-api.js';
import {escapeHtml as esc} from './public-data.js';
import {isCompleted} from './season-state.js?v=19';
import {finalMarkup} from './season-final.js?v=19';
const message=document.querySelector('#archiveMessage'),container=document.querySelector('#seasonArchive');
const finals=document.createElement('section');finals.id='seasonFinal';finals.setAttribute('aria-live','polite');container.after(finals);
let selected=null,token=0,seasons=[];
async function selectSeason(id){
  const season=seasons.find(s=>s.seasonId===id);if(!season)return;
  selected=id;const current=++token;finals.textContent='Finale Auswertung wird geladen …';
  container.querySelectorAll('[data-season]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.season===id)));
  try{const result=await loadPublicResults(id);if(current!==token)return;
    finals.innerHTML=finalMarkup(result.data,{completed:isCompleted(season)});
    if(result.warning){const p=document.createElement('p');p.textContent=result.warning;finals.prepend(p)}
    const url=new URL(location.href);url.searchParams.set('saison',id);history.replaceState(null,'',url);
  }catch{if(current!==token)return;finals.innerHTML='<p>Diese Auswertung konnte nicht geladen werden.</p><button type="button">Erneut versuchen</button>';finals.querySelector('button').onclick=()=>selectSeason(id)}
}
watchLoader(loadPublicSeasons,{
  onData:(data,meta)=>{
    seasons=[...data].sort((a,b)=>String(b.firstMatchdayDate||b.seasonId).localeCompare(String(a.firstMatchdayDate||a.seasonId)));
    message.textContent=meta.warning||(!seasons.length?'Noch keine Saisons verfügbar.':'');
    container.innerHTML=seasons.map(s=>{const completed=isCompleted(s),active=s.seasonId===meta.activeSeasonId&&!completed;
      return `<article class="archive-card"><header><div><span class="schedule-state">${completed?'Abgeschlossen':active?'Aktuelle Saison':'Saisonstand'}</span><h2>${esc(s.seasonName??s.seasonId)}</h2></div></header><div class="actions">${active?`<a class="button" href="ergebnisse.html?saison=${encodeURIComponent(s.seasonId)}">Aktuelle Ergebnisse</a>`:s.hasResults?`<button class="button" type="button" data-season="${esc(s.seasonId)}">${completed?'Finale Auswertung':'Letzter Saisonstand'}</button>`:'<span>Noch keine Auswertung veröffentlicht</span>'}</div></article>`;
    }).join('');
    container.querySelectorAll('[data-season]').forEach(b=>b.onclick=()=>selectSeason(b.dataset.season));
    const requested=selected||new URLSearchParams(location.search).get('saison');
    const target=seasons.find(s=>s.seasonId===requested&&s.hasResults&&(isCompleted(s)||s.seasonId!==meta.activeSeasonId))||seasons.find(s=>isCompleted(s)&&s.hasResults);
    if(target)selectSeason(target.seasonId);else{selected=null;token++;finals.textContent='Noch keine abgeschlossene Saison verfügbar.'}
  },
  onError:()=>{message.textContent='Das Saisonarchiv ist gerade nicht erreichbar. Bitte lade die Seite erneut.'}
});
