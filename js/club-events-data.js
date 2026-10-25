export const clubEvents=[{id:'weihnachtsfeier-2026',title:'Weihnachtsfeier',date:'2026-12-12',time:'19:00',location:'Auf der Bowlingbahn'}];
export function berlinDay(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function nextClubEvent(now=new Date()){const today=berlinDay(now);return [...clubEvents].filter(e=>e.date>=today).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0]??null}
