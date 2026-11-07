// ==========================================
// 金融商品定義データ / Financial Instrument Data
// (外貨・株式・現物資産の基礎パラメータとアイコン)
// ==========================================

export const CURRENCIES = {
  honeycomb: {
    name: { ja: "ハニカム (HNY)", en: "Honeycomb (HNY)" },
    baseRate: 2.0,
    volatility: 0.2,
    desc: { ja: "基軸通貨・手堅い安定性", en: "Base Currency (Stable)" }
  },
  apple: {
    name: { ja: "リンゴ (APL)", en: "Apple (APL)" },
    baseRate: 1.5,
    volatility: 0.4,
    desc: { ja: "平穏な波型", en: "Moderate Waves" }
  },
  sweet_berry: {
    name: { ja: "スイートベリー (SWB)", en: "Sweet Berry (SWB)" },
    baseRate: 0.8,
    volatility: 0.7,
    desc: { ja: "少額・激しい乱高下", en: "Low Cost, High Volatility" }
  },
  glow_berry: {
    name: { ja: "グローベリー (GLB)", en: "Glow Berry (GLB)" },
    baseRate: 3.0,
    volatility: 0.5,
    desc: { ja: "伸びしろのある成長型", en: "Growth Potential" }
  },
  chorus_fruit: {
    name: { ja: "コーラスフルーツ (CHO)", en: "Chorus Fruit (CHO)" },
    baseRate: 5.0,
    volatility: 1.2,
    desc: { ja: "超ハイリスク・急騰急落", en: "Extreme Volatility" }
  }
};

export const STOCKS = {
  pupple: {
    name: { ja: "Pupple (PPL)", en: "Pupple (PPL)" },
    base: 32,
    vol: 0.35,
    desc: { ja: "ハイテク首輪・デバイス", en: "Smart Collars & Gadgets" },
    animal: "dog"
  },
  mcmoonald: {
    name: { ja: "McMoonald (MCD)", en: "McMoonald (MCD)" },
    base: 22,
    vol: 0.15,
    desc: { ja: "ファストフード・ミルク", en: "Fast Food & Dairy Milk" },
    animal: "cow"
  },
  witcha_cola: {
    name: { ja: "Witcha-Cola (WCC)", en: "Witcha-Cola (WCC)" },
    base: 65,
    vol: 0.85,
    desc: { ja: "秘伝ポーション飲料", en: "Secret Formula Potion Drink" },
    animal: "witch"
  },
  clattle: {
    name: { ja: "Clattle (CLT)", en: "Clattle (CLT)" },
    base: 40,
    vol: 0.55,
    desc: { ja: "骨格防衛・遠隔重工", en: "Skeletal Defense & Hardware" },
    animal: "skeleton"
  },
  eekbay: {
    name: { ja: "EekBay (EKB)", en: "EekBay (EKB)" },
    base: 18,
    vol: 0.45,
    desc: { ja: "海洋オークション物流", en: "Maritime Express Auction" },
    animal: "dolphin"
  },
  skein: {
    name: { ja: "Skein (SKN)", en: "Skein (SKN)" },
    base: 48,
    vol: 0.4,
    desc: { ja: "ジャングルのオウムが編隊配達を行う巨大EC企業", en: "Jungle-parrot formation delivery giant" },
    animal: "parrot"
  },
  kelplife: {
    name: { ja: "KelpLife Holdings (KLH)", en: "KelpLife Holdings (KLH)" },
    base: 55,
    vol: 0.3,
    desc: { ja: "海の生物たちが運営する生命保険会社", en: "A life insurance company run by sea creatures" },
    dividendType: "cash" // 配当率は政策金利に連動(rates.js の getDividendRateDaily)
  },
  hrmhrm: {
    name: { ja: "HRMHRM Partners HLD (HRM)", en: "HRMHRM Partners HLD (HRM)" },
    base: 80,
    vol: 0.2,
    desc: {
      ja: "村人を労働者として働かせるグローバルコンサルタントサービス。設立者・CEOは不明。",
      en: "A global consultancy that dispatches villagers as laborers. Founder and CEO unknown."
    },
    // 現金/アイテム配当なし。一定数以上保有していると、労働市場(クエスト/コンサル/オーナーズクラブ)で
    // 仕事が発生するたびにストックオプション(自社株)が付与される特殊型。
    dividendType: "stock_option"
  }
};

// 花の先物契約（銀行メニューから証拠金取引できる5種類）
export const FUTURES = {
  rose: {
    name: { ja: "バラ先物 (ROS)", en: "Rose Futures (ROS)" },
    base: 12,
    vol: 0.5,
    desc: { ja: "贈答需要で急騰しやすい", en: "Gift-demand driven spikes" }
  },
  allium: {
    name: { ja: "アリウム先物 (ALM)", en: "Allium Futures (ALM)" },
    base: 9,
    vol: 0.3,
    desc: { ja: "観賞需要が安定した堅実銘柄", en: "Steady ornamental demand" }
  },
  jade_orchid: {
    name: { ja: "ヒスイラン先物 (JDO)", en: "Jade Orchid Futures (JDO)" },
    base: 20,
    vol: 0.6,
    desc: { ja: "希少・高単価でハイリスク", en: "Rare, pricey, high-risk" }
  },
  sunflower: {
    name: { ja: "ヒマワリ先物 (SUN)", en: "Sunflower Futures (SUN)" },
    base: 7,
    vol: 0.25,
    desc: { ja: "夏場に需要が伸びる低価格銘柄", en: "Low-cost, summer demand" }
  },
  sakura: {
    name: { ja: "サクラ先物 (SKR)", en: "Sakura Futures (SKR)" },
    base: 15,
    vol: 0.7,
    desc: { ja: "季節イベントで乱高下する人気銘柄", en: "Volatile seasonal favorite" }
  }
};

// 現物資産（ゴーレムの宝石取引）: 通貨/株式とは別に、実アイテムそのものを
// エメラルドで直接売買する「現物投資」枠。買値=売値で、利益/損失は価格変動そのものから生まれる。
export const COMMODITIES = {
  diamond: {
    name: { ja: "ダイヤモンド (DIA)", en: "Diamond (DIA)" },
    itemId: "minecraft:diamond",
    blockId: "minecraft:diamond_block",
    key: "item.diamond.name",
    baseRate: 1.5,
    volatility: 0.3,
    desc: { ja: "希少な現物資産・値動き中程度", en: "Rare physical asset, moderate swings" }
  },
  gold_ingot: {
    name: { ja: "金インゴット (AU)", en: "Gold Ingot (AU)" },
    itemId: "minecraft:gold_ingot",
    blockId: "minecraft:gold_block",
    key: "item.gold_ingot.name",
    baseRate: 0.532,
    volatility: 0.15,
    desc: { ja: "伝統的な安定資産", en: "Traditional stable asset" }
  },
  lapis_lazuli: {
    name: { ja: "ラピスラズリ (LAP)", en: "Lapis Lazuli (LAP)" },
    itemId: "minecraft:lapis_lazuli",
    blockId: "minecraft:lapis_block",
    key: "item.dye.blue.name",
    baseRate: 0.375,
    volatility: 0.5,
    desc: { ja: "小口で値動きはやや荒め", en: "Small denomination, choppier moves" }
  },
  // ここから v0.3.4 #1 で追加。ネザークォーツ・レッドストーンは希少資源として従来通り
  // 小口取引(現物取引メニュー)にそのまま乗る。丸石・鉄・銅・ガラスは一般資源で、
  // bulkOnly: true を付けてシュルカー単位のバルク取引専用に切り出す(現物取引メニューには出さない)。
  cobblestone: {
    name: { ja: "丸石", en: "Cobblestone" },
    itemId: "minecraft:cobblestone",
    blockId: "minecraft:cobblestone",
    key: "item.cobblestone.name",
    baseRate: 0.188,
    volatility: 0.1,
    bulkOnly: true,
    desc: { ja: "供給過多になりやすい建材、値動きは穏やか", en: "Abundant building material, low volatility" }
  },
  iron_ingot: {
    name: { ja: "鉄インゴット (FE)", en: "Iron Ingot (FE)" },
    itemId: "minecraft:iron_ingot",
    blockId: "minecraft:iron_block",
    key: "item.iron_ingot.name",
    baseRate: 0.407,
    volatility: 0.2,
    bulkOnly: true,
    desc: { ja: "汎用資材、比較的安定", en: "General-purpose material, fairly stable" }
  },
  copper_ingot: {
    name: { ja: "銅インゴット (CU)", en: "Copper Ingot (CU)" },
    itemId: "minecraft:copper_ingot",
    blockId: "minecraft:copper_block",
    key: "item.copper_ingot.name",
    baseRate: 0.282,
    volatility: 0.25,
    bulkOnly: true,
    desc: { ja: "近年需要が伸びている資材", en: "Rising-demand material" }
  },
  glass: {
    name: { ja: "ガラス", en: "Glass" },
    itemId: "minecraft:glass",
    blockId: "minecraft:glass",
    key: "item.glass.name",
    baseRate: 0.236,
    volatility: 0.1,
    bulkOnly: true,
    desc: { ja: "建材、値動きは穏やか", en: "Building material, low volatility" }
  },
  quartz: {
    name: { ja: "ネザークォーツ (QZ)", en: "Nether Quartz (QZ)" },
    itemId: "minecraft:quartz",
    blockId: "minecraft:quartz_block",
    key: "item.quartz.name",
    baseRate: 0.25,
    volatility: 0.3,
    desc: { ja: "ネザー産、やや値動きが荒い", en: "Nether-sourced, choppier moves" }
  },
  redstone: {
    name: { ja: "レッドストーン (RS)", en: "Redstone (RS)" },
    itemId: "minecraft:redstone",
    blockId: "minecraft:redstone_block",
    key: "item.redstone.name",
    baseRate: 0.25,
    volatility: 0.3,
    desc: { ja: "機構向け需要で値動きが荒め", en: "Demand from redstone builds, choppier moves" }
  },
  // v0.3.4 #2 で追加。トウヒの原木+植木鉢のスイートベリー取引画面(mob-trade-menu.js)から
  // 分岐する「材木取引」の原木バルク取引向け。#1の一般資源と同じくbulkOnly(シュルカー単位のみ)。
  // 苗木8種類全部を対象にする(材木先物の対象銘柄も兼ねる。品種ごとに別銘柄・別需要圧力プール)。
  spruce_log: {
    name: { ja: "トウヒの原木", en: "Spruce Log" },
    itemId: "minecraft:spruce_log",
    blockId: null,
    key: "item.spruceLog.name",
    baseRate: 0.188,
    volatility: 0.15,
    bulkOnly: true,
    desc: { ja: "建材需要が中心、値動きは穏やか", en: "Mostly building demand, low volatility" }
  },
  oak_log: {
    name: { ja: "オークの原木", en: "Oak Log" },
    itemId: "minecraft:oak_log",
    blockId: null,
    key: "item.oakLog.name",
    baseRate: 0.188,
    volatility: 0.1,
    bulkOnly: true,
    desc: { ja: "最も一般的な建材、値動きは穏やか", en: "Most common lumber, low volatility" }
  },
  birch_log: {
    name: { ja: "シラカバの原木", en: "Birch Log" },
    itemId: "minecraft:birch_log",
    blockId: null,
    key: "item.birchLog.name",
    baseRate: 0.188,
    volatility: 0.1,
    bulkOnly: true,
    desc: { ja: "内装用の需要が中心", en: "Mostly interior-finish demand" }
  },
  jungle_log: {
    name: { ja: "ジャングルの原木", en: "Jungle Log" },
    itemId: "minecraft:jungle_log",
    blockId: null,
    key: "item.jungleLog.name",
    baseRate: 0.188,
    volatility: 0.2,
    bulkOnly: true,
    desc: { ja: "供給地が偏るためやや値動きが荒い", en: "Choppier due to limited source biomes" }
  },
  acacia_log: {
    name: { ja: "アカシアの原木", en: "Acacia Log" },
    itemId: "minecraft:acacia_log",
    blockId: null,
    key: "item.acaciaLog.name",
    baseRate: 0.188,
    volatility: 0.2,
    bulkOnly: true,
    desc: { ja: "供給地が偏るためやや値動きが荒い", en: "Choppier due to limited source biomes" }
  },
  dark_oak_log: {
    name: { ja: "ダークオークの原木", en: "Dark Oak Log" },
    itemId: "minecraft:dark_oak_log",
    blockId: null,
    key: "item.darkOakLog.name",
    baseRate: 0.188,
    volatility: 0.15,
    bulkOnly: true,
    desc: { ja: "内装用の需要が中心", en: "Mostly interior-finish demand" }
  },
  cherry_log: {
    name: { ja: "サクラの原木", en: "Cherry Log" },
    itemId: "minecraft:cherry_log",
    blockId: null,
    key: "item.cherryLog.name",
    baseRate: 0.188,
    volatility: 0.3,
    bulkOnly: true,
    desc: { ja: "希少で装飾需要が高く値動きが荒い", en: "Scarce, decorative demand, choppy moves" }
  },
  mangrove_log: {
    name: { ja: "マングローブの原木", en: "Mangrove Log" },
    itemId: "minecraft:mangrove_log",
    blockId: null,
    key: "item.mangroveLog.name",
    baseRate: 0.188,
    volatility: 0.25,
    bulkOnly: true,
    desc: { ja: "供給地が偏るためやや値動きが荒い", en: "Choppier due to limited source biomes" }
  },
  // v0.3.4: 土砂系。一旦「一般資源」に統合する(村限定という当初の線引きは撤回)。
  dirt: {
    name: { ja: "土", en: "Dirt" },
    itemId: "minecraft:dirt",
    blockId: null,
    key: "item.dirt.name",
    baseRate: 0.188,
    volatility: 0.05,
    bulkOnly: true,
    desc: { ja: "無尽蔵に近い、最も安価な建材", en: "Near-infinite supply, the cheapest fill material" }
  },
  sand: {
    name: { ja: "砂", en: "Sand" },
    itemId: "minecraft:sand",
    blockId: null,
    key: "item.sand.name",
    baseRate: 0.188,
    volatility: 0.05,
    bulkOnly: true,
    desc: { ja: "ガラス生産等の需要が下支え", en: "Underpinned by glass-making demand" }
  },
  gravel: {
    name: { ja: "砂利", en: "Gravel" },
    itemId: "minecraft:gravel",
    blockId: null,
    key: "item.gravel.name",
    baseRate: 0.188,
    volatility: 0.05,
    bulkOnly: true,
    desc: { ja: "無尽蔵に近い、値動きは穏やか", en: "Near-infinite supply, low volatility" }
  },
  clay_ball: {
    name: { ja: "粘土", en: "Clay" },
    itemId: "minecraft:clay_ball",
    blockId: "minecraft:clay",
    key: "item.clay.name",
    baseRate: 0.188,
    volatility: 0.1,
    bulkOnly: true,
    desc: { ja: "陶器・レンガ需要が中心", en: "Mostly pottery and brick demand" }
  }
};

// v0.3.4 #1: 大口現物取引(バルク取引)の標準単位。シュルカーボックス1個 = 27スタック = 1,728個。
// 法人格制度(将来のマイルストーン)が入るまでは、1回の取引はこの単位が上限となる。
export const SHULKER_UNIT_QTY = 27 * 64;

// ブロック化されたアイテムをカウント・換金する際に使う個数（ブロック1個 = 素材9個）
export const BLOCK_UNIT_SIZE = 9;

// 相場パターンテーブル（週替わりでシャッフルされる4種類の値動き）
// 各配列は1〜7日目の「基準値に対する変動率」(-1.0〜+1.0)。
// 実際の価格 = baseRate/base * (1 + パターン値 * volatility)
export const MARKET_PATTERNS = [
  // パターンA: 山型（週半ばにピークをつけ後半に下落）
  [-0.6, -0.2, 0.4, 1.0, 0.6, 0.0, -0.4],
  // パターンB: V字回復型（週初めに急落し後半にかけて回復）
  [-1.0, -0.7, -0.3, 0.1, 0.4, 0.7, 0.9],
  // パターンC: 乱高下ジグザグ型（激しい上下動）
  [0.8, -0.9, 0.6, -0.7, 0.9, -0.5, 0.3],
  // パターンD: 右肩上がり型（週を通してじわじわ上昇）
  [-0.8, -0.5, -0.1, 0.2, 0.5, 0.8, 1.0]
];

// 上場7社の広告コピー（郵便販売カタログの一覧画面に日替わりで1本表示する）。
// 各社3本ずつ、計21本。絵文字は使わずテキストのみ。
export const AD_COPY = {
  pupple: [
    { ja: "その一吠え、もっと賢く。Pupple", en: "Bark smarter. Pupple." },
    { ja: "首輪で世界とつながる。Pupple", en: "Your collar, connected. Pupple." },
    { ja: "忠犬にも、最新技術を。Pupple", en: "Loyalty meets technology. Pupple." }
  ],
  mcmoonald: [
    { ja: "モーッと美味しい、今すぐ一杯。McMoonald", en: "Moo-licious, served fast. McMoonald." },
    { ja: "牧場から、あなたの食卓へ。McMoonald", en: "From pasture to plate. McMoonald." },
    { ja: "今日も搾りたて、今日も元気。McMoonald", en: "Fresh today, happy every day. McMoonald." }
  ],
  witcha_cola: [
    { ja: "一杯で、魔法がかかる。Witcha-Cola", en: "One sip, pure magic. Witcha-Cola." },
    { ja: "秘伝のレシピ、今夜も煮込み中。Witcha-Cola", en: "Secret recipe, brewing tonight. Witcha-Cola." },
    { ja: "呪文よりも効く、あの爽快感。Witcha-Cola", en: "Stronger than any spell. Witcha-Cola." }
  ],
  clattle: [
    { ja: "守りはガタガタ、結果はガッチリ。Clattle", en: "Rattles, but never breaks. Clattle." },
    { ja: "遠距離火力、骨の髄まで信頼を。Clattle", en: "Ranged power you can trust. Clattle." },
    { ja: "備えあれば、憂いなし。Clattle重工", en: "Defense engineered to last. Clattle." }
  ],
  eekbay: [
    { ja: "深海の掘り出し物、あなたの元へ。EekBay", en: "Deep-sea deals, delivered. EekBay." },
    { ja: "競り落とせ、海のトレジャー。EekBay", en: "Bid deep. Win big. EekBay." },
    { ja: "泳ぐように速い配送。EekBay", en: "Delivery that swims circles around the rest. EekBay." }
  ],
  skein: [
    { ja: "地平線の彼方から、あなたのチェストまで。Skein", en: "From beyond the horizon, to your chest. Skein." },
    { ja: "羽ばたく配達、待たせない。Skein", en: "Delivery on the wing. Skein." },
    { ja: "プライムで、送料はいつも無料。Skein", en: "Prime members fly free. Skein." }
  ],
  kelplife: [
    { ja: "ワンタッチで即お見積もり。KelpLife", en: "One-touch instant quotes. KelpLife." },
    { ja: "もしもの時も、海は味方。KelpLife", en: "When the tide turns, we've got you. KelpLife." },
    { ja: "安心を、潮だまりのように蓄えて。KelpLife", en: "Peace of mind, pooled like the tide. KelpLife." }
  ]
};

// 通貨/銘柄ごとの表示アイコン（絵文字は環境によって「?」化するため色付き●で代用）
export const CURRENCY_ICONS = {
  honeycomb: "§6●",
  apple: "§c●",
  sweet_berry: "§d●",
  glow_berry: "§b●",
  chorus_fruit: "§5●"
};
export const STOCK_ICONS = {
  pupple: "§9●",
  mcmoonald: "§f●",
  witcha_cola: "§d●",
  clattle: "§7●",
  eekbay: "§b●",
  skein: "§a●",
  kelplife: "§3●",
  hrmhrm: "§6●"
};
export const COMMODITY_ICONS = {
  diamond: "§b●",
  gold_ingot: "§6●",
  lapis_lazuli: "§9●",
  quartz: "§f●",
  redstone: "§4●",
  cobblestone: "§8●",
  iron_ingot: "§7●",
  copper_ingot: "§6●",
  glass: "§e●",
  spruce_log: "§2●",
  oak_log: "§6●",
  birch_log: "§f●",
  jungle_log: "§a●",
  acacia_log: "§c●",
  dark_oak_log: "§8●",
  cherry_log: "§d●",
  mangrove_log: "§3●",
  dirt: "§6●",
  sand: "§e●",
  gravel: "§7●",
  clay_ball: "§b●"
};
export const FUTURES_ICONS = {
  rose: "§c●",
  allium: "§5●",
  jade_orchid: "§a●",
  sunflower: "§6●",
  sakura: "§d●"
};


