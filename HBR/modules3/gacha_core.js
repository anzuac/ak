// gacha_core.js
import { units } from "./units.js";
import { ratesConfig } from "./rates_ticket.js"; // ★ 本檔直接用票券版設定

// ========= 工具 =========
const RANK = { A: 0, S: 1, SS: 2 };
const rankOf = (r) => RANK[r] ?? -1;
const randInt = (max) => Math.floor(Math.random() * max);
const choose  = (arr) => arr[arr.length ? randInt(arr.length) : 0];

function rollRarity(table) {
  const r = Math.random() * 100;
  let acc = 0;
  for (const k of Object.keys(table)) {
    acc += Number(table[k]) || 0;
    if (r < acc) return k;
  }
  return "A"; // fallback
}

function getPUConfig() {
  const pu = ratesConfig?.pu || {};
  const enabled = !!pu.enabled && Array.isArray(pu.units) && pu.units.length > 0;
  const ids = enabled ? pu.units : [];
  const rateEach = Number.isFinite(+pu.rateEach) ? +pu.rateEach
                  : (Number.isFinite(+pu.sharePercent) ? +pu.sharePercent : null);
  return { enabled, ids, rateEach };
}

// SS 稀有度的 PU 分流（本池 pu.enabled=false，仍保留以利未來擴充）
function rollSSUnitWithPU() {
  const { enabled, ids, rateEach } = getPUConfig();
  const ssPool   = units.filter(u => u.rarity === "SS");
  if (!enabled) return choose(ssPool);

  const puPool   = ssPool.filter(u => ids.includes(u.id));
  const nonPool  = ssPool.filter(u => !ids.includes(u.id));

  if (!puPool.length && !nonPool.length) return choose(units) || null;
  if (!puPool.length) return choose(nonPool);
  if (!nonPool.length) return choose(puPool);

  if (Number.isFinite(rateEach) && rateEach > 0) {
    const r = Math.random() * 100;
    const totalPuRate = rateEach * puPool.length;
    return (r < totalPuRate) ? choose(puPool) : choose(nonPool);
  }
  return (Math.random() < 0.5) ? choose(puPool) : choose(nonPool);
}

// 以指定表抽一張
function drawOneRaw(mode = "general") {
  const table = (ratesConfig?.tables && ratesConfig.tables[mode])
             || (ratesConfig?.tables?.general)
             || { A: 100 };
  const rarity = rollRarity(table);

  if (rarity === "SS") {
    const pick = rollSSUnitWithPU();
    if (pick) return pick;
  }

  let pool = units.filter(u => u.rarity === rarity);
  if (!pool.length) {
    // 回退：找任一有角色的稀有度（避免空池）
    const order = Object.keys(RANK).sort((a,b) => rankOf(b)-rankOf(a));
    for (const r of order) {
      pool = units.filter(u => u.rarity === r);
      if (pool.length) break;
    }
  }
  return choose(pool);
}

// ===== 新增：保底抽（S/SS）
export function drawAtLeast(minRarity, mode = "general") {
  const need = rankOf(minRarity);
  if (need < 0) throw new Error("minRarity 必須為 'S' 或 'SS'");
  let guard = 3000;
  while (guard-- > 0) {
    const u = drawOneRaw(mode);
    if (u && rankOf(u.rarity) >= need) return u;
  }
  throw new Error(`抽卡失敗：未能抽到 >= ${minRarity} 的單位`);
}

// ===== 舊 API（保留相容）=====
export function drawOne(mode = "general") { return drawOneRaw(mode); }
export function drawTen() {
  const arr = [];
  for (let i = 0; i < 9; i++) arr.push(drawOneRaw("general"));
  arr.push(drawOneRaw("tenGuarantee")); // 第10抽走保底表
  return arr;
}

// ===== 新 API：依 preset 抽 =====
// 回傳 { units: Unit[], cost: { quartz: number, tickets: {s?, tenS?, ss?} } }
export function drawPreset(key) {
  const preset = ratesConfig?.presets?.[key];
  if (!preset || !Array.isArray(preset.steps) || !preset.steps.length) {
    throw new Error(`未知的抽卡預設：${key}`);
  }

  const results = [];
  for (const step of preset.steps) {
    const tableKey  = step.tableKey || "general";
    const count     = Math.max(1, Number(step.count) || 1);
    const minRarity = step.minRarity; // 'S' | 'SS' | undefined

    for (let i = 0; i < count; i++) {
      const unit = minRarity ? drawAtLeast(minRarity, tableKey) : drawOneRaw(tableKey);
      results.push(unit);
    }
  }

  // 成本（若有指定就用它；否則回退 drawCost * 抽數）
  const cost = { quartz: 0, tickets: {} };
  if (preset.cost) {
    cost.quartz = Number(preset.cost.quartz) || 0;
    if (preset.cost.tickets && typeof preset.cost.tickets === "object") {
      cost.tickets = { ...preset.cost.tickets };
    }
  } else {
    cost.quartz = (Number(ratesConfig.drawCost) || 0) * results.length;
  }

  return { units: results, cost };
}
