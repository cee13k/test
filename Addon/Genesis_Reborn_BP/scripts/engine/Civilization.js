// Independent Genesis council utilities; no world mutations here.
export const POPULATION_GATE=8;
export const MAX_CONTRACTS=12;
export function stockDeficits(inventory, targets){
 return Object.entries(targets).map(([id,goal])=>({id,goal,stock:inventory[id]||0,needed:Math.max(0,goal-(inventory[id]||0))})).filter(x=>x.needed>0).sort((a,b)=>b.needed-a.needed);
}
export function chooseConstruction(v,population,stock){
 if(population<POPULATION_GATE || v.queue.some(q=>!['complete','cancelled'].includes(q.state)))return null;
 if((stock['minecraft:oak_planks']||0)<16)return null;
 return v.approvedPlots?.[0]||null;
}
export function contractRequest(v,item,qty,day,offer=null){
 v.contracts??=[];
 if(v.contracts.length>=MAX_CONTRACTS||!/^minecraft:[a-z0-9_]+$/.test(item)||!Number.isInteger(qty)||qty<1||qty>64)return null;
 if(offer&&(!/^minecraft:[a-z0-9_]+$/.test(offer.id)||!Number.isInteger(offer.amount)||offer.amount<1||offer.amount>64))return null;
 const c={id:`${day}_${v.contractSerial=(v.contractSerial||0)+1}`,item,qty,delivered:0,offer, status:'open',created:day};v.contracts.push(c);return c;
}
export function contractProgress(v,inventory){
 const r=[];for(const c of v.contracts||[]){if(c.status!=='open')continue;const available=Math.max(0,(inventory[c.item]||0)-c.delivered);r.push({...c,available,remaining:Math.max(0,c.qty-c.delivered)});}return r;
}
export function relation(v,other,action){
 v.relations??={};const current=v.relations[other]||{stance:'neutral',score:0};
 const diff=action==='gift'?5:action==='raid'?-25:action==='peace'?10:0;
 current.score=Math.max(-100,Math.min(100,current.score+diff));current.stance=current.score>=25?'friendly':current.score<=-25?'hostile':'neutral';v.relations[other]=current;return current;
}
