// gacha_core.js － 穩健版（避免回傳 undefined）
import { units } from "./units.js";
import { ratesConfig } from "./rates.js";

function randInt(max) { return Math.floor(Math.random() * max); }
function sample(arr) { return arr && arr.length ? arr[randInt(arr.length)] : null; }

function rollRarity(table) {
  const r = Math.random() * 100;
  let acc = 0;
  for (const key of Object.keys(table)) {
    acc += Number(table[key] || 0);
    if (r < acc) return key;
  }
  return "A"; // 萬一表格總和不是 100，回退 A
}

function poolOf(rarity) {
  return units.filter(u => u.rarity === rarity);
}

function safePickFrom(pool, fallbacks = []) {
  // 依序從 pool → fallback pools → 全角色池 擇一
  if (pool && pool.length) return sample(pool);
  for (const fb of fallbacks) {
    if (fb && fb.length) return sample(fb);
  }
  return sample(units); // 最後保底
}

function drawOne(mode = "general") {
  const table = ratesConfig.tables[mode] || ratesConfig.tables.general;
  const rarity = rollRarity(table);

  // 非 SS：等分抽取；若該稀有度空，往下回退
  if (rarity !== "SS" || !ratesConfig.pu?.enabled) {
    const a = poolOf("A");
    const s = poolOf("S");
    const ss = poolOf("SS");
    if (rarity === "A") return safePickFrom(a, [s, ss]);
    if (rarity === "S") return safePickFrom(s, [a, ss]);
    return safePickFrom(ss, [s, a]);
  }

  // === SS + 啟用 PU 的情況 ===
  const ssPool = poolOf("SS");
  if (!ssPool.length) return safePickFrom(poolOf("S"), [poolOf("A")]);

  const puIds = ratesConfig.pu.units || [];
  const puPool = ssPool.filter(u => puIds.includes(u.id));
  const nonPuPool = ssPool.filter(u => !puIds.includes(u.id));

  // 在 SS 內的 PU 佔比（％），例如 25 = SS 裡 25% 機率是 PU
  const share = Number(ratesConfig.pu.shareInSS ?? 0);
  const hitPU = Math.random() * 100 < share;

  if (hitPU) {
    // PU 區空 → 退回 SS 全池
    return safePickFrom(puPool, [ssPool, poolOf("S"), poolOf("A")]);
  } else {
    // 非 PU 區空 → 退回 PU 區
    return safePickFrom(nonPuPool, [puPool, ssPool, poolOf("S"), poolOf("A")]);
  }
}

function drawTen() {
  const r = [];
  // 9 抽一般 + 1 抽保底表
  for (let i = 0; i < 9; i++) r.push(drawOne("general"));
  r.push(drawOne("tenGuarantee"));

  // 清掉任何異常空值，補到 10 張
  let cleaned = r.filter(Boolean);
  while (cleaned.length < 10) cleaned.push(drawOne("general"));
  if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
  return cleaned;
}

export { drawOne, drawTen };
