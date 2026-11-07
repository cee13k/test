// Original Genesis adapter. Construct's MIT Structure class is imported and used below.
import { Structure } from '../vendor/construct/classes/Structure/Structure.js';
import { VILLAGE_CONVERT_TABLE } from '../vendor/bee/convert-data.js';

// No commands, liquids, spawners, containers, gravity-dependent blocks or free resource synthesis.
const SAFE = new Set([
 'minecraft:oak_planks','minecraft:spruce_planks','minecraft:birch_planks','minecraft:dark_oak_planks',
 'minecraft:cobblestone','minecraft:stone','minecraft:stone_bricks','minecraft:bricks',
 'minecraft:glass','minecraft:oak_log','minecraft:spruce_log','minecraft:birch_log',
 'minecraft:oak_fence','minecraft:oak_slab','minecraft:oak_stairs',
 'minecraft:torch','minecraft:lantern','minecraft:dirt','minecraft:gravel',
]);
const MAX_VOLUME=2048, MAX_SIDE=24;
export function allowedStructureBlock(id){return SAFE.has(id);}
// Keep Bee My Honey's data as executable input: only real table recipes with verifiable Minecraft
// crafting mechanics can become Genesis work orders. Furnace recipes are excluded, since we
// have not implemented fuel, workstation availability or cooking time.
export function safeVillageConversions(){return VILLAGE_CONVERT_TABLE.filter(r=>r.in==='minecraft:wheat'&&r.out==='minecraft:bread'&&r.inQty===3&&r.outQty===1);}
export function readConstructionStructure(structureId) {
 if(!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(structureId))throw Error('Invalid structure identifier');
 const source=new Structure(structureId); // Direct Construct library, not a reimplementation.
 const bounds=source.getMax(),volume=bounds.x*bounds.y*bounds.z;
 if(![bounds.x,bounds.y,bounds.z].every(n=>Number.isInteger(n)&&n>0&&n<=MAX_SIDE)||volume>MAX_VOLUME)throw Error('Structure exceeds safe size limits');
 const steps=[];
 for(let y=0;y<bounds.y;y++)for(let z=0;z<bounds.z;z++)for(let x=0;x<bounds.x;x++){
   const b=source.getBlock({x,y,z});
   if(!b||b.typeId==='minecraft:air'||b.typeId==='minecraft:structure_void')continue;
   if(!allowedStructureBlock(b.typeId))throw Error('Unsupported / unsafe block: '+b.typeId);
   if(b.isWaterlogged)throw Error('Waterlogged blocks are not supported');
   // Store only safe, JSON-serializable state values; validate again at placement.
   const states=b.states||{};
   if(Object.keys(states).length>8)throw Error('Too many block states');
   steps.push({x,y,z,id:b.typeId,states});
 }
 if(!steps.length)throw Error('Structure contains no supported blocks');
 return {kind:'construct_structure',title:structureId, width:bounds.x,depth:bounds.z,height:bounds.y,tiles:steps};
}
export function planFromStructurePreview(preview, origin){
 if(!preview||preview.kind!=='construct_structure'||!preview.tiles?.length)throw Error('Invalid structure preview');
 return {kind:'construct_structure',title:preview.title,origin,tiles:preview.tiles,
 width:preview.width,depth:preview.depth,progress:0,state:'queued',reason:''};
}
