// Genesis integration adapter for Construct's original physical inventory subtraction.
import { StructureMaterials } from '../vendor/construct/StructureMaterialsInventory.js';

export function countRemainingBlocks(tiles, offset=0) {
  const items = {};
  if (!Array.isArray(tiles)) return items;
  for (let i=Math.max(0,offset|0); i<tiles.length; i++) {
    const id=tiles[i]?.id;
    if (typeof id !== 'string' || !id.startsWith('minecraft:')) continue;
    const entry=items[id] || (items[id]={count:0,stackSize:64});
    entry.count++;
  }
  return items;
}

// Actual Construct method reads each real chest slot and subtracts its stack amount.
export function shortageForWarehouse(tiles, offset, container) {
  const all=countRemainingBlocks(tiles,offset);
  if (!container) return Object.fromEntries(Object.entries(all).map(([id,entry])=>[id,entry.count]));
  const remaining=StructureMaterials.subtractInventory(all,container);
  return Object.fromEntries(Object.entries(remaining).filter(([_,entry])=>entry.count>0).map(([id,entry])=>[id,entry.count]));
}
