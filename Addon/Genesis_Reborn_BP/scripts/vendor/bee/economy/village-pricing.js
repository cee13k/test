import { COMMODITIES, CURRENCIES } from "../data/market-data.js";
import {
  GENERIC_HANDWORK_WAGE,
  DAY_MINUTES,
  GATHER_DEFAULT_PER_DAY,
  CRAFT_DEFAULT_PER_DAY,
  GATHER_RATE_OVERRIDES,
  FIXED_LABOR_DAYS,
  SMELTING_BLOCKS,
  FUEL_ITEM_ID,
  FUEL_SMELTS_PER_UNIT,
  VILLAGE_FLOOR_RATES,
  DEFAULT_MAX_LOT,
  MAX_LOT_OVERRIDES,
  LOT_MIN_UNITS
} from "../data/village-pricing-data.js";
import { PRICING_RECIPES } from "../data/pricing-recipes-data.js";

// ==========================================
// 統一プライシングエンジン (dev/pricing-guide.md 参照)
// ------------------------------------------
// 第1層(原価)・第2層(基準価格)の計算関数。第3層(市場価格)は新規実装不要
// (既存の需要圧力・実出品の需給・PBの気まぐれ変動がそのまま第3層にあたる)。
//
// 再帰のルール(pricing-guide.md):
//   1. 再帰では必ず「原価」だけを積み上げる。1.20倍は最終的な完成品に1回だけ適用する
//      (getBasePriceでのみ掛ける。calculateCost自体はマージンを含まない)
//   2. 既にCOMMODITIESにbaseRateが存在する素材は、採掘/伐採から再帰計算せず、
//      そのbaseRateをそのまま材料原価として使う
//      (※COMMODITIES.baseRate自体を導出し直す時だけは useCommodity:false で、
//        この近道を使わず労働費から計算する。deriveCommodityBaseRate参照)
// ==========================================

export const MARGIN = 1.2;

let _commodityKeyByItemId = null;
function commodityKeyByItemId(itemId) {
  if (!_commodityKeyByItemId) {
    _commodityKeyByItemId = {};
    for (const [key, def] of Object.entries(COMMODITIES)) {
      _commodityKeyByItemId[def.itemId] = key;
    }
  }
  return _commodityKeyByItemId[itemId] ?? null;
}

const DEFAULT_OPTS = { useCommodity: true };

// 採集素材1個あたりの原価(=労働費)。useCommodity:true(既定)なら、COMMODITIESに既存のbaseRateが
// あればそちらを優先する。perDayInline は擬似素材(レシピの中だけに出てくる素材)用の直接指定。
export function getGatherCost(itemId, opts = DEFAULT_OPTS, perDayInline = null) {
  if (opts.useCommodity) {
    const commodityKey = commodityKeyByItemId(itemId);
    if (commodityKey) return COMMODITIES[commodityKey].baseRate;
  }
  const perDay = perDayInline ?? GATHER_RATE_OVERRIDES[itemId] ?? GATHER_DEFAULT_PER_DAY;
  return GENERIC_HANDWORK_WAGE / perDay;
}

// クラフト(クラフト台レシピ)1回あたりの加工労働費。
export function getCraftLaborCost(countPerDay = CRAFT_DEFAULT_PER_DAY) {
  return GENERIC_HANDWORK_WAGE / countPerDay;
}

// 精錬(かまど/溶鉱炉/燻製器/たき火)1個あたりの加工労働費・燃料費。
// ingredientCostは含まない(呼び出し側でcalculateCostのsmeltノードが別途加算する)。
// 燃料費は村の床値(VILLAGE_FLOOR_RATES)から出す(pricing-guide.mdの式通り。
// getGatherCostの汎用労働費フォールバックは使わない)。
export function getSmeltCost(blockKey) {
  const block = SMELTING_BLOCKS[blockKey];
  if (!block) return { labor: 0, fuel: 0, total: 0 };

  const perDay = (DAY_MINUTES * 60) / block.secondsPerItem;
  const labor = GENERIC_HANDWORK_WAGE / perDay;
  const fuelUnitRate = VILLAGE_FLOOR_RATES[FUEL_ITEM_ID] ?? 0;
  const fuel = block.needsFuel ? fuelUnitRate / FUEL_SMELTS_PER_UNIT : 0;
  return { labor, fuel, total: labor + fuel };
}

const _warned = new Set();
function warnOnce(msg) {
  if (_warned.has(msg)) return;
  _warned.add(msg);
  console.warn("[BeeMyHoney] village-pricing: " + msg);
}

// itemId 1個あたりの原価(第1層)。解決の順序:
//   1. COMMODITIES に baseRate がある(useCommodity:true の時のみ) → その baseRate
//   2. FIXED_LABOR_DAYS にある → 労働日数 × 手間賃
//   3. PRICING_RECIPES にレシピ/採集ノードがある → そのノードを再帰計算
//   4. どれも無い → 汎用の採集デフォルトで暫定計算(警告を出す。dev/check_pricing.mjs で検出する想定)
function itemCost(itemId, opts, trail) {
  if (trail.includes(itemId)) {
    throw new Error("village-pricing: recipe cycle " + [...trail, itemId].join(" -> "));
  }
  if (opts.useCommodity) {
    const key = commodityKeyByItemId(itemId);
    if (key) return COMMODITIES[key].baseRate;
  }
  if (FIXED_LABOR_DAYS[itemId] !== undefined) {
    return GENERIC_HANDWORK_WAGE * FIXED_LABOR_DAYS[itemId];
  }
  const node = PRICING_RECIPES[itemId];
  if (node) return nodeCost(node, opts, [...trail, itemId]);

  warnOnce("no recipe for " + itemId + " (using generic gather default)");
  return getGatherCost(itemId, opts);
}

function nodeCost(node, opts, trail) {
  switch (node.kind) {
    case "gather":
      return getGatherCost(node.itemId, opts, node.perDay ?? null);

    case "fixed":
      return node.cost;

    case "labor":
      // 労働日数そのもの(経験値稼ぎ・探索など、品物に直接結びつかない手間)
      return GENERIC_HANDWORK_WAGE * node.days;

    case "item":
      // 他の品目への参照(その品目のレシピ/採集/COMMODITIESを再帰的に使う)
      return itemCost(node.itemId, opts, trail);

    case "smelt": {
      const { labor, fuel } = getSmeltCost(node.block);
      const ingredientCost = nodeCost(node.ingredient.node, opts, trail) * node.ingredient.qty;
      return ingredientCost + labor + fuel;
    }

    case "craft": {
      const materialCost = node.ingredients.reduce(
        (sum, ing) => sum + nodeCost(ing.node, opts, trail) * ing.qty,
        0
      );
      const laborCost = getCraftLaborCost(node.countPerDay);
      const extraCost = node.extraCost ?? 0;
      // yield = 1回のクラフトで出来上がる個数(板材4個・棒4本・矢4本など)。1個あたりに直す。
      return (materialCost + laborCost + extraCost) / (node.yield ?? 1);
    }

    default:
      console.warn("[BeeMyHoney] village-pricing: unknown node kind " + node.kind);
      return 0;
  }
}

// 加工品の原価を再帰的に計算する(マージンは含まない。第1層のみ)。
// node の形:
//   { kind: "gather", itemId, perDay? }
//     … 採集素材。getGatherCostで原価を出す。perDay は擬似素材用の直接指定
//   { kind: "fixed", cost }
//     … 根拠がある固定原価をそのまま使いたい場合の脱出口
//   { kind: "labor", days }
//     … 労働日数そのもの(手間賃 × 日数)
//   { kind: "item", itemId }
//     … 他の品目の参照。その品目のCOMMODITIES/固定日数/レシピ/採集を再帰的に使う
//   { kind: "smelt", block, ingredient: { node, qty } }
//     … 精錬。block は SMELTING_BLOCKS のキー("furnace"等)
//   { kind: "craft", ingredients: [{ node, qty }], countPerDay?, extraCost?, yield? }
//     … クラフト台レシピ。ingredientsは材料ノードの配列(他のノードを再帰的に渡せる)。
//       extraCostは明示できる追加コスト(多くの品目ではゼロ)。
//       yield は1回のクラフトで出来上がる個数(省略時1。原価は1個あたりに直して返す)
export function calculateCost(node, opts = DEFAULT_OPTS) {
  return nodeCost(node, opts, []);
}

// 品目IDから原価を引く(第1層)。
export function getItemCost(itemId, opts = DEFAULT_OPTS) {
  return itemCost(itemId, opts, []);
}

// 第2層: 基準価格 = 原価 × 1.20。マージンはここで1回だけ適用する。
// 小数第3位まで残す(丸石0.1875Eのような数E未満の品でも、シュルカー1箱=1,728個で誤差が出にくいように)。
export function getBasePrice(node) {
  return Math.round(calculateCost(node) * MARGIN * 1000) / 1000;
}

// 丸め無しの基準価格(個数を掛けてから丸めたい時用。郵便販売・外貨ロットの計算で使う)。
export function getBasePriceExact(node) {
  return calculateCost(node) * MARGIN;
}

// 品目の基準価格(丸め無し)。COMMODITIESの品目は、既にbaseRateが基準価格なので×1.20はしない
// (市場価格=基準価格として扱う。pricing-guide.md 再帰ルール2)。
export function getItemBasePriceExact(itemId) {
  const key = commodityKeyByItemId(itemId);
  if (key) return COMMODITIES[key].baseRate;
  return getItemCost(itemId) * MARGIN;
}

export function getItemBasePrice(itemId) {
  return Math.round(getItemBasePriceExact(itemId) * 1000) / 1000;
}

// COMMODITIES.baseRate の導出(バルク取引の価格をエンジンで作り直す用)。
// 近道(COMMODITIESのbaseRateをそのまま使う)を全段で止め、労働費からの原価に×1.20を1回だけ掛ける。
// 結果は market-data.js に焼き込む(market-data.js は本ファイルから import されるので、
// 逆向きに import すると循環参照になるため)。dev/check_pricing.mjs が焼き込み値とのズレを検出する。
export function deriveCommodityBaseRate(commodityKey) {
  const def = COMMODITIES[commodityKey];
  const opts = { useCommodity: false };
  const cost = itemCost(def.itemId, opts, []);
  return Math.round(cost * MARGIN * 1000) / 1000;
}

// ---- 外貨(動物交易)・PB向け: エメラルド基準の価格を通貨単位+ロット(まとめ売り)に直す ----
// 外貨の最小単位は1通貨(HNY=2E, APL=1.5E, SWB=0.8E, GLB=3E, CHO=5E)なので、1個が数E未満の品は
// 「N個で1口」にしないと基準価格に合わない。通貨換算で minUnits 単位になるまでロットを倍々にして
// (上限は MAX_LOT_OVERRIDES / DEFAULT_MAX_LOT)、価格は四捨五入(最低1)する。
export function quoteInCurrency(itemId, currKey, { minUnits = LOT_MIN_UNITS } = {}) {
  const unitE = getItemBasePriceExact(itemId);
  const rate = CURRENCIES[currKey].baseRate;
  const maxLot = MAX_LOT_OVERRIDES[itemId] ?? DEFAULT_MAX_LOT;

  let lot = 1;
  while (lot < maxLot && (unitE * lot) / rate < minUnits) lot *= 2;
  lot = Math.min(lot, maxLot);

  const exactUnits = (unitE * lot) / rate;
  return { lot, value: Math.max(1, Math.round(exactUnits)), exactUnits, unitE };
}


