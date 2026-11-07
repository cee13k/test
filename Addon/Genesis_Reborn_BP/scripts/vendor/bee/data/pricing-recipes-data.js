import { SAPLINGS, MUSIC_DISCS, SMITHING_TEMPLATES } from "./item-catalog.js";
import { ENCHANT_BOOK_LABOR_DAYS } from "./village-pricing-data.js";

// ==========================================
// 統一プライシングエンジン レシピ表 (dev/pricing-guide.md / dev/pricing-settings.md 参照)
// ------------------------------------------
// 品目ID → 原価ノード。economy/village-pricing.js の calculateCost が再帰的に辿る。
//   gather … 採集/ドロップ/ダンジョン産。1日あたりの入手数は village-pricing-data.js の
//            GATHER_RATE_OVERRIDES(無ければ汎用64個/日)
//   craft  … クラフト台レシピ(ingredients: [[材料, 個数], ...]。材料は品目ID文字列かノード)
//            yield = 1回のクラフトで出来上がる個数
//   smelt  … 精錬(block: furnace / blast_furnace / smoker / campfire)
//
// COMMODITIES(バルク取引)に載っている品目は、ここのレシピを使うのは baseRate の導出時だけで、
// 他の品目の材料になる時は market-data.js の baseRate をそのまま原価に使う(再帰ルール2)。
//
// 【レシピの確からしさ】基本はバニラのレシピ。26.50で追加された品目や、レシピが確認できていない品目
// (槍・オウムガイの鎧・硫黄の結晶柱・棚など)は近い既存レシピ/入手ペースで置いた暫定。
// 一覧は dev/pricing-settings.md §5 の「要確認レシピ」。
// ==========================================

const g = (itemId, perDay) => ({ kind: "gather", itemId, ...(perDay ? { perDay } : {}) });
const it = (itemId) => ({ kind: "item", itemId });
const labor = (days) => ({ kind: "labor", days });
const toNode = (n) => (typeof n === "string" ? it(n) : n);
const craft = (ingredients, extra = {}) => ({
  kind: "craft",
  ingredients: ingredients.map(([n, qty]) => ({ node: toNode(n), qty })),
  ...extra
});
const smelt = (block, ingredientId, qty = 1) => ({
  kind: "smelt",
  block,
  ingredient: { node: toNode(ingredientId), qty }
});

const M = (id) => "minecraft:" + id;

export const PRICING_RECIPES = {};

// ---- 採集/ドロップ(汎用64個/日、または GATHER_RATE_OVERRIDES の個別値) ----
const PLAIN_GATHER = [
  // 鉱石・岩石・土砂(COMMODITIES の導出元も含む)
  "diamond", "lapis_lazuli", "quartz", "redstone", "cobblestone", "dirt", "sand", "gravel", "clay_ball",
  "oak_log", "spruce_log", "birch_log", "jungle_log", "acacia_log", "dark_oak_log", "cherry_log", "mangrove_log",
  "raw_iron", "raw_copper", "raw_gold", "ancient_debris", "coal", "flint", "obsidian", "crying_obsidian",
  "amethyst_shard", "netherrack", "mud", "blackstone", "end_stone",
  // 農作物・植物
  "wheat", "potato", "carrot", "melon_slice", "beetroot", "dandelion", "poppy", "cornflower", "allium", "sunflower", "oxeye_daisy", "kelp", "bamboo",
  "sugar_cane", "cactus", "cocoa_beans", "pumpkin", "nether_wart", "sweet_berries", "glow_berries", "apple",
  "big_dripleaf", "small_dripleaf", "spore_blossom", "sulfur_spike", "pointed_dripstone", "sea_pickle",
  "chorus_fruit", "chorus_flower", "resin_clump",
  // 動物・モブ由来
  "cod", "salmon", "tropical_fish", "pufferfish", "beef", "porkchop", "chicken", "mutton", "rabbit",
  "egg", "bone", "rotten_flesh", "spider_eye", "string", "slime_ball", "ink_sac", "glow_ink_sac",
  "feather", "leather", "rabbit_hide", "rabbit_foot", "honeycomb", "white_wool", "turtle_scute", "armadillo_scute",
  // ドロップ・ダンジョン産・ボス産(レシピで作れないもの)
  "ender_pearl", "blaze_rod", "ghast_tear", "breeze_rod", "heavy_core", "echo_shard",
  "prismarine_shard", "prismarine_crystals", "shulker_shell", "dragon_breath", "nether_star",
  "totem_of_undying", "elytra", "nautilus_shell", "name_tag", "saddle", "bell",
  "leather_horse_armor", "iron_horse_armor", "golden_horse_armor", "diamond_horse_armor",
  "diamond_nautilus_armor"
];
for (const id of PLAIN_GATHER) PRICING_RECIPES[M(id)] = g(M(id));

// 苗木・レコードは品種が多いので、カタログから展開する(新しい品種が増えても自動で拾える)
for (const s of SAPLINGS) PRICING_RECIPES[s.itemId] = g(s.itemId);
for (const d of MUSIC_DISCS) PRICING_RECIPES[d.itemId] = g(M("music_disc")); // 入手ペースはレコード共通(4個/日)

// ---- 精錬品 ----
PRICING_RECIPES[M("iron_ingot")] = smelt("blast_furnace", M("raw_iron"));
PRICING_RECIPES[M("copper_ingot")] = smelt("blast_furnace", M("raw_copper"));
PRICING_RECIPES[M("gold_ingot")] = smelt("blast_furnace", M("raw_gold"));
PRICING_RECIPES[M("glass")] = smelt("furnace", M("sand"));
PRICING_RECIPES[M("brick")] = smelt("furnace", M("clay_ball"));
PRICING_RECIPES[M("stone")] = smelt("furnace", M("cobblestone"));
PRICING_RECIPES[M("smooth_stone")] = smelt("furnace", M("stone"));
PRICING_RECIPES[M("charcoal")] = smelt("furnace", M("oak_log"));
PRICING_RECIPES[M("netherite_scrap")] = smelt("blast_furnace", M("ancient_debris"));
PRICING_RECIPES[M("popped_chorus_fruit")] = smelt("furnace", M("chorus_fruit"));
PRICING_RECIPES[M("resin_brick")] = smelt("furnace", M("resin_clump"));
PRICING_RECIPES[M("dried_kelp")] = smelt("smoker", M("kelp")); // 保険の支給品(insurance.js)

// ---- 村・会社の入荷/出荷メモ用(dev/village-company-flow-spec.md §3) ----
// 砂糖: サトウキビ1本 → 砂糖1個
PRICING_RECIPES[M("sugar")] = craft([[M("sugar_cane"), 1]]);
// 骨粉: コンポスターの最高効率の入力から換算(確率65%の花 → 7段階で約11個。昆布30%は24個、麦50%は14個、干草・パン85%は加工費で割高、ケーキ類100%も割高)。骨経由は骨ファーム不在で安すぎるため使わない
PRICING_RECIPES[M("bone_meal")] = craft([[M("dandelion"), 11]]);
// 加工食品: 原料の原価 + 手間賃(スモーカー/クラフト)
PRICING_RECIPES[M("bread")] = craft([[M("wheat"), 3]]);
PRICING_RECIPES[M("pumpkin_pie")] = craft([[M("pumpkin"), 1], [M("sugar"), 1], [M("egg"), 1]]);
PRICING_RECIPES[M("cooked_porkchop")] = smelt("smoker", M("porkchop"));
PRICING_RECIPES[M("cooked_chicken")] = smelt("smoker", M("chicken"));
PRICING_RECIPES[M("cooked_cod")] = smelt("smoker", M("cod"));
PRICING_RECIPES[M("cooked_salmon")] = smelt("smoker", M("salmon"));

// ---- 基本クラフト素材 ----
PRICING_RECIPES[M("oak_planks")] = craft([[M("oak_log"), 1]], { yield: 4 });
PRICING_RECIPES[M("oak_slab")] = craft([[M("oak_planks"), 3]], { yield: 6 });
PRICING_RECIPES[M("stick")] = craft([[M("oak_planks"), 2]], { yield: 4 });
PRICING_RECIPES[M("stone_slab")] = craft([[M("stone"), 3]], { yield: 6 });
PRICING_RECIPES[M("paper")] = craft([[M("sugar_cane"), 3]], { yield: 3 });
PRICING_RECIPES[M("book")] = craft([[M("paper"), 3], [M("leather"), 1]]);
PRICING_RECIPES[M("iron_nugget")] = craft([[M("iron_ingot"), 1]], { yield: 9 });
PRICING_RECIPES[M("iron_block")] = craft([[M("iron_ingot"), 9]]);
PRICING_RECIPES[M("furnace")] = craft([[M("cobblestone"), 8]]);
PRICING_RECIPES[M("torch")] = craft([[M("coal"), 1], [M("stick"), 1]], { yield: 4 });
PRICING_RECIPES[M("redstone_torch")] = craft([[M("redstone"), 1], [M("stick"), 1]]);
PRICING_RECIPES[M("bucket")] = craft([[M("iron_ingot"), 3]]);
PRICING_RECIPES[M("tripwire_hook")] = craft([[M("iron_ingot"), 1], [M("stick"), 1], [M("oak_planks"), 1]], { yield: 2 });
PRICING_RECIPES[M("piston")] = craft([[M("oak_planks"), 3], [M("cobblestone"), 4], [M("iron_ingot"), 1], [M("redstone"), 1]]);
PRICING_RECIPES[M("netherite_ingot")] = craft([[M("netherite_scrap"), 4], [M("gold_ingot"), 4]]);
PRICING_RECIPES[M("blaze_powder")] = craft([[M("blaze_rod"), 1]], { yield: 2 });
PRICING_RECIPES[M("ender_eye")] = craft([[M("ender_pearl"), 1], [M("blaze_powder"), 1]]);
PRICING_RECIPES[M("glass_bottle")] = craft([[M("glass"), 3]], { yield: 3 });
PRICING_RECIPES[M("diamond_sword")] = craft([[M("diamond"), 2], [M("stick"), 1]]);
PRICING_RECIPES[M("diamond_pickaxe")] = craft([[M("diamond"), 3], [M("stick"), 2]]);
PRICING_RECIPES[M("diamond_axe")] = craft([[M("diamond"), 3], [M("stick"), 2]]);
PRICING_RECIPES[M("diamond_shovel")] = craft([[M("diamond"), 1], [M("stick"), 2]]);
PRICING_RECIPES[M("diamond_hoe")] = craft([[M("diamond"), 2], [M("stick"), 2]]);
PRICING_RECIPES[M("diamond_spear")] = craft([[M("diamond"), 2], [M("stick"), 1]]); // 暫定(要確認)
PRICING_RECIPES[M("diamond_helmet")] = craft([[M("diamond"), 5]]);
PRICING_RECIPES[M("diamond_chestplate")] = craft([[M("diamond"), 8]]);
PRICING_RECIPES[M("diamond_leggings")] = craft([[M("diamond"), 7]]);
PRICING_RECIPES[M("diamond_boots")] = craft([[M("diamond"), 4]]);

// ---- 鍛冶型(複製レシピ: ダイヤ7+素材ブロック1で+1枚。元の型は残る) ----
// 飾り型の素材ブロックは型ごとに違う(砂岩・プリズマリン・エンドストーン等)が、
// 原価の差は数分の1E以下なので、丸石1個で代表させた暫定。ネザライトのみネザーラック。
for (const tpl of SMITHING_TEMPLATES) {
  const material = tpl.itemId === M("netherite_upgrade_smithing_template") ? M("netherrack") : M("cobblestone");
  PRICING_RECIPES[tpl.itemId] = craft([[M("diamond"), 7], [material, 1]]);
}

// ---- ネザライト装備(ダイヤ装備 + ネザライトインゴット + アップグレード型。型は消費される) ----
const NETHERITE_UPGRADE = (base) => craft([[M(base), 1], [M("netherite_ingot"), 1], [M("netherite_upgrade_smithing_template"), 1]]);
PRICING_RECIPES[M("netherite_sword")] = NETHERITE_UPGRADE("diamond_sword");
PRICING_RECIPES[M("netherite_spear")] = NETHERITE_UPGRADE("diamond_spear");
PRICING_RECIPES[M("netherite_pickaxe")] = NETHERITE_UPGRADE("diamond_pickaxe");
PRICING_RECIPES[M("netherite_axe")] = NETHERITE_UPGRADE("diamond_axe");
PRICING_RECIPES[M("netherite_shovel")] = NETHERITE_UPGRADE("diamond_shovel");
PRICING_RECIPES[M("netherite_hoe")] = NETHERITE_UPGRADE("diamond_hoe");
PRICING_RECIPES[M("netherite_helmet")] = NETHERITE_UPGRADE("diamond_helmet");
PRICING_RECIPES[M("netherite_chestplate")] = NETHERITE_UPGRADE("diamond_chestplate");
PRICING_RECIPES[M("netherite_leggings")] = NETHERITE_UPGRADE("diamond_leggings");
PRICING_RECIPES[M("netherite_boots")] = NETHERITE_UPGRADE("diamond_boots");
PRICING_RECIPES[M("netherite_horse_armor")] = NETHERITE_UPGRADE("diamond_horse_armor");
PRICING_RECIPES[M("netherite_nautilus_armor")] = NETHERITE_UPGRADE("diamond_nautilus_armor");

// ---- 郵便販売: 生鮮・自然物 ----
PRICING_RECIPES[M("resin_bricks")] = craft([[M("resin_brick"), 4]]); // ブロック(樹脂レンガ4個)

// ---- 郵便販売: 日常雑貨 ----
PRICING_RECIPES[M("item_frame")] = craft([[M("stick"), 8], [M("leather"), 1]]);
PRICING_RECIPES[M("glow_item_frame")] = craft([[M("item_frame"), 1], [M("glow_ink_sac"), 1]]);
PRICING_RECIPES[M("candle")] = craft([[M("string"), 1], [M("honeycomb"), 1]]);
PRICING_RECIPES[M("white_bed")] = craft([[M("oak_planks"), 3], [M("white_wool"), 3]]);
PRICING_RECIPES[M("lantern")] = craft([[M("iron_nugget"), 8], [M("torch"), 1]]);
PRICING_RECIPES[M("lectern")] = craft([[M("oak_slab"), 4], [M("bookshelf"), 1]]);
PRICING_RECIPES[M("flower_pot")] = craft([[M("brick"), 3]]);
PRICING_RECIPES[M("cauldron")] = craft([[M("iron_ingot"), 7]]);
PRICING_RECIPES[M("brewing_stand")] = craft([[M("blaze_rod"), 1], [M("cobblestone"), 3]]);
PRICING_RECIPES[M("spyglass")] = craft([[M("copper_ingot"), 2], [M("amethyst_shard"), 1]]);
PRICING_RECIPES[M("minecart")] = craft([[M("iron_ingot"), 5]]);
PRICING_RECIPES[M("oak_boat")] = craft([[M("oak_planks"), 5]]);
PRICING_RECIPES[M("shelf")] = craft([[M("oak_log"), 6]], { yield: 2 }); // 暫定(要確認)
PRICING_RECIPES[M("brush")] = craft([[M("feather"), 1], [M("copper_ingot"), 1], [M("stick"), 1]]);
PRICING_RECIPES[M("farmland")] = craft([[M("dirt"), 1]]); // クワで耕すだけ(材料は土1個)
PRICING_RECIPES[M("jack_o_lantern")] = craft([[M("pumpkin"), 1], [M("torch"), 1]]);

// ---- 郵便販売: 機能ブロック・レッドストーン ----
PRICING_RECIPES[M("observer")] = craft([[M("cobblestone"), 6], [M("redstone"), 2], [M("quartz"), 1]]);
PRICING_RECIPES[M("blast_furnace")] = craft([[M("iron_ingot"), 5], [M("furnace"), 1], [M("smooth_stone"), 3]]);
PRICING_RECIPES[M("barrel")] = craft([[M("oak_planks"), 6], [M("oak_slab"), 2]]);
PRICING_RECIPES[M("composter")] = craft([[M("oak_slab"), 7]]);
PRICING_RECIPES[M("grindstone")] = craft([[M("stick"), 2], [M("stone_slab"), 1], [M("oak_planks"), 2]]);
PRICING_RECIPES[M("anvil")] = craft([[M("iron_block"), 3], [M("iron_ingot"), 4]]);
PRICING_RECIPES[M("chest")] = craft([[M("oak_planks"), 8]]);
PRICING_RECIPES[M("repeater")] = craft([[M("stone"), 3], [M("redstone_torch"), 2], [M("redstone"), 1]]);
PRICING_RECIPES[M("comparator")] = craft([[M("stone"), 3], [M("redstone_torch"), 3], [M("quartz"), 1]]);
PRICING_RECIPES[M("dropper")] = craft([[M("cobblestone"), 7], [M("redstone"), 1]]);
PRICING_RECIPES[M("dispenser")] = craft([[M("cobblestone"), 7], [M("bow"), 1], [M("redstone"), 1]]);
PRICING_RECIPES[M("sticky_piston")] = craft([[M("piston"), 1], [M("slime_ball"), 1]]);
PRICING_RECIPES[M("hopper")] = craft([[M("iron_ingot"), 5], [M("chest"), 1]]);
PRICING_RECIPES[M("ender_chest")] = craft([[M("obsidian"), 8], [M("ender_eye"), 1]]);
PRICING_RECIPES[M("daylight_detector")] = craft([[M("glass"), 3], [M("quartz"), 3], [M("oak_slab"), 3]]);
PRICING_RECIPES[M("noteblock")] = craft([[M("oak_planks"), 8], [M("redstone"), 1]]);
PRICING_RECIPES[M("shulker_box")] = craft([[M("shulker_shell"), 2], [M("chest"), 1]]);
PRICING_RECIPES[M("bookshelf")] = craft([[M("oak_planks"), 6], [M("book"), 3]]);
PRICING_RECIPES[M("smoker")] = craft([[M("oak_log"), 4], [M("furnace"), 1]]);

// ---- 郵便販売: 防具・アイテム ----
PRICING_RECIPES[M("mace")] = craft([[M("heavy_core"), 1], [M("breeze_rod"), 1]]);
PRICING_RECIPES[M("bow")] = craft([[M("stick"), 3], [M("string"), 3]]);
PRICING_RECIPES[M("crossbow")] = craft([[M("stick"), 3], [M("string"), 2], [M("iron_ingot"), 1], [M("tripwire_hook"), 1]]);
PRICING_RECIPES[M("arrow")] = craft([[M("flint"), 1], [M("stick"), 1], [M("feather"), 1]], { yield: 4 });
PRICING_RECIPES[M("shears")] = craft([[M("iron_ingot"), 2]]);
PRICING_RECIPES[M("fishing_rod")] = craft([[M("stick"), 3], [M("string"), 2]]);
PRICING_RECIPES[M("turtle_helmet")] = craft([[M("turtle_scute"), 5]]);
PRICING_RECIPES[M("shield")] = craft([[M("oak_planks"), 6], [M("iron_ingot"), 1]]);
PRICING_RECIPES[M("bundle")] = craft([[M("string"), 1], [M("leather"), 1]]);
PRICING_RECIPES[M("compass")] = craft([[M("iron_ingot"), 4], [M("redstone"), 1]]);
PRICING_RECIPES[M("clock")] = craft([[M("gold_ingot"), 4], [M("redstone"), 1]]);
PRICING_RECIPES[M("wolf_armor")] = craft([[M("armadillo_scute"), 8]]);

// ---- 郵便販売: レア・ボスドロップ ----
PRICING_RECIPES[M("magma_cream")] = craft([[M("blaze_powder"), 1], [M("slime_ball"), 1]]);
PRICING_RECIPES[M("end_crystal")] = craft([[M("glass"), 7], [M("ender_eye"), 1], [M("ghast_tear"), 1]]);
PRICING_RECIPES[M("beacon")] = craft([[M("glass"), 5], [M("obsidian"), 3], [M("nether_star"), 1]]);
PRICING_RECIPES[M("enchanting_table")] = craft([[M("obsidian"), 4], [M("diamond"), 2], [M("book"), 1]]);
PRICING_RECIPES[M("recovery_compass")] = craft([[M("echo_shard"), 8], [M("compass"), 1]]);
// 芽生えたアメジストはサバイバルで入手不能なので village-pricing-data.js の FIXED_LABOR_DAYS で固定

// ---- 動物交易(モブトレード)・PB ----
PRICING_RECIPES[M("honey_bottle")] = craft([[M("glass_bottle"), 1], [g("honey_harvest", 32), 1]]); // 巣箱から瓶で採取
PRICING_RECIPES[M("lead")] = craft([[M("string"), 4], [M("slime_ball"), 1]], { yield: 2 });
PRICING_RECIPES[M("tropical_fish_bucket")] = craft([[M("bucket"), 1], [M("tropical_fish"), 1]]);
PRICING_RECIPES[M("pufferfish_bucket")] = craft([[M("bucket"), 1], [M("pufferfish"), 1]]);
PRICING_RECIPES[M("end_rod")] = craft([[M("blaze_rod"), 1], [M("popped_chorus_fruit"), 1]], { yield: 4 });
PRICING_RECIPES[M("lava_bucket")] = craft([[M("bucket"), 1], [g("lava_source", 64), 1]]);

// ---- エンチャント本(エンチャントごとにIDは同じ enchanted_book なので、擬似IDで3段階) ----
// 本(紙3+革1) + ラピス3 + 経験値稼ぎの労働日数(village-pricing-data.js の ENCHANT_BOOK_LABOR_DAYS)。
// mail-order-data.js が key から段階を引いて使う。
for (const [tier, days] of Object.entries(ENCHANT_BOOK_LABOR_DAYS)) {
  PRICING_RECIPES["enchanted_book:" + tier] = craft([[M("book"), 1], [M("lapis_lazuli"), 3], [labor(days), 1]]);
}


