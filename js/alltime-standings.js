import {alltimeStandings} from './alltime-standings-data.js?v=32';
import {escapeHtml as esc,formatNumber as num} from './public-data.js?v=31';
import {favourite,nameKey} from './player-profile.js?v=31';
export function categoryRanking(rows,field){
 const known=p=>field!=='games200'||p.known200>0;
 const sorted=[...rows].sort((a,b)=>Number(known(b))-Number(known(a))||b[field]-a[field]||a.name.localeCompare(b.name,'de'));
 return sorted.map((p,i)=>({...p,rank:!known(p)?null:(i>0&&known(sorted[i-1])&&Math.abs(p[field]-sorted[i-1][field])<1e-9?sorted.findIndex(x=>known(x)&&Math.abs(x[field]-p[field])<1e-9)+1:i+1)}));
}
export function standingsMarkup(data,archiveData=data){
 const all=alltimeStandings(data),archive=alltimeStandings(archiveData),saved=favourite();const integer=v=>Number(v).toLocaleString('de-DE');
 const categories=[
 ['games200','200er-Spiele insgesamt','Anzahl 200+','Alle bekannten Spiele ab 200 Pins werden über die erfassten Saisons addiert. Rangfolge nach der bekannten Anzahl; bei fehlenden Angaben ist sie vorläufig.',all.rows],
 ['bestGame','Bestes Einzelspiel','Pins','Das höchste Einzelspiel jeder Person aus allen erfassten Saisons.',all.rows],
 ['bestSeries','Beste Serie','Pins','Die höchste Serie jeder Person aus allen erfassten Saisons.',all.rows],
 ['bestAverage','Bester Saisonschnitt','Schnitt','Der höchste Saisonschnitt jeder Person. Die laufende Saison zählt mit ihrem veröffentlichten Stand.',all.rows],
 ['average','Gesamtschnitt aus dem Archiv','Gesamt-Ø','Nur abgeschlossene Archivsaisons: alle Pins geteilt durch alle Spiele. Die laufende Saison ist ausgeschlossen. Keine Mittelung der Saisonschnitte.',archive.rows]
 ];
 return (all.ambiguous||archive.ambiguous?'<p class="profile-note">Mehrdeutige gleichnamige Einträge innerhalb einer Saison wurden ausgelassen.</p>':'')+categories.map(([field,title,label,note,rows])=>{
 const isArchive=field==='average';
 return '<section class="alltime-standings"><h2>'+title+'</h2><p class="profile-note">'+note+'</p><div class="alltime-table-scroll" role="region" aria-label="'+title+'" tabindex="0"><table class="alltime-table"><caption>'+rows.length+' Spieler · '+(isArchive?archive.seasonCount+' Archivsaisons':all.seasonCount+' erfasste Saisons')+'</caption><thead><tr><th scope="col">Pl.</th><th scope="col">Name</th><th scope="col" aria-sort="descending">'+label+'</th>'+(isArchive?'<th scope="col">Spiele</th><th scope="col">Pins gesamt</th><th scope="col">Saisons</th>':field==='bestAverage'?'<th scope="col">Saison</th>':'')+'</tr></thead><tbody>'+categoryRanking(rows,field).map(p=>{
 const value=field==='games200'?(!p.known200?'–':(p.missing200?'≥ ':'')+integer(p.games200)):field==='average'||field==='bestAverage'?num(p[field]):integer(p[field]);
 return '<tr'+(nameKey(saved?.name)===nameKey(p.name)?' class="alltime-my-row"':'')+'><td>'+(p.rank??'–')+'</td><th scope="row">'+esc(p.name)+'</th><td'+(field==='bestGame'&&p.bestGame>=200?' class="alltime-gold"':'')+'>'+value+'</td>'+(isArchive?'<td>'+integer(p.games)+'</td><td>'+integer(p.pins)+'</td><td>'+p.seasons+'</td>':field==='bestAverage'?'<td>'+p.bestAverageSeasons.map(esc).join(' · ')+'</td>':'')+'</tr>';
 }).join('')+'</tbody></table></div>'+(rows.length?'':'<p>Noch keine Ergebnisse vorhanden.</p>')+(field==='games200'?'<p class="profile-note">„≥“ bedeutet mindestens: Nicht alle Saisons enthalten 200er-Angaben. „–“ bedeutet unbekannt, nicht null. Diese Spieler erhalten keinen Rang.</p>':'')+'</section>';
 }).join('');
}
export function renderAlltimeStandings(host,data,archiveData=data){host.className='alltime-rankings';host.innerHTML=standingsMarkup(data,archiveData)}
