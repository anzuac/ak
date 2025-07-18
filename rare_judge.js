
const drawProbabilities = {
  position1: { "特殊": 60, "稀有": 30, "罕見": 8, "傳說": 2 },
  position2: { "特殊": 0,  "稀有": 90, "罕見": 8, "傳說": 2 },
  position3: { "特殊": 60, "稀有": 30, "罕見": 8, "傳說": 2 },
  ssOverride: { "特殊": 0,  "稀有": 90, "罕見": 8, "傳說": 2 }
};

function rollCategory(table) {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (let key in table) {
    cumulative += table[key];
    if (rand < cumulative) return key;
  }
  return Object.keys(table)[0]; // fallback
}

function judgeLevel(item, position) {
  if (item.rarity === "SS") {
    return rollCategory(drawProbabilities.ssOverride);
  }
  return rollCategory(drawProbabilities["position" + position]);
}
