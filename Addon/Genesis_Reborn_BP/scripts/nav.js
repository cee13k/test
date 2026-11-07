// Genesis Reborn: marker-guided native navigation, globally unique slot leases.
// Workers are NEVER teleported. Only their invisible goal markers are positioned.
// A bounded detour retry prevents a blocked native navigation goal from stalling forever.
export const MAX_NAV_SLOTS = 32;
const routes = new Map();
const leases = new Map(); // dimension|slot => worker ID
const planar = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const floor = p => ({x:Math.floor(p.x),y:Math.floor(p.y),z:Math.floor(p.z)});
const leaseKey = (dimension,slot) => dimension+'|'+slot;
const dimensionOf = w => w.dimension.id;
const ownerTag = id => 'grnav_'+id;
function standing(d,p){
 try {
  const at=floor(p), f=d.getBlock(at), h=d.getBlock({...at,y:at.y+1}), ground=d.getBlock({...at,y:at.y-1});
  return !!(f?.isAir && h?.isAir && ground && !ground.isAir && !ground.isLiquid);
 }catch(_){return false;}
}
function landing(d,target){
 const b=floor(target);
 for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2]])
  for(const dy of [0,1,-1]){
   const p={x:b.x+dx+0.5,y:b.y+dy,z:b.z+dz+0.5};
   if(standing(d,p))return p;
  }
 return null;
}
function markerFor(w){
 try{return w.dimension.getEntities({type:'genesis:nav_marker',location:w.location,maxDistance:55,tags:[ownerTag(w.id)]})[0]??null;}
 catch(_){return null;}
}
function releaseLease(w,slot){
 const key=leaseKey(dimensionOf(w),slot);
 if(leases.get(key)===w.id)leases.delete(key);
}
export function assignSlot(v,w){
 v.navSlots??={};
 const dimension=dimensionOf(w), prior=v.navSlots[w.id];
 if(Number.isInteger(prior)&&prior>=0&&prior<MAX_NAV_SLOTS){
  const key=leaseKey(dimension,prior), owner=leases.get(key);
  if(!owner||owner===w.id){leases.set(key,w.id);return {slot:prior,changed:false};}
 }
 for(let s=0;s<MAX_NAV_SLOTS;s++){
  const key=leaseKey(dimension,s);
  if(!leases.has(key)){
   // The saved slot may belong to an entirely different worker in another village.
   // Remove the old marker so its old family can never compete for this worker.
   if(prior!==undefined){try{markerFor(w)?.remove();}catch(_){}}
   v.navSlots[w.id]=s;leases.set(key,w.id);
   return {slot:s,changed:prior!==s};
  }
 }
 return {slot:-1,changed:false};
}
export function releaseRoute(v,w){
 if(!v||!w)return;
 const route=routes.get(w.id), slot=route?.slot??v.navSlots?.[w.id];
 if(Number.isInteger(slot))releaseLease(w,slot);
 const marker=route?.marker??markerFor(w);
 try{if(marker?.isValid!==false)marker?.remove();}catch(_){ }
 try{w.triggerEvent('genesis:route_clear');}catch(_){ }
 routes.delete(w.id);
}
function pushMarker(w,slot,point,existing){
 let marker=existing;
 try{
  if(marker?.isValid===false)marker=null;
  if(!marker){
   marker=w.dimension.spawnEntity('genesis:nav_marker',point);
   marker.addTag(ownerTag(w.id));
   marker.triggerEvent('genesis:marker_slot_'+slot);
   try{marker.addEffect('invisibility',120000,{showParticles:false});}catch(_){ }
  } else if(planar(marker.location,point)>0.7||Math.abs(marker.location.y-point.y)>0.7){
   if(!marker.tryTeleport(point,{checkForBlocks:false}))return null;
  }
  return marker;
 }catch(_){return null;}
}
function detour(w,goal,attempt){
 const p=w.location,dx=goal.x-p.x,dz=goal.z-p.z,len=Math.hypot(dx,dz)||1;
 const side=attempt%2===0?1:-1,span=2+Math.floor(attempt/2)*2;
 // A small lateral plus forward step, rather than teleporting a stuck worker.
 return landing(w.dimension,{
  x:p.x+dx/len*2-dz/len*span*side,
  y:p.y,
  z:p.z+dz/len*2+dx/len*span*side
 });
}
export function moveNative(v,w,target,stop,tick){
 if(!v||!w||!target)return 'blocked';
 const here=w.location,dist=planar(here,target),t=tick||0;
 if(dist<=stop&&Math.abs(here.y-target.y)<=2){releaseRoute(v,w);return 'arrived';}
 if(dist>36||Math.abs(here.y-target.y)>12){releaseRoute(v,w);return 'far';}
 const assigned=assignSlot(v,w);
 if(assigned.slot<0)return 'no_slot';
 const slot=assigned.slot;
 let route=routes.get(w.id);
 if(route?.slot!==slot){route=null;try{w.triggerEvent('genesis:route_'+slot);}catch(_){return 'blocked';}}
 const changedGoal=!route||planar(route.target,target)>1.5||Math.abs(route.target.y-target.y)>1.5;
 if(changedGoal)route={slot,target:{...target},lastPos:{...here},lastMoved:t,lastRequest:t,attempt:0,detourUntil:0,blockedUntil:0,marker:markerFor(w)};
 if(t<route.blockedUntil){routes.set(w.id,{...route,lastRequest:t});return 'stalled';}
 const progress=planar(here,route.lastPos)>0.35;
 if(progress){route.lastPos={...here};route.lastMoved=t;route.attempt=0;route.detourUntil=0;}
 let goal=landing(w.dimension,target);
 if(!goal){routes.set(w.id,{...route,lastRequest:t});return 'blocked';}
 if(t-route.lastMoved>240){
  const attempt=route.attempt||0;
  if(attempt>=4){route.blockedUntil=t+400;route.lastMoved=t;route.attempt=0;routes.set(w.id,{...route,lastRequest:t});return 'stalled';}
  const alt=detour(w,target,attempt);
  route.attempt=attempt+1;route.lastMoved=t;route.detourUntil=t+120;
  if(alt)goal=alt;
 }
 // Preserve the detour for a short window instead of oscillating back every tick.
 if(route.detourUntil>t&&route.detourPoint)goal=route.detourPoint;
 else if(route.detourUntil>t&&route.attempt)route.detourPoint={...goal};
 else route.detourPoint=null;
 const marker=pushMarker(w,slot,goal,route.marker);
 if(!marker){routes.set(w.id,{...route,lastRequest:t});return 'blocked';}
 routes.set(w.id,{...route,marker,lastRequest:t});
 return route.detourUntil>t?'rerouting':'walking';
}
export function cleanRoutes(v,workers,tick){
 const present=new Set(workers.map(w=>w.id));
 for(const w of workers){const r=routes.get(w.id);if(r&&tick-r.lastRequest>160)releaseRoute(v,w);}
 // A trader's destination marker may be beside a DIFFERENT village bell.
 // Only delete markers owned by this village, never another settlement's routes.
 const owned=new Set(v.workerIds||[]);
 for(const id of Object.keys(v.navSlots||{}))if(!owned.has(id))delete v.navSlots[id];
 try{
  const d=v.dimensionObject;
  for(const e of d.getEntities({type:'genesis:nav_marker',location:v.bell,maxDistance:46})){
   const who=e.getTags().find(t=>t.startsWith('grnav_'))?.slice(6);
   if(who&&owned.has(who)&&!present.has(who)){
    // Unloaded workers are not dead. Keep their marker until they are next loaded.
    continue;
   }
   // Unknown/foreign marker: do not remove it. A different village owns it.
  }
 }catch(_){ }
}
