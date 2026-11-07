import { moveNative, releaseRoute, cleanRoutes } from './nav.js';
import { verifySite, remainingMaterials } from './engine/SiteSafety.js';
import { stockDeficits, chooseConstruction, contractRequest, contractProgress, relation } from './engine/Civilization.js';
import { withInventoryRollback } from './engine/InventorySafety.js';
import { waypoint, findCandidate } from './engine/TradeRoutes.js';
import { supplyPlan, nextProductionOrder } from './union/SupplyPlanner.js';
import { BlockBudget } from './union/BlockBudget.js';
import { world, system, ItemStack, BlockPermutation } from '@minecraft/server';
import { ActionFormData, MessageFormData, ModalFormData } from '@minecraft/server-ui';
import { readConstructionStructure, planFromStructurePreview, safeVillageConversions } from './integration/StructureBridge.js';
import { shortageForWarehouse } from './integration/ConstructionSupplies.js';
import { checkBlueprintBlock, VerifiedLevel } from './integration/ConstructVerifier.js';
import { barterQuote } from './integration/BeePricing.js';
import { configureSmartNpcDialogue, migrateSmartNpcWorkerMemory, updateSmartNpcWorkerRole, isSmartNpcDialogueLocked } from './engine/SmartNpcDialogue.js';

// GENESIS REBORN 2.4 — integrated Bedrock civilization add-on.
// Original SmartNPC namespaces and vanilla villager definitions are never edited.
const KEY='genesis_reborn:state_01', LEGACY_CIV_KEY='smartnpc:civilization:v1', HISTORY_PREFIX='genesis_reborn:history_', ROSTER_PREFIX='genesis_reborn:roster_', PROJECT_PREFIX='genesis_reborn:projects_', TILE_PREFIX='genesis_reborn:tiles_', TILE_CHUNK=128, VER=7, RADIUS=46, MAX_VILLAGES=8, MAX_WORKERS=12;
const TYPES=['minecraft:villager','minecraft:villager_v2'];
const WOOD=/^minecraft:(?:(?:stripped_)?(?:oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|pale_oak)_(?:log|wood)|(?:stripped_)?(?:crimson|warped)_(?:stem|hyphae)|(?:oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|pale_oak|crimson|warped)_planks)$/;
const QUARRY_OUTPUTS=new Set(['minecraft:cobblestone','minecraft:cobbled_deepslate','minecraft:coal','minecraft:raw_iron']);
const CROP_ITEMS=new Set(['minecraft:wheat','minecraft:wheat_seeds','minecraft:carrot','minecraft:potato','minecraft:beetroot','minecraft:beetroot_seeds']);
const JOBS=['Hauler','Builder','Crafter','Farmer','Ranger','Sentinel','Medic','Provisioner','Miner','Steward','Trader'];
const RECIPES={planks:{title:'Oak planks ×4',needs:{'minecraft:oak_log':1},gives:{'minecraft:oak_planks':4}},sticks:{title:'Sticks ×4',needs:{'minecraft:oak_planks':2},gives:{'minecraft:stick':4}},chest:{title:'Chest ×1',needs:{'minecraft:oak_planks':8},gives:{'minecraft:chest':1}},bread:{title:'Bread ×1',needs:{'minecraft:wheat':3},gives:{'minecraft:bread':1}},torches:{title:'Torches ×4',needs:{'minecraft:stick':1,'minecraft:coal':1},gives:{'minecraft:torch':4}},fences:{title:'Oak Fences ×3',needs:{'minecraft:oak_planks':4,'minecraft:stick':2},gives:{'minecraft:oak_fence':3}},slabs:{title:'Oak Slabs ×6',needs:{'minecraft:oak_planks':3},gives:{'minecraft:oak_slab':6}}};
let state={version:VER,aiEnabled:false,legacyCivImported:false,villages:{}}, dirty=false, ready=false, cursor=0;const dirtyHistories=new Set(),dirtyRosters=new Set(),dirtyProjects=new Set(),dirtyProjectTiles=new Set();
const openMenus=new Set();
const workerStatuses=new Map();const combatCooldown=new Map();const defenseScanCache=new Map();
function status(w,message){workerStatuses.set(w.id,{message,tick:system.currentTick||0});}
function workerStatus(v,w){const trip=v.tradeTrips?.[w.id];if(trip&&(trip.phase==='audit'||trip.phase==='auditReturn'))return 'Trade settlement audit hold';const c=v.cargo[w.id]||v.builderCargo?.[w.id]||v.medicalCargo?.[w.id];if(c?.phase==='audit')return `Inventory audit hold: ${c.id.replace('minecraft:','')} ×${c.amount}`;if(c)return `Carrying ${c.id.replace('minecraft:','')} ×${c.amount}`;if(!state.aiEnabled)return 'Global worker engine paused';const old=workerStatuses.get(w.id);if(old&&(system.currentTick||0)-old.tick<300)return old.message;const j=jobOf(v,w);if(!v.enabled)return 'Village specialists paused';if(!chestFor(v)&&j!=='Sentinel')return 'Waiting for warehouse';return 'Awaiting work';}
configureSmartNpcDialogue({getRole:w=>{const v=Object.values(state.villages).find(x=>x.workerIds.includes(w.id));return v?jobOf(v,w):'Specialist';},getStatus:w=>{const v=Object.values(state.villages).find(x=>x.workerIds.includes(w.id));return v?workerStatus(v,w):'Ready';}});
const note=s=>console.warn('[GENESIS_REBORN] '+s);
const day=()=>{try{return world.getDay();}catch(_){return 0;}};
const xyz=p=>`${Math.floor(p.x)},${Math.floor(p.y)},${Math.floor(p.z)}`;
const hd=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function dimension(v){try{return world.getDimension(v.dimension.replace('minecraft:',''));}catch(_){return null;}}
function getBlock(d,p){try{return d.getBlock(p);}catch(_){return undefined;}}
function valid(e){try{return !!e&&e.isValid!==false;}catch(_){return false;}}
function announce(p,s){try{p.sendMessage('§2[Genesis Reborn]§r '+s);}catch(_){}}
function event(v,t,message){v.history??=[];v.history.unshift({day:day(),type:t,message:String(message).slice(0,105)});v.history.length=Math.min(50,v.history.length);dirtyHistories.add(v.id);dirty=true;}
function historyKey(id){return HISTORY_PREFIX+String(id).replace(/[^a-zA-Z0-9_-]/g,'_');}
function rosterKey(id){return ROSTER_PREFIX+String(id).replace(/[^a-zA-Z0-9_-]/g,'_');}
function projectKey(id){return PROJECT_PREFIX+String(id).replace(/[^a-zA-Z0-9_-]/g,'_');}
function tileKey(id,pid,index){const safe=x=>String(x).replace(/[^a-zA-Z0-9_-]/g,'_');return TILE_PREFIX+safe(id)+'_'+safe(pid)+'_'+index;}
function addProject(v,q){v.projectSerial??=0;q.projectId??='p'+(++v.projectSerial);const serial=String(q.projectId).match(/^p(\d+)$/);if(serial)v.projectSerial=Math.max(v.projectSerial,Number(serial[1]));if(Array.isArray(q.tiles)){q.tileCount=q.tiles.length;q.tileChunks=Math.ceil(q.tiles.length/TILE_CHUNK);dirtyProjectTiles.add(v.id+'|'+q.projectId);}v.queue.push(q);dirtyProjects.add(v.id);dirty=true;return q;}
function utf8Length(value){let bytes=0;for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c<0x80)bytes++;else if(c<0x800)bytes+=2;else if(c>=0xD800&&c<=0xDBFF&&i+1<value.length&&value.charCodeAt(i+1)>=0xDC00&&value.charCodeAt(i+1)<=0xDFFF){bytes+=4;i++;}else bytes+=3;}return bytes;}
function persist(){
 if(!dirty)return true;
 const rollback=[];
 const rollbackAll=()=>{let restored=true;for(let i=rollback.length-1;i>=0;i--){const [key,previous]=rollback[i];try{world.setDynamicProperty(key,previous);}catch(restoreError){restored=false;note('SAVE ROLLBACK FAILED '+key+': '+restoreError);}}return restored;};
 const abortSave=message=>{const restored=rollbackAll();note(message+'; prior property values '+(restored?'restored':'not fully restored'));return false;};
 const writeProperty=(key,value)=>{const previous=world.getDynamicProperty(key);rollback.push([key,previous]);world.setDynamicProperty(key,value);};
 try{
  const corrupt=Object.values(state.villages).find(v=>v.persistenceError);if(corrupt){note('SAVE PAUSED: unreadable saved data for village '+corrupt.id+'; existing records preserved');return false;}
  const main={version:state.version,aiEnabled:state.aiEnabled,legacyCivImported:state.legacyCivImported===true,villages:{}};
  for(const [id,v] of Object.entries(state.villages)){const saved={...v};delete saved.history;delete saved.residents;delete saved.conversions;delete saved.queue;delete saved.approvedPlots;main.villages[id]=saved;}
  const data=JSON.stringify(main);
  if(utf8Length(data)>29000){note('STATE LIMIT: refusing to overwrite resident and project records');return false;}
  const writtenRosters=[];for(const [id,v] of Object.entries(state.villages))if(dirtyRosters.has(id)){
   const rosterData=JSON.stringify({residents:v.residents||{},conversions:v.conversions||{}});if(utf8Length(rosterData)>29000){return abortSave('ROSTER LIMIT: refusing to overwrite '+id+' resident records');}writeProperty(rosterKey(id),rosterData);writtenRosters.push(id);
  }
  const writtenProjectTiles=[],writtenProjects=[];
  for(const [id,v] of Object.entries(state.villages))for(const q of v.queue||[]){const projectDirtyKey=id+'|'+q.projectId;if(!dirtyProjectTiles.has(projectDirtyKey)||!Array.isArray(q.tiles))continue;q.tileCount=q.tiles.length;q.tileChunks=Math.ceil(q.tiles.length/TILE_CHUNK);for(let i=0;i<q.tileChunks;i++){const chunkData=JSON.stringify(q.tiles.slice(i*TILE_CHUNK,(i+1)*TILE_CHUNK));if(utf8Length(chunkData)>29000){return abortSave('PROJECT TILE LIMIT: '+q.projectId+' chunk '+i);}writeProperty(tileKey(id,q.projectId,i),chunkData);}writtenProjectTiles.push(projectDirtyKey);dirtyProjects.add(id);}
  for(const [id,v] of Object.entries(state.villages))if(dirtyProjects.has(id)){const queue=(v.queue||[]).map(q=>{const saved={...q};if(Array.isArray(saved.tiles)){saved.tileCount=saved.tiles.length;saved.tileChunks=Math.ceil(saved.tiles.length/TILE_CHUNK);delete saved.tiles;}return saved;});const projectsData=JSON.stringify({queue,approvedPlots:v.approvedPlots||[]});if(utf8Length(projectsData)>29000){return abortSave('PROJECT LIMIT: refusing to overwrite '+id+' project records');}writeProperty(projectKey(id),projectsData);writtenProjects.push(id);}
  const writtenHistories=[];for(const [id,v] of Object.entries(state.villages))if(dirtyHistories.has(id)){
   const historyData=JSON.stringify(Array.isArray(v.history)?v.history:[]);
   if(utf8Length(historyData)>29000){return abortSave('HISTORY LIMIT: refusing to overwrite '+id+' history');}
   writeProperty(historyKey(id),historyData);writtenHistories.push(id);
  }
  writeProperty(KEY,data);for(const id of writtenRosters)dirtyRosters.delete(id);for(const id of writtenProjects)dirtyProjects.delete(id);for(const id of writtenProjectTiles)dirtyProjectTiles.delete(id);for(const id of writtenHistories)dirtyHistories.delete(id);dirty=false;for(const [id,v] of Object.entries(state.villages))for(const q of v.queue||[])if(q.tileChunks>0&&(q.state==='complete'||q.state==='cancelled')){for(let i=0;i<q.tileChunks;i++)try{world.setDynamicProperty(tileKey(id,q.projectId,i),undefined);}catch(_){}q.tileChunks=0;dirtyProjects.add(id);dirty=true;}return true;
 }catch(e){const restored=rollbackAll();note('SAVE FAILED '+e+'; prior property values '+(restored?'restored':'not fully restored'));return false;}
}

function migrate(o){
 if(!o||typeof o!=='object'||!o.villages)return state;
 const priorVersion=Number(o.version||0);
 for(const [villageId,v] of Object.entries(o.villages)){
  v.id=villageId;v.censusWarmup=true;v.residents??={};v.conversions??={};try{const rosterRaw=world.getDynamicProperty(rosterKey(villageId));if(typeof rosterRaw==='string'){const roster=JSON.parse(rosterRaw);if(roster&&typeof roster==='object'&&!Array.isArray(roster)&&(!roster.residents||(typeof roster.residents==='object'&&!Array.isArray(roster.residents)))&&(!roster.conversions||(typeof roster.conversions==='object'&&!Array.isArray(roster.conversions)))){v.residents=roster.residents||v.residents;v.conversions=roster.conversions||v.conversions;}else v.persistenceError=true;}else dirtyRosters.add(villageId);}catch(e){v.persistenceError=true;note('ROSTER LOAD FAILED '+e);}v.history=Array.isArray(v.history)?v.history:Array.isArray(v.events)?v.events:[];try{const historyRaw=world.getDynamicProperty(historyKey(villageId));if(typeof historyRaw==='string'){const history=JSON.parse(historyRaw);if(Array.isArray(history))v.history=history;else v.persistenceError=true;}else dirtyHistories.add(villageId);}catch(e){v.persistenceError=true;note('HISTORY LOAD FAILED '+e);}
  v.residents??={};for(const m of Object.values(v.residents)){m.name??='Villager';m.age??='unknown';m.joined??=day();m.seen??=m.joined;m.lastDimension??=v.dimension;if(m.life==='present'||m.life==='wandering'||!m.life)m.life='unloaded';}v.workerIds??=[];v.cargo??={};v.builderCargo??={};v.jobs??={};v.chest??=null;
  v.queue??=[];v.crafts??=[];v.sites??=[];v.approvedPlots??=[];v.projectSerial??=0;try{const projectRaw=world.getDynamicProperty(projectKey(villageId));if(typeof projectRaw==='string'){const projects=JSON.parse(projectRaw);if(projects&&typeof projects==='object'&&!Array.isArray(projects)){const validQueue=Array.isArray(projects.queue)&&projects.queue.every(q=>q&&typeof q==='object'&&!Array.isArray(q)),validPlots=projects.approvedPlots===undefined||Array.isArray(projects.approvedPlots);if(validQueue&&validPlots){v.queue=projects.queue;v.approvedPlots=projects.approvedPlots||v.approvedPlots;}else v.persistenceError=true;}else v.persistenceError=true;}else dirtyProjects.add(villageId);}catch(e){v.persistenceError=true;note('PROJECT LOAD FAILED '+e);}
  for(const q of v.queue){q.progress??=0;q.state??='queued';q.reason??='';q.projectId??='p'+(++v.projectSerial);const serial=String(q.projectId).match(/^p(\d+)$/);if(serial)v.projectSerial=Math.max(v.projectSerial,Number(serial[1]));if(Array.isArray(q.tiles)){q.tileCount=q.tiles.length;q.tileChunks=Math.ceil(q.tiles.length/TILE_CHUNK);dirtyProjectTiles.add(villageId+'|'+q.projectId);dirtyProjects.add(villageId);}else if(q.tileCount>0&&q.state!=='complete'&&q.state!=='cancelled'){const tiles=[];for(let i=0;i<(q.tileChunks||Math.ceil(q.tileCount/TILE_CHUNK));i++){try{const raw=world.getDynamicProperty(tileKey(villageId,q.projectId,i));if(typeof raw==='string'){const chunk=JSON.parse(raw);if(Array.isArray(chunk))tiles.push(...chunk);}}catch(_){}}if(tiles.length===q.tileCount&&tiles.every(t=>t&&typeof t.id==='string'&&Number.isFinite(t.x)&&Number.isFinite(t.y)&&Number.isFinite(t.z)))q.tiles=tiles;else{q.state='blocked';q.reason='Saved Construct blueprint data incomplete';v.persistenceError=true;note('PROJECT TILE DATA INCOMPLETE '+q.projectId);}}}
  v.farm??=null;v.farmCursor??=0;v.farmEnabled??=false;v.haulCrops??=false;
  v.woodlot??=null;v.woodlotEnabled??=false;v.woodCursor??=0;v.woodCutting??={};
  v.guardEnabled??=false;v.enabled??=true;v.protection??={};v.morale??=100;
  v.metrics??={};v.metrics.picked??=0;v.metrics.delivered??=0;v.metrics.built??=0;v.metrics.crafted??=0;v.metrics.harvested??=0;v.metrics.mined??=0;
  v.governor??={};v.governor.enabled??=false;v.governor.autoJobs??=false;v.governor.foodReserve??=12;v.governor.woodReserve??=24;v.governor.guardCombat??=false;v.governor.autoExpansion??=false;
  v.provisioning??={};v.provisioning.enabled??=false;v.provisioning.lastDay??=-1;v.provisioning.delivered??=0;
  v.defense??={};v.defense.hits??=0;v.defense.healed??=0;v.defense.shots??=0;v.defense.donations??=0;v.defense.last??='not attempted';
  v.medicalCargo??={};v.rallies??={};v.navSlots??={};v.lastAlert??=0;
  v.quarry??=null;v.quarryEnabled??=false;v.quarryCursor??=0;
  v.contracts??=[];for(const c of v.contracts){c.delivered??=0;c.status??='open';}
  v.relations??={};v.pendingTreaties??=[];v.tradeTrips??={};v.conversions??={};for(const c of Object.values(v.conversions)){c.name??='Villager';c.convertedDay??=day();c.seen??=c.convertedDay;c.lastDimension??=v.dimension;if(c.life==='present'||c.life==='wandering'||!c.life)c.life='unloaded';}v.contractSerial??=0;v.stewardDay??=-1;v.autoSiteLastDay??=-1;
 }
 return {version:VER,aiEnabled:priorVersion<7?false:o.aiEnabled===true,legacyCivImported:o.legacyCivImported===true,villages:o.villages};
}
function validPosition(p){return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);}
function newVillageState(id,dimensionId,bell,founder){return {id,dimension:dimensionId,bell:{x:Math.floor(bell.x),y:Math.floor(bell.y),z:Math.floor(bell.z)},founder:founder||'Unknown Founder',residents:{},workerIds:[],jobs:{},cargo:{},builderCargo:{},chest:null,history:[],queue:[],crafts:[],farm:null,farmCursor:0,farmEnabled:false,woodlot:null,woodlotEnabled:false,woodCursor:0,woodCutting:{},guardEnabled:false,haulCrops:false,governor:{enabled:false,autoJobs:false,foodReserve:12,woodReserve:24,guardCombat:false,autoExpansion:false},approvedPlots:[],medicalCargo:{},rallies:{},navSlots:{},provisioning:{enabled:false,lastDay:-1,delivered:0},defense:{hits:0,healed:0,shots:0,donations:0,last:'not attempted'},quarry:null,quarryEnabled:false,quarryCursor:0,contracts:[],contractSerial:0,relations:{},pendingTreaties:[],tradeTrips:{},conversions:{},enabled:true,protection:{},morale:100,lastAlert:0,stewardDay:-1,autoSiteLastDay:-1,metrics:{picked:0,delivered:0,built:0,crafted:0,harvested:0,mined:0}};}
function migrateLegacyCivilization(){
 if(state.legacyCivImported)return 0;
 let raw;try{raw=world.getDynamicProperty(LEGACY_CIV_KEY);}catch(e){note('LEGACY CIVILIZATION READ FAILED '+e);return 0;}
 if(typeof raw!=='string')return 0;
 if(utf8Length(raw)>30000){note('LEGACY CIVILIZATION IMPORT PAUSED: original property exceeds safe read size; source property preserved');return 0;}
 let legacy;try{legacy=JSON.parse(raw);}catch(e){note('LEGACY CIVILIZATION IMPORT PAUSED: source JSON is unreadable; source property preserved');return 0;}
 if(!legacy||legacy.version!==1||!legacy.villages||typeof legacy.villages!=='object'||Array.isArray(legacy.villages)){note('LEGACY CIVILIZATION IMPORT PAUSED: unsupported source schema; source property preserved');return 0;}
 let imported=0;
 for(const [legacyId,old] of Object.entries(legacy.villages)){
  if(!old||typeof old!=='object'||!old.dimension||!validPosition(old.bell||old.origin))continue;
  const hasBell=validPosition(old.bell),center=old.bell||old.origin,dimensionId=String(old.dimension),id=dimensionId+'|'+xyz(center);
  let bellNeedsLink=!hasBell;try{if(hasBell){const oldBellBlock=getBlock(world.getDimension(dimensionId.replace('minecraft:','')),center);if(oldBellBlock&&oldBellBlock.typeId!=='minecraft:bell')bellNeedsLink=true;}}catch(_){}
  const nearbyExisting=Object.values(state.villages).filter(x=>x.dimension===dimensionId&&validPosition(x.bell)&&hd(x.bell,center)<=RADIUS);
  let v=state.villages[id]||Object.values(state.villages).find(x=>x.legacyCivId===legacyId)||(nearbyExisting.length===1?nearbyExisting[0]:null);
  const created=!v;if(!v){v=newVillageState(id,dimensionId,center,old.owner||'Legacy Founder');state.villages[id]=v;}
  v.legacyCivId=legacyId;v.legacyNeedsBell=bellNeedsLink&&(created||v.legacyNeedsBell===true||xyz(v.bell)===xyz(center));v.legacyImportVersion=1;v.censusWarmup=true;
  v.legacySummary={sourceKey:LEGACY_CIV_KEY,sourceId:legacyId,stockItemTypes:Object.keys(old.stock||{}).length,cargoRecords:Object.keys(old.cargo||{}).length,projectStage:old.plan?.stage||null,projectPlaced:Number(old.plan?.placed)||0,completed:Number(old.completed)||0,failed:Number(old.failed)||0};
  if(!v.founder||v.founder==='Unknown Founder')v.founder=old.owner||'Legacy Founder';
  if(!v.ownerSalt&&typeof old.ownerSalt==='string')v.ownerSalt=old.ownerSalt;if(!v.ownerPasswordHash&&typeof old.ownerPasswordHash==='string')v.ownerPasswordHash=old.ownerPasswordHash;if(!v.ownerLockVersion&&old.ownerLockVersion)v.ownerLockVersion=old.ownerLockVersion;
  v.residents??={};
  for(const [residentId,m] of Object.entries(old.members||{})){
   if(v.residents[residentId]||!m||typeof m!=='object')continue;
   const loc=validPosition(m.lastLoc)?m.lastLoc:center;
   v.residents[residentId]={name:String(m.name||'Villager').slice(0,30),age:m.isBaby===true?'child':m.isBaby===false?'adult':'unknown',life:m.life==='deceased'?'dead':'unloaded',joined:day(),seen:day(),last:{x:Math.floor(loc.x),y:Math.floor(loc.y),z:Math.floor(loc.z)},lastDimension:dimensionId,legacyRole:String(m.role||'unassigned').slice(0,24),legacyCheckedIn:m.checkedIn===true,legacyNote:String(m.lastNote||'').slice(0,90)};
  }
  if(!v.history.length&&Array.isArray(old.history))v.history=old.history.slice(-50).reverse().map(message=>({day:day(),type:'legacy',message:String(message).slice(0,105)}));
  dirtyRosters.add(v.id);dirtyHistories.add(v.id);event(v,'migration','Imported existing SmartNPC civilization records; vanilla residents remain census-only and old stock/jobs are not resumed');imported++;
 }
 state.legacyCivImported=true;dirty=true;
 note('LEGACY CIVILIZATION MIGRATION staged '+imported+' village(s); original '+LEGACY_CIV_KEY+' property left unchanged');
 return imported;
}
function villageAt(dim,pos){return Object.values(state.villages).find(v=>v.dimension===dim.id&&xyz(v.bell)===xyz(pos));}
function entities(v,q={}){const d=dimension(v);if(!d)return [];try{return d.getEntities({location:v.bell,maxDistance:RADIUS,...q}).filter(valid);}catch(_){return [];}}
function residents(v){return entities(v).filter(e=>TYPES.includes(e.typeId)&&Math.abs(e.location.y-v.bell.y)<15);}
function workerList(v){
 const loaded=new Map();
 for(const id of v.workerIds){try{const e=world.getEntity(id);if(valid(e)&&e.typeId==='smartnpc:worker')loaded.set(id,e);}catch(_){}}
 for(const e of entities(v,{type:'smartnpc:worker'}))if(v.workerIds.includes(e.id))loaded.set(e.id,e);
 return [...loaded.values()];
}
function roleAge(e){try{return e.getComponent('minecraft:is_baby')?'child':'adult';}catch(_){return 'unknown';}}
function villagerVariant(e){try{const value=e.getComponent('minecraft:variant')?.value;return Number.isInteger(value)?value:null;}catch(_){return null;}}
function confirmedAdultNitwit(e){return valid(e)&&TYPES.includes(e.typeId)&&roleAge(e)==='adult'&&villagerVariant(e)===14;}
function emptyVillagerInventory(e){try{const inventory=e.getComponent('minecraft:inventory')?.container;if(!inventory)return false;for(let i=0;i<inventory.size;i++)if(inventory.getItem(i))return false;return true;}catch(_){return false;}}
function villagerWorkforceProbe(v){const list=residents(v),report={total:list.length,adults:0,children:0,inventoryApi:0,inventoryReadable:0,inventorySlots:0,occupiedSlots:0,heldItems:{},addItemApi:0,components:{}};for(const e of list){if(roleAge(e)==='adult')report.adults++;else if(roleAge(e)==='child')report.children++;if(typeof e.addItem==='function')report.addItemApi++;try{for(const c of e.getComponents()){const id=c.typeId||c.id||'unknown';report.components[id]=(report.components[id]||0)+1;}}catch(_){}try{const box=e.getComponent('minecraft:inventory')?.container;if(box){report.inventoryApi++;report.inventorySlots+=box.size;let readable=true;for(let i=0;i<box.size;i++){const stack=box.getItem(i);if(stack){if(typeof stack.typeId!=='string'||!Number.isFinite(stack.amount)){readable=false;continue;}report.occupiedSlots++;report.heldItems[stack.typeId]=(report.heldItems[stack.typeId]||0)+stack.amount;}}if(readable)report.inventoryReadable++;}}catch(_){}}return report;}
function scanActive(v){try{return dimension(v).getPlayers({location:v.bell,maxDistance:RADIUS}).length>0;}catch(_){return false;}}
function census(v){
 const d=dimension(v);if(!d)return;const nearIds=new Set();
 for(const e of residents(v)){
  nearIds.add(e.id);let m=v.residents[e.id];
  if(!m){m={name:(e.nameTag||'Villager').slice(0,30),age:roleAge(e),life:'present',joined:day()};v.residents[e.id]=m;event(v,'arrival',m.name+' joined');}
  const previous=m.life,age=roleAge(e);if(m.age==='child'&&age==='adult')event(v,'grown',m.name+' grew up');
  m.age=age;m.life='present';m.seen=day();m.last={x:Math.floor(e.location.x),y:Math.floor(e.location.y),z:Math.floor(e.location.z)};m.lastDimension=v.dimension;
  if(e.nameTag)m.name=e.nameTag.slice(0,30);if(previous&&previous!=='present'&&previous!=='converted'&&!v.censusWarmup)event(v,'return',m.name+' returned to the Town Center area');
 }
 // Track previously registered villagers that are loaded nearby but outside the settlement radius.
 const wanderingIds=new Set();
 for(const type of TYPES){try{for(const e of d.getEntities({type,location:v.bell,maxDistance:RADIUS*2})){
  if(!valid(e)||nearIds.has(e.id))continue;const m=v.residents[e.id];if(!m||m.life==='dead'||m.life==='converted')continue;
  wanderingIds.add(e.id);const previous=m.life;m.life='wandering';m.age=roleAge(e);m.seen=day();m.last={x:Math.floor(e.location.x),y:Math.floor(e.location.y),z:Math.floor(e.location.z)};m.lastDimension=v.dimension;if(e.nameTag)m.name=e.nameTag.slice(0,30);
  if(previous!=='wandering'&&!v.censusWarmup)event(v,'wandering',m.name+' is loaded outside the Town Center radius');
 }}catch(_){}}
 if(scanActive(v))for(const [id,m] of Object.entries(v.residents)){
  if(nearIds.has(id)||wanderingIds.has(id)||m.life==='dead'||m.life==='converted')continue;
  const previous=m.life,lastBlock=m.last&&m.lastDimension===v.dimension?getBlock(d,m.last):null,age=day()-(m.seen??m.joined??day());
  const nextLife=lastBlock&&age>=7?'missing':'unloaded';m.life=nextLife;
  if(previous!==nextLife&&!v.censusWarmup)event(v,nextLife,m.name+(nextLife==='missing'?' not seen for seven in-game days':' last known chunk is not currently accounted for'));
 }
 // Converted nitwits remain residents even while their worker entity is unloaded or wandering.
 const loadedWorkers=new Map(workerList(v).filter(w=>v.conversions?.[w.id]).map(w=>[w.id,w]));
 for(const [id,c] of Object.entries(v.conversions||{})){
  const w=loadedWorkers.get(id),previous=c.life||'unloaded';
  if(w){const sameDimension=w.dimension?.id===v.dimension,inside=sameDimension&&hd(w.location,v.bell)<=RADIUS&&Math.abs(w.location.y-v.bell.y)<15;c.life=inside?'present':'wandering';c.seen=day();c.last={x:Math.floor(w.location.x),y:Math.floor(w.location.y),z:Math.floor(w.location.z)};c.lastDimension=w.dimension?.id||v.dimension;if(previous!==c.life&&!v.censusWarmup)event(v,c.life,'Genesis worker '+(c.name||w.nameTag||'resident')+(inside?' returned to town':' is wandering outside town'));}
  else{const lastBlock=c.last&&c.lastDimension===v.dimension?getBlock(d,c.last):null,age=day()-(c.seen??c.convertedDay??day());c.life=lastBlock&&age>=7?'missing':'unloaded';if(previous!==c.life&&!v.censusWarmup)event(v,c.life,'Genesis worker '+(c.name||'resident')+' is '+c.life);}
 }
 v.censusWarmup=false;dirtyRosters.add(v.id);dirty=true;
}
function stats(v){
 const records=Object.values(v.residents),living=records.filter(x=>x.life!=='dead'&&x.life!=='converted'),present= living.filter(x=>x.life==='present'),wandering=living.filter(x=>x.life==='wandering'),unloaded=living.filter(x=>x.life==='unloaded'),missing=living.filter(x=>x.life==='missing'),dead=records.filter(x=>x.life==='dead');
 const conversions=Object.values(v.conversions||{}),convertedPresent=conversions.filter(x=>x.life==='present').length,convertedWandering=conversions.filter(x=>x.life==='wandering').length,convertedUnloaded=conversions.filter(x=>x.life==='unloaded').length,convertedMissing=conversions.filter(x=>x.life==='missing').length;
 const adults=living.filter(x=>x.age==='adult').length+conversions.length,babies=living.filter(x=>x.age==='child').length,unclassified=living.filter(x=>x.age==='unknown').length;
 const presentAdults=present.filter(x=>x.age==='adult').length+convertedPresent,presentBabies=present.filter(x=>x.age==='child').length;
 const totalPresent=present.length+convertedPresent,totalWandering=wandering.length+convertedWandering,totalUnloaded=unloaded.length+convertedUnloaded,totalMissing=missing.length+convertedMissing;
 return {adults,babies,unclassified,present:totalPresent,presentAdults,presentBabies,population:living.length+conversions.length,wandering:totalWandering,unloaded:totalUnloaded,missing:totalMissing,dead:dead.length,workers:v.workerIds.length,stage:adults>=8?'ACTIVE CIVILIZATION':'FOUNDING / POPULATION'};
}
const OWNER_UNLOCK_TICKS=12000,ownerSessions=new Map(),ownerFailures=new Map();
function ownerHash(text){
 // SHA-256, used only on interactive authentication (not in the village scheduler).
 text=String(text);
 const bytes=[...text].map(ch=>ch.charCodeAt(0));const bitlen=bytes.length*8;
 bytes.push(128);while(bytes.length%64!==56)bytes.push(0);
 const high=Math.floor(bitlen/4294967296),low=bitlen>>>0;
 for(let j=3;j>=0;j--)bytes.push((high>>>(j*8))&255);
 for(let j=3;j>=0;j--)bytes.push((low>>>(j*8))&255);
 const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
 const rot=(x,n)=>(x>>>n)|(x<<(32-n));
 for(let i=0;i<bytes.length;i+=64){const w=new Array(64);
  for(let j=0;j<16;j++)w[j]=((bytes[i+4*j]<<24)|(bytes[i+4*j+1]<<16)|(bytes[i+4*j+2]<<8)|bytes[i+4*j+3])>>>0;
  for(let j=16;j<64;j++){let x=w[j-15],y=w[j-2];w[j]=(w[j-16]+(rot(x,7)^rot(x,18)^(x>>>3))+w[j-7]+(rot(y,17)^rot(y,19)^(y>>>10)))>>>0;}
  let [a,b,c,d,e,f,g,z]=h;
  for(let j=0;j<64;j++){const t1=(z+(rot(e,6)^rot(e,11)^rot(e,25))+((e&f)^(~e&g))+k[j]+w[j])>>>0;
   const t2=((rot(a,2)^rot(a,13)^rot(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
   z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
  }
  [a,b,c,d,e,f,g,z].forEach((v,j)=>h[j]=(h[j]+v)>>>0);
 }
 return h.map(x=>x.toString(16).padStart(8,'0')).join('');
}
const ownerSecretHash=(v,password)=>ownerHash(v.ownerSalt+':'+password);
function ownerSession(p,v){return p?.name===v.founder&&!!v.ownerPasswordHash&&(ownerSessions.get(v.id+':'+p.id)||0)>system.currentTick;}
function ownerLockClear(p,v){ownerSessions.delete(v.id+':'+p.id);}
async function ownerUnlock(p,v){
 if(p?.name!==v.founder)return false;if(ownerSession(p,v))return true;
 if(!v.ownerPasswordHash){
  let r;try{r=await new ModalFormData().title('Founder Council Lock').textField('Create a private passphrase (8–64 characters)','Enter passphrase').textField('Confirm passphrase','Repeat passphrase').show(p);}catch(_){return false;}
  if(!r||r.canceled)return false;const a=String(r.formValues?.[0]||''),b=String(r.formValues?.[1]||'');if(a.length<8||a.length>64||!/^[ -~]+$/.test(a)||a!==b){announce(p,'Passphrase must match and use 8–64 standard keyboard characters.');return false;}
  const old={salt:v.ownerSalt,hash:v.ownerPasswordHash,version:v.ownerLockVersion};v.ownerSalt=ownerHash(v.id+':'+p.id+':'+system.currentTick+':'+Math.random()).slice(0,32);v.ownerPasswordHash=ownerSecretHash(v,a);v.ownerLockVersion=1;dirty=true;
  if(!persist()){v.ownerSalt=old.salt;v.ownerPasswordHash=old.hash;v.ownerLockVersion=old.version;dirty=true;announce(p,'Founder lock could not be saved. Existing settings were preserved.');return false;}
  ownerSessions.set(v.id+':'+p.id,system.currentTick+OWNER_UNLOCK_TICKS);announce(p,'Founder lock configured. Keep the passphrase safe; there is no automatic recovery.');return true;
 }
 const key=v.id+':'+p.id,fail=ownerFailures.get(key)||{count:0,until:0};if(fail.until>system.currentTick){announce(p,'Unlock temporarily locked. Try again later.');return false;}
 let r;try{r=await new ModalFormData().title('Unlock Village — '+v.founder).textField('Village passphrase','Enter passphrase').show(p);}catch(_){return false;}
 if(!r||r.canceled)return false;const given=String(r.formValues?.[0]||'');
 if(ownerSecretHash(v,given)!==v.ownerPasswordHash){fail.count++;if(fail.count>=5){fail.until=system.currentTick+1200;fail.count=0;}ownerFailures.set(key,fail);announce(p,'Incorrect village passphrase.');return false;}
 ownerFailures.delete(key);ownerSessions.set(key,system.currentTick+OWNER_UNLOCK_TICKS);return true;
}
function owner(p,v){return ownerSession(p,v);}
async function menu(p,title,body,buttons){try{const f=new ActionFormData().title(title).body(body);for(const b of buttons)f.button(b);const r=await f.show(p);return r.canceled?-1:r.selection;}catch(e){note('MENU '+e);return -1;}}
async function yes(p,title,text){try{const r=await new MessageFormData().title(title).body(text).button1('Cancel').button2('Confirm').show(p);return !r.canceled&&r.selection===1;}catch(_){return false;}}
function chestFor(v){if(!v.chest)return null;const b=getBlock(dimension(v),v.chest);if(!b||!['minecraft:chest','minecraft:trapped_chest'].includes(b.typeId))return null;try{return b.getComponent('minecraft:inventory')?.container??null;}catch(_){return null;}}
function countItems(box){const o={};if(!box)return o;for(let i=0;i<box.size;i++){const s=box.getItem(i);if(s)o[s.typeId]=(o[s.typeId]||0)+s.amount;}return o;}
function hasNeeds(box,needs){const list=countItems(box);return Object.entries(needs).every(([id,n])=>(list[id]||0)>=n);}
function canFit(box,id,amount){if(!box||amount<1)return false;let room=0;for(let i=0;i<box.size;i++){const it=box.getItem(i);if(!it)room+=64;else if(it.typeId===id){room+=Math.max(0,(it.maxAmount||64)-it.amount);}}return room>=amount;}
function put(box,id,amount){if(!canFit(box,id,amount))return false;let left=amount;for(let i=0;i<box.size&&left>0;i++){const s=box.getItem(i);if(s?.typeId===id&&s.amount<(s.maxAmount||64)){const n=Math.min(left,(s.maxAmount||64)-s.amount);s.amount+=n;box.setItem(i,s);left-=n;}}
 for(let i=0;i<box.size&&left>0;i++){if(box.getItem(i))continue;const n=Math.min(left,64);box.setItem(i,new ItemStack(id,n));left-=n;}return left===0;}
function take(box,needs){if(!hasNeeds(box,needs))return false;for(const [id,amount] of Object.entries(needs)){let left=amount;for(let i=0;i<box.size&&left;i++){const s=box.getItem(i);if(!s||s.typeId!==id)continue;const n=Math.min(left,s.amount);if(s.amount===n)box.setItem(i,undefined);else{s.amount-=n;box.setItem(i,s);}left-=n;}}return true;}
function labelItems(o){const a=Object.entries(o).filter(([_,n])=>n>0).sort((a,b)=>b[1]-a[1]);return a.slice(0,12).map(([k,n])=>`${k.replace('minecraft:','')} ×${n}`).join('\n')||'Empty';}
const atSite=(v,p)=>v.dimension===p.dimension.id&&hd(p.location,v.bell)<RADIUS;
function jobOf(v,w){return v.jobs[w.id]||'Hauler';}
function setJob(v,w,job){const load=v.builderCargo?.[w.id];if(load&&!returnBuilderLoad(v,w,chestFor(v),load))return false;v.jobs[w.id]=job;updateSmartNpcWorkerRole(w.id,job);dirty=true;return true;}
function moveToward(e,target,stop=1.8){
 // Native AI follows a worker-specific invisible destination marker.
 const v=Object.values(state.villages).find(v=>v.workerIds.includes(e.id));
 if(!v)return 'blocked';
 const had=v.navSlots?.[e.id];
 const result=moveNative(v,e,target,stop,system.currentTick||0);
 if(had!==v.navSlots?.[e.id])dirty=true;
 return result;
}
function returnCargo(v,id,w){const c=v.cargo[id];if(!c)return;if(c.phase==='audit'){note('CARGO LEFT IN AUDIT HOLD AFTER WORKER DEATH '+id);return;}try{const d=w?.dimension||dimension(v);const pos=w?.location||v.bell;d.spawnItem(new ItemStack(c.id,c.amount),pos);delete v.cargo[id];event(v,'recovery','Recovered cargo '+c.id+' ×'+c.amount);persist();}catch(e){note('CARGO RECOVERY REQUIRED '+e);}}
function hauling(v,w,box){const c=v.cargo[w.id];if(c){if(c.phase==='audit'){status(w,'Cargo requires manual warehouse audit');return true;}const where={x:v.chest.x+0.5,y:v.chest.y,z:v.chest.z+0.5};if(moveToward(w,where,2.4)!=='arrived'){status(w,'Carrying supplies to warehouse');return;}if(!canFit(box,c.id,c.amount)){status(w,'Warehouse is full');return true;}try{const tx=withInventoryRollback(box,()=>put(box,c.id,c.amount));if(tx.ok){delete v.cargo[w.id];v.metrics.delivered+=c.amount;event(v,'delivery',w.nameTag+' stored '+c.id+' ×'+c.amount);note('PHYSICAL DELIVERY '+c.id+' x'+c.amount);persist();}else{if(!tx.restored){c.phase='audit';dirty=true;persist();}note('DELIVERY ERROR '+tx.error+' rollback='+tx.restored);}}catch(e){note('DELIVERY ERROR '+e);}return true;}
 let best=null,bd=100;try{for(const e of w.dimension.getEntities({type:'minecraft:item',location:w.location,maxDistance:10})){const s=e.getComponent('minecraft:item')?.itemStack;if(!s||s.amount<1||s.amount>64||!(WOOD.test(s.typeId)||(v.haulCrops&&CROP_ITEMS.has(s.typeId))||(jobOf(v,w)==='Farmer'&&CROP_ITEMS.has(s.typeId))||((v.quarry||jobOf(v,w)==='Miner')&&QUARRY_OUTPUTS.has(s.typeId))||((v.woodlot||jobOf(v,w)==='Ranger')&&s.typeId==='minecraft:oak_sapling')))continue;if(!canFit(box,s.typeId,s.amount))continue;const dd=hd(e.location,w.location);if(dd<bd){bd=dd;best=e;}}}catch(_){return true;}if(!best)return false;
 if(moveToward(w,best.location,1.7)!=='arrived'){status(w,'Collecting '+best.getComponent('minecraft:item')?.itemStack?.typeId.replace('minecraft:',''));return true;}try{const s=best.getComponent('minecraft:item')?.itemStack;if(!s||!(WOOD.test(s.typeId)||(v.haulCrops&&CROP_ITEMS.has(s.typeId))||(jobOf(v,w)==='Farmer'&&CROP_ITEMS.has(s.typeId))||((v.quarry||jobOf(v,w)==='Miner')&&QUARRY_OUTPUTS.has(s.typeId))||((v.woodlot||jobOf(v,w)==='Ranger')&&s.typeId==='minecraft:oak_sapling'))||!canFit(box,s.typeId,s.amount))return true;best.remove();v.cargo[w.id]={id:s.typeId,amount:s.amount};v.metrics.picked+=s.amount;dirty=true;persist();status(w,'Picked up '+s.typeId.replace('minecraft:','')+' ×'+s.amount);note('HAUL PICKUP '+s.typeId+' x'+s.amount);return true;}catch(e){note('PICKUP ERROR '+e);return true;}}
function hasCraftingTable(v){
 if(!v.chest)return false;const d=dimension(v);if(!d)return false;
 for(const dy of [0,1])for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
  const b=getBlock(d,{x:v.chest.x+dx,y:v.chest.y+dy,z:v.chest.z+dz});if(b?.typeId==='minecraft:crafting_table')return true;
 }
 return false;
}
// This is deterministic settlement crafting: only the named Master Crafter may execute the queue.
function crafting(v,w,box){if(!v.crafts.length){const need=requiredFor(v);const present=countItems(box);if((need['minecraft:oak_planks']||0)>(present['minecraft:oak_planks']||0)&& (present['minecraft:oak_log']||0)>0 && canFit(box,'minecraft:oak_planks',4)){v.crafts.push('planks');dirty=true;}else return;}if(!hasCraftingTable(v)){status(w,'Waiting for a crafting table beside the warehouse');return;}const task=v.crafts[0],r=RECIPES[task];if(!r){v.crafts.shift();dirty=true;return;}if(moveToward(w,{x:v.chest.x+0.5,y:v.chest.y,z:v.chest.z+0.5},2.4)!=='arrived')return;if(!hasNeeds(box,r.needs)){status(w,'Waiting for '+labelItems(r.needs).replace('\n',', '));return;}if(!Object.entries(r.gives).every(([k,n])=>canFit(box,k,n)))return;
 // Snapshot slots for recovery if any API operation fails; inventory is the source of truth.
 const tx=withInventoryRollback(box,()=>{if(!take(box,r.needs))return false;for(const [id,n] of Object.entries(r.gives))if(!put(box,id,n))throw Error('output capacity changed');return true;});
 if(!tx.ok){note('CRAFT ERROR '+tx.error+' rollback='+tx.restored);return;}v.crafts.shift();v.metrics.crafted++;status(w,'Crafted '+r.title);event(v,'craft',w.nameTag+' crafted '+r.title);note('CRAFTED '+r.title);dirty=true;persist();}
const blueprints={
 workshop:{title:'Carpenter Workshop',minimum:8,width:5,depth:5,blocks:function(){const a=[];for(let x=0;x<5;x++)for(let z=0;z<5;z++)a.push({x,z,y:0,id:'minecraft:oak_planks'});for(let y=1;y<=3;y++)for(let x=0;x<5;x++)for(let z=0;z<5;z++)if(x===0||x===4||z===0||z===4){if(z===0&&x===2&&y<3)continue;if(y===2&&(x===0||x===4)&&z===2)continue;a.push({x,z,y,id:'minecraft:oak_planks'});}for(let x=0;x<5;x++)for(let z=0;z<5;z++)a.push({x,z,y:4,id:'minecraft:oak_planks'});return a;}},
 storehouse:{title:'Village Storehouse',minimum:8,width:7,depth:5,blocks:function(){const a=[];for(let x=0;x<7;x++)for(let z=0;z<5;z++)a.push({x,z,y:0,id:'minecraft:oak_planks'});for(let y=1;y<4;y++)for(let x=0;x<7;x++)for(let z=0;z<5;z++)if(x===0||x===6||z===0||z===4){if(z===0&&x===3&&y<=2)continue;a.push({x,z,y,id:'minecraft:oak_planks'});}for(let x=0;x<7;x++)for(let z=0;z<5;z++)a.push({x,z,y:4,id:'minecraft:oak_planks'});return a;}}
,
 house:{title:'Village House',minimum:8,width:5,depth:5,blocks:function(){const a=[];for(let x=0;x<5;x++)for(let z=0;z<5;z++)a.push({x,z,y:0,id:'minecraft:oak_planks'});for(let y=1;y<=3;y++)for(let x=0;x<5;x++)for(let z=0;z<5;z++)if(x===0||x===4||z===0||z===4){if(z===0&&x===2&&y<=2)continue;if((x===0||x===4)&&z===2&&y===2)continue;a.push({x,z,y,id:'minecraft:oak_planks'});}for(let x=0;x<5;x++)for(let z=0;z<5;z++)a.push({x,z,y:4,id:'minecraft:oak_planks'});return a;}},
 watchtower:{title:'Watchtower',minimum:8,width:3,depth:3,blocks:function(){const a=[];for(let y=0;y<=7;y++)for(let x=0;x<3;x++)for(let z=0;z<3;z++){if(y===0||y===7||((x===0||x===2)&&(z===0||z===2)))a.push({x,z,y,id:'minecraft:oak_planks'});}return a;}},
 stone_road:{title:'Stone Road Segment',minimum:8,width:1,depth:9,blocks:function(){const a=[];for(let z=0;z<9;z++)a.push({x:0,y:0,z,id:'minecraft:cobblestone'});return a;}},
 quarryhut:{title:'Stone Quarry Workshop',minimum:8,width:5,depth:5,blocks:function(){const a=[];for(let x=0;x<5;x++)for(let z=0;z<5;z++)a.push({x,y:0,z,id:'minecraft:cobblestone'});for(let y=1;y<=3;y++)for(let x=0;x<5;x++)for(let z=0;z<5;z++)if(x===0||x===4||z===0||z===4){if(z===0&&x===2&&y<=2)continue;a.push({x,y,z,id:'minecraft:oak_planks'});}for(let x=0;x<5;x++)for(let z=0;z<5;z++)a.push({x,y:4,z,id:'minecraft:cobblestone'});return a;}}
};
function planBlueprint(q){if(!q)return null;if(q.kind==='construct_structure'&&Array.isArray(q.tiles))return {title:q.title||'Imported Structure',minimum:8,width:q.width,depth:q.depth,blocks:()=>q.tiles};return blueprints[q.kind];}
function nextBuild(v){
 // A blocked first project must not starve another approved queued project.
 return v.queue.find(q=>q.state==='working')||v.queue.find(q=>q.state==='verifying')||v.queue.find(q=>q.state==='queued')||v.queue.find(q=>q.state==='blocked');
}
function buildKey(q){return q?`${q.kind}@${xyz(q.origin)}`:'';}
function returnBuilderLoad(v,w,box,load){
 if(!load)return true;if(load.phase==='audit'){status(w,'Builder cargo requires manual warehouse audit');return false;}
 try{
  if(box&&canFit(box,load.id,load.amount)){
   const tx=withInventoryRollback(box,()=>put(box,load.id,load.amount));
   if(tx.ok){delete v.builderCargo[w.id];dirty=true;persist();return true;}
   if(!tx.restored){load.phase='audit';dirty=true;persist();note('BUILDER CARGO RECOVERY ROLLBACK INCOMPLETE '+tx.error);return false;}
  }
  w.dimension.spawnItem(new ItemStack(load.id,load.amount),w.location);delete v.builderCargo[w.id];dirty=true;persist();return true;
 }catch(e){note('BUILDER CARGO RECOVERY '+e);return false;}
}
function construction(v,w,box,adults){
 v.builderCargo??={};const load=v.builderCargo[w.id],q=nextBuild(v);if(load?.phase==='audit'){status(w,'Builder cargo requires manual warehouse audit');return;}
 if(!q){if(load)returnBuilderLoad(v,w,box,load);return;}
 dirtyProjects.add(v.id);const bp=planBlueprint(q);if(!bp){q.state='blocked';q.reason='Unknown blueprint';if(load)returnBuilderLoad(v,w,box,load);dirty=true;return;}
 if(adults<bp.minimum){if(q.state!=='queued'||q.reason){q.state='queued';q.reason='';dirty=true;}status(w,'Waiting for '+bp.minimum+' adults');if(load)returnBuilderLoad(v,w,box,load);return;}
 const tiles=bp.blocks();
 if(q.progress>=tiles.length||q.state==='verifying'){
  if(load&&!returnBuilderLoad(v,w,box,load))return;
  q.state='verifying';q.verifyCursor??=0;
  const end=Math.min(tiles.length,q.verifyCursor+32);
  for(let i=q.verifyCursor;i<end;i++){
   const check=tiles[i],at={x:q.origin.x+check.x,y:q.origin.y+check.y,z:q.origin.z+check.z},actual=getBlock(w.dimension,at);
   if(!actual){q.state='blocked';q.reason='Verification chunk unavailable at '+xyz(at);dirty=true;persist();return;}
   const level=checkBlueprintBlock(actual,check);
   if(level===VerifiedLevel.Match)continue;
   if(level===VerifiedLevel.Missing){q.progress=i;q.state='working';q.verifyCursor=0;q.reason='Missing block at '+xyz(at);status(w,q.reason);dirty=true;persist();return;}
   q.state='blocked';q.reason=(level===VerifiedLevel.TypeMatch?'Incorrect block state at ':'Verification mismatch at ')+xyz(at);dirty=true;persist();return;
  }
  q.verifyCursor=end;
  if(q.verifyCursor>=tiles.length){q.state='complete';q.tileCount=tiles.length;if(Array.isArray(q.tiles)){q.tileChunks=Math.ceil(q.tiles.length/TILE_CHUNK);delete q.tiles;}delete q.verifyCursor;q.reason='';event(v,'construction',bp.title+' completed and fully verified ('+tiles.length+' blocks)');note('BUILD VERIFIED '+bp.title+' '+tiles.length);}
  else status(w,'Verifying '+bp.title+' '+q.verifyCursor+'/'+tiles.length);
  dirty=true;persist();return;
 }
 const tile=tiles[q.progress],p={x:q.origin.x+tile.x,y:q.origin.y+tile.y,z:q.origin.z+tile.z};
 const b=getBlock(w.dimension,p);if(!b){q.state='blocked';q.reason='Target chunk unavailable';if(load)returnBuilderLoad(v,w,box,load);dirty=true;return;}
 const verdict=checkBlueprintBlock(b,tile);
 if(verdict===VerifiedLevel.Match){q.progress++;q.state='working';if(load?.amount===0)delete v.builderCargo[w.id];dirty=true;return;}
 if(verdict===VerifiedLevel.TypeMatch){q.state='blocked';q.reason='Incorrect block state at '+xyz(p);if(load)returnBuilderLoad(v,w,box,load);dirty=true;return;}
 if(verdict===VerifiedLevel.Skipped){q.state='blocked';q.reason='Unloaded block at '+xyz(p);if(load)returnBuilderLoad(v,w,box,load);dirty=true;return;}
 if(verdict===VerifiedLevel.NoMatch){q.state='blocked';q.reason='Obstructed by '+b.typeId+' at '+xyz(p);if(load)returnBuilderLoad(v,w,box,load);dirty=true;return;}
 if(!b.isAir){q.state='blocked';q.reason='Obstruction at '+xyz(p);if(load)returnBuilderLoad(v,w,box,load);dirty=true;return;}
 const key=buildKey(q);let cargo=v.builderCargo?.[w.id];
 if(cargo&&(cargo.project!==key||cargo.id!==tile.id)){
  if(!returnBuilderLoad(v,w,box,cargo))return;cargo=null;
 }
 if(!cargo){
  if(!hasNeeds(box,{[tile.id]:1})){q.state='queued';q.reason='Need '+tile.id.replace('minecraft:','');status(w,q.reason);return;}
  if(hd(w.location,{x:v.chest.x+0.5,y:v.chest.y,z:v.chest.z+0.5})>2.4){moveToward(w,{x:v.chest.x+0.5,y:v.chest.y,z:v.chest.z+0.5},2.4);status(w,'Collecting '+tile.id.replace('minecraft:','')+' at warehouse');return;}
  const available=countItems(box)[tile.id]||0,amount=Math.min(16,available);
  if(amount<1)return;
  const tx=withInventoryRollback(box,()=>take(box,{[tile.id]:amount}));
  if(!tx.ok){note('BUILDER SUPPLY WITHDRAWAL '+tx.error+' rollback='+tx.restored);return;}
  cargo=v.builderCargo[w.id]={project:key,id:tile.id,amount};dirty=true;persist();
 }
 if(hd(w.location,p)>2.6){moveToward(w,{x:p.x+0.5,y:p.y,z:p.z+0.5},2.5);status(w,'Carrying '+cargo.id.replace('minecraft:','')+' ×'+cargo.amount);return;}
 const budget=new BlockBudget();budget.credit(1);if(budget.isExhausted())return;
 try{
  if(tile.states&&Object.keys(tile.states).length)b.setPermutation(BlockPermutation.resolve(tile.id,tile.states));else b.setType(tile.id);
  budget.spend(1);cargo.amount--;q.progress++;q.state='working';q.reason='';v.metrics.built++;status(w,'Building '+bp.title+' '+q.progress+'/'+tiles.length);
  if(cargo.amount<=0)delete v.builderCargo[w.id];
  if(q.progress===tiles.length){q.state='complete';event(v,'construction',bp.title+' finished, '+tiles.length+' real blocks');note('BUILD COMPLETE '+bp.title);}
  dirty=true;persist();
 }catch(e){q.state='blocked';q.reason=String(e).slice(0,55);note('BUILD ERROR '+e);}
}
// Farm jobs use founder-designated plots. Harvested output travels via tracked worker cargo.
const CROPS={'minecraft:wheat':{seed:'minecraft:wheat_seeds',produce:'minecraft:wheat'},'minecraft:carrots':{seed:'minecraft:carrot',produce:'minecraft:carrot'},'minecraft:potatoes':{seed:'minecraft:potato',produce:'minecraft:potato'},'minecraft:beetroot':{seed:'minecraft:beetroot_seeds',produce:'minecraft:beetroot'}};
function farmWork(v,w,box){
 if(v.cargo[w.id]){hauling(v,w,box);return;}
 // Collect actual crop item entities before harvesting another plant.
 if(hauling(v,w,box))return;
 if(!v.farmEnabled||!v.farm)return;
 const d=dimension(v),cx=v.farm.x,cy=v.farm.y,cz=v.farm.z;v.farmCursor=(v.farmCursor||0)%49;
 const ix=v.farmCursor%7-3,iz=Math.floor(v.farmCursor/7)-3,p={x:cx+ix,y:cy,z:cz+iz},b=getBlock(d,p);if(!b)return;
 const soil=getBlock(d,{x:p.x,y:p.y-1,z:p.z});if(soil?.typeId!=='minecraft:farmland'){v.farmCursor=(v.farmCursor+1)%49;return;}
 if(!CROPS[b.typeId]){v.farmCursor=(v.farmCursor+1)%49;return;}
 const crop=CROPS[b.typeId];let growth=-1;try{growth=b.permutation.getState('growth');}catch(_){return;}
 if(growth!==(b.typeId==='minecraft:beetroot'?3:7)){v.farmCursor=(v.farmCursor+1)%49;return;}
 if(!canFit(box,crop.produce,1))return;
 if(moveToward(w,{x:p.x+0.5,y:p.y,z:p.z+0.5},2.2)!=='arrived')return;
 const oldPermutation=b.permutation;
 try{
  // Reset the mature crop for natural regrowth and create a real item entity for its harvest.
  b.setPermutation(BlockPermutation.resolve(b.typeId,{growth:0}));
  try{d.spawnItem(new ItemStack(crop.produce,1),{x:p.x+0.5,y:p.y+0.2,z:p.z+0.5});}
  catch(spawnError){b.setPermutation(oldPermutation);throw spawnError;}
  v.farmCursor=(v.farmCursor+1)%49;v.metrics.harvested++;dirty=true;
  event(v,'harvest','Farmer harvested '+crop.produce.replace('minecraft:',''));persist();
  status(w,'Collecting harvested '+crop.produce.replace('minecraft:',''));hauling(v,w,box);
 }catch(e){note('FARM ERROR '+e);}
}
// Registered forestry only: one opt-in 5x5 woodlot, one real log per cycle.
// Natural leaves are required (persistent_bit=false); unknown leaf state fails closed.
function naturalOakLeaves(d,x,y,z){
 for(let lx=-2;lx<=2;lx++)for(let lz=-2;lz<=2;lz++)for(let ly=-1;ly<=3;ly++){
  const leaf=getBlock(d,{x:x+lx,y:y+ly,z:z+lz});if(leaf?.typeId!=='minecraft:oak_leaves')continue;
  try{if(leaf.permutation.getState('persistent_bit')===false)return true;}catch(_){}
 }
 return false;
}
function forestry(v,w,box){
 if(v.cargo[w.id]){hauling(v,w,box);return;}
 // Pick up naturally decayed oak saplings before cutting another log.
 if(hauling(v,w,box))return;
 if(!v.woodlotEnabled||!v.woodlot)return;
 const d=dimension(v),base=v.woodlot;if(!d)return;
 v.woodCutting??={};v.woodCursor=(v.woodCursor||0)%25;
 let target=v.woodCutting[w.id];
 if(!target){
  const dx=v.woodCursor%5-2,dz=Math.floor(v.woodCursor/5)-2,x=base.x+dx,z=base.z+dz;
  const ground=getBlock(d,{x,y:base.y,z});
  const groundTypes=['minecraft:dirt','minecraft:grass_block','minecraft:podzol','minecraft:coarse_dirt'];
  if(!groundTypes.includes(ground?.typeId)){v.woodCursor=(v.woodCursor+1)%25;dirty=true;return;}
  const root=getBlock(d,{x,y:base.y+1,z});
  if(root?.typeId==='minecraft:oak_log'){
   let top=base.y+1;
   for(let y=base.y+2;y<=base.y+7;y++){const b=getBlock(d,{x,y,z});if(b?.typeId!=='minecraft:oak_log')break;top=y;}
   if(!naturalOakLeaves(d,x,top,z)){v.woodCursor=(v.woodCursor+1)%25;dirty=true;return;}
   target=v.woodCutting[w.id]={x,z,baseY:base.y,topY:top};
  }else{
   const above=getBlock(d,{x,y:base.y+1,z});
   if(!above?.isAir||!hasNeeds(box,{'minecraft:oak_sapling':1})){v.woodCursor=(v.woodCursor+1)%25;dirty=true;return;}
   if(moveToward(w,{x:x+0.5,y:base.y+1,z:z+0.5},2.3)!=='arrived')return;
   const current=getBlock(d,{x,y:base.y+1,z});if(!current?.isAir)return;
   const tx=withInventoryRollback(box,()=>{if(!take(box,{'minecraft:oak_sapling':1}))return false;current.setType('minecraft:oak_sapling');return true;});
   if(!tx.ok){note('FORESTRY PLANT FAILED '+tx.error+' rollback='+tx.restored);return;}
   v.metrics.planted=(v.metrics.planted||0)+1;v.woodCursor=(v.woodCursor+1)%25;dirty=true;persist();status(w,'Replanted oak sapling');return;
  }
 }
 // Persist the selected tree while cutting top-down so the canopy check is not lost mid-harvest.
 const x=target.x,z=target.z,y=target.topY;
 if(x<base.x-2||x>base.x+2||z<base.z-2||z>base.z+2||target.baseY!==base.y){delete v.woodCutting[w.id];return;}
 const targetBlock=getBlock(d,{x,y,z});if(!targetBlock)return;
 if(targetBlock.typeId!=='minecraft:oak_log'){
  delete v.woodCutting[w.id];v.woodCursor=(v.woodCursor+1)%25;dirty=true;persist();return;
 }
 if(moveToward(w,{x:x+0.5,y,z:z+0.5},2.3)!=='arrived')return;
 const log=getBlock(d,{x,y,z});if(log?.typeId!=='minecraft:oak_log')return;
 if(!canFit(box,'minecraft:oak_log',1)){status(w,'Warehouse full — forestry paused');return;}
 try{
  // Convert the actual block into an actual item entity; never mint abstract log cargo.
  log.setType('minecraft:air');
  try{d.spawnItem(new ItemStack('minecraft:oak_log',1),{x:x+0.5,y:y+0.15,z:z+0.5});}
  catch(spawnError){log.setType('minecraft:oak_log');throw spawnError;}
  v.metrics.woodcut=(v.metrics.woodcut||0)+1;
  if(y<=target.baseY+1){delete v.woodCutting[w.id];v.woodCursor=(v.woodCursor+1)%25;}
  else target.topY=y-1;
  dirty=true;persist();status(w,'Collecting harvested oak log');hauling(v,w,box);
 }catch(e){note('FORESTRY CUT FAILED '+e);}
}
// Authorized quarry: an opt-in 5x5 surface quarry. One stone at a time,
// produced as an actual Minecraft item, delivered by the same worker before resuming.
function mining(v,w,box){
 const carry=v.cargo[w.id];if(carry){hauling(v,w,box);return;}
 if(hauling(v,w,box))return;
 if(!v.quarryEnabled||!v.quarry)return;
 const site=v.quarry,d=dimension(v);if(!d)return;const idx=(v.quarryCursor||0)%25;
 const x=site.x+(idx%5)-2,z=site.z+Math.floor(idx/5)-2;
 const p={x,y:site.y,z},b=getBlock(d,p);
 if(!b)return;
 if(!['minecraft:stone','minecraft:deepslate','minecraft:coal_ore'].includes(b.typeId)){v.quarryCursor=(idx+1)%25;dirty=true;return;}
 const produce=b.typeId==='minecraft:coal_ore'?'minecraft:coal':b.typeId==='minecraft:deepslate'?'minecraft:cobbled_deepslate':'minecraft:cobblestone';
 if(!canFit(box,produce,1)){status(w,'Quarry warehouse full');return;}
 if(moveToward(w,{x:x+0.5,y:site.y+1,z:z+0.5},2.4)!=='arrived'){status(w,'Walking to approved quarry');return;}
 const before=b.typeId;
 try{
  b.setType('minecraft:air');
  try{d.spawnItem(new ItemStack(produce,1),{x:x+0.5,y:site.y+0.15,z:z+0.5});}
  catch(spawnError){b.setType(before);throw spawnError;}
  v.metrics.mined=(v.metrics.mined||0)+1;v.quarryCursor=(idx+1)%25;event(v,'quarry','Miner extracted '+before+' from approved plot');status(w,'Collecting mined '+produce.replace('minecraft:',''));persist();hauling(v,w,box);
 }catch(e){note('QUARRY FAILED '+e);}
}
// Keep contracts grounded in warehouse stock. Steward does not fabricate currency.
function steward(v,w,box){
 if(day()===v.stewardDay)return;
 const inventory=countItems(box);const requests=contractProgress(v,inventory);
 for(const req of requests){if(req.available>=req.remaining&&req.remaining>0){
  const c=v.contracts.find(q=>q.id===req.id);if(c?.offer)continue; // Barter demand is fulfilled only by an audited incoming delivery.
  // A fulfilled contract denotes a physically stocked village request, not a virtual sale.
  c.delivered=c.qty;c.status='stocked';v.stewardDay=day();event(v,'contract','Warehouse stocked request '+c.item+' ×'+c.qty);return;
 }}
 v.stewardDay=day();dirty=true;
}
function fairContractQuote(contract){
 if(!contract?.offer)return null;
 const q=contract.pricing||barterQuote(contract.item,contract.qty,contract.offer.id,contract.offer.amount);
 return q&&Number.isFinite(q.ratio)&&q.ratio>=0.9&&q.ratio<=1.1?q:null;
}
function startTrade(v,w,box){
 const stock=countItems(box),candidate=findCandidate(v,Object.values(state.villages),stock,8);
 if(!candidate)return;
 if(v.cargo[w.id])return;
 const target=state.villages[candidate.targetId],contract=target?.contracts?.find(c=>c.id===candidate.contractId);
 if(contract?.offer){const quote=fairContractQuote(contract);if(!quote){status(w,'Barter contract price is unverified or unfair; founder review required');return;}if(!contract.pricing){contract.pricing={requestedValue:quote.requestedValue,offeredValue:quote.offeredValue,ratio:quote.ratio,source:'Bee My Honey'};persist();}}
 if(moveToward(w,{x:v.chest.x+0.5,y:v.chest.y,z:v.chest.z+0.5},2.5)!=='arrived'){
  status(w,'Walking to warehouse for allied delivery');return;
 }
 if(!target?.chest){
  status(w,'Allied warehouse not registered; waiting for access');return;
 }
 if(!take(box,{[candidate.id]:candidate.amount}))return;
 v.cargo[w.id]={id:candidate.id,amount:candidate.amount};
 v.tradeTrips??={};v.tradeTrips[w.id]={...candidate,phase:'outbound',started:day()};
 event(v,'caravan','Trader departed with '+candidate.id+' ×'+candidate.amount+' for '+target.founder);
 persist();
}
function tradeTrip(v,w){
 const trip=v.tradeTrips?.[w.id];if(!trip)return;
 const target=state.villages[trip.targetId];const carried=v.cargo[w.id];
 if(!target||(!carried&&trip.phase!=='home')){delete v.tradeTrips[w.id];dirty=true;return;}
 if(trip.phase==='audit'||trip.phase==='auditReturn'){
  // Delivery may have occurred before a crash. Never blindly pay twice.
  status(w,'Delivery receipt requires manual inspection (safety hold)');return;
 }
 if(trip.phase==='outbound'){
  const to=target.chest?{x:target.chest.x+0.5,y:target.chest.y,z:target.chest.z+0.5}:target.bell;
  const dist=Math.hypot(w.location.x-to.x,w.location.z-to.z);
  if(dist>2.6){
   const next=waypoint(w.location,to,22);
   const result=moveToward(w,next,dist<24?2.4:2.1);
   status(w,result==='stalled'?'Caravan path blocked — awaiting access':'Carrying '+carried.id+' toward allied village');return;
  }
  const receiver=chestFor(target);
  if(!receiver||!canFit(receiver,carried.id,carried.amount)){
   status(w,'Allied chest inaccessible or full; holding cargo');return;
  }
  const contract=(target.contracts||[]).find(c=>c.id===trip.contractId);
  if(!contract||contract.status!=='open'){ 
   trip.phase='return';status(w,'Contract closed; returning goods');persist();return;
  }
  if(contract.offer&&!fairContractQuote(contract)){trip.phase='return';status(w,'Barter quote failed fair-price validation; returning goods');persist();return;}
  // In barter mode, verify payment chest contents BEFORE delivering goods.
  let payment=null;
  if(contract.offer){
   if(!Number.isInteger(contract.qty)||contract.qty<1){trip.phase='return';status(w,'Invalid barter quantity; returning goods');persist();return;}
   const prior=contract.delivered||0,after=Math.min(contract.qty,prior+carried.amount);
   const amount=Math.floor(contract.offer.amount*after/contract.qty)-Math.floor(contract.offer.amount*prior/contract.qty);
   if(amount>0){payment={id:contract.offer.id,amount};if(!hasNeeds(receiver,{[payment.id]:payment.amount})){status(w,'Trade destination lacks the agreed barter payment');return;}}
  }
  // Durable precommit marker prevents replaying delivery after an interrupted tick.
  trip.phase='audit';trip.previousQuantity=countItems(receiver)[carried.id]||0;dirty=true;if(!persist()){trip.phase='outbound';return;}
  const settlement=withInventoryRollback(receiver,()=>{
   if(!put(receiver,carried.id,carried.amount))return false;
   if(payment&&!take(receiver,{[payment.id]:payment.amount}))return false;
   return true;
  });
  if(!settlement.ok){
   if(settlement.restored){trip.phase='outbound';status(w,'Barter settlement rolled back safely; retrying');persist();}
   else{status(w,'Settlement rollback incomplete; manual audit required');persist();}
   return;
  }
  if(payment){v.cargo[w.id]=payment;trip.phase='return';trip.kind='barter';}
  else{delete v.cargo[w.id];trip.phase='home';}
  contract.delivered=(contract.delivered||0)+carried.amount;
  if(contract.delivered>=contract.qty)contract.status='delivered';
  event(target,'delivery','Received '+carried.id+' ×'+carried.amount+' from '+v.founder);
  event(v,'caravan',payment?'Bartered '+carried.amount+' '+carried.id+' for '+payment.amount+' '+payment.id:contract.offer?'Delivered '+carried.amount+' '+carried.id+'; no payment due on this installment':'Delivered '+carried.id+' ×'+carried.amount+' to '+target.founder);
  relation(v,target.id,'gift');relation(target,v.id,'gift');persist();
  return;
 }
 if(trip.phase==='return'){
  const home=chestFor(v);
  if(!home){status(w,'Home warehouse unavailable with undelivered cargo');return;}
  const where={x:v.chest.x+0.5,y:v.chest.y,z:v.chest.z+0.5};
  if(Math.hypot(w.location.x-where.x,w.location.z-where.z)>2.5){moveToward(w,waypoint(w.location,where,22),2.3);return;}
  if(canFit(home,carried.id,carried.amount)){
   trip.phase='auditReturn';dirty=true;if(!persist()){trip.phase='return';return;}
   if(!put(home,carried.id,carried.amount)){trip.phase='return';dirty=true;persist();return;}
   delete v.cargo[w.id];trip.phase='home';event(v,'caravan',trip.kind==='barter'?'Trader returned real barter payment to warehouse':'Undelivered cargo returned to home chest');persist();
  }
  return;
 }
 if(trip.phase==='home'){
  const center={x:v.bell.x+0.5,y:v.bell.y,z:v.bell.z+0.5};
  if(Math.hypot(w.location.x-center.x,w.location.z-center.z)>3){moveToward(w,waypoint(w.location,center,22),2.7);return;}
  delete v.tradeTrips[w.id];event(v,'caravan','Trader returned home');persist();
 }
}
function currentGovernor(v){v.governor??={enabled:false,autoJobs:false,foodReserve:12,woodReserve:24,guardCombat:false};return v.governor;}
function desiredJobs(v,box,ws,s){
  const g=currentGovernor(v),items=countItems(box),j=['Hauler'];
  if(ws.length>1&&s.presentAdults>=8&&v.queue.some(q=>q.state!=='complete'&&q.state!=='cancelled'))j.push('Builder');
  if(ws.length>j.length&&((items['minecraft:oak_log']||0)>1||(items['minecraft:wheat']||0)>3))j.push('Crafter');
  if(ws.length>j.length&&v.farmEnabled&&v.farm)j.push('Farmer');
  if(ws.length>j.length&&v.woodlotEnabled&&v.woodlot)j.push('Ranger');
  if(ws.length>j.length&&v.guardEnabled)j.push('Sentinel');
  if(ws.length>j.length&&v.quarryEnabled&&v.quarry)j.push('Miner');
  if(ws.length>j.length&&v.contracts?.some(c=>c.status==='open'))j.push('Steward');
  if(ws.length>j.length&&Object.values(state.villages).some(other=>other.id!==v.id&&v.relations?.[other.id]?.stance==='friendly'&&other.contracts?.some(c=>c.status==='open')))j.push('Trader');
  if(ws.length>j.length&&v.provisioning?.enabled&&s.presentAdults>=2&&s.presentAdults<8&&(items['minecraft:bread']||0)>=g.foodReserve+3)j.push('Provisioner');
  if(ws.length>j.length&&(items['minecraft:bread']||0)>g.foodReserve)j.push('Medic');
  while(j.length<ws.length)j.push(j.some(x=>x==='Hauler')&&v.woodlotEnabled?'Ranger':'Hauler');
  return j.slice(0,ws.length);
}
function findAutonomousBuildSite(v,kind){
 const bp=blueprints[kind],d=dimension(v);if(!bp||!d)return null;
 const offsets=[-24,-18,-12,12,18,24];
 for(const xoff of offsets)for(const zoff of offsets){
  const origin={x:Math.floor(v.bell.x+xoff),y:Math.floor(v.bell.y),z:Math.floor(v.bell.z+zoff)};
  if(hd(origin,v.bell)>RADIUS-12)continue;
  if((v.queue||[]).some(q=>hd(q.origin,origin)<10))continue;
  let supported=true;
  for(let x=0;x<bp.width&&supported;x++)for(let z=0;z<bp.depth;z++){
   const ground=getBlock(d,{x:origin.x+x,y:origin.y-1,z:origin.z+z});
   if(!ground||!['minecraft:grass_block','minecraft:dirt','minecraft:stone','minecraft:cobblestone','minecraft:coarse_dirt'].includes(ground.typeId)){supported=false;break;}
  }
  if(supported&&verifySite(d,origin,bp.blocks()).safe)return {kind,origin};
 }
 return null;
}
function governorStep(v,box,ws,s){
 const g=currentGovernor(v);if(!g.enabled||!box)return;
 // Decisions use real chest contents. Never spawn resources or invent workers.
 const inv=countItems(box),food=(inv['minecraft:bread']||0),wheat=(inv['minecraft:wheat']||0);
 const plan=unionPlan(v,box,s);const order=nextProductionOrder(plan,v.crafts);
 if(order&&v.crafts.length<5){v.crafts.push(order);event(v,'supply','Demand planner queued '+order+' from physical supplies');}

 if(food<g.foodReserve&&wheat>=3&&v.crafts.length<5&&!v.crafts.includes('bread')){
  v.crafts.push('bread');event(v,'council','Food reserve low; queued bread from stored wheat');
 }
 const needs=requiredFor(v),planks=inv['minecraft:oak_planks']||0,logs=inv['minecraft:oak_log']||0;
 if((needs['minecraft:oak_planks']||0)>planks&&logs>=1&&v.crafts.length<5&&!v.crafts.includes('planks')){
  v.crafts.push('planks');event(v,'council','Building shortage; queued planks from warehouse logs');
 }
 if(s.presentAdults>=8&&!nextBuild(v)&&v.approvedPlots?.length){
  const plots=v.approvedPlots;const plan=plots.shift();dirtyProjects.add(v.id);
  // Planner never picks new ground: founder must approve the exact empty area.
  if(plan&&blueprints[plan.kind]){
    const bp=blueprints[plan.kind];let clear=true;
    clear=verifySite(dimension(v),plan.origin,bp.blocks()).safe;
    if(clear){addProject(v,{kind:plan.kind,origin:plan.origin,progress:0,state:'queued',reason:''});event(v,'council','Council began approved '+bp.title);}
    else event(v,'council','Approved plot obstructed; plan discarded without changes');
  }
 }
 if(g.autoExpansion&&s.presentAdults>=8&&!nextBuild(v)&&!(v.approvedPlots||[]).length){
  const lastDay=v.autoSiteLastDay??-1;
  if(lastDay!==day()){
   v.autoSiteLastDay=day();dirty=true;
   const completed=v.queue.filter(q=>q.state==='complete');
   const houseCount=completed.filter(q=>q.kind==='house').length;
   const kind=completed.some(q=>q.kind==='workshop')?(houseCount%3===2?'watchtower':'house'):'workshop';
   const needed=blueprints[kind].blocks().length;
   const stock=countItems(box);
   if((stock['minecraft:oak_planks']||0)>=Math.min(needed,32)){
    const plot=findAutonomousBuildSite(v,kind);
    if(plot){addProject(v,{kind,origin:plot.origin,progress:0,state:'queued',reason:''});event(v,'expansion','Council selected cleared, flat '+kind+' site '+xyz(plot.origin));}
   }
  }
 }
 if(g.autoJobs&&ws.length){
  // Never reassign a worker carrying cargo. Preserve lone Master Crafter rule.
  const available=ws.filter(w=>!v.cargo[w.id]&&!v.builderCargo?.[w.id]&&!v.medicalCargo?.[w.id]&&!v.rallies?.[w.id]&&!v.tradeTrips?.[w.id]);const roles=desiredJobs(v,box,ws,s);
  // Allocate whole-village roles in one pass. Stable assignments avoid task thrashing.
  const counts={};for(const role of roles)counts[role]=(counts[role]||0)+1;
  const assigned=new Set();
  for(const w of available){const role=jobOf(v,w);if((counts[role]||0)>0){counts[role]--;assigned.add(w.id);}}
  for(const w of available){if(assigned.has(w.id))continue;const role=Object.keys(counts).find(k=>counts[k]>0);if(role){counts[role]--;setJob(v,w,role);}}
 }
}

function provisionResidents(v,w,box,s){
 const p=v.provisioning;if(!p?.enabled||s.presentAdults<2||s.presentAdults>=8)return;
 const today=day();if(p.lastDay===today)return;
 if(!hasNeeds(box,{'minecraft:bread':3}))return;
 const eligible=entities(v).filter(e=>TYPES.includes(e.typeId)&&roleAge(e)==='adult'&&valid(e));
 if(!eligible.length)return;
 eligible.sort((a,b)=>hd(a.location,w.location)-hd(b.location,w.location));const target=eligible[0];
 if(moveToward(w,target.location,2.2)!=='arrived'){status(w,'Delivering food to village adults');return;}
 // Save the daily delivery marker first: a restart cannot duplicate a partially completed delivery.
 const oldDay=p.lastDay,oldDelivered=p.delivered;p.lastDay=today;p.delivered+=3;dirty=true;
 if(!persist()){p.lastDay=oldDay;p.delivered=oldDelivered;return;}
 const tx=withInventoryRollback(box,()=>{if(!take(box,{'minecraft:bread':3}))return false;w.dimension.spawnItem(new ItemStack('minecraft:bread',3),{x:target.location.x,y:target.location.y+0.5,z:target.location.z});return true;});
 if(!tx.ok){p.lastDay=oldDay;p.delivered=oldDelivered;dirty=true;persist();note('PROVISION FAILED '+tx.error+' rollback='+tx.restored);return;}
 status(w,'Provided three real bread to village adults');event(v,'provisions','Provisioner delivered three bread; villagers may breed if beds and game rules allow');persist();
}

function medic(v,w,box){
 v.medicalCargo??={};const cargo=v.medicalCargo[w.id];if(cargo?.phase==='audit'){status(w,'Medical supply requires manual warehouse audit');return;}
 let injured=null,lowest=1;
 for(const e of [...residents(v),...workerList(v)]){
  if(!valid(e)||e.id===w.id)continue;
  try{const h=e.getComponent('minecraft:health'),max=h.effectiveMax||h.defaultValue||20,ratio=h.currentValue/max;if(ratio<0.75&&ratio<lowest){lowest=ratio;injured=e;}}
  catch(_){}
 }
 if(cargo){
  if(!injured){returnMedicine(v,w);return;}
  if(moveToward(w,injured.location,2.5)!=='arrived'){status(w,'Carrying food to injured resident');return;}
  try{const h=injured.getComponent('minecraft:health'),max=h.effectiveMax||h.defaultValue||20;h.setCurrentValue(Math.min(max,h.currentValue+4));delete v.medicalCargo[w.id];v.defense??={hits:0,healed:0,shots:0,donations:0,last:'not attempted'};v.defense.healed++;status(w,'Treated '+(injured.nameTag||'resident'));event(v,'care','Medic used one warehouse bread to heal an injured resident');persist();}
  catch(e){note('MEDIC HEAL ERROR '+e);}return;
 }
 if(!injured||!hasNeeds(box,{'minecraft:bread':1}))return;
 if(moveToward(w,{x:v.chest.x+0.5,y:v.chest.y,z:v.chest.z+0.5},2.5)!=='arrived'){status(w,'Getting bread from warehouse');return;}
 const tx=withInventoryRollback(box,()=>take(box,{'minecraft:bread':1}));if(!tx.ok){note('MEDIC SUPPLY ERROR '+tx.error+' rollback='+tx.restored);return;}
 v.medicalCargo[w.id]={id:'minecraft:bread',amount:1};status(w,'Carrying medical food');dirty=true;persist();
}

function returnMedicine(v,w){
 if(!v.medicalCargo?.[w.id])return;
 const c=v.medicalCargo[w.id],box=chestFor(v);if(c.phase==='audit'){status(w,'Medical supply requires manual warehouse audit');return;}
 if(box&&moveToward(w,{x:v.chest.x+0.5,y:v.chest.y,z:v.chest.z+0.5},2.4)==='arrived'){
  const tx=withInventoryRollback(box,()=>put(box,c.id,c.amount));
  if(tx.ok){delete v.medicalCargo[w.id];dirty=true;persist();return;}
  if(!tx.restored){c.phase='audit';dirty=true;persist();note('MEDIC RETURN ROLLBACK INCOMPLETE '+tx.error);}
 }
 status(w,'Returning unused medical supplies');
}

function approvePlot(v,ground,kind){
 const bp=blueprints[kind],origin={x:ground.location.x,y:ground.location.y+1,z:ground.location.z};
 if(!bp||hd(origin,v.bell)>RADIUS-12||v.approvedPlots.length>=4)return null;
 const d=dimension(v);
 if(!verifySite(d,origin,bp.blocks()).safe)return null;
 return {kind,origin};
}
function unionPlan(v,box,s){
 return supplyPlan({population:s.adults+s.babies,foodReserve:currentGovernor(v).foodReserve,woodReserve:currentGovernor(v).woodReserve,stock:countItems(box),construction:requiredFor(v)});
}
function supplyBoard(v){
 const box=chestFor(v),plan=unionPlan(v,box,stats(v));
 if(!box)return 'Register the physical warehouse chest first.';
 return `§lLive Supply Requests§r\n${plan.requests.slice(0,12).map(x=>`${x.id.replace('minecraft:','')}: have ${x.stock} / need ${x.goal} (short ${x.needed})`).join('\n')||'All tracked supplies meet village demand.'}\n\n§7Derived from actual chest contents; building materials reflect unfinished block plans. These requests do not spawn or duplicate items.`;
}
async function pageSupplyBoard(p,v){await menu(p,'Village Supply Orders',supplyBoard(v),['Back']);}

const DEFENSE_TARGETS=['minecraft:zombie','minecraft:husk','minecraft:drowned','minecraft:skeleton','minecraft:stray','minecraft:creeper','minecraft:pillager','minecraft:ravager'];
const DEFENSE_RANGE=10,DEFENSE_VERTICAL=2.8;
function defenseDonate(v,d,box){
 if(!v.guardEnabled||!box)return;
 let drops=[];try{drops=d.getEntities({type:'minecraft:item',location:v.bell,maxDistance:3});}catch(_){return;}
 for(const item of drops){
  try{
   if(!valid(item))continue;const stack=item.getComponent('minecraft:item')?.itemStack;
   if(stack?.typeId!=='minecraft:arrow'||!Number.isInteger(stack.amount)||stack.amount<1||stack.amount>64||!canFit(box,'minecraft:arrow',stack.amount))continue;
   const amount=stack.amount,tx=withInventoryRollback(box,()=>{if(!put(box,'minecraft:arrow',amount))return false;item.remove();return true;});
   if(tx.ok){v.defense??={hits:0,healed:0,shots:0,donations:0,last:'not attempted'};v.defense.donations=(v.defense.donations||0)+amount;v.defense.last='accepted '+amount+' donated arrows';dirty=true;persist();note('SENTINEL AMMO '+amount+' real arrows stored');break;}
   if(!tx.restored){v.defense.last='arrow donation inventory audit required';dirty=true;persist();note('SENTINEL AMMO ROLLBACK INCOMPLETE '+tx.error);break;}
  }catch(e){note('SENTINEL DONATION ERROR '+e);}
 }
}
function defenseClear(d,from,to){
 const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,dist=Math.hypot(dx,dy,dz);
 if(dist<0.1||dist>DEFENSE_RANGE+2)return false;
 const steps=Math.ceil(dist*2);
 for(let i=1;i<steps;i++){const f=i/steps,b=getBlock(d,{x:from.x+dx*f,y:from.y+dy*f,z:from.z+dz*f});if(!b||!b.isAir)return false;}
 return true;
}
function defenseFriendsClear(from,to,friendlies){
 const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,len2=dx*dx+dy*dy+dz*dz;if(len2<1)return false;
 for(const e of friendlies){let p;try{p=e.location;}catch(_){continue;}const fy=p.y+1;const f=Math.max(0,Math.min(1,((p.x-from.x)*dx+(fy-from.y)*dy+(p.z-from.z)*dz)/len2));if(f<0.05)continue;if(Math.hypot(from.x+dx*f-p.x,from.y+dy*f-fy,from.z+dz*f-p.z)<1.7)return false;}
 return true;
}
function sentinel(v,w,box){
 if(!v.guardEnabled)return;const d=dimension(v);if(!d)return;defenseDonate(v,d,box);
 const t=system.currentTick||0;let mobs=[];const cached=defenseScanCache.get(v.id);
 if(cached?.tick===t)mobs=cached.mobs;
 else{for(const type of DEFENSE_TARGETS){try{for(const e of d.getEntities({type,location:v.bell,maxDistance:RADIUS}))if(valid(e))mobs.push(e);}catch(_){}}defenseScanCache.set(v.id,{tick:t,mobs});}
 if(!mobs.length)return;
 if(t-(v.lastAlert||0)>600){v.lastAlert=t;event(v,'alert','Sentinel spotted '+mobs[0].typeId.replace('minecraft:',''));for(const p of d.getPlayers({location:v.bell,maxDistance:RADIUS}))announce(p,'§cSentinel alert: '+mobs[0].typeId.replace('minecraft:','')+' nearby!');}
 if(!v.governor?.guardCombat)return;
 if(t-(combatCooldown.get(v.id)||0)<30)return;
 if(!box||!hasNeeds(box,{'minecraft:arrow':1})){v.defense.last='no donated arrows in warehouse';status(w,'Alerts only — no donated arrows');return;}
 const friendlies=[...d.getPlayers({location:v.bell,maxDistance:RADIUS}),...residents(v),...workerList(v)];let best=null;
 for(const shooter of workerList(v).filter(e=>jobOf(v,e)==='Sentinel'))for(const mob of mobs){
  let a,b;try{a=shooter.location;b=mob.location;}catch(_){continue;}
  const planar=Math.hypot(a.x-b.x,a.z-b.z);if(planar>DEFENSE_RANGE||Math.abs(a.y-b.y)>DEFENSE_VERTICAL)continue;
  const from={x:a.x,y:a.y+1.55,z:a.z},to={x:b.x,y:b.y+1,z:b.z};
  if(!defenseClear(d,from,to)||!defenseFriendsClear(from,to,friendlies))continue;
  if(!best||planar<best.distance)best={shooter,mob,from,to,distance:planar};
 }
 if(!best){v.defense.last='hostiles blocked, underground or behind allies';return;}
 const tx=withInventoryRollback(box,()=>take(box,{'minecraft:arrow':1}));if(!tx.ok){v.defense.last='arrow withdrawal failed';dirty=true;persist();note('SENTINEL ARROW WITHDRAWAL '+tx.error+' rollback='+tx.restored);return;}
 let arrow;
 try{
  const delta={x:best.to.x-best.from.x,y:best.to.y-best.from.y,z:best.to.z-best.from.z},distance=Math.hypot(delta.x,delta.y,delta.z);if(distance<0.5)throw Error('target too close');
  arrow=d.spawnEntity('minecraft:arrow',best.from);const projectile=arrow.getComponent('minecraft:projectile');if(!projectile)throw Error('arrow projectile component unavailable');
  try{projectile.owner=best.shooter;}catch(_){}
  projectile.shoot({x:delta.x/distance*1.7,y:(delta.y/distance+0.09)*1.7,z:delta.z/distance*1.7});
 }catch(e){let projectileRemoved=!arrow;try{if(arrow){arrow.remove();projectileRemoved=true;}}catch(_){}const restore=projectileRemoved?withInventoryRollback(box,()=>put(box,'minecraft:arrow',1)):{ok:false,restored:false};v.defense.last='shot failed; arrow restore '+(restore.ok?'complete':projectileRemoved?'requires manual audit':'projectile removal uncertain; ammo consumed');dirty=true;persist();note('SENTINEL SHOT ERROR '+e);return;}
 combatCooldown.set(v.id,t);v.defense.shots=(v.defense.shots||0)+1;v.defense.last='fired at '+best.mob.typeId;dirty=true;persist();status(best.shooter,'Fired a donated arrow at '+best.mob.typeId.replace('minecraft:',''));
}
function runRally(v,w){const r=v.rallies?.[w.id];if(!r)return false;if((system.currentTick||0)>r.until){delete v.rallies[w.id];dirty=true;return false;}if(moveToward(w,r,2.5)==='arrived'){delete v.rallies[w.id];dirty=true;status(w,'Rally complete');return false;}status(w,'Responding to founder rally');return true;}

function workerCycle(v){const ws=workerList(v);v.dimensionObject=dimension(v);cleanRoutes(v,ws,system.currentTick||0);delete v.dimensionObject;if(!state.aiEnabled||!v.enabled){for(const w of ws)releaseRoute(v,w);return;}const box=chestFor(v),s=stats(v);governorStep(v,box,ws,s);for(const w of ws){if(isSmartNpcDialogueLocked(w))continue;const role=jobOf(v,w);try{if(v.tradeTrips?.[w.id]){tradeTrip(v,w);continue;}if(runRally(v,w))continue;if(v.cargo[w.id]&&box){hauling(v,w,box);continue;}if(role==='Hauler'&&box)hauling(v,w,box);else if(role==='Crafter'&&box)crafting(v,w,box);else if(role==='Builder'&&box)construction(v,w,box,s.presentAdults);else if(role==='Farmer'&&box)farmWork(v,w,box);else if(role==='Ranger'&&box)forestry(v,w,box);else if(role==='Sentinel')sentinel(v,w,box);else if(role==='Medic'&&box)medic(v,w,box);else if(role==='Provisioner'&&box)provisionResidents(v,w,box,s);else if(role==='Miner'&&box)mining(v,w,box);else if(role==='Steward'&&box)steward(v,w,box);else if(role==='Trader'&&box)startTrade(v,w,box);}catch(e){note('WORKER '+role+' '+e);}}}
function requiredFor(v){const q=nextBuild(v);if(!q)return {};return remainingMaterials(planBlueprint(q)?.blocks()||[],q.progress||0);}
function nextMilestone(v,box,s){
 if(!box)return 'Register a chest as the physical warehouse';
 if(!s.workers)return 'Recruit a SmartNPC specialist worker';
 if(s.presentAdults<8)return `Founding: ${s.presentAdults}/8 present adults (${s.adults} total adults). Provisioner ${v.provisioning?.enabled?'ON':'OFF'}; ensure spare beds and bread`; 
 const q=nextBuild(v);
 if(q){const bp=planBlueprint(q);if(!bp)return 'Investigate unknown construction plan';
  const shortage=shortageForWarehouse(bp.blocks(),q.progress||0,box);
  const urgent=Object.entries(shortage).sort((a,b)=>b[1]-a[1])[0];
  if(urgent)return `Supply ${urgent[0].replace('minecraft:','')}: missing ${urgent[1]} real blocks`;
  if(!workerList(v).some(w=>jobOf(v,w)==='Builder'))return 'Assign a Builder to the active project';
  return `Build ${bp.title}: ${q.progress}/${bp.blocks().length} blocks`;
 }
 return 'Plan a workshop or storehouse from Construction';
}

async function pageQuarry(p,v,canEdit){
 const current=v.quarry?xyz(v.quarry):'None';
 const x=await menu(p,'Genesis Quarry',`Approved stone layer: ${current}\nMining: ${v.quarryEnabled?'ON':'OFF'}\nMined: ${v.metrics.mined||0}\n\nOnly designated 5×5 stone/coal blocks are affected. Miners carry one real resource at a time to the warehouse.`,canEdit?['Register looked-at stone block','Toggle quarry operation','Back']:['Back']);
 if(!canEdit||x<0)return;
 if(x===0){let b;try{b=p.getBlockFromViewDirection({maxDistance:8})?.block;}catch(_){};
  if(!b||!['minecraft:stone','minecraft:deepslate','minecraft:coal_ore'].includes(b.typeId)||hd(b.location,v.bell)>34){announce(p,'Look at natural stone within 34 blocks of the village.');return;}
  if(!await yes(p,'Authorize a quarry','Allow Miners to remove natural stone and coal ore in the 5×5 square at this height? Existing buildings could be damaged; use a remote area.'))return;
  v.quarry={...b.location};v.quarryCursor=0;v.quarryEnabled=false;event(v,'quarry','Authorized quarry layer '+xyz(b.location));persist();
 }
 if(x===1){if(!v.quarry){announce(p,'Register a quarry first.');return;}v.quarryEnabled=!v.quarryEnabled;event(v,'quarry','Quarry '+(v.quarryEnabled?'enabled':'disabled'));persist();}
}
async function pageTrade(p,v,canEdit){
 const list=(v.contracts||[]).slice(-10).map(c=>`${c.item.replace('minecraft:','')} ×${c.qty} for ${c.offer?c.offer.amount+' '+c.offer.id.replace('minecraft:',''):'mutual aid'}: ${c.status}`).join('\n')||'No requests';
 const pricingPreview=[['minecraft:oak_log','minecraft:wheat'],['minecraft:wheat','minecraft:cobblestone'],['minecraft:cobblestone','minecraft:oak_log']].map(([wanted,payment])=>{const quote=barterQuote(wanted,16,payment,16);return `${wanted.replace('minecraft:','')} ×16 / ${payment.replace('minecraft:','')} ×16: ${quote?quote.ratio+' value ratio':'unpriced'}`;}).join('\n');
 const relations=Object.entries(v.relations||{}).map(([k,r])=>`${k.slice(-18)}: ${r.stance}`).join('\n')||'No known settlements';
 const auditHolds=[...Object.entries(v.tradeTrips||{}).filter(([_,t])=>t.phase==='audit'||t.phase==='auditReturn').map(([id,t])=>`${id.slice(-8)} trade ${t.phase}`),...['cargo','builderCargo','medicalCargo'].flatMap(k=>Object.entries(v[k]||{}).filter(([_,c])=>c.phase==='audit').map(([id,c])=>`${id.slice(-8)} ${k} ${c.id} ×${c.amount}`))].join('\n')||'None';
 const x=await menu(p,'Civilization Economy',`Warehouse-backed requests (not virtual currency):\n${list}\n\nBee My Honey reference-price quotes (not minted currency):\n${pricingPreview}\n\nSettlement audit holds:\n${auditHolds}\n\nNeighbor relations:\n${relations}`,canEdit?['Trade 16 wheat for 16 oak logs','Trade 16 cobble for 16 wheat','Trade 16 logs for 16 cobblestone','Clear finished requests','Back']:['Back']);
 if(!canEdit||x<0)return;
 if(x<=2){const item=['minecraft:oak_log','minecraft:wheat','minecraft:cobblestone'][x];const offer={id:['minecraft:wheat','minecraft:cobblestone','minecraft:oak_log'][x],amount:16};const quote=barterQuote(item,16,offer.id,offer.amount);if(!quote||quote.ratio<0.9||quote.ratio>1.1){announce(p,'Bee My Honey pricing could not verify a fair physical barter quote.');return;}const contract=contractRequest(v,item,16,day(),offer);if(contract){contract.pricing={requestedValue:quote.requestedValue,offeredValue:quote.offeredValue,ratio:quote.ratio,source:'Bee My Honey'};event(v,'trade','Steward recorded price-checked barter '+item+' ×16 for '+offer.id+' ×16 (value ratio '+quote.ratio+')');persist();}else announce(p,'Request list is full.');}
 if(x===3){v.contracts=(v.contracts||[]).filter(c=>c.status==='open');dirty=true;persist();}
}
async function pageDiplomacy(p,v,canEdit){
 const others=Object.values(state.villages).filter(x=>x.id!==v.id);
 const lines=others.map(o=>`${o.founder}'s settlement: ${(v.relations||{})[o.id]?.stance||'neutral'}`).join('\n')||'No neighboring registered settlements';
 const pending=(v.pendingTreaties||[]).map(t=>`${state.villages[t.from]?.founder||'Unknown'} requests an alliance`).join('\n')||'No pending treaties';
 const x=await menu(p,'Civilization Diplomacy',`Registered neighboring settlements:\n${lines}\n\nIncoming proposals:\n${pending}`,canEdit?['Propose alliance','Review incoming proposal','Back']:['Back']);
 if(!canEdit||x<0)return;
 if(x===0){if(!others.length){announce(p,'No other Genesis settlement is registered.');return;}
  const n=await menu(p,'Alliance Proposal','Select a foreign town center.',others.map(o=>o.founder+' — '+xyz(o.bell)).concat('Back'));
  if(n<0||n>=others.length)return;const target=others[n];target.pendingTreaties??=[];
  if(target.pendingTreaties.some(t=>t.from===v.id)){announce(p,'An offer is already pending.');return;}
  target.pendingTreaties.push({from:v.id,day:day()});event(v,'diplomacy','Proposed alliance to '+target.founder);event(target,'diplomacy','Alliance request from '+v.founder);persist();}
 if(x===1){const offers=(v.pendingTreaties||[]).filter(t=>state.villages[t.from]);if(!offers.length){announce(p,'No incoming proposals.');return;}
  const i=await menu(p,'Incoming Diplomacy','Select a proposal.',offers.map(t=>state.villages[t.from].founder+' offers an alliance').concat('Back'));
  if(i<0||i>=offers.length)return;const from=state.villages[offers[i].from];
  const accept=await yes(p,'Accept Treaty','Become friendly with '+from.founder+'? Both registered civilizations record this treaty.');
  v.pendingTreaties=v.pendingTreaties.filter(t=>t.from!==from.id);
  if(accept){relation(v,from.id,'gift');relation(v,from.id,'peace');relation(v,from.id,'peace');relation(from,v.id,'gift');relation(from,v.id,'peace');relation(from,v.id,'peace');event(v,'diplomacy','Alliance ratified with '+from.founder);event(from,'diplomacy','Alliance ratified with '+v.founder);}
  else event(v,'diplomacy','Declined alliance from '+from.founder);
  persist();}
}
async function showHome(p,v){if(p.name===v.founder)await ownerUnlock(p,v);for(let n=0;n<40;n++){const s=stats(v),box=chestFor(v),ownerAccess=owner(p,v),next=nextMilestone(v,box,s);const buttons=['Population & History','Workers & Jobs','Warehouse & Inventory','Construction Plans','Master Crafter','Fields & Agriculture','Defense & Policies','Village Statistics','Civilization Council','Supply Orders','Quarry & Mining','Economy & Contracts','Diplomacy & Treaties','Refresh Census'];if(ownerAccess)buttons.push('Lock council now');buttons.push('Close');const closeIndex=buttons.length-1,lockIndex=ownerAccess?buttons.length-2:-1;
 const idx=await menu(p,'§2GENESIS REBORN §7• Living Civilization',`§lFounder§r ${v.founder}  §7| Day ${day()}§r
§a${s.stage}§r
Residents: ${s.adults} adults (${s.presentAdults} present), ${s.babies} children, ${s.unclassified} unclassified
Present: ${s.present} | Wandering: ${s.wandering} | Unloaded: ${s.unloaded} | Missing: ${s.missing} | Dead: ${s.dead}
Specialists: ${s.workers} | Jobs: ${!state.aiEnabled?'GLOBAL PAUSED':v.enabled?'ACTIVE':'VILLAGE PAUSED'}
Warehouse: ${box?'ONLINE':'NOT REGISTERED'}
Founder controls: ${ownerAccess?'UNLOCKED':'LOCKED / READ ONLY'}

§eNext milestone: ${next}§r`,buttons);if(idx===-1||idx===closeIndex)return;if(idx===lockIndex){ownerLockClear(p,v);announce(p,'Founder council locked.');return;}
 if(idx===0)await pagePopulation(p,v);if(idx===1)await pageWorkers(p,v,ownerAccess);if(idx===2)await pageWarehouse(p,v,ownerAccess);if(idx===3)await pageConstruction(p,v,ownerAccess);if(idx===4)await pageCrafting(p,v,ownerAccess);if(idx===5)await pageFarms(p,v,ownerAccess);if(idx===6)await pagePolicies(p,v,ownerAccess);if(idx===7)await pageStats(p,v);if(idx===8)await pageCouncil(p,v,ownerAccess);if(idx===9)await pageSupplyBoard(p,v);if(idx===10)await pageQuarry(p,v,ownerAccess);if(idx===11)await pageTrade(p,v,ownerAccess);if(idx===12)await pageDiplomacy(p,v,ownerAccess);if(idx===13){census(v);persist();announce(p,'Updated local census. Missing is not the same as dead.');}}}
async function pagePopulation(p,v,offset=0){
 const label=life=>life==='dead'?'§cDEAD':life==='missing'?'§eMISSING':life==='unloaded'?'§7UNLOADED':life==='wandering'?'§bWANDERING':'§aPRESENT';
 const entries=[...Object.values(v.residents).filter(m=>m.life!=='converted').map(m=>({name:m.name,life:m.life,detail:'Vanilla villager • '+m.age})),...Object.values(v.conversions||{}).map(c=>({name:c.name,life:c.life,detail:'SmartNPC specialist'}))].sort((a,b)=>a.life.localeCompare(b.life)||a.name.localeCompare(b.name));
 const pageSize=25,pageCount=Math.max(1,Math.ceil(entries.length/pageSize)),page=Math.min(pageCount-1,Math.floor(offset/pageSize)),rows=entries.slice(page*pageSize,(page+1)*pageSize).map(m=>`${label(m.life)}§r  ${m.name} (${m.detail})`),s=stats(v);
 const actions=[];if(page>0)actions.push('Previous page');if(page+1<pageCount)actions.push('Next page');actions.push('Back');
 const x=await menu(p,'Residents & Generations • '+(page+1)+'/'+pageCount,`${rows.join('\n')||'No registered residents'}\n\nPresent: ${s.present} | Wandering: ${s.wandering} | Unloaded: ${s.unloaded} | Missing: ${s.missing} | Dead: ${s.dead}\n§7Missing and unloaded residents remain in population totals. Only a confirmed death event removes a resident from the living census. Vanilla villagers retain their breeding, trading, schedules and professions. Construction unlocks at 8 present adults.`,actions);
 let i=0;if(page>0){if(x===i)return pagePopulation(p,v,(page-1)*pageSize);i++;}if(page+1<pageCount&&x===i)return pagePopulation(p,v,(page+1)*pageSize);
}
async function pageWarehouse(p,v,canEdit){const box=chestFor(v),contents=countItems(box);const x=await menu(p,'Village Warehouse',`§lPhysical inventory§r\n${labelItems(contents)}\n\n§lIn transit§r\n${labelItems(Object.values({...v.cargo,...(v.builderCargo||{}),...(v.medicalCargo||{})}).reduce((a,c)=>{a[c.id]=(a[c.id]||0)+c.amount;return a;},{}))}\n\n${v.chest?'Chest at '+xyz(v.chest):'No chest registered'}\n§7Only delivered items count as stored. Construction and crafting consume real chest inventory.`,canEdit?['Register looked-at single chest','Unregister chest','Toggle crop hauling ('+(v.haulCrops?'ON':'OFF')+')','Back']:['Back']);if(!canEdit)return;
 if(x===0){let b;try{b=p.getBlockFromViewDirection({maxDistance:8})?.block;}catch(_){}if(!b||!['minecraft:chest','minecraft:trapped_chest'].includes(b.typeId)||hd(b.location,v.bell)>24||b.dimension.id!==v.dimension||!b.getComponent('minecraft:inventory')?.container){announce(p,'Look at a single chest within 24 blocks of the bell.');return;}v.chest={x:b.location.x,y:b.location.y,z:b.location.z};event(v,'warehouse','Chest registered '+xyz(v.chest));persist();}
 if(x===1){if(await yes(p,'Unregister Warehouse','Stored items remain in the chest. In-flight Haulers will be paused.')){v.chest=null;dirty=true;persist();}}
 if(x===2){v.haulCrops=!v.haulCrops;dirty=true;persist();}}
async function pageWorkers(p,v,canEdit){const ws=workerList(v),vanilla=villagerWorkforceProbe(v),lines=ws.map((w,i)=>`${i+1}. ${w.nameTag||'SmartNPC Worker'} | ${jobOf(v,w)}\n    §7${workerStatus(v,w)}§r`);const labels=['Legacy fallback: convert nitwit','Assign profession','Retire legacy worker','Back'];const x=await menu(p,'Specialist Workforce',`${lines.join('\n')||'No loaded workers'}\n\nVanilla workforce pilot: ${vanilla.total} villagers nearby (${vanilla.adults} adults, ${vanilla.children} children) | Inventory component: ${vanilla.inventoryApi}/${vanilla.total} | Readable: ${vanilla.inventoryReadable} | Slots: ${vanilla.inventorySlots} | Occupied: ${vanilla.occupiedSlots} | addItem API: ${vanilla.addItemApi}/${vanilla.total}\nNaturally carried items: ${Object.entries(vanilla.heldItems).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,n])=>id.replace('minecraft:','')+' ×'+n).join(', ')||'None detected'}\nComponents: ${Object.entries(vanilla.components).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([id,n])=>id+' ×'+n).join(', ')||'Unavailable'}\n§7Read-only audit only. No items are taken, inserted, or changed. Readable inventory data still does not prove safe transfer or reliable villager work behavior.\n\nLoaded specialists: ${ws.length}/${v.workerIds.length} | Converted residents: ${Object.keys(v.conversions||{}).length} | Unloaded/missing conversions: ${Object.values(v.conversions||{}).filter(c=>c.life==='unloaded'||c.life==='missing').length} | Wandering: ${Object.values(v.conversions||{}).filter(c=>c.life==='wandering').length}\n§7Unloaded specialists remain in the resident census and return to this list when loaded. Only one active Master Crafter is permitted. Workers are custom SmartNPC entities recruited only from verified adult nitwits; normal employed villagers remain vanilla.`,canEdit?labels:['Back']);if(!canEdit)return;
 if(x===0){
  if(ws.length>=MAX_WORKERS){announce(p,'Maximum 12 specialists.');return;}
  if(!atSite(v,p)){announce(p,'Stand within your settlement to enroll a nitwit.');return;}
  let candidates=[];try{candidates=p.dimension.getEntities({families:['nitwit'],location:v.bell,maxDistance:32}).filter(confirmedAdultNitwit);}catch(e){note('NITWIT FAMILY QUERY UNSUPPORTED '+e);}
  if(!candidates.length){announce(p,'No confirmed adult nitwits within 32 blocks. No entity changed.');return;}
  const index=await menu(p,'Optional Legacy Specialist Conversion','Fallback only: regular villagers remain the intended workforce. Choose a confirmed adult non-trading nitwit only if you deliberately want a custom Genesis specialist; conversion permanently removes normal villager breeding behavior.',candidates.map(e=>(e.nameTag||'Nitwit')+' at '+xyz(e.location)).concat('Back'));
  if(index<0||index>=candidates.length)return;
  const old=candidates[index];
  // Any villager inventory is sacred. Do not convert villagers holding items.
  if(!emptyVillagerInventory(candidates[index])){announce(p,'Nitwit inventory is occupied or cannot be verified. Enrollment refused.');return;}
  if(!await yes(p,'Confirm Optional Conversion','This is a permanent legacy fallback. The adult nitwit will be replaced by one Genesis worker and lose normal villager breeding. No regular villager workforce is changed. Proceed?'))return;
  const originalId=old.id,originalName=old.nameTag||'Nitwit',position={...old.location};
  let newcomer=null;
  try{
   newcomer=p.dimension.spawnEntity('smartnpc:worker',position);
   newcomer.nameTag=originalName;
   // Ensure the original still exists before committing the conversion.
   if(!confirmedAdultNitwit(old))throw Error('Original entity is no longer a confirmed adult nitwit (variant 14)');
   if(!emptyVillagerInventory(old))throw Error('Original nitwit inventory changed or cannot be verified');
   old.remove();
   v.conversions??={};v.conversions[newcomer.id]={from:originalId,name:originalName,convertedDay:day(),seen:day(),life:'present',last:{x:Math.floor(position.x),y:Math.floor(position.y),z:Math.floor(position.z)},lastDimension:v.dimension};dirtyRosters.add(v.id);
   if(v.residents[originalId])v.residents[originalId].life='converted';
   v.workerIds.push(newcomer.id);setJob(v,newcomer,'Hauler');migrateSmartNpcWorkerMemory(originalId,newcomer.id,originalName,'Hauler');
   event(v,'enrollment','Nitwit '+originalName+' joined specialist workforce (permanent conversion)');persist();
  }catch(e){if(newcomer)try{newcomer.remove();}catch(_){}note('NITWIT CONVERSION FAILED '+e);announce(p,'Nitwit enrollment failed; check logs and census.');}
 }
 if(x===1){if(!ws.length)return;const pick=await menu(p,'Choose Specialist','Assign one job to a SmartNPC worker.',ws.map(w=>w.nameTag+' ('+jobOf(v,w)+')').concat('Back'));if(pick<0||pick>=ws.length)return;const jobIndex=await menu(p,'Assign Profession','Haulers collect wood and optional crops. Builders place real blocks. Crafter processes recipes. Farmer manages an opted-in plot. Ranger tends an opted-in oak woodlot; Sentinel protects residents; Miner removes approved quarry stone; Steward tracks physical requests.',JOBS.concat('Back'));if(jobIndex<0||jobIndex>=JOBS.length)return;const j=JOBS[jobIndex];if(j==='Crafter'&&ws.some(w=>w.id!==ws[pick].id&&jobOf(v,w)==='Crafter')){announce(p,'Only ONE Master Crafter is permitted.');return;}if(!setJob(v,ws[pick],j)){announce(p,'Builder materials could not be safely recovered; job unchanged.');return;}event(v,'profession',ws[pick].nameTag+' assigned '+j);persist();}
 if(x===2){if(!ws.length)return;const i=await menu(p,'Retire Worker','Cargo must be delivered first. This only affects custom Genesis workers.',ws.map(w=>w.nameTag).concat('Back'));if(i<0||i>=ws.length)return;const w=ws[i];if(v.tradeTrips?.[w.id]){announce(p,'Trader has a live delivery and cannot retire.');return;}if(v.conversions?.[w.id]){announce(p,'Converted nitwits cannot be retired to vanilla without losing their original identity.');return;}if(v.cargo[w.id]||v.medicalCargo?.[w.id]){announce(p,'Worker has cargo. Let it deliver or recover before retiring.');return;}if(!await yes(p,'Retire Worker','Remove this custom specialist entity? Any builder materials will be returned to the warehouse or dropped safely. Vanilla residents are unaffected.'))return;if(v.builderCargo?.[w.id]&&!returnBuilderLoad(v,w,chestFor(v),v.builderCargo[w.id])){announce(p,'Builder materials could not be safely recovered; worker was not retired.');return;}try{releaseRoute(v,w);delete v.navSlots?.[w.id];delete v.woodCutting?.[w.id];w.remove();v.workerIds=v.workerIds.filter(id=>id!==w.id);delete v.jobs[w.id];event(v,'retire','Custom specialist retired');persist();}catch(e){note('RETIRE ERROR '+e);}}}
async function pageCrafting(p,v,canEdit){const crafter=workerList(v).find(w=>jobOf(v,w)==='Crafter');const box=chestFor(v);const x=await menu(p,'Master Crafter',`Master Crafter: ${crafter?crafter.nameTag:'NOT ASSIGNED'}\nWarehouse: ${box?'Online':'Missing'}\nCrafting table: ${hasCraftingTable(v)?'Nearby':'MISSING beside warehouse'}\nQueue: ${v.crafts.map(i=>RECIPES[i]?.title||i).join(', ')||'Empty'}\n\n§7Recipes use and produce real chest items.`,canEdit?[...Object.values(RECIPES).map(x=>'Queue '+x.title),'Cancel last recipe','Back']:['Back']);if(!canEdit)return;const keys=Object.keys(RECIPES);if(x>=0&&x<keys.length){if(v.crafts.length>=16){announce(p,'Craft queue full.');return;}v.crafts.push(keys[x]);dirty=true;persist();announce(p,'Recipe queued. Assign one Master Crafter to process it.');}if(x===keys.length&&v.crafts.length){v.crafts.pop();dirty=true;persist();}}
async function pageConstruction(p,v,canEdit){const s=stats(v),tasks=v.queue.map(q=>`${q.title||planBlueprint(q)?.title||q.kind}: ${q.progress}/${planBlueprint(q)?.blocks().length||q.tileCount||'?'} (${q.state}${q.reason?', '+q.reason:''})`).join('\n');const need=requiredFor(v);const shortage=nextBuild(v)?shortageForWarehouse(planBlueprint(nextBuild(v))?.blocks()||[],nextBuild(v)?.progress||0,chestFor(v)):{};const x=await menu(p,'Village Construction',`${s.presentAdults}/8 present adults ready for expansion (${s.adults} total adults)\n§7Build only on empty plots you explicitly select. Builders consume real planks. No landscape clearing.\n\n${tasks||'No projects yet.'}\n\n§eRemaining materials:\n${labelItems(need)}§r\n\n§eUnstocked materials (Construct inventory accounting):\n${labelItems(shortage)}§r`,canEdit?['Plan Carpenter Workshop (5×5)','Plan Storehouse (7×5)','Plan Village House (5×5)','Plan Watchtower (3×3)','Plan Stone Road (1×9)','Plan Quarry Workshop (5×5)','Build from saved Construct structure','Cancel most recent unfinished plan','Back']:['Back']);if(!canEdit)return;
 if(x>=0&&x<=5){if(s.presentAdults<8){announce(p,'Civilization construction requires 8 present adults. Let vanilla residents grow and breed naturally.');return;}if(v.queue.filter(q=>q.state!=='complete'&&q.state!=='cancelled').length>=2){announce(p,'Two unfinished projects maximum.');return;}const kind=['workshop','storehouse','house','watchtower','stone_road','quarryhut'][x],bp=blueprints[kind];let hit;try{hit=p.getBlockFromViewDirection({maxDistance:8})?.block;}catch(_){}if(!hit||!atSite(v,p)){announce(p,'Look at the ground near your village.');return;}const origin={x:hit.location.x,y:hit.location.y+1,z:hit.location.z};if(hd(origin,v.bell)>RADIUS-12){announce(p,'Build site is too far from town center.');return;}const d=dimension(v);for(const part of bp.blocks()){const b=getBlock(d,{x:origin.x+part.x,y:origin.y+part.y,z:origin.z+part.z});if(!b?.isAir){announce(p,'Build plot obstructed at '+(b?xyz(b.location):'unloaded location')+'. Nothing modified.');return;}}
 if(!await yes(p,'Plan '+bp.title,`Reserve an empty ${bp.width}×${bp.depth} plot from ${xyz(origin)}? One builder will physically place blocks using chest materials.`))return;addProject(v,{kind,origin,progress:0,state:'queued',reason:''});event(v,'plan','Planned '+bp.title+' at '+xyz(origin));persist();}
 if(x===6){
  if(s.presentAdults<8){announce(p,'Need eight present adults before construction.');return;}
  if(v.queue.filter(q=>q.state!=='complete'&&q.state!=='cancelled').length>=2){announce(p,'Two unfinished projects maximum.');return;}
  const answer=await new ModalFormData().title('Construct Blueprint').textField('Structure ID','namespace:structure_name',{defaultValue:'genesis:house'}).show(p);
  if(answer.canceled)return;
  const id=String(answer.formValues?.[0]||'').trim();let preview;
  try{preview=readConstructionStructure(id);}catch(e){announce(p,'Could not load blueprint: '+String(e.message||e).slice(0,110));return;}
  let hit;try{hit=p.getBlockFromViewDirection({maxDistance:8})?.block;}catch(_){}
  if(!hit||!atSite(v,p)){announce(p,'Look at the ground near the village first.');return;}
  const origin={x:hit.location.x,y:hit.location.y+1,z:hit.location.z};
  if(hd(origin,v.bell)>RADIUS-12){announce(p,'Structure too far from town center.');return;}
  const d=dimension(v);
  for(const part of preview.tiles){const block=getBlock(d,{x:origin.x+part.x,y:origin.y+part.y,z:origin.z+part.z});
   if(!block?.isAir){announce(p,'Plot obstructed/unloaded at '+xyz({x:origin.x+part.x,y:origin.y+part.y,z:origin.z+part.z})+'. No blocks changed.');return;}}
  const cost={};for(const tile of preview.tiles)cost[tile.id]=(cost[tile.id]||0)+1;
  if(!await yes(p,'Build '+preview.title,`Approve ${preview.tiles.length} real block placements at ${xyz(origin)}?\nResources: ${labelItems(cost)}\nBuilder will consume one item per block from the warehouse.`))return;
  addProject(v,planFromStructurePreview(preview,origin));event(v,'plan','Approved Construct structure '+id+' with '+preview.tiles.length+' blocks');persist();return;
 }
 if(x===7){const last=[...v.queue].reverse().find(q=>q.state!=='complete'&&q.state!=='cancelled');if(!last)return;if(await yes(p,'Cancel Plan','Previously placed blocks remain in the world. The unbuilt portion is cancelled.')){last.state='cancelled';if(Array.isArray(last.tiles)){last.tileCount=last.tiles.length;last.tileChunks=Math.ceil(last.tiles.length/TILE_CHUNK);delete last.tiles;}dirtyProjects.add(v.id);event(v,'plan','Cancelled '+last.kind+' without undoing blocks');persist();}}}
async function pageFarms(p,v,canEdit){const x=await menu(p,'Village Agriculture',`Registered farmland center: ${v.farm?xyz(v.farm):'None'}\nAutomated harvest: ${v.farmEnabled?'ON':'OFF'}\n§7Only mature crops rooted over farmland in the 7×7 plot are harvested. The crop remains planted for natural regrowth; the Farmer collects a real item entity and delivers it to the warehouse.`,canEdit?['Register looked-at farmland','Toggle automated harvest','Back']:['Back']);if(!canEdit)return;
 if(x===0){let b;try{b=p.getBlockFromViewDirection({maxDistance:8})?.block;}catch(_){}if(b?.typeId!=='minecraft:farmland'||hd(b.location,v.bell)>35){announce(p,'Look at farmland within 35 blocks of your bell.');return;}v.farm={x:b.location.x,y:b.location.y+1,z:b.location.z};event(v,'farm','Registered farmland plot');persist();}
 if(x===1){v.farmEnabled=!v.farmEnabled;event(v,'policy','Farm harvesting '+(v.farmEnabled?'enabled':'disabled'));persist();}}
async function pagePolicies(p,v,canEdit){
 const x=await menu(p,'Village Policies',`Global worker engine: ${state.aiEnabled?'ON':'PAUSED'}
Village specialists: ${v.enabled?'ON':'PAUSED'}
Sentinel alerts: ${v.guardEnabled?'ON':'OFF'}
Ranged defense: ${!v.guardEnabled?'OFF':v.governor?.guardCombat?'ARMED':'ALERTS ONLY'}
Oak woodlot: ${v.woodlot?xyz(v.woodlot):'NOT REGISTERED'}
Ranger forestry: ${v.woodlotEnabled?'ON':'OFF'}
§7This is the in-world global control. It pauses or resumes Genesis specialists only; normal employed villagers keep their vanilla AI and professions.`,canEdit?['Toggle global worker engine','Pause / Resume village specialists','Toggle sentinel threat alerts','Register looked-at woodlot ground','Toggle woodlot forestry','Back']:['Back']);
 if(!canEdit)return;
 if(x===0){if(!setGlobalAiEnabled(v,!state.aiEnabled))announce(p,'Global AI setting could not be saved; previous state restored.');}
 if(x===1){v.enabled=!v.enabled;event(v,'policy','Village specialists '+(v.enabled?'resumed':'paused'));persist();}
 if(x===2){v.guardEnabled=!v.guardEnabled;event(v,'policy','Sentinel alerts '+(v.guardEnabled?'enabled':'disabled'));persist();}
 if(x===3){let b;try{b=p.getBlockFromViewDirection({maxDistance:8})?.block;}catch(_){}if(!b||!['minecraft:dirt','minecraft:grass_block','minecraft:podzol','minecraft:coarse_dirt'].includes(b.typeId)||hd(b.location,v.bell)>35){announce(p,'Look at grass or dirt within 35 blocks of the bell.');return;}if(!await yes(p,'Designate Oak Woodlot','Rangers will plant oak saplings and cut oak logs connected to leaves inside a 5×5 area centered here. Never choose an area containing buildings.'))return;v.woodlot={...b.location};event(v,'forest','Woodlot registered');persist();}
 if(x===4){v.woodlotEnabled=!v.woodlotEnabled;event(v,'policy','Woodlot forestry '+(v.woodlotEnabled?'enabled':'disabled'));persist();}
}

function councilReport(v){
 const g=currentGovernor(v),s=stats(v),box=chestFor(v),inv=countItems(box),roles={};
 for(const w of workerList(v))roles[jobOf(v,w)]=(roles[jobOf(v,w)]||0)+1;
 const unbuilt=v.approvedPlots?.length||0;
 return `§lCivilization Council§r\nGovernor: ${g.enabled?'ACTIVE':'OFF'} | Auto jobs: ${g.autoJobs?'ON':'OFF'} | Expansion: ${g.autoExpansion?'ON':'OFF'}\nAdults: ${s.adults} total / ${s.presentAdults} present | Children: ${s.babies} | Wandering: ${s.wandering} | Unloaded: ${s.unloaded} | Missing: ${s.missing} | Dead: ${s.dead}\nRoles: ${Object.entries(roles).map(([k,n])=>k+' '+n).join(', ')||'No workers'}\nStored food: ${(inv['minecraft:bread']||0)} bread; ${inv['minecraft:wheat']||0} wheat\nWood: ${inv['minecraft:oak_log']||0} logs; ${inv['minecraft:oak_planks']||0} planks\nFood goal: ${g.foodReserve} bread | Reserve logs: ${g.woodReserve}\nBreeding provisions: ${v.provisioning?.enabled?'ON':'OFF'} | Bread delivered: ${v.provisioning?.delivered||0}\nApproved future plots: ${unbuilt} | Live queue: ${v.queue.filter(x=>x.state!=='complete'&&x.state!=='cancelled').length}\nDefense: ${!v.guardEnabled?'OFF':g.guardCombat?'ARMED':'ALERTS ONLY'} | Arrows in warehouse: ${inv['minecraft:arrow']||0} | Shots: ${v.defense?.shots||0} | Donations: ${v.defense?.donations||0} | Last: ${v.defense?.last||'not attempted'}\nMedic treatments: ${v.defense?.healed||0}\n\n§7Construction starts at 8 present adults. Missing/unloaded residents remain in the living census until death is confirmed. No forced breeding, terrain clearing, or spawning materials.`;
}
async function pageCouncil(p,v,canEdit){
 const g=currentGovernor(v);
 const actions=canEdit?['Toggle Civilization Governor','Toggle automatic specialist jobs','Approve next HOUSE plot (look at ground)','Approve next WATCHTOWER plot (look at ground)','Toggle opt-in guard combat','Toggle food reserve (12 / 24)','Rally one worker to my location','Toggle food provisioner for natural breeding','Toggle surveyed automatic expansion','Back']:['Back'];
 const x=await menu(p,'§2Civilization Council',councilReport(v),actions);
 if(!canEdit||x<0||x>=9)return;
 if(x===0){g.enabled=!g.enabled;event(v,'policy','Autonomous council '+(g.enabled?'enabled':'disabled'));}
 if(x===1){g.autoJobs=!g.autoJobs;event(v,'policy','Automatic jobs '+(g.autoJobs?'enabled':'disabled'));}
 if(x===2||x===3){let ground;try{ground=p.getBlockFromViewDirection({maxDistance:8})?.block;}catch(_){return;}const kind=x===2?'house':'watchtower',plan=ground&&approvePlot(v,ground,kind);if(!plan){announce(p,'Choose an empty, flat build area inside the village. Nothing changed.');return;}if(!await yes(p,'Approve '+blueprints[kind].title,'Reserve this empty site for future autonomous construction? Resources must come from the registered chest.'))return;v.approvedPlots.push(plan);dirtyProjects.add(v.id);event(v,'approval','Founder approved '+kind+' plot '+xyz(plan.origin));}
 if(x===4){g.guardCombat=!g.guardCombat;event(v,'policy','Guard combat '+(g.guardCombat?'enabled':'disabled'));}
 if(x===5){g.foodReserve=g.foodReserve===12?24:12;event(v,'policy','Food reserve set to '+g.foodReserve);}
 if(x===8){g.autoExpansion=!g.autoExpansion;event(v,'policy','Surveyed autonomous expansion '+(g.autoExpansion?'enabled':'disabled'));}
 if(x===7){v.provisioning??={enabled:false,lastDay:-1,delivered:0};v.provisioning.enabled=!v.provisioning.enabled;event(v,'policy','Founding food provisions '+(v.provisioning.enabled?'enabled':'disabled'));}
 if(x===6){const ws=workerList(v);if(!ws.length)return;const i=await menu(p,'Rally Specialist','Temporary rally position: the worker will return to regular work afterward.',ws.map(w=>w.nameTag+' ('+jobOf(v,w)+')').concat('Back'));if(i<0||i>=ws.length)return;const w=ws[i];if(v.tradeTrips?.[w.id]){announce(p,'Trader has a live delivery and cannot retire.');return;}if(v.conversions?.[w.id]){announce(p,'Converted nitwits cannot be retired to vanilla without losing their original identity.');return;}if(v.cargo[w.id]||v.builderCargo?.[w.id]||v.medicalCargo?.[w.id]){announce(p,'This worker is carrying cargo and cannot be rerouted.');return;}v.rallies??={};v.rallies[w.id]={x:Math.floor(p.location.x),y:Math.floor(p.location.y),z:Math.floor(p.location.z),until:(system.currentTick||0)+400};event(v,'order','Founder rallied '+(w.nameTag||'worker'));}
 persist();
}
async function pageStats(p,v){const s=stats(v),m=v.metrics;const hist=v.history.slice(0,16).map(x=>`Day ${x.day} • ${x.type}: ${x.message}`).join('\n');await menu(p,'Chronicle & Diagnostics',`§lCivilization: ${s.stage}§r\nLiving residents: ${s.population}; Present: ${s.present}; Wandering: ${s.wandering}; Unloaded: ${s.unloaded}; Missing: ${s.missing}; Confirmed dead: ${s.dead}\nAdults: ${s.adults} total / ${s.presentAdults} present; Children: ${s.babies}\nHaul pickups: ${m.picked}; Delivered: ${m.delivered}\nBlocks built: ${m.built}; Recipes completed: ${m.crafted}; Crops: ${m.harvested}\nLogs cut: ${m.woodcut||0}; Saplings planted: ${m.planted||0}\nUnfinished cargo: ${Object.keys(v.cargo).length}\nLoaded census coverage: ${scanActive(v)?'Local scan':'Not confirmed'}\n\n§lHistory§r\n${hist||'No records yet'}`,['Back']);}
async function onBell(p,dim,pos){if(openMenus.has(p.id))return;openMenus.add(p.id);try{let v=villageAt(dim,pos);if(!v){const legacy=Object.values(state.villages).find(x=>x.legacyNeedsBell&&x.dimension===dim.id&&hd(x.bell,pos)<=RADIUS);if(legacy){v=legacy;v.bell={...pos};v.legacyNeedsBell=false;event(v,'migration','Linked imported SmartNPC village to its existing Town Center bell');persist();}}if(!v){if(Object.keys(state.villages).length>=MAX_VILLAGES){announce(p,'Maximum eight Genesis settlements per world.');return;}if(Object.values(state.villages).some(x=>x.dimension===dim.id&&hd(x.bell,pos)<RADIUS*2)){announce(p,'Another Genesis Town Center is too near.');return;}if(!await yes(p,'Found Village','Register this bell as a Genesis Reborn Town Center? Vanilla residents will remain unchanged.'))return;v=newVillageState(dim.id+'|'+xyz(pos),dim.id,pos,p.name);state.villages[v.id]=v;event(v,'founding','Founded by '+p.name);census(v);persist();}await showHome(p,v);}catch(e){note('TOWN CENTER '+e);announce(p,'Town Center error. Check content log.');}finally{openMenus.delete(p.id);persist();}}
if(safeVillageConversions().length!==1)note('BEE CONVERSION SAFETY: bread conversion did not match expected source table');
try{world.afterEvents.playerStartBreakingBlock.subscribe(ev=>{try{if(ev.block.typeId!=='minecraft:bell'||ev.heldItemStack)return;const p=ev.player,d=ev.block.dimension,pos={...ev.block.location};system.run(()=>void onBell(p,d,pos));}catch(e){note('BELL EVENT '+e);}});}catch(e){note('BELL SUBSCRIBE '+e);}
try{world.beforeEvents.playerBreakBlock.subscribe(ev=>{if(ev.block.typeId==='minecraft:bell'&&!ev.itemStack)ev.cancel=true;});}catch(_){}
try{world.afterEvents.entityDie.subscribe(ev=>{const e=ev.deadEntity;if(!e)return;for(const v of Object.values(state.villages)){if(TYPES.includes(e.typeId)&&v.residents[e.id]&&v.residents[e.id].life!=='dead'){const m=v.residents[e.id],cause=String(ev.damageSource?.cause||'unknown'),attacker=ev.damageSource?.damagingEntity?.typeId||ev.damageSource?.damagingProjectile?.typeId;m.life='dead';m.seen=day();dirtyRosters.add(v.id);event(v,'death',m.name+' died ('+cause+(attacker?' via '+attacker.replace('minecraft:',''):'')+')');}if(e.typeId==='smartnpc:worker'&&v.workerIds.includes(e.id)){const conversionRecord=v.conversions?.[e.id];delete v.navSlots?.[e.id];const trip=v.tradeTrips?.[e.id],tradeAudit=trip&&(trip.phase==='audit'||trip.phase==='auditReturn');if(!tradeAudit)delete v.tradeTrips?.[e.id];else event(v,'audit','Trader died during settlement audit; cargo held for manual inspection');delete v.woodCutting?.[e.id];const med=v.medicalCargo?.[e.id];if(med){if(med.phase==='audit'){note('MEDIC CARGO LEFT IN AUDIT HOLD AFTER WORKER DEATH');}else try{e.dimension.spawnItem(new ItemStack(med.id,med.amount),e.location);delete v.medicalCargo[e.id];dirty=true;}catch(err){note('MEDIC CARGO RECOVERY ERROR '+err);}}returnCargo(v,e.id,e);if(v.builderCargo?.[e.id])returnBuilderLoad(v,e,chestFor(v),v.builderCargo[e.id]);if(v.conversions?.[e.id]){const originalId=v.conversions[e.id].from;if(v.residents[originalId])v.residents[originalId].life='dead';delete v.conversions[e.id];dirtyRosters.add(v.id);}v.workerIds=v.workerIds.filter(id=>id!==e.id);delete v.jobs[e.id];const cause=String(ev.damageSource?.cause||'unknown'),attacker=ev.damageSource?.damagingEntity?.typeId||ev.damageSource?.damagingProjectile?.typeId;event(v,'loss',(conversionRecord?.name||e.nameTag||'Specialist worker')+' died ('+cause+(attacker?' via '+attacker.replace('minecraft:',''):'')+')');}}persist();});}catch(e){note('DEATH EVENT '+e);}
function setGlobalAiEnabled(v,enabled){
 const previous=state.aiEnabled,historyLength=v.history.length;
 state.aiEnabled=enabled===true;event(v,'policy','Global worker engine '+(state.aiEnabled?'enabled':'paused'));
 if(!persist()){state.aiEnabled=previous;v.history.length=historyLength;dirty=true;return false;}
 return true;
}
system.run(()=>{try{const saved=world.getDynamicProperty(KEY);if(typeof saved==='string')state=migrate(JSON.parse(saved));migrateLegacyCivilization();ready=true;dirty=true;persist();note('Genesis Reborn 2.4 READY — native navigation, jobs, quarry, crafting, warehouse, contracts, council');}catch(e){ready=true;note('LOAD FAILED '+e);}});

system.runInterval(()=>{if(!ready)return;const vs=Object.values(state.villages);if(!vs.length)return;const v=vs[(cursor++)%vs.length];try{const d=dimension(v);const homePlayers=d?.getPlayers({location:v.bell,maxDistance:RADIUS}).length||0;
  const travelerVisible=Object.keys(v.tradeTrips||{}).some(id=>{try{const w=world.getEntity(id);return valid(w)&&d.getPlayers({location:w.location,maxDistance:45}).length>0;}catch(_){return false;}});
  if(!homePlayers&&!travelerVisible)return;
  if(cursor%4===0&&homePlayers)census(v);workerCycle(v);persist();}catch(e){note('CIVILIZATION TICK '+String(e).slice(0,160));}},40);
