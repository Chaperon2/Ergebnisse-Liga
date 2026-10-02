import {escapeHtml as esc,formatDate} from './public-data.js';
import {loadPublicSchedule,loadPublicResults} from './public-api.js';
import {calculatePlayerOfWeek} from './player-of-week.js?v=12.8';
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
  host.innerHTML='<div id="teamPicker"></div><button type="button" id="shareWeek">Spieltagskarte herunterladen</button><span id="shareStatus" role="status"></span>';
  picker(data,host.querySelector('#teamPicker'),()=>highlight(data));highlight(data);
  host.querySelector('#shareWeek').onclick=()=>downloadCard(data,host.querySelector('#shareStatus'));
}
function downloadCard(data,status){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#f7efdc';ctx.fillRect(0,0,1080,1080);ctx.fillStyle='#075957';ctx.fillRect(0,0,1080,220);ctx.fillStyle='#fff';
  const text=(s,y,size=42,color='#173d3c')=>{ctx.fillStyle=color;ctx.font=`bold ${size}px sans-serif`;while(ctx.measureText(String(s)).width>920&&size>18){size--;ctx.font=`bold ${size}px sans-serif`}ctx.fillText(String(s),80,y)};
  text('STRIKECLUB VELTEN',105,54,'#fff');text(`${data.seasonName} · Spieltag ${data.matchday.number}`,170,36,'#fff');
  text(formatDate(data.matchday.date),285,30);const award=calculatePlayerOfWeek(data);
  text('SPIELER/IN DER WOCHE',390,28);text(award?.name??'Keine Wertung',465,64);text(award?.team??'',520,32);
  const best=data.currentMatchday.bestGame; text('BESTES SPIEL',640,28);text(best?`${best.name} · ${best.score} Pins`:'–',705,46);
  const leader=data.teamStandings.rows[0];text('TEAM AN DER SPITZE',825,28);text(leader?`${leader.name} · ${leader.points} Punkte`:'–',885,42);
  text('www.strikeclub-velten.de',1005,28);
  canvas.toBlob(blob=>{if(!blob){status.textContent='Download nicht möglich.';return}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Strikeclub-${data.seasonId}-Spieltag-${data.matchday.number}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);status.textContent='Karte erstellt – du kannst sie selbst teilen.'},'image/png');
}
export async function homeExtras(){
  const hosts=[...document.querySelectorAll('[data-club-home]')];if(!hosts.length)return;
  try{
    const [results,schedule]=await Promise.all([loadPublicResults(),loadPublicSchedule()]);const data=results.data;
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const next=schedule.data.matchdays.filter(d=>d.number>schedule.publishedThrough&&d.date>=today).sort((a,b)=>a.number-b.number)[0];
    const updates=[]; for(const host of hosts){host.innerHTML=`<h2>Deine Liga im Blick</h2><div class="home-team-picker"></div><div class="next-game"></div><p>${esc(data.seasonName)}: ${data.matchday.number} von ${data.matchdayCount} Spieltagen veröffentlicht</p><progress value="${Number(data.matchday.number)}" max="${Number(data.matchdayCount)}" aria-label="Saisonfortschritt"></progress><p class="club-source">${esc(results.warning||schedule.warning||'Aktuell aus der Liga')}</p>`;
      const update=()=>{const id=selected(data);const match=schedule.seasonId===data.seasonId?next?.pairings.find(p=>p.homeTeamId===id||p.awayTeamId===id):null;
        host.querySelector('.next-game').innerHTML=next?`<h3>Nächster Spieltag: ${next.number} · ${esc(formatDate(next.date))}</h3><p>${match?`${esc(match.homeTeam)} gegen ${esc(match.awayTeam)} · Bahn ${esc(match.lanePair)}`:'Alle Begegnungen und Bahnen im Spielplan'}</p><a href="spielplan.html?saison=${encodeURIComponent(schedule.seasonId)}">Zum Spielplan</a>`:'<p>Aktuell kein weiterer Spieltermin veröffentlicht.</p>'};
      updates.push(update);picker(data,host.querySelector('.home-team-picker'),()=>{for(const other of hosts){const select=other.querySelector('select');if(select)select.value=selected(data)||''}updates.forEach(fn=>fn())});update();
    }
  }catch{for(const host of hosts)host.innerHTML='<h2>Deine Liga im Blick</h2><p>Ligadaten gerade nicht erreichbar.</p><a href="spielplan.html">Spielplan öffnen</a>'}
}
homeExtras();
