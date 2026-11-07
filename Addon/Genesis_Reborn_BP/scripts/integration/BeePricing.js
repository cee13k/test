// Genesis economy bridge to the ORIGINAL Bee My Honey MIT village-pricing engine.
import { getItemBasePriceExact } from '../vendor/bee/economy/village-pricing.js';
export function villagePrice(itemId){
  if(typeof itemId!=='string'||!/^minecraft:[a-z0-9_]+$/.test(itemId))return null;
  try {const p=getItemBasePriceExact(itemId);return Number.isFinite(p)&&p>0?p:null;}catch(_){return null;}
}
export function barterQuote(requestId,requestQty,offerId,offerQty){
  const ask=villagePrice(requestId),give=villagePrice(offerId);
  if(!ask||!give||![requestQty,offerQty].every(n=>Number.isInteger(n)&&n>0))return null;
  return {requestedValue:Math.round(ask*requestQty*100)/100,offeredValue:Math.round(give*offerQty*100)/100,ratio: Math.round(give*offerQty/(ask*requestQty)*100)/100};
}
