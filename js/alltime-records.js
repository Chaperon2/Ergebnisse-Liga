import {loadCareerData,allTimeRecords} from './career-data.js?v=30';
import {escapeHtml as esc,formatNumber as num} from './public-data.js?v=30';
let sequence=0;
export async function renderAlltime(host,current){
 const token=++sequence;host.innerHTML='<p>Allzeitrekorde werden geladen …</p>';
 try{const career=await loadCareerData(current);if(token!==sequence)return;
 host.innerHTML='<p class="profile-note">Bestmarken aus '+career.data.length+' erfassten Saisons einschließlich des aktuellen Stands. Nicht erfasste Saisons sind nicht enthalten. Für die Abschlüsse Juni und November 2023 liegen keine Anzahlen der 200er-Spiele vor; diese Kategorie berücksichtigt dort keine Werte.'+(career.partial?' Einige Saisons sind gerade nicht erreichbar; die Übersicht ist unvollständig.':'')+'</p><div class="records-grid">'+allTimeRecords(career.data).map(r=>`<article class="record-card"><div class="record-inner"><span class="record-label">${esc(r.label)}</span><div class="record-value">${r.unit==='Ø'?'Ø '+num(r.value):r.value+' '+esc(r.unit)}</div><div class="record-detail">${r.winners.map(p=>`${esc(p.name)} · ${esc(p.seasonName)}${r.field==='average'?' · '+p.games+' Spiele':''}`).join('<br>')||'Noch kein Rekord'}</div></div></article>`).join('')+'</div>';
 }catch{if(token===sequence)host.innerHTML='<p>Allzeitrekorde konnten nicht geladen werden. Bitte lade die Seite erneut.</p>'}
}
