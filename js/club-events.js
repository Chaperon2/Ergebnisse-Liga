import {clubEvents,nextClubEvent,berlinDay} from './club-events-data.js?v=36';
let banner=null,lastKey;
function update(){
 const event=nextClubEvent(),key=event?.id??null;
 if(key!==lastKey){lastKey=key;banner?.remove();banner=null;
  if(event){banner=document.createElement('aside');banner.className='club-event-banner';banner.setAttribute('aria-label','Nächster Veranstaltungstermin');
   const link=document.createElement('a');link.href='termine-news.html#'+event.id;
   const label=document.createElement('span');label.className='club-event-label';label.textContent='Nächster Termin';
   const title=document.createElement('strong');title.textContent=event.title;
   const info=document.createElement('span');info.textContent=event.date.split('-').reverse().join('.')+' · '+event.time.replace(':00','')+' Uhr · '+event.location;
   const more=document.createElement('span');more.className='club-event-more';more.textContent='Mehr erfahren →';const track=document.createElement('span');track.className='club-event-ticker';track.append(label,title,info,more);link.append(track);banner.append(link);document.body.prepend(banner);
  }
 }
 for(const event of clubEvents){const status=document.querySelector('#'+event.id+' [data-event-status]');if(status)status.textContent=event.date<berlinDay()?'Vergangener Termin':event.date===berlinDay()?'Heute':'Termin vormerken';}
}
update();setInterval(update,60000);
