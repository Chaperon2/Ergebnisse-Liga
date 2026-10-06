import {canonicalPlayerName} from './player-names.js?v=31';
export const nameKey=name=>canonicalPlayerName(name).toLocaleLowerCase('de');
const key='strikeclub-favourite-player-v1';
export function favourite(){try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
export function rememberPlayer(data,player){try{localStorage.setItem(key,JSON.stringify(player?{season:data.seasonId,playerId:player.playerId,name:player.name}:null))}catch{}}
export function selectedPlayer(data){
 const value=favourite(),rows=data.individualStandings?.rows??[];if(!value)return null;
 const exact=value.season===data.seasonId?rows.find(r=>r.playerId===value.playerId):null;
 if(exact)return exact;const matches=rows.filter(r=>nameKey(r.name)===nameKey(value.name));return matches.length===1?matches[0]:null;
}
