// ✅ 模組化怪物系統重構版（含自動轉換屬性區間）map_

const mapOptions = [
  { label: "全部地區", value: "all", minLevel: 1 },
  { label: "森林地區", value: "forest", minLevel: 1 },
  { label: "沼澤地區", value: "swamp", minLevel: 10 },
  { label: "熔岩地區", value: "lava", minLevel: 20 },
  { label: "天水之境", value: "aqua", minLevel: 30 },
  { label: "風靈山巔", value: "wind", minLevel: 40 },
  { label: "雷光之域", value: "lightning", minLevel: 50 },
  { label: "冰霜谷地", value: "ice", minLevel: 60 },
  { label: "黯影森林", value: "shadow", minLevel: 70 },
  { label: "煉獄深淵", value: "hell", minLevel: 80 },
  { label: "聖光神殿", value: "holy", minLevel: 90 },
  { label: "核心地區", value: "core", minLevel: 100 },
  { label: "未知地區", value: "max", minLevel: 1000 }
  
];

const levelRangeOptions = Array.from({ length: 200 }, (_, i) => {
  const start = i * 10 + 1;
  const end = Math.min(start + 9, 2000);
  return { label: `等級 ${start}～${end}`, value: `${start}-${end}` };
});

