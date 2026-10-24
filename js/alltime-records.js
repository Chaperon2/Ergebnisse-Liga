import {renderAlltimeStandings} from './alltime-standings.js?v=33';
import {loadCareerData} from './career-data.js?v=33';
let sequence=0;
export async function renderAlltime(host,current){
 const token=++sequence;host.innerHTML='<p>Allzeit-Tabellen werden geladen …</p>';
 try{const career=await loadCareerData(current);if(token!==sequence)return;
 host.innerHTML='<p class="profile-note">Eigene Ranglisten je Kategorie mit allen erfassten Spielern. Die vier Bestwert-Tabellen enthalten auch die laufende Saison; der Archiv-Gesamtschnitt berücksichtigt ausschließlich abgeschlossene Saisons.'+(career.partial?' Einige Saisons sind gerade nicht erreichbar; die Tabellen sind unvollständig.':'')+'</p>';
 const tables=document.createElement('div');host.append(tables);const ids=new Set(career.archiveSeasonIds);renderAlltimeStandings(tables,career.data,career.data.filter(s=>ids.has(s.seasonId)));
 }catch{if(token===sequence)host.innerHTML='<p>Allzeit-Tabellen konnten nicht geladen werden. Bitte lade die Seite erneut.</p>'}
}
