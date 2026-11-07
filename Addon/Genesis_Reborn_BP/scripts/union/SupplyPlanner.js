// Genesis coordination adapter: real-stock demand, no invented inventories or currency.
// Integrates Construct's CollectedMaterials ledger and Bee My Honey demand weights.
import { CollectedMaterials } from './CollectedMaterials.js';
import { VILLAGE_BUY_TABLE } from '../vendor/bee/VillageDemand.js';

const weights = Object.fromEntries(VILLAGE_BUY_TABLE.map(row => [row.itemId, row.weight]));
function int(v) { return Math.max(0, Math.floor(Number(v) || 0)); }
function requirement(map, id, count) { if(count>0) map[id]=(map[id]||0)+int(count); }
export function supplyPlan(input) {
  const population = int(input.population), foodReserve = int(input.foodReserve);
  // Construct's material ledger: counts in the actual registered chest only.
  const ledger = new CollectedMaterials(input.stock || {});
  const goals = {};
  requirement(goals, 'minecraft:bread', Math.max(foodReserve, population >= 2 && population < 8 ? 6 : 0));
  if (population >= 2) {
    requirement(goals, 'minecraft:wheat', Math.ceil(population * (weights['minecraft:wheat'] || 1)));
    requirement(goals, 'minecraft:carrot', Math.ceil(population * (weights['minecraft:carrot'] || 1) / 2));
  }
  // Construction is a physical material requirement, not a virtual balance.
  for(const [id,amount] of Object.entries(input.construction || {}))
    requirement(goals,id,amount);
  // Wood reserve is a policy goal, not an item payment or a claim on the world.
  requirement(goals, 'minecraft:oak_log', int(input.woodReserve));
  const materials = Object.fromEntries(Object.entries(goals).map(([id,count]) => [id,{count,stackSize:64}]));
  const deficits = ledger.subtractFrom(materials);
  const requested = Object.entries(deficits).sort((a,b)=>b[1].count-a[1].count).map(([id,e])=>({id,needed:e.count,stock:ledger.get(id),goal:goals[id]}));
  return {goals,stock:ledger.toJSON(),requests:requested};
}

// Reservation-free, capacity-aware: never issues duplicate fabrication tasks.
export function nextProductionOrder(plan, queued) {
  const already = new Set(queued||[]);
  const missing = id => (plan.requests.find(x=>x.id===id)?.needed||0)>0;
  if(missing('minecraft:bread') && (plan.stock['minecraft:wheat']||0)>=3 && !already.has('bread'))return 'bread';
  if(missing('minecraft:oak_planks') && (plan.stock['minecraft:oak_log']||0)>=1 && !already.has('planks'))return 'planks';
  return null;
}
