// Original trade route segmentation for the Genesis navigation envelope.
export function waypoint(from,to,step=20){
 const dx=to.x-from.x,dz=to.z-from.z;const distance=Math.hypot(dx,dz);
 if(distance<=step)return {x:to.x,y:to.y,z:to.z};
 return {x:from.x+(dx/distance)*step,y:from.y,z:from.z+(dz/distance)*step};
}
export function canExport(inventory,item,amount,reserve=0){return Number.isInteger(amount)&&amount>0&&amount<=8&&(inventory[item]||0)>=amount+reserve;}
export function findCandidate(source,villages,inventory,reserve=0){
 for(const target of villages){
  if(target.id===source.id||target.dimension!==source.dimension||source.relations?.[target.id]?.stance!=='friendly'||!target.chest)continue;
  const distance=Math.hypot(source.bell.x-target.bell.x,source.bell.z-target.bell.z);
  if(distance>180)continue;
  for(const contract of target.contracts||[]){
   if(contract.status!=='open')continue;
   const needed=contract.qty-(contract.delivered||0);const amount=Math.min(8,needed);
   if(canExport(inventory,contract.item,amount,reserve))return {targetId:target.id,contractId:contract.id,id:contract.item,amount};
  }
 }
 return null;
}
