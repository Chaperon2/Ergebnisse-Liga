import {escapeHtml as esc,formatNumber} from './public-data.js?v=30';
function podium(rows,title,value,extra=""){
  const places=[2,1,3].map(rank=>{
    const winners=rows.filter(r=>Number(r.rank)===rank);
    return `<div class="podium-place podium-${rank}"><div class="podium-bar"><b>${rank}</b>${winners.map(r=>`<span>${esc(value(r))}</span>`).join('')}</div><div class="podium-names">${winners.length?winners.map(r=>`<strong>${esc(r.name)}</strong>`).join(''):'<span>–</span>'}</div></div>`;
  }).join('');
  return `<article class="winner-card"><h3>${esc(title)}</h3><div class="podium" aria-label="Siegerehrung, Plätze zwei, eins und drei">${places}</div>${extra}</article>`;
}
export function seasonBestGameMarkup(data){
  const rows=data.individualStandings?.rows??[];
  const record=data.individualStandings?.bestGame;
  const valid=v=>Number.isInteger(Number(v))&&Number(v)>0&&Number(v)<=300;
  const score=Math.max(0,...rows.filter(r=>valid(r.bestGame)).map(r=>Number(r.bestGame)),valid(record?.score)?Number(record.score):0);
  if(!score)return '';
  const winners=rows.filter(r=>Number(r.bestGame)===score).map(r=>({id:r.playerId,name:r.name}));
  if(Number(record?.score)===score&&record?.name&&!winners.some(r=>record.playerId?r.id===record.playerId:r.name===record.name))winners.push({id:record.playerId,name:record.name});
  return '<div class="season-best-game" style="margin-top:12px;padding:14px;border-radius:10px;background:#e1f1ed;border:1px solid #80aaa1;text-align:center;overflow-wrap:anywhere"><span style="display:block;font-size:13px;font-weight:700">Bestes Spiel der gesamten Saison</span><strong style="display:block;font-size:23px;margin:5px 0">'+esc(score)+' Pins</strong><span>'+winners.map(r=>esc(r.name??'Unbekannt')).join(' · ')+'</span></div>';
}
export function winnersMarkup(data){
  const players=data.individualStandings?.rows??[];
  const teams=(data.teamStandings?.rows??[]).filter(r=>r.teamId!==data.dummyTeamId);
  return `<section class="season-winners"><header><span class="winner-eyebrow">Saison abgeschlossen</span><h2>${esc(data.seasonName??data.seasonId)} · Siegerehrung</h2></header><div class="winner-grid">${podium(players,'Einzelwertung',r=>`Ø ${formatNumber(r.average)}`,seasonBestGameMarkup(data))}${podium(teams,'Teamwertung',r=>`${r.points} Punkte`)}</div></section>`;
}
function table(title,headers,rows){return `<section class="final-table"><h3>${title}</h3><table><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v??'–')}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`}
export function finalMarkup(data,{completed=true}={}){
  const individual=(data.individualStandings?.rows??[]).map(r=>[r.rank,r.name,r.team,r.games,r.bestSeries,r.bestGame,r.pins,formatNumber(r.average),r.games200??'–']);
  const teams=(data.teamStandings?.rows??[]).map(r=>[r.rank,r.name,r.points,r.pins,r.matchdays,formatNumber(r.average)]);
  return `<div class="final-results">${completed?winnersMarkup(data):`<h2>${esc(data.seasonName)} · Letzter veröffentlichter Saisonstand</h2><p>Diese Saison ist noch nicht als abgeschlossen verzeichnet.</p>`}<p class="final-note">${completed?'Finale Auswertung':'Saisonstand'} · bis Spieltag ${Number(data.matchday?.number)||'–'}</p>${table('Einzelwertung',['Pl.','Name','Team','Sp.','Beste Serie','Bestes Spiel','Pins','Ø','200+'],individual)}${table('Teamwertung',['Pl.','Team','Punkte','Pins','Spieltage','Ø'],teams)}</div>`;
}
