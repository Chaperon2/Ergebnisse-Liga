import {renderAlltimeStandings} from './alltime-standings.js?v=34';
import {loadCareerData} from './career-data.js?v=33';
const views=new WeakMap();
export async function renderAlltime(host,current){
 let view=views.get(host);if(!view){view={sequence:0,markup:null};views.set(host,view)}
 const token=++view.sequence;
 if(view.markup===null)host.innerHTML='<p>Allzeit-Tabellen werden geladen …</p>';
 try{
  const career=await loadCareerData(current);if(token!==view.sequence)return;
  // Build off-screen so the existing tables remain visible during polling.
  const next=document.createElement('div');
  next.innerHTML='<p class="profile-note">Eigene Ranglisten je Kategorie mit allen erfassten Spielern. Die vier Bestwert-Tabellen enthalten auch die laufende Saison; der Archiv-Gesamtschnitt berücksichtigt ausschließlich abgeschlossene Saisons.'+(career.partial?' Einige Saisons sind gerade nicht erreichbar; die Tabellen sind unvollständig.':'')+'</p>';
  const tables=document.createElement('div');next.append(tables);const ids=new Set(career.archiveSeasonIds);renderAlltimeStandings(tables,career.data,career.data.filter(s=>ids.has(s.seasonId)));
  const markup=next.innerHTML;
  if(markup!==view.markup){host.replaceChildren(...next.childNodes);view.markup=markup;}
  host.querySelector('.alltime-refresh-error')?.remove();
 }catch{
  if(token!==view.sequence)return;
  if(view.markup===null)host.innerHTML='<p>Allzeit-Tabellen konnten nicht geladen werden. Bitte lade die Seite erneut.</p>';
  else if(!host.querySelector('.alltime-refresh-error')){const note=document.createElement('p');note.className='profile-note alltime-refresh-error';note.textContent='Aktualisierung gerade nicht möglich. Der zuletzt geladene Stand bleibt sichtbar.';host.append(note);}
 }
}
