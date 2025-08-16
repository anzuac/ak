 // 美髮道具數據（包括男性和女性的道具數據）
    const hairItems = [
  // 🔹 男性資料（如前已更新）
// 🔹 男性資料（修正後：SSS / SS / S / B / C）
{ name: "黑色雅皮髮型",     type: "SSS", chance: 1.00,  gender: "male" },
{ name: "黑色萊薩髮型",     type: "SS",  chance: 1.00,  gender: "male" },
{ name: "黑色純白髮型",     type: "S",   chance: 1.00,  gender: "male" },

{ name: "黑色嬰兒捲造型",   type: "B",   chance: 6.00,  gender: "male" },
{ name: "黑色潤澤耀眼造型", type: "B",   chance: 6.00,  gender: "male" },
{ name: "黑色飛翹年輕造型", type: "B",   chance: 6.00,  gender: "male" },
{ name: "黑色音樂家造型",   type: "B",   chance: 6.00,  gender: "male" },
{ name: "黑色藍迪造型",     type: "B",   chance: 6.00,  gender: "male" },

{ name: "黑色瀏海飛揚造型", type: "C",   chance: 16.75, gender: "male" },
{ name: "黑色隨興自捲造型", type: "C",   chance: 16.75, gender: "male" },
{ name: "黑色蘋果小紮造型", type: "C",   chance: 16.75, gender: "male" },
{ name: "黑色狂野奔放造型", type: "C",   chance: 16.75, gender: "male" },

// 🔸 女性資料（更新後）
{ name: "黑色優雅女子髮型",   type: "SSS", chance: 1.00,  gender: "female" },
{ name: "黑色妖精的眼淚髮型", type: "SS",  chance: 1.00,  gender: "female" },
{ name: "黑色艾拉髮型",       type: "S",   chance: 1.00,  gender: "female" },

{ name: "黑色愛情暗示造型",   type: "B",   chance: 6.00,  gender: "female" },
{ name: "黑色消音造型",       type: "B",   chance: 6.00,  gender: "female" },
{ name: "黑色貴賓狗",         type: "B",   chance: 6.00,  gender: "female" },
{ name: "黑色可愛風格頭",     type: "B",   chance: 6.00,  gender: "female" },
{ name: "黑色短劉海髮",       type: "B",   chance: 6.00,  gender: "female" },

{ name: "黑色蝴蝶側尾造型",   type: "C",   chance: 16.75, gender: "female" },
{ name: "黑色小啾紮髮造型",   type: "C",   chance: 16.75, gender: "female" },
{ name: "黑色小捲髮結造型",   type: "C",   chance: 16.75, gender: "female" },
{ name: "黑色包脖長髮造型",   type: "C",   chance: 16.75, gender: "female" }
];

    // 整形道具數據
    const surgeryItems = [
  // 🔹 男性整形（更新後）
 // 🔹 男性臉型（更新後）
{ name: "鈕扣眼臉型(黑色瞳)",         type: "SSS", chance: 2.50, gender: "male" },
{ name: "充滿魅力的撩人臉型(黑色瞳)", type: "SS",  chance: 2.50, gender: "male" },

{ name: "化妝國王臉型",     type: "B", chance: 9.50, gender: "male" },
{ name: "黑色塗鴉造型眼睛", type: "B", chance: 9.50, gender: "male" },
{ name: "真男人臉型",       type: "B", chance: 9.50, gender: "male" },
{ name: "黑色惡魔殺手臉型", type: "B", chance: 9.50, gender: "male" },
{ name: "黑色高傲精靈臉型", type: "B", chance: 9.50, gender: "male" },
{ name: "黑色杰伊臉形",     type: "B", chance: 9.50, gender: "male" },
{ name: "黑色不高興的臉",   type: "B", chance: 9.50, gender: "male" },
{ name: "黑色真實的臉",     type: "B", chance: 9.50, gender: "male" },
{ name: "黑色厭煩的臉型",   type: "B", chance: 9.50, gender: "male" },
{ name: "黑色陰沉的臉型",   type: "B", chance: 9.50, gender: "male" },

  // 🔸 女性整形（原資料保留，若要更新請提供）
  // 🔸 女性臉型（更新後）
{ name: "鈕扣眼臉型(黑色瞳)",         type: "SSS", chance: 2.50, gender: "female" },
{ name: "充滿魅力的撩人臉型(黑色瞳)", type: "SS",  chance: 2.50, gender: "female" },

{ name: "化妝皇后臉型",     type: "B", chance: 9.50, gender: "female" },
{ name: "黑色塗鴉造型眼睛", type: "B", chance: 9.50, gender: "female" },
{ name: "狡猾臉型",         type: "B", chance: 9.50, gender: "female" },
{ name: "黑色高傲精靈臉型", type: "B", chance: 9.50, gender: "female" },
{ name: "黑色親切精靈臉型", type: "B", chance: 9.50, gender: "female" },
{ name: "黑色厭煩的臉型",   type: "B", chance: 9.50, gender: "female" },
{ name: "黑色甜蜜的臉型",   type: "B", chance: 9.50, gender: "female" },
{ name: "黑色女孩娃娃臉造型", type: "B", chance: 9.50, gender: "female" },
{ name: "黑色放大眼臉型",   type: "B", chance: 9.50, gender: "female" },
{ name: "黑色俏魔女造型",   type: "B", chance: 9.50, gender: "female" }
];  { name: "黑瞳奇里里臉型", type: "S", chance: 1.67, gender: "male" },
  { name: "森林之精靈臉型", type: "B", chance: 10.55, gender: "male" },
  { name: "黑色路亞臉", type: "B", chance: 10.55, gender: "male" },
  { name: "黑色恐懼臉型", type: "B", chance: 10.55, gender: "male" },
  { name: "黑色男孩娃娃臉造型", type: "B", chance: 10.55, gender: "male" },
  { name: "黑色甜蜜的臉型", type: "B", chance: 10.55, gender: "male" },
  { name: "黑色卡頓整形", type: "B", chance: 10.55, gender: "male" },
  { name: "正直的臉型", type: "B", chance: 10.55, gender: "male" },
  { name: "黑色娃娃臉臉型", type: "B", chance: 10.55, gender: "male" },
  { name: "黑色傳說的臉", type: "B", chance: 10.55, gender: "male" },

  // 🔸 女性整形（原資料保留，若要更新請提供）
  { name: "安潔拉臉型", type: "SSS", chance: 1.67, gender: "female" },
  { name: "那個…那個…臉型(黑色瞳)", type: "SS", chance: 1.67, gender: "female" },
  { name: "霧雨臉型", type: "S", chance: 1.67, gender: "female" },
  { name: "黑色水汪汪臉型", type: "B", chance: 10.55, gender: "female" },
  { name: "黑色明亮的臉型", type: "B", chance: 10.55, gender: "female" },
  { name: "黑色很叛逆臉型", type: "B", chance: 10.55, gender: "female" },
  { name: "黑色乖女孩臉型", type: "B", chance: 10.55, gender: "female" },
  { name: "黑色聰明的臉型", type: "B", chance: 10.55, gender: "female" },
  { name: "黑色扁嘴的臉型", type: "B", chance: 10.55, gender: "female" },
  { name: "黑色卡頓整形", type: "B", chance: 10.55, gender: "female" },
  { name: "黑色超新星臉型", type: "B", chance: 10.55, gender: "female" },
  { name: "黑色清秀臉形", type: "B", chance: 10.55, gender: "female" }
];
