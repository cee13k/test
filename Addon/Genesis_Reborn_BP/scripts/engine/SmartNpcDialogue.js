import { world, system } from '@minecraft/server';
import { ModalFormData } from '@minecraft/server-ui';

// Preserve the installed SmartNPC conversation store and its native local-model relay.
// Dialogue is intentionally restricted to custom SmartNPC workers; vanilla villagers
// remain census-only and never receive Genesis tags, movement, names, or job changes.
const KEY='smartnpc:conversation_v11', LEGACY='smartnpc:agent_v1';
const WORKER='smartnpc:worker', REACH=4.5;
const records=Object.create(null), activeUI=new Set(), crouch=new Map(), lastItem=new Map();
const rpc=new Map(), dialogueLocks=new Map();
let loaded=false, dirty=false, corrupt=false, seq=0;
let getRole=()=> 'Specialist', getStatus=()=> 'Ready';

const limit=(s,n=220)=>String(s??'').replace(/§./g,'').replace(/[\r\n\t]/g,' ').slice(0,n).trim();
const good=e=>{try{return !!e&&e.isValid!==false;}catch(_){return false;}};
const isWorker=e=>good(e)&&e.typeId===WORKER;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const nearby=(p,n,r)=>{try{return p.dimension.id===n.dimension.id&&distance(p.location,n.location)<=r;}catch(_){return false;}};
const names=['Elias','Mara','Rowan','Tobin','Ada','Bram','Iris','Finn','Nora','Soren','Wren','Lina'];
function seed(id){let h=2166136261;for(const c of String(id))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
function cleanInventory(obj){const out={};if(!obj||typeof obj!=='object')return out;for(const [k,v] of Object.entries(obj).slice(0,64))if(/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(k)&&Number.isSafeInteger(v)&&v>0&&v<=384)out[k]=v;return out;}
function make(e){return {name:limit(e?.nameTag,24)||names[seed(e?.id)%names.length],profession:limit(getRole(e),24)||'Specialist',inventory:{},ties:{},dialogue:{},last:limit(getStatus(e),120)||'Ready to help the village'};}

function save(){
 if(!dirty)return true;
 if(corrupt){console.warn('[SMARTNPC_MEMORY_SAVE_BLOCKED] existing conversation property is unreadable; original data preserved');return false;}
 try{const raw=JSON.stringify({version:11,agents:records});if(raw.length>29000){console.warn('[SMARTNPC_MEMORY_SAVE_BLOCKED] conversation memory exceeds safe property size');return false;}world.setDynamicProperty(KEY,raw);dirty=false;return true;}
 catch(e){console.warn('[SMARTNPC_MEMORY_SAVE_ERROR] '+String(e).slice(0,140));return false;}
}
function load(){
 if(loaded)return;
 try{
  const raw=world.getDynamicProperty(KEY);
  if(typeof raw==='string'){
   const data=JSON.parse(raw);
   if(!data||typeof data!=='object'||!data.agents||typeof data.agents!=='object'||Array.isArray(data.agents))throw Error('invalid conversation_v11 schema');
   Object.assign(records,data.agents);
  }else{
   // Read-only legacy migration. The old key is deliberately never deleted.
   const legacy=world.getDynamicProperty(LEGACY);
   if(typeof legacy==='string'){
    const data=JSON.parse(legacy);
    for(const [id,o] of Object.entries(data?.npcs||{}).slice(0,64))records[id]={name:limit(o?.name,24)||'Villager',profession:'Specialist',inventory:cleanInventory(o?.items),ties:{},dialogue:{},last:'Previous SmartNPC memory retained; legacy work orders are not resumed'};
    if(Object.keys(records).length)dirty=true;
   }
  }
 }catch(e){corrupt=true;console.warn('[SMARTNPC_MEMORY_LOAD_ERROR] '+String(e).slice(0,140));}
 loaded=true;if(dirty)save();
}
function agent(e){
 if(!isWorker(e)||!loaded)return null;
 let a=records[e.id];if(!a){if(Object.keys(records).length>=64)return null;a=records[e.id]=make(e);dirty=true;}
 if(!a.ties||typeof a.ties!=='object')a.ties={};if(!a.inventory||typeof a.inventory!=='object')a.inventory={};if(!a.dialogue||typeof a.dialogue!=='object')a.dialogue={};
 a.name=limit(a.name||e.nameTag||'Genesis Worker',24);a.profession=limit(getRole(e),24)||'Specialist';a.last=limit(getStatus(e),120)||a.last||'Ready';
 return a;
}
function friend(a,p){const key=p.id;let t=a.ties[key];if(!t){t={name:limit(p.name,24),trust:0,turns:0};a.ties[key]=t;dirty=true;}return t;}
function trustName(t){return t.trust>=12?'Trusted friend':t.trust>=5?'Friend':t.trust>=0?'Acquaintance':'Wary';}
function inventoryText(a){const count=Object.values(a.inventory||{}).reduce((n,v)=>n+(Number.isInteger(v)&&v>0?v:0),0);return count?'Legacy personal supplies on record; current work uses the physical village warehouse.':'Current work uses the physical village warehouse.';}
function answer(a,p,text){
 const q=text.toLowerCase(),t=friend(a,p);t.turns++;let result='';
 if(/\b(hello|hey|hi|howdy|good morning)\b/.test(q))result=`Hello, ${limit(p.name,24)}. It's good to see you. ${a.last}`;
 else if(/\b(how are you|how's it going|how do you feel)\b/.test(q))result=`I'm doing well. ${a.last} How are things with you?`;
 else if(/\b(what are you doing|what are you working|progress|your job|your plan)\b/.test(q))result=`I'm assigned as ${a.profession}. ${a.last}`;
 else if(/\b(what do you have|inventory|materials|supplies)\b/.test(q))result=inventoryText(a);
 else if(/\b(thank you|thanks|appreciate)\b/.test(q)){t.trust=Math.min(20,t.trust+2);result=`You're welcome, ${limit(p.name,24)}. I'm glad to help.`;}
 else if(/\b(sorry|apologize)\b/.test(q)){t.trust=Math.min(20,t.trust+1);result='That is alright. We can try again.';}
 else if(/\b(who are you|your name|tell me about yourself)\b/.test(q))result=`I'm ${a.name}, a ${a.profession} with the village workforce. I help using real supplies and approved tasks.`;
 else if(/\b(build|house|construct|farm|mine|chop|harvest|assign|job|work)\b/.test(q))result='My work is assigned through the Town Center. I only perform approved tasks and use real warehouse items; I cannot accept unapproved work orders through conversation.';
 else result=`I'm listening, ${limit(p.name,24)}. ${a.last}`;
 if(t.turns===2||t.turns===5||t.turns===10)t.trust=Math.min(20,t.trust+1);
 return result;
}
function askModel(a,p,q){
 return new Promise(resolve=>{
  if(rpc.size>=1){console.warn('[SMARTNPC_AI_BUSY] previous request active');resolve(null);return;}
  const id='q'+(++seq)+'-'+system.currentTick;rpc.set(id,resolve);
  const data={id,name:limit(a.name,24),role:limit(a.profession,24),player:limit(p.name,24),relationship:trustName(friend(a,p)),status:limit(a.last,120),items:limit(inventoryText(a),120),question:limit(q,240)};
  console.warn('[SMARTNPC_AI_REQUEST]'+JSON.stringify(data));
  system.runTimeout(()=>{if(rpc.delete(id)){console.warn('[SMARTNPC_AI_TIMEOUT] '+id);resolve(null);}},1200);
 });
}
function respond(p,n,a,question){
 const q=limit(question,240),low=q.toLowerCase();let reply=answer(a,p,q);
 // Model output is dialogue only. It is never parsed as a job, command, or world action.
 const isWorkOrder=/\b(build|construct|farm|mine|chop|harvest|assign|change job|start working|stop working|follow me|come here|go to)\b/.test(low);
 if(!isWorkOrder){/* model request is awaited by the caller to keep the form responsive */}
 if(!a.dialogue[p.id])a.dialogue[p.id]=[];a.dialogue[p.id].push({q,reply});a.dialogue[p.id]=a.dialogue[p.id].slice(-5);dirty=true;
 return isWorkOrder?Promise.resolve(reply):askModel(a,p,q).then(generated=>{if(generated){reply=generated;const rows=a.dialogue[p.id],row=rows?.length?rows[rows.length-1]:null;if(row&&row.q===q)row.reply=reply;dirty=true;}return reply;});
}
function isSmartNpcDialogueLocked(e){try{return !!e&&dialogueLocks.has(e.id);}catch(_){return false;}}
function beginDialogue(player,npc){
 try{
  if(!npc)return;let entry=dialogueLocks.get(npc.id);
  if(entry){entry.viewers.add(player.id);entry.last=system.currentTick;return;}
  const movement=npc.getComponent('minecraft:movement');let base=null,frozen=false;
  try{if(movement){base=movement.currentValue;frozen=movement.setCurrentValue(0)!==false;}}catch(err){console.warn('[SMARTNPC_TALK_SPEED_UNAVAILABLE] '+String(err).slice(0,100));}
  dialogueLocks.set(npc.id,{viewers:new Set([player.id]),base,frozen,last:system.currentTick});
 }catch(err){console.warn('[SMARTNPC_TALK_ERROR] '+String(err).slice(0,100));}
}
function touchDialogue(player,npc){const entry=dialogueLocks.get(npc.id);if(entry){entry.viewers.add(player.id);entry.last=system.currentTick;}}
function endDialogue(player,npc){
 try{
  if(!npc)return;const entry=dialogueLocks.get(npc.id);if(!entry)return;entry.viewers.delete(player.id);if(entry.viewers.size)return;dialogueLocks.delete(npc.id);
  try{if(entry.frozen&&good(npc)){const movement=npc.getComponent('minecraft:movement');if(movement&&entry.base!==null)movement.setCurrentValue(entry.base);}}catch(err){console.warn('[SMARTNPC_TALK_RESTORE_ERROR] '+String(err).slice(0,100));}
 }catch(err){console.warn('[SMARTNPC_TALK_ERROR] '+String(err).slice(0,100));}
}
async function conversation(p,n){
 if(!good(p)||!isWorker(n)||activeUI.has(p.id)||!loaded)return;const a=agent(n);if(!a)return;activeUI.add(p.id);beginDialogue(p,n);
 try{
  let reply=`Hi. I'm ${a.name}. What would you like to talk about?`;
  for(let round=0;round<8;round++){
   if(!good(n)||!nearby(p,n,7))break;touchDialogue(p,n);const t=friend(a,p);
   const label=`${a.name} · ${trustName(t)} (${t.trust})\n${a.profession} · ${a.last}\n\n${limit(reply,500)}`;
   const form=new ModalFormData().title(`${a.name} — Chat`).textField(label,'Type a message to the worker...');
   const r=await form.show(p).catch(e=>{console.warn('[SMARTNPC_DIALOGUE_FORM_ERROR] '+String(e).slice(0,120));return null;});
   if(!r||r.canceled)break;await new Promise(resolve=>system.runTimeout(resolve,2));
   const q=limit(r.formValues?.[0],240);if(!q)break;reply=await respond(p,n,a,q);
  }
 }catch(e){try{p.sendMessage('§c[SmartNPC] Conversation error: '+limit(e,90));}catch(_){}console.warn('[SMARTNPC_DIALOGUE_ERROR] '+String(e).slice(0,140));}
 finally{endDialogue(p,n);activeUI.delete(p.id);if(dirty)save();}
}
function aimed(p){try{for(const hit of p.getEntitiesFromViewDirection({maxDistance:REACH}))if(isWorker(hit.entity)&&nearby(p,hit.entity,REACH))return hit.entity;}catch(_){}return null;}

export function configureSmartNpcDialogue(options={}){
 if(typeof options.getRole==='function')getRole=options.getRole;
 if(typeof options.getStatus==='function')getStatus=options.getStatus;
}
export function migrateSmartNpcWorkerMemory(oldId,newId,name,role){
 load();if(!newId)return false;
 try{
  if(!records[newId]){
   const prior=records[oldId];
   records[newId]=prior?JSON.parse(JSON.stringify(prior)):{name:limit(name,24)||'Genesis Worker',profession:limit(role,24)||'Specialist',inventory:{},ties:{},dialogue:{},last:'Joined the Genesis workforce'};
  }
  const a=records[newId];a.name=limit(a.name||name||'Genesis Worker',24);a.profession=limit(role||a.profession||'Specialist',24);a.inventory=cleanInventory(a.inventory);a.ties=a.ties&&typeof a.ties==='object'?a.ties:{};a.dialogue=a.dialogue&&typeof a.dialogue==='object'?a.dialogue:{};
  dirty=true;return save();
 }catch(e){console.warn('[SMARTNPC_MEMORY_MIGRATION_ERROR] '+String(e).slice(0,120));return false;}
}
export function updateSmartNpcWorkerRole(workerId,role){load();const a=records[workerId];if(!a)return; a.profession=limit(role,24)||'Specialist';dirty=true;save();}
export { isSmartNpcDialogueLocked };

// Native SmartNPC bridge: existing host watches SMARTNPC_AI_REQUEST and replies with
// scriptevent smartnpc:reply. This listener only handles the existing reply channel.
try{system.afterEvents.scriptEventReceive.subscribe(ev=>{
 if(ev.id!=='smartnpc:reply'||ev.sourceType!=='Server')return;let data;try{data=JSON.parse(ev.message);}catch(_){return;}
 const cb=rpc.get(data?.id);if(!cb)return;rpc.delete(data.id);cb(data?.ok===true?limit(data.text,320):null);
});}catch(e){console.warn('[SMARTNPC_AI_REPLY_LISTENER_UNAVAILABLE] '+String(e).slice(0,100));}

system.run(()=>{try{load();console.warn('[SMARTNPC_DIALOGUE_READY] worker-only conversation and saved memory loaded');}catch(e){console.warn('[SMARTNPC_DIALOGUE_LOAD_ERROR] '+String(e).slice(0,100));}});
system.runInterval(()=>{
 const now=system.currentTick;
 for(const [id,entry] of dialogueLocks){if(now-entry.last<12000)continue;let npc;try{npc=world.getEntity(id);}catch(_){}dialogueLocks.delete(id);try{if(good(npc)&&entry.frozen&&entry.base!==null)npc.getComponent('minecraft:movement')?.setCurrentValue(entry.base);}catch(_){}console.warn('[SMARTNPC_TALK_TIMEOUT] npc='+id);}
},200);
system.runInterval(()=>{
 if(!loaded)return;
 for(const p of world.getAllPlayers()){
  try{
   if(!p.isSneaking){crouch.delete(p.id);continue;}
   const n=aimed(p);if(!n){crouch.delete(p.id);continue;}
   const current=crouch.get(p.id),now=system.currentTick;
   if(!current||current.id!==n.id){crouch.set(p.id,{id:n.id,tick:now,opened:false});continue;}
   if(current.opened||now-current.tick<20)continue;current.opened=true;
   system.run(()=>{if(good(n)&&nearby(p,n,REACH))void conversation(p,n);});
  }catch(e){crouch.delete(p.id);}
 }
},2);
try{world.afterEvents.itemUse.subscribe(ev=>{
 if(ev.itemStack?.typeId!=='minecraft:carrot_on_a_stick')return;const p=ev.source,now=system.currentTick;
 if(now-(lastItem.get(p.id)??-1000)<30)return;lastItem.set(p.id,now);
 system.runTimeout(()=>{const n=aimed(p);if(n)void conversation(p,n);},2);
});}catch(e){console.warn('[SMARTNPC_DIALOGUE_ITEM_TRIGGER_UNAVAILABLE] '+String(e).slice(0,100));}
