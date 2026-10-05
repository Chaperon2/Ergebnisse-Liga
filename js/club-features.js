import {homeSeasonState} from './season-state.js?v=19';
import {winnersMarkup} from './season-final.js?v=19';
import {escapeHtml as esc,formatDate} from './public-data.js';
import {loadPublicSchedule,loadPublicResults,loadPublicSeasons} from './public-api.js';
import {buildTeamColorMap} from './team-colors.js';
const key='strikeclub-favourite-team-v1';
function saved(){try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
function remember(value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function selected(data){const value=saved();return value?.season===data.seasonId?value.team:''}
function highlight(data){const id=selected(data);const name=data.teamStandings.rows.find(t=>t.teamId===id)?.name;
  document.querySelectorAll('#sectionsGrid tbody tr').forEach(row=>row.classList.toggle('my-team-row',!!name&&row.querySelector('.col-team')?.textContent===name));
}
function picker(data,host,onChange){
  host.innerHTML=`<label>Mein Team <select aria-label="Mein Team"><option value="">Alle Teams</option>${data.teamStandings.rows.filter(t=>t.teamId!==data.dummyTeamId).map(t=>`<option value="${esc(t.teamId)}">${esc(t.name)}</option>`).join('')}</select></label><small>Auf diesem Gerät merken</small>`;
  const select=host.querySelector('select');select.value=selected(data)||'';
  select.onchange=()=>{remember({season:data.seasonId,team:select.value});onChange()};
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
    const colors=buildTeamColorMap(schedule.data.matchdays); const updates=[]; for(const host of hosts){host.innerHTML=`<h2>Meine Liga im Blick</h2><div class="home-team-picker"></div><div class="next-game"></div><p class="club-progress-label">${esc(data.seasonName)} · ${data.matchday.number}/${data.matchdayCount} Spieltage</p><progress value="${Number(data.matchday.number)}" max="${Number(data.matchdayCount)}" aria-label="Saisonfortschritt"></progress><p class="club-source">${esc(results.warning||schedule.warning||'')}</p>`;
      const update=()=>{const id=selected(data);const match=schedule.seasonId===data.seasonId?next?.pairings.find(p=>p.homeTeamId===id||p.awayTeamId===id):null;
        host.querySelector('.next-game').innerHTML=next?`<h3>Nächster Spieltag ${next.number} · ${esc(formatDate(next.date))}</h3><p>${match?`<span class="club-team ${colors.get(match.homeTeam)||'team-color-1'}">${esc(match.homeTeam)}</span><span class="club-vs">vs.</span><span class="club-team ${colors.get(match.awayTeam)||'team-color-1'}">${esc(match.awayTeam)}</span><small class="club-lanes">Bahn ${esc(match.lanePair)}</small>`:'Alle Begegnungen und Bahnen im Spielplan'}</p><a class="club-schedule-button" href="spielplan.html?saison=${encodeURIComponent(schedule.seasonId)}">Spielplan öffnen →</a>`:'<p>Aktuell kein weiterer Spieltermin veröffentlicht.</p>'};
      updates.push(update);picker(data,host.querySelector('.home-team-picker'),()=>{for(const other of hosts){const select=other.querySelector('select');if(select)select.value=selected(data)||''}updates.forEach(fn=>fn())});update();
    }
  }catch{for(const host of hosts)host.innerHTML='<h2>Meine Liga im Blick</h2><p>Ligadaten gerade nicht erreichbar.</p><a class="club-schedule-button" href="spielplan.html">Spielplan öffnen</a>'}
}
homeExtras();
setInterval(()=>{if(!document.hidden)homeExtras()},60000);
