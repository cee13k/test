// Genesis -> Construct verifier adapter. Original CellVerifier performs block classification.
import { CellVerifier } from '../vendor/construct/classes/Verifier/CellVerifier.js';
import { BlockVerificationLevel as L } from '../vendor/construct/classes/Enums/BlockVerificationLevel.js';
export function checkBlueprintBlock(worldBlock, tile) {
  const instance={
    toGlobalCoords: location => location,
    getDimension: () => ({getBlock: () => worldBlock}),
    getBlock: () => ({typeId:tile.id,states:tile.states||{},hasStates:Object.keys(tile.states||{}).length>0,isWaterlogged:false})
  };
  return new CellVerifier(instance,false).verify({x:0,y:0,z:0}).verificationLevel;
}
export const VerifiedLevel=L;
