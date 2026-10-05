const scoresOf = scores => (Array.isArray(scores)?scores:[]).filter(v=>Number.isInteger(v)&&v>0&&v<=300);
const mean = values => values.reduce((a,b)=>a+b,0)/values.length;
const clamp = (v,min,max)=>Math.min(max,Math.max(min,v));

export function personalReference(data,id,day) {
  const player=data?.analytics?.players?.find(p=>p.playerId===id);
  const scores=(player?.entries??[]).filter(e=>Number(e.matchdayNumber)<day)
    .sort((a,b)=>a.matchdayNumber-b.matchdayNumber).flatMap(e=>scoresOf(e.scores)).slice(-12);
  if(scores.length>=3)return {average:mean(scores),label:`Letzte ${scores.length} Spiele vor diesem Spieltag`};
  const previous=player?.previousSeasonAverage??data?.individualStandings?.rows?.find(p=>p.playerId===id)?.previousSeasonAverage;
  if(previous!==null&&previous!==undefined&&Number(previous)>0&&Number(previous)<=300)return {average:Number(previous),label:'Schnitt der Vorsaison'};
  return null;
}

export function calculatePersonalAward(data) {
  const day=Number(data?.matchday?.number??0);
  const candidates=(data?.currentMatchday?.rows??[]).flatMap(row=>{
    if(row.teamId===data?.dummyTeamId)return [];
    const scores=scoresOf(row.scores),reference=personalReference(data,row.playerId,day);
    if(scores.length<3||!reference)return [];
    const average=mean(scores),improvement=average-reference.average;
    const improvementPercent=100*improvement/reference.average;
    const above=scores.filter(v=>v>reference.average).length;
    const form=50*clamp(.5+improvementPercent/50,0,1);
    const consistency=25*above/scores.length;
    const performance=15*average/300;
    const highlight=10*scores.filter(v=>v>=200).length/scores.length;
    return [{playerId:row.playerId,name:row.name??'Unbekannt',team:row.team??row.teamId,
      teamId:row.teamId,scores,games:scores.length,total:scores.reduce((a,b)=>a+b,0),
      average,bestGame:Math.max(...scores),referenceAverage:reference.average,referenceLabel:reference.label,
      improvement,improvementPercent,aboveReference:above,
      standardDeviation:Math.sqrt(mean(scores.map(v=>(v-average)**2))),
      breakdown:{form,consistency,performance,highlight},score:form+consistency+performance+highlight}];
  });
  candidates.sort((a,b)=>b.score-a.score||b.improvementPercent-a.improvementPercent
    ||(a.standardDeviation/a.referenceAverage)-(b.standardDeviation/b.referenceAverage)
    ||String(a.playerId).localeCompare(String(b.playerId),'de'));
  if(!candidates.length)return null;
  return {...candidates[0],matchdayNumber:day,matchdayDate:data.matchday.date,
    seasonId:data.seasonId,seasonName:data.seasonName??data.seasonId,eligiblePlayers:candidates.length};
}
