// Confirmed aliases for the same player; stable player IDs remain unchanged.
export function canonicalPlayerName(name){
 const value=String(name??'').normalize('NFC').trim();
 return ['wallande','wallander','walter'].includes(value.toLocaleLowerCase('de'))?'Wallander':value;
}
export function normalizePlayerNames(value){
 if(Array.isArray(value))return value.map(normalizePlayerNames);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,(key==='name'||key==='playerName')&&typeof item==='string'?canonicalPlayerName(item):normalizePlayerNames(item)]));
}
