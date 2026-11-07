// ==========================================
// アイテムカタログ / Item Catalog (master list)
//
// numerical-item-ids.md (バージョン26.50時点のIDリスト) から、
// 「種類が変わる」系アイテム群 ―― 苗木・生肉・生魚・色違い・素材違い ――
// を丸ごと抜き出して整理したマスターリスト。
// 他のデータファイル (mail-order-data.js など) は、ここから必要な分を
// import して使う。新しいアップデートで種類が増えたときは、このファイル
// だけ更新すれば済むようにするのが狙い。
//
// This file is a master extract of every "variant family" item group
// (saplings, raw meat/fish, color series, material-tier series, etc.)
// pulled from numerical-item-ids.md (current as of game version 26.50).
// Other data files should import from here instead of hardcoding their
// own copies, so that new items added by future updates only need to be
// added in one place.
// ==========================================

// 16色の染料系カラー名（バンドル・ハーネス・クッションなど色違いアイテムの生成に使用）
export const COLOR_NAMES = {
  black: { ja: "黒", en: "Black" },
  blue: { ja: "青", en: "Blue" },
  brown: { ja: "茶", en: "Brown" },
  cyan: { ja: "水色", en: "Cyan" },
  gray: { ja: "灰色", en: "Gray" },
  green: { ja: "緑", en: "Green" },
  light_blue: { ja: "空色", en: "Light Blue" },
  light_gray: { ja: "薄灰色", en: "Light Gray" },
  lime: { ja: "黄緑", en: "Lime" },
  magenta: { ja: "赤紫", en: "Magenta" },
  orange: { ja: "橙", en: "Orange" },
  pink: { ja: "桃", en: "Pink" },
  purple: { ja: "紫", en: "Purple" },
  red: { ja: "赤", en: "Red" },
  white: { ja: "白", en: "White" },
  yellow: { ja: "黄", en: "Yellow" }
};

// 16色 + (任意で無地) の `minecraft:{color}_{suffix}` シリーズを一括生成するヘルパー
function colorSeries(suffix, baseJa, baseEn, { includePlain = false } = {}) {
  const list = Object.entries(COLOR_NAMES).map(([color, c]) => ({
    itemId: `minecraft:${color}_${suffix}`,
    name: { ja: `${c.ja}の${baseJa}`, en: `${c.en} ${baseEn}` }
  }));
  if (includePlain) {
    list.push({ itemId: `minecraft:${suffix}`, name: { ja: `無地の${baseJa}`, en: `Plain ${baseEn}` } });
  }
  return list;
}

// ------------------------------------------
// 苗木 (Saplings) — 26.50時点で poplar・pale_oak が追加済み
// ------------------------------------------
export const SAPLINGS = [
  { itemId: "minecraft:oak_sapling", name: { ja: "オークの苗木", en: "Oak Sapling" } },
  { itemId: "minecraft:spruce_sapling", name: { ja: "トウヒの苗木", en: "Spruce Sapling" } },
  { itemId: "minecraft:birch_sapling", name: { ja: "シラカバの苗木", en: "Birch Sapling" } },
  { itemId: "minecraft:jungle_sapling", name: { ja: "ジャングルの苗木", en: "Jungle Sapling" } },
  { itemId: "minecraft:acacia_sapling", name: { ja: "アカシアの苗木", en: "Acacia Sapling" } },
  { itemId: "minecraft:dark_oak_sapling", name: { ja: "ダークオークの苗木", en: "Dark Oak Sapling" } },
  { itemId: "minecraft:cherry_sapling", name: { ja: "サクラの苗木", en: "Cherry Sapling" } },
  { itemId: "minecraft:pale_oak_sapling", name: { ja: "青白いオークの苗木", en: "Pale Oak Sapling" } },
  { itemId: "minecraft:poplar_sapling", name: { ja: "ポプラの苗木", en: "Poplar Sapling" } },
  { itemId: "minecraft:mangrove_propagule", name: { ja: "マングローブの苗木", en: "Mangrove Propagule" } }
];

// ------------------------------------------
// 生魚・生肉 (Raw Fish / Raw Meat) — 26.50時点で種類の変更なし
// ------------------------------------------
export const RAW_FISH = [
  { itemId: "minecraft:cod", name: { ja: "生タラ", en: "Raw Cod" } },
  { itemId: "minecraft:salmon", name: { ja: "生サケ", en: "Raw Salmon" } },
  { itemId: "minecraft:tropical_fish", name: { ja: "熱帯魚", en: "Tropical Fish" } },
  { itemId: "minecraft:pufferfish", name: { ja: "フグ", en: "Pufferfish" } }
];

export const RAW_MEAT = [
  { itemId: "minecraft:beef", name: { ja: "生の牛肉", en: "Raw Beef" } },
  { itemId: "minecraft:porkchop", name: { ja: "生の豚肉", en: "Raw Porkchop" } },
  { itemId: "minecraft:chicken", name: { ja: "生の鶏肉", en: "Raw Chicken" } },
  { itemId: "minecraft:mutton", name: { ja: "生の羊肉", en: "Raw Mutton" } },
  { itemId: "minecraft:rabbit", name: { ja: "生の兎肉", en: "Raw Rabbit" } }
];

// ------------------------------------------
// レコード (Music Discs) — 26.50時点で creator/precipice/tears/lava_chicken/bounce が追加済み
// ------------------------------------------
export const MUSIC_DISCS = [
  { itemId: "minecraft:music_disc_13", name: { ja: "レコード 13", en: "Music Disc 13" } },
  { itemId: "minecraft:music_disc_cat", name: { ja: "レコード cat", en: "Music Disc cat" } },
  { itemId: "minecraft:music_disc_blocks", name: { ja: "レコード blocks", en: "Music Disc blocks" } },
  { itemId: "minecraft:music_disc_chirp", name: { ja: "レコード chirp", en: "Music Disc chirp" } },
  { itemId: "minecraft:music_disc_far", name: { ja: "レコード far", en: "Music Disc far" } },
  { itemId: "minecraft:music_disc_mall", name: { ja: "レコード mall", en: "Music Disc mall" } },
  { itemId: "minecraft:music_disc_mellohi", name: { ja: "レコード mellohi", en: "Music Disc mellohi" } },
  { itemId: "minecraft:music_disc_stal", name: { ja: "レコード stal", en: "Music Disc stal" } },
  { itemId: "minecraft:music_disc_strad", name: { ja: "レコード strad", en: "Music Disc strad" } },
  { itemId: "minecraft:music_disc_ward", name: { ja: "レコード ward", en: "Music Disc ward" } },
  { itemId: "minecraft:music_disc_11", name: { ja: "レコード 11", en: "Music Disc 11" } },
  { itemId: "minecraft:music_disc_wait", name: { ja: "レコード wait", en: "Music Disc wait" } },
  { itemId: "minecraft:music_disc_pigstep", name: { ja: "レコード pigstep", en: "Music Disc pigstep" } },
  { itemId: "minecraft:music_disc_otherside", name: { ja: "レコード otherside", en: "Music Disc otherside" } },
  { itemId: "minecraft:music_disc_5", name: { ja: "レコード 5", en: "Music Disc 5" } },
  { itemId: "minecraft:music_disc_relic", name: { ja: "レコード relic", en: "Music Disc relic" } },
  { itemId: "minecraft:music_disc_creator", name: { ja: "レコード creator", en: "Music Disc creator" } },
  { itemId: "minecraft:music_disc_creator_music_box", name: { ja: "レコード creator (music box)", en: "Music Disc creator (music box)" } },
  { itemId: "minecraft:music_disc_precipice", name: { ja: "レコード precipice", en: "Music Disc precipice" } },
  { itemId: "minecraft:music_disc_tears", name: { ja: "レコード tears", en: "Music Disc tears" } },
  { itemId: "minecraft:music_disc_lava_chicken", name: { ja: "レコード lava chicken", en: "Music Disc lava chicken" } },
  { itemId: "minecraft:music_disc_bounce", name: { ja: "レコード bounce", en: "Music Disc bounce" } }
];

// ------------------------------------------
// 槍 (Spears) — 26.50で追加された新武器種。素材違いでツール5種+石+木の7段階
// ------------------------------------------
export const SPEARS = [
  { itemId: "minecraft:wooden_spear", name: { ja: "木の槍", en: "Wooden Spear" } },
  { itemId: "minecraft:stone_spear", name: { ja: "石の槍", en: "Stone Spear" } },
  { itemId: "minecraft:copper_spear", name: { ja: "銅の槍", en: "Copper Spear" } },
  { itemId: "minecraft:iron_spear", name: { ja: "鉄の槍", en: "Iron Spear" } },
  { itemId: "minecraft:golden_spear", name: { ja: "金の槍", en: "Golden Spear" } },
  { itemId: "minecraft:diamond_spear", name: { ja: "ダイヤモンドの槍", en: "Diamond Spear" } },
  { itemId: "minecraft:netherite_spear", name: { ja: "ネザライトの槍", en: "Netherite Spear" } }
];

// ------------------------------------------
// オウムガイの鎧 (Nautilus Armor) — 26.50で追加。馬鎧と同じ5素材段階
// ------------------------------------------
export const NAUTILUS_ARMOR = [
  { itemId: "minecraft:copper_nautilus_armor", name: { ja: "銅のオウムガイの鎧", en: "Copper Nautilus Armor" } },
  { itemId: "minecraft:iron_nautilus_armor", name: { ja: "鉄のオウムガイの鎧", en: "Iron Nautilus Armor" } },
  { itemId: "minecraft:golden_nautilus_armor", name: { ja: "金のオウムガイの鎧", en: "Golden Nautilus Armor" } },
  { itemId: "minecraft:diamond_nautilus_armor", name: { ja: "ダイヤモンドのオウムガイの鎧", en: "Diamond Nautilus Armor" } },
  { itemId: "minecraft:netherite_nautilus_armor", name: { ja: "ネザライトのオウムガイの鎧", en: "Netherite Nautilus Armor" } }
];

// ------------------------------------------
// 馬鎧 (Horse Armor) — copper と netherite が追加され6段階に
// ------------------------------------------
export const HORSE_ARMOR = [
  { itemId: "minecraft:leather_horse_armor", name: { ja: "革の馬鎧", en: "Leather Horse Armor" } },
  { itemId: "minecraft:iron_horse_armor", name: { ja: "鉄の馬鎧", en: "Iron Horse Armor" } },
  { itemId: "minecraft:copper_horse_armor", name: { ja: "銅の馬鎧", en: "Copper Horse Armor" } },
  { itemId: "minecraft:golden_horse_armor", name: { ja: "金の馬鎧", en: "Golden Horse Armor" } },
  { itemId: "minecraft:diamond_horse_armor", name: { ja: "ダイヤモンドの馬鎧", en: "Diamond Horse Armor" } },
  { itemId: "minecraft:netherite_horse_armor", name: { ja: "ネザライトの馬鎧", en: "Netherite Horse Armor" } }
];

// ------------------------------------------
// 色違いシリーズ (Color Variant Series) — 16色 + 無地
// バンドル・ハーネス(happy ghast用)・クッションは全て26.50で追加された新アイテム群
// ------------------------------------------
export const BUNDLES = colorSeries("bundle", "バンドル", "Bundle", { includePlain: true });
export const HARNESSES = colorSeries("harness", "ハーネス", "Harness");
export const CUSHIONS = colorSeries("cushion", "クッション", "Cushion");

// ------------------------------------------
// 鍛冶型 (Smithing Templates) — アップグレード用1種 + 防具飾り19種
// ------------------------------------------
export const SMITHING_TEMPLATES = [
  { itemId: "minecraft:netherite_upgrade_smithing_template", name: { ja: "ネザライト・アップグレード型", en: "Netherite Upgrade Template" } },
  { itemId: "minecraft:sentry_armor_trim_smithing_template", name: { ja: "歩哨の飾り型", en: "Sentry Armor Trim Template" } },
  { itemId: "minecraft:dune_armor_trim_smithing_template", name: { ja: "砂丘の飾り型", en: "Dune Armor Trim Template" } },
  { itemId: "minecraft:coast_armor_trim_smithing_template", name: { ja: "海岸の飾り型", en: "Coast Armor Trim Template" } },
  { itemId: "minecraft:wild_armor_trim_smithing_template", name: { ja: "野生の飾り型", en: "Wild Armor Trim Template" } },
  { itemId: "minecraft:ward_armor_trim_smithing_template", name: { ja: "護符の飾り型", en: "Ward Armor Trim Template" } },
  { itemId: "minecraft:eye_armor_trim_smithing_template", name: { ja: "眼の飾り型", en: "Eye Armor Trim Template" } },
  { itemId: "minecraft:vex_armor_trim_smithing_template", name: { ja: "ヴェックスの飾り型", en: "Vex Armor Trim Template" } },
  { itemId: "minecraft:tide_armor_trim_smithing_template", name: { ja: "潮の飾り型", en: "Tide Armor Trim Template" } },
  { itemId: "minecraft:snout_armor_trim_smithing_template", name: { ja: "鼻先の飾り型", en: "Snout Armor Trim Template" } },
  { itemId: "minecraft:rib_armor_trim_smithing_template", name: { ja: "肋骨の飾り型", en: "Rib Armor Trim Template" } },
  { itemId: "minecraft:spire_armor_trim_smithing_template", name: { ja: "尖塔の飾り型", en: "Spire Armor Trim Template" } },
  { itemId: "minecraft:silence_armor_trim_smithing_template", name: { ja: "静寂の飾り型", en: "Silence Armor Trim Template" } },
  { itemId: "minecraft:wayfinder_armor_trim_smithing_template", name: { ja: "道標の飾り型", en: "Wayfinder Armor Trim Template" } },
  { itemId: "minecraft:raiser_armor_trim_smithing_template", name: { ja: "飼育者の飾り型", en: "Raiser Armor Trim Template" } },
  { itemId: "minecraft:shaper_armor_trim_smithing_template", name: { ja: "形成の飾り型", en: "Shaper Armor Trim Template" } },
  { itemId: "minecraft:host_armor_trim_smithing_template", name: { ja: "宿主の飾り型", en: "Host Armor Trim Template" } },
  { itemId: "minecraft:flow_armor_trim_smithing_template", name: { ja: "奔流の飾り型", en: "Flow Armor Trim Template" } },
  { itemId: "minecraft:bolt_armor_trim_smithing_template", name: { ja: "電光の飾り型", en: "Bolt Armor Trim Template" } }
];

// ------------------------------------------
// エンチャント (Enchantments) — numerical-item-ids.md はアイテムIDのみで
// エンチャントIDは載っていないため、こちらは @minecraft/vanilla-data の
// MinecraftEnchantmentTypes (v26.50時点) を基に全42種を収録。
// 26.50で「掃討(sweeping_edge)」は戦闘リワークにより廃止・削除されており、
// 代わりに槍専用の「突進(lunge)」が新規追加されている点に注意。
//
// dedicated: true の3種 (無限・修繕・シルクタッチ) は常にレベル1のみで
// バリエーションが無いため、下記 ENCHANTED_BOOK_COMMON_POOL には含めず、
// 単価の高い専用アイテムとして個別に販売する運用を想定。
// ------------------------------------------
export const ENCHANTMENTS = [
  { id: "protection", maxLevel: 4, name: { ja: "ダメージ軽減", en: "Protection" } },
  { id: "fire_protection", maxLevel: 4, name: { ja: "火炎耐性", en: "Fire Protection" } },
  { id: "feather_falling", maxLevel: 4, name: { ja: "落下耐性", en: "Feather Falling" } },
  { id: "blast_protection", maxLevel: 4, name: { ja: "爆発耐性", en: "Blast Protection" } },
  { id: "projectile_protection", maxLevel: 4, name: { ja: "飛び道具耐性", en: "Projectile Protection" } },
  { id: "thorns", maxLevel: 3, name: { ja: "棘の鎧", en: "Thorns" } },
  { id: "respiration", maxLevel: 3, name: { ja: "水中呼吸", en: "Respiration" } },
  { id: "aqua_affinity", maxLevel: 1, name: { ja: "水中採掘", en: "Aqua Affinity" } },
  { id: "depth_strider", maxLevel: 3, name: { ja: "水中歩行", en: "Depth Strider" } },
  { id: "frost_walker", maxLevel: 2, name: { ja: "氷渡り", en: "Frost Walker" } },
  { id: "soul_speed", maxLevel: 3, name: { ja: "ソウルスピード", en: "Soul Speed" } },
  { id: "swift_sneak", maxLevel: 3, name: { ja: "しのびあし", en: "Swift Sneak" } },
  { id: "sharpness", maxLevel: 5, name: { ja: "ダメージ増加", en: "Sharpness" } },
  { id: "smite", maxLevel: 5, name: { ja: "アンデット特効", en: "Smite" } },
  { id: "bane_of_arthropods", maxLevel: 5, name: { ja: "虫特効", en: "Bane of Arthropods" } },
  { id: "knockback", maxLevel: 2, name: { ja: "ノックバック", en: "Knockback" } },
  { id: "fire_aspect", maxLevel: 2, name: { ja: "火属性", en: "Fire Aspect" } },
  { id: "looting", maxLevel: 3, name: { ja: "ドロップ増加", en: "Looting" } },
  { id: "lunge", maxLevel: 3, name: { ja: "突進", en: "Lunge" } },
  { id: "efficiency", maxLevel: 5, name: { ja: "効率強化", en: "Efficiency" }, dedicated: true },
  { id: "silk_touch", maxLevel: 1, name: { ja: "シルクタッチ", en: "Silk Touch" }, dedicated: true },
  { id: "unbreaking", maxLevel: 3, name: { ja: "耐久力", en: "Unbreaking" } },
  { id: "fortune", maxLevel: 3, name: { ja: "幸運", en: "Fortune" } },
  { id: "power", maxLevel: 5, name: { ja: "パワー", en: "Power" } },
  { id: "punch", maxLevel: 2, name: { ja: "パンチ", en: "Punch" } },
  { id: "flame", maxLevel: 1, name: { ja: "フレイム", en: "Flame" } },
  { id: "infinity", maxLevel: 1, name: { ja: "無限", en: "Infinity" }, dedicated: true },
  { id: "luck_of_the_sea", maxLevel: 3, name: { ja: "幸運の海", en: "Luck of the Sea" } },
  { id: "lure", maxLevel: 3, name: { ja: "誘引", en: "Lure" } },
  { id: "loyalty", maxLevel: 3, name: { ja: "忠誠", en: "Loyalty" } },
  { id: "impaling", maxLevel: 5, name: { ja: "水生特効", en: "Impaling" } },
  { id: "riptide", maxLevel: 3, name: { ja: "激流", en: "Riptide" } },
  { id: "channeling", maxLevel: 1, name: { ja: "召雷", en: "Channeling" } },
  { id: "multishot", maxLevel: 1, name: { ja: "拡散", en: "Multishot" } },
  { id: "quick_charge", maxLevel: 3, name: { ja: "クイックチャージ", en: "Quick Charge" } },
  { id: "piercing", maxLevel: 4, name: { ja: "貫通", en: "Piercing" } },
  { id: "density", maxLevel: 5, name: { ja: "密度", en: "Density" } },
  { id: "breach", maxLevel: 4, name: { ja: "違反", en: "Breach" } },
  { id: "wind_burst", maxLevel: 3, name: { ja: "風爆", en: "Wind Burst" } },
  { id: "mending", maxLevel: 1, name: { ja: "修繕", en: "Mending" }, dedicated: true },
  { id: "binding", maxLevel: 1, name: { ja: "束縛の呪い", en: "Curse of Binding" }, curse: true },
  { id: "vanishing", maxLevel: 1, name: { ja: "消滅の呪い", en: "Curse of Vanishing" }, curse: true }
];

// 「無限・修繕・シルクタッチ・効率強化(V)」の4種は常に固定レベルのレア枠専用アイテムとして
// 個別に販売するため、ここでは除外。それ以外は入手できる最大レベルで1エントリずつ収録
// （束縛/消滅の呪いも含め全種を網羅）。
export const ENCHANTED_BOOK_COMMON_POOL = ENCHANTMENTS
  .filter((e) => !e.dedicated)
  .map((e) => ({ id: e.id, level: e.maxLevel }));

// 郵便販売の「本(エンチャント)」カテゴリ用: ランダム抽選ではなく、38種すべてを
// 個別の商品として並べる（1つ選べば確実にそのエンチャントが手に入る）。
const ROMAN_NUMERALS = ["", "I", "II", "III", "IV", "V"];
export const ENCHANTED_BOOK_COMMON_ITEMS = ENCHANTMENTS
  .filter((e) => !e.dedicated)
  .map((e) => {
    const roman = e.maxLevel > 1 ? ` ${ROMAN_NUMERALS[e.maxLevel] ?? e.maxLevel}` : "";
    return {
      key: `book_${e.id}`,
      itemId: "minecraft:enchanted_book",
      giveAmount: 1,
      // price はここでは持たない。郵便販売の mail-order-data.js が統一プライシングエンジンで付ける
      name: {
        ja: `エンチャント本（${e.name.ja}${roman}）`,
        en: `Enchanted Book (${e.name.en}${roman})`
      },
      enchant: { id: e.id, level: e.maxLevel }
    };
  });

// ------------------------------------------
// ボート (Boats) — 木材の種類分。poplar/pale_oak/cherry/mangroveが追加済み
// ------------------------------------------
export const BOATS = [
  { itemId: "minecraft:oak_boat", name: { ja: "オークのボート", en: "Oak Boat" } },
  { itemId: "minecraft:birch_boat", name: { ja: "シラカバのボート", en: "Birch Boat" } },
  { itemId: "minecraft:spruce_boat", name: { ja: "トウヒのボート", en: "Spruce Boat" } },
  { itemId: "minecraft:jungle_boat", name: { ja: "ジャングルのボート", en: "Jungle Boat" } },
  { itemId: "minecraft:acacia_boat", name: { ja: "アカシアのボート", en: "Acacia Boat" } },
  { itemId: "minecraft:dark_oak_boat", name: { ja: "ダークオークのボート", en: "Dark Oak Boat" } },
  { itemId: "minecraft:mangrove_boat", name: { ja: "マングローブのボート", en: "Mangrove Boat" } },
  { itemId: "minecraft:cherry_boat", name: { ja: "サクラのボート", en: "Cherry Boat" } },
  { itemId: "minecraft:pale_oak_boat", name: { ja: "青白いオークのボート", en: "Pale Oak Boat" } },
  { itemId: "minecraft:poplar_boat", name: { ja: "ポプラのボート", en: "Poplar Boat" } }
];


