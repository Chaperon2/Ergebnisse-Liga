import {selectedPlayer,rememberPlayer} from './player-profile.js?v=31';
import {homeSeasonState} from './season-state.js?v=19';
import {winnersMarkup} from './season-final.js?v=31';
import {escapeHtml as esc,formatDate} from './public-data.js?v=31';
import {loadPublicSchedule,loadPublicResults,loadPublicSeasons} from './public-api.js?v=31';
import {buildTeamColorMap} from './team-colors.js';
function selected(data){return selectedPlayer(data)?.teamId||''}
function highlight(data){const player=selectedPlayer(data);
 document.querySelectorAll('#sectionsGrid tbody tr').forEach(row=>{row.classList.remove('my-team-row');row.classList.toggle('my-player-row',!!player&&row.querySelector('[data-player-id]')?.dataset.playerId===player.playerId)});
}
function picker(data,host,onChange){
 const players=[...(data.individualStandings?.rows??[])].filter(r=>r.teamId!==data.dummyTeamId).sort((a,b)=>a.name.localeCompare(b.name,'de'));
 host.innerHTML='<label>'+ (host.closest('[data-club-home]')?'Mein Name':'Meine Saison')+' <select aria-label="Mein Name"><option value="">Namen auswählen</option>'+players.map(r=>'<option value="'+esc(r.playerId)+'">'+esc(r.name)+'</option>').join('')+'</select></label><small>Auswahl wird auf diesem Gerät gespeichert.</small>';
 const select=host.querySelector('select');select.value=selectedPlayer(data)?.playerId||'';
 select.onchange=()=>{rememberPlayer(data,players.find(r=>r.playerId===select.value));onChange()};
}
export function resultExtras(data){
  let host=document.getElementById('resultExtras');
  if(!host){host=document.createElement('section');host.id='resultExtras';host.className='club-tools';document.getElementById('summaryGrid').before(host)}
  host.innerHTML='<div id="teamPicker"></div>';
  picker(data,host.querySelector('#teamPicker'),()=>highlight(data));highlight(data);

}
export async function homeExtras(){
  const hosts=[...document.querySelectorAll('[data-club-home]')];if(!hosts.length)return;
  try{
    const catalog=await loadPublicSeasons();const state=homeSeasonState(catalog.data);
    if(!state.season)throw Error('Keine Saison vorhanden');
    if(state.mode==='winners'){
      const result=await loadPublicResults(state.season.seasonId);
      for(const host of hosts){host.classList.add('club-home-winners');host.innerHTML=winnersMarkup(result.data)+'<a class="club-schedule-button" href="archiv.html?saison='+encodeURIComponent(state.season.seasonId)+'">Zur finalen Auswertung →</a>';if(result.warning||catalog.warning){const p=document.createElement('p');p.textContent=result.warning||catalog.warning;host.append(p)}}return;
    }
    hosts.forEach(h=>h.classList.remove('club-home-winners'));
    const schedule=await loadPublicSchedule(state.season.seasonId);
    const results=state.season.hasResults?await loadPublicResults(state.season.seasonId):{data:null};
    const names=new Map();for(const day of schedule.data.matchdays??[])for(const p of day.pairings??[]){names.set(p.homeTeamId,p.homeTeam);names.set(p.awayTeamId,p.awayTeam)}
    const data=results.data??{seasonId:state.season.seasonId,seasonName:state.season.seasonName,matchday:{number:0},matchdayCount:state.season.matchdayCount,dummyTeamId:'Team 10',teamStandings:{rows:[...names].map(([teamId,name])=>({teamId,name}))}};
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const next=schedule.data.matchdays.filter(d=>d.number>schedule.publishedThrough&&d.date>=today).sort((a,b)=>a.number-b.number)[0];
    const colors=buildTeamColorMap(schedule.data.matchdays); const updates=[]; for(const host of hosts){host.innerHTML=`<h2>Meine Saison</h2><div class="home-team-picker"></div><div class="next-game"></div><p class="club-progress-label">${esc(data.seasonName)} · ${data.matchday.number}/${data.matchdayCount} Spieltage</p><progress value="${Number(data.matchday.number)}" max="${Number(data.matchdayCount)}" aria-label="Saisonfortschritt"></progress><p class="club-source">${esc(results.warning||schedule.warning||'')}</p>`;
      const update=()=>{const player=selectedPlayer(data);const id=selected(data);const match=schedule.seasonId===data.seasonId?next?.pairings.find(p=>p.homeTeamId===id||p.awayTeamId===id):null;
        host.querySelector('.next-game').innerHTML=(player?'<div class="season-personal"><strong>'+esc(player.name)+'</strong> · Platz '+esc(player.rank)+' · Ø '+esc(Number(player.average).toLocaleString('de-DE',{maximumFractionDigits:1,minimumFractionDigits:1}))+'<div><a class="club-schedule-button" href="spieleranalyse.html?spieler='+encodeURIComponent(player.playerId)+'">Spielerkarte öffnen →</a></div></div>':'')+(next?`<h3>Nächster Spieltag ${next.number} · ${esc(formatDate(next.date))}</h3><p>${match?`<span class="club-team ${colors.get(match.homeTeam)||'team-color-1'}">${esc(match.homeTeam)}</span><span class="club-vs">vs.</span><span class="club-team ${colors.get(match.awayTeam)||'team-color-1'}">${esc(match.awayTeam)}</span><small class="club-lanes">Bahn ${esc(match.lanePair)}</small>`:'Alle Begegnungen und Bahnen im Spielplan'}</p><a class="club-schedule-button" href="spielplan.html?saison=${encodeURIComponent(schedule.seasonId)}">Spielplan öffnen →</a>`:'<p>Aktuell kein weiterer Spieltermin veröffentlicht.</p>')};
      updates.push(update);picker(data,host.querySelector('.home-team-picker'),()=>{for(const other of hosts){const select=other.querySelector('select');if(select)select.value=selectedPlayer(data)?.playerId||''}updates.forEach(fn=>fn())});update();
    }
  }catch{for(const host of hosts)host.innerHTML='<h2>Meine Saison</h2><p>Ligadaten gerade nicht erreichbar.</p><a class="club-schedule-button" href="spielplan.html">Spielplan öffnen</a>'}
}
homeExtras();
setInterval(()=>{if(!document.hidden)homeExtras()},60000);
