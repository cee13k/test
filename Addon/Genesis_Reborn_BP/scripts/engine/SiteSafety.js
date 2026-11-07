// Chunk-aware construction inspection using MIT Construct's ChunkGrid and SkippedChunkTracker.
import { ChunkGrid } from '../union/ChunkGrid.js';
import { SkippedChunkTracker } from '../union/SkippedChunkTracker.js';
export function verifySite(dimension,origin,tiles,allowExisting=false){
 const blockers=[];let present=0;const grid=new ChunkGrid(origin);const skipped=new SkippedChunkTracker();
 for(const tile of tiles){const pos={x:origin.x+tile.x,y:origin.y+tile.y,z:origin.z+tile.z};
  const chunk=grid.keyAt(tile.x,tile.z);
  if(skipped.isSkipped(chunk)){blockers.push({pos,reason:'unloaded-chunk'});break;}
  let block;try{block=dimension.getBlock(pos);}catch(error){skipped.trackError(error,chunk);blockers.push({pos,reason:'unloaded-or-bounds'});break;}
  if(!block){blockers.push({pos,reason:'unloaded'});break;}
  if(block.typeId===tile.id){present++;continue;}
  if(!block.isAir){blockers.push({pos,reason:'occupied'});break;}
 }
 return {safe:blockers.length===0&&(allowExisting||present===0),existing:present,blockers};
}
export function remainingMaterials(tiles,index){const tally={};for(const b of tiles.slice(index))tally[b.id]=(tally[b.id]||0)+1;return tally;}
