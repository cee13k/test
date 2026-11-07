// ==========================================
// 統一プライシングエンジン データ (dev/pricing-guide.md 参照)
// ------------------------------------------
// 0.4.2→0.5.x ロードマップ「価格のオーバーホール」の第1層(原価)・第2層(基準価格)で使う
// デフォルト値・精錬ブロック定義・村の床値テーブル。計算ロジック自体は
// economy/village-pricing.js を参照。
// ==========================================

// 特定の採集物に紐付かない汎用労働の日給(手間賃)。labor-data.js の
// OWNER_BASE_WAGE_PER_DAY(20E) × 0.5 と同じ値 = 10E。
export const GENERIC_HANDWORK_WAGE = 10;

// 1日の基準: 60分(プレイ想定時間)。採集・クラフトのデフォルト数も、精錬の実時間計算も
// この基準から逆算/検算している(pricing-guide.md参照)。
export const DAY_MINUTES = 60;

// 採集素材のデフォルト採集数(1スタック/日)。あくまでバニラの村基準で、プレイヤーの
// 自動化(全自動農場・自動採掘等)は考慮しない。
export const GATHER_DEFAULT_PER_DAY = 64;

// クラフト(クラフト台レシピ)のデフォルト製作数/日。
export const CRAFT_DEFAULT_PER_DAY = 640;

// 汎用64個/日が不適切な資源の個別上書き(1日あたりの採集/入手数)。
// 汎用デフォルトをそのまま当てはめると丸石と同じ労働費になり安すぎる/高すぎるため、
// この仕組みを使う前に上書き必須のリストとして扱う(pricing-guide.md参照)。
// 方針: 「自動化なし・60分・手作業」で1日(=60分)に現実的に集められる数。小数も可
// (0.5 = 2日に1個)。レシピで作れない品(モブドロップ・ダンジョン産・ボス産)はここで入手ペースを持つ。
// TODO: 値は全て暫定。実際の希少性バランスを見て調整すること(dev/pricing-settings.md §4 に一覧)。
export const GATHER_RATE_OVERRIDES = {
  // ---- 廃棄物(モブファームで大量に出る。村人の取引レート32個→1Eに合わせて基準1/32E) ----
  "minecraft:rotten_flesh": 384,
  // ---- 鉱石・宝石(採掘) ----
  "minecraft:diamond": 8,
  "minecraft:emerald": 8,
  "minecraft:ancient_debris": 4,
  "minecraft:netherite_scrap": 4,
  "minecraft:raw_iron": 32,
  "minecraft:raw_copper": 48,
  "minecraft:raw_gold": 24,
  "minecraft:lapis_lazuli": 32,
  "minecraft:redstone": 48,
  "minecraft:quartz": 48,
  "minecraft:amethyst_shard": 32,
  "minecraft:obsidian": 16,
  "minecraft:crying_obsidian": 8,
  // ---- 動植物・自然物(通常より手間がかかるもの) ----
  "minecraft:leather": 48,
  "minecraft:spider_eye": 32,
  "minecraft:slime_ball": 24,
  "minecraft:ink_sac": 48,
  "minecraft:glow_ink_sac": 32,
  "minecraft:glow_berries": 48,
  "minecraft:apple": 24,
  "minecraft:honeycomb": 32,
  "minecraft:pumpkin": 64,
  "minecraft:cocoa_beans": 48,
  "minecraft:nether_wart": 48,
  "minecraft:spore_blossom": 32,
  "minecraft:big_dripleaf": 48,
  "minecraft:small_dripleaf": 48,
  "minecraft:sulfur_spike": 32,
  "minecraft:resin_clump": 32,
  "minecraft:pufferfish": 32,
  "minecraft:tropical_fish": 48,
  "minecraft:rabbit": 32,
  "minecraft:rabbit_hide": 32,
  "minecraft:rabbit_foot": 3,
  "minecraft:turtle_scute": 16,
  "minecraft:armadillo_scute": 16,
  "minecraft:sea_pickle": 48,
  "minecraft:chorus_fruit": 48,
  "minecraft:chorus_flower": 32,
  // ---- ドロップ・ダンジョン産・ボス産(レシピで作れない) ----
  "minecraft:ender_pearl": 16,
  "minecraft:blaze_rod": 24,
  "minecraft:ghast_tear": 6,
  "minecraft:breeze_rod": 12,
  "minecraft:heavy_core": 1,
  "minecraft:echo_shard": 4,
  "minecraft:prismarine_shard": 48,
  "minecraft:prismarine_crystals": 24,
  "minecraft:shulker_shell": 6,
  "minecraft:dragon_breath": 8,
  "minecraft:nether_star": 1,
  "minecraft:totem_of_undying": 2,
  "minecraft:elytra": 0.5,
  "minecraft:nautilus_shell": 3,
  "minecraft:name_tag": 4,
  "minecraft:saddle": 3,
  "minecraft:bell": 2,
  "minecraft:leather_horse_armor": 3,
  "minecraft:iron_horse_armor": 3,
  "minecraft:golden_horse_armor": 3,
  "minecraft:diamond_horse_armor": 2,
  "minecraft:diamond_nautilus_armor": 2,
  "minecraft:music_disc": 4 // レコード全般の擬似ID(個別IDは pricing-recipes-data.js が music_disc を参照する)
};

// 入手不能・レシピ化できない品に便宜上つける固定の労働日数(1日 = GENERIC_HANDWORK_WAGE)。
// 例: 芽生えたアメジスト(サバイバルで入手不能)。値は暫定。
export const FIXED_LABOR_DAYS = {
  "minecraft:budding_amethyst": 3
};

// エンチャント本の価格は、エンチャントテーブル/金床で使う経験値の稼ぎ時間を労働日数で置いたもの。
// 本そのもの(紙3+革1)とラピス3個は別途レシピで足す。値は暫定。
export const ENCHANT_BOOK_LABOR_DAYS = {
  common: 1, // 通常のエンチャント(各最大レベル)
  silk_touch_efficiency5: 3, // シルクタッチ・効率強化V
  infinity_mending: 5 // 無限・修繕
};

// 郵便販売(HRMHRMの出品価格)の上乗せ率。基準価格(原価×1.20)にさらに掛ける。
// 1.25 にしてあるのは、「今日のお買い得コーナー」の20%引き(BARGAIN_DISCOUNT 0.8)が
// ちょうど基準価格(1.25 × 0.8 = 1.00)に戻るようにするため。将来の取引所では、
// プレイヤーの出品がこの価格と基準価格の間に入る余地になる(pricing-settings.md §6参照)。
export const MAIL_ORDER_MARKUP = 1.25;

// ロット(まとめ売り)の上限。外貨・PBは最小単位が1通貨単位(エメラルド換算で0.8〜5E)なので、
// 数Eに満たない品は「N個で1口」にしないと価格が合わない。スタックできない品は1個固定。
export const DEFAULT_MAX_LOT = 64;
export const MAX_LOT_OVERRIDES = {
  "minecraft:saddle": 1,
  "minecraft:leather_horse_armor": 1,
  "minecraft:iron_horse_armor": 1,
  "minecraft:golden_horse_armor": 1,
  "minecraft:diamond_horse_armor": 1,
  "minecraft:netherite_horse_armor": 1,
  "minecraft:tropical_fish_bucket": 1,
  "minecraft:pufferfish_bucket": 1,
  "minecraft:lava_bucket": 1,
  "minecraft:honey_bottle": 16,
  "minecraft:ender_pearl": 16
};
// 口の目安: 通貨換算で最低この単位数になるまでロットを倍々に増やす(丸め誤差を約17%以内に抑える)
export const LOT_MIN_UNITS = 3;

// 精錬ブロックの定義(精錬速度・燃料要否・職業ブロックかどうか)。
export const SMELTING_BLOCKS = {
  furnace: { secondsPerItem: 10, needsFuel: true, isJobBlock: false },
  blast_furnace: { secondsPerItem: 5, needsFuel: true, isJobBlock: true },
  smoker: { secondsPerItem: 5, needsFuel: true, isJobBlock: true },
  campfire: { secondsPerItem: 30, needsFuel: false, isJobBlock: false }
};

export const FUEL_ITEM_ID = "minecraft:coal";
// 石炭1個で精錬できる個数の目安(バニラは1個=8アイテム分の燃焼時間)。
export const FUEL_SMELTS_PER_UNIT = 8;

// 村の床値(新米レベルの村人取引、同一素材で複数レートがあれば一番良い方)。
// HRMHRM賃金が「村の最低賃金を下回っていないか」の検算専用。原価計算(getGatherCost)には
// 使わない(採集素材の原価は労働費だけで出す方針、pricing-guide.md参照)。
// 出典: 村人との取引(Bedrock Edition) wiki + 実機スクリーンショット(2026-10-01)。
export const VILLAGE_FLOOR_RATES = {
  "minecraft:stone": 0.05, // 石工(見習い、石20→1E)
  "minecraft:wheat": 0.05, // 農民(新米、小麦20→1E)
  "minecraft:rotten_flesh": 1 / 32, // 聖職者(新米、32→1E)
  "minecraft:coal": 0.1, // 釣り人(新米、石炭10→1E。鍛冶系の15→1Eより良いレートを採用)
  "minecraft:leather": 1 / 6, // 革細工師(新米、革6→1E)
  "minecraft:wool": 1 / 18, // 羊飼い(新米、羊毛18→1E)
  "minecraft:stick": 1 / 32, // 矢師(新米、棒32→1E)
  "minecraft:paper": 1 / 24, // 製図家/司書(新米、紙24→1E)
  "minecraft:beetroot": 1 / 15, // 農民(新米、ビートルート15→1E)
  "minecraft:chicken": 1 / 14 // 肉屋(新米、生の鶏肉14→1E)
};


