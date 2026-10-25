import {clubEvents,nextClubEvent,berlinDay} from './club-events-data.js?v=36';
let banner=null,spacer=null,observer=null,lastKey;
function syncBannerSpace(){if(!banner||!spacer)return;const height=Math.ceil(banner.getBoundingClientRect().bottom+8);spacer.style.height=height+'px';document.documentElement.style.setProperty('--club-banner-space',height+'px')}
window.addEventListener('resize',syncBannerSpace);
function update(){
 const event=nextClubEvent(),key=event?.id??null;
 if(key!==lastKey){lastKey=key;observer?.disconnect();banner?.remove();spacer?.remove();banner=null;spacer=null;document.documentElement.style.removeProperty('--club-banner-space');
  if(event){banner=document.createElement('aside');banner.className='club-event-banner';banner.setAttribute('aria-label','Nächster Veranstaltungstermin');
   const link=document.createElement('a');link.href='termine-news.html#'+event.id;
   const label=document.createElement('span');label.className='club-event-label';label.textContent='Nächster Termin';
   const title=document.createElement('strong');title.textContent=event.title;
   const info=document.createElement('span');info.textContent=event.date.split('-').reverse().join('.')+' · '+event.time.replace(':00','')+' Uhr · '+event.location;
   const more=document.createElement('span');more.className='club-event-more';more.textContent='Infos ansehen →';const track=document.createElement('span');track.className='club-event-ticker';track.append(label,title,info);const viewport=document.createElement('span');viewport.className='club-event-viewport';viewport.append(track);link.append(viewport,more);banner.append(link);spacer=document.createElement('div');spacer.className='club-event-spacer';spacer.setAttribute('aria-hidden','true');document.body.prepend(spacer);document.body.prepend(banner);syncBannerSpace();if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(syncBannerSpace);observer.observe(banner);}
  }
 }
 for(const event of clubEvents){const status=document.querySelector('#'+event.id+' [data-event-status]');if(status)status.textContent=event.date<berlinDay()?'Vergangener Termin':event.date===berlinDay()?'Heute':'Termin vormerken';}
}
update();setInterval(update,60000);
