// 加工の変換表(村の週次の加工と、工場への派遣で共通)。in を inQty 個で1回、out を outQty 個。実際の出来高は convert_loss(損失)を掛けて切り捨てる。
// 在庫に入力がなければ出力ゼロ。
export const VILLAGE_CONVERT_TABLE = [
  { in: "minecraft:wheat", inQty: 3, out: "minecraft:bread", outQty: 1 },
  { in: "minecraft:porkchop", inQty: 1, out: "minecraft:cooked_porkchop", outQty: 1 },
  { in: "minecraft:chicken", inQty: 1, out: "minecraft:cooked_chicken", outQty: 1 },
  { in: "minecraft:cod", inQty: 1, out: "minecraft:cooked_cod", outQty: 1 },
  { in: "minecraft:salmon", inQty: 1, out: "minecraft:cooked_salmon", outQty: 1 },
  { in: "minecraft:raw_iron", inQty: 1, out: "minecraft:iron_ingot", outQty: 1 },
  { in: "minecraft:raw_copper", inQty: 1, out: "minecraft:copper_ingot", outQty: 1 },
  { in: "minecraft:oak_sapling", inQty: 4, out: "minecraft:oak_log", outQty: 1 },
  { in: "minecraft:spruce_sapling", inQty: 4, out: "minecraft:spruce_log", outQty: 1 },
  { in: "minecraft:birch_sapling", inQty: 4, out: "minecraft:birch_log", outQty: 1 }
];

// 工場(派遣)だけの変換。村は金属・工具を作らない(金のインゴットは、原石が納品された会社・HRMHRMの工場だけ)。
export const FACTORY_EXTRA_TABLE = [
  { in: "minecraft:raw_gold", inQty: 1, out: "minecraft:gold_ingot", outQty: 1 },
  { in: "minecraft:iron_ingot", inQty: 3, out: "minecraft:bucket", outQty: 1 },
  { in: "minecraft:iron_ingot", inQty: 2, out: "minecraft:shears", outQty: 1 },
  { in: "minecraft:oak_log", inQty: 1, out: "minecraft:charcoal", outQty: 1 }
];
export const FACTORY_CONVERT_TABLE = [...VILLAGE_CONVERT_TABLE, ...FACTORY_EXTRA_TABLE];
