// ========== element_equipment (Break-only color + Break10 white glow + divine naming) ==========

const elementGearData = {
  weapon: {
    slotKey: "weapon",
    name: "武器", level: 0, advance: 0, starforce: 0, break: 0,
    stats: { atk: 0 },
    upgradeStats: {}, isDivine: false,
    jobStats: { warrior: { str: 1 }, mage: { int: 1 }, archer: { agi: 1 }, thief: { luk: 1 } }
  },
  shield: {
    slotKey: "shield",
    name: "盾牌", level: 0, advance: 0, starforce: 0, break: 0,
    stats: { def: 0, hp: 0 },
    upgradeStats: {}, isDivine: false,
    jobStats: { warrior: { str: 1 }, mage: { int: 1 }, archer: { agi: 1 }, thief: { luk: 1 } }
  },
  hat: {
    slotKey: "hat",
    name: "帽子", level: 0, advance: 0, starforce: 0, break: 0,
    stats: { def: 0, hp: 0 },
    upgradeStats: {}, isDivine: false,
    jobStats: { warrior: { str: 1 }, mage: { int: 1 }, archer: { agi: 1 }, thief: { luk: 1 } }
  },
  suit: {
    slotKey: "suit",
    name: "套服", level: 0, advance: 0, starforce: 0, break: 0,
    stats: { def: 0 },
    upgradeStats: {}, isDivine: false,
    jobStats: { warrior: { str: 2 }, mage: { int: 2 }, archer: { agi: 2 }, thief: { luk: 2 } }
  },
  shoes: {
    slotKey: "shoes",
    name: "鞋子", level: 0, advance: 0, starforce: 0, break: 0,
    stats: {},
    upgradeStats: {}, isDivine: false,
    jobStats: { warrior: { str: 3 }, mage: { int: 3 }, archer: { agi: 3 }, thief: { luk: 3 } }
  },
  glove: {
    slotKey: "glove",
    name: "手套", level: 0, advance: 0, starforce: 0, break: 0,
    stats: { atk: 0 },
    upgradeStats: {}, isDivine: false,
    jobStats: { warrior: { str: 3 }, mage: { int: 3 }, archer: { agi: 3 }, thief: { luk: 3 } }
  },
  cape: {
    slotKey: "cape",
    name: "披風", level: 0, advance: 0, starforce: 0, break: 0,
    stats: { def: 0, hp: 0 },
    upgradeStats: {}, isDivine: false,
    jobStats: { warrior: { str: 1 }, mage: { int: 1 }, archer: { agi: 1 }, thief: { luk: 1 } }
  },
  accessory: {
    slotKey: "accessory",
    name: "飾品", level: 0, advance: 0, starforce: 0, break: 0,
    stats: { hp: 0, mp: 2 },
    upgradeStats: {}, isDivine: false,
    jobStats: { warrior: { str: 1 }, mage: { int: 1 }, archer: { agi: 1 }, thief: { luk: 1 } }
  },
  badge: {
    slotKey: "badge",
    name: "徽章", level: 0, advance: 0, starforce: 0, break: 0,
    stats: {},
    upgradeStats: {}, isDivine: false,
    jobStats: { warrior: { str: 0 }, mage: { int: 0 }, archer: { agi: 0 }, thief: { luk: 0 } }
  },
};


// ✅ 新增兩行（緊接著）
window.elementGearData = elementGearData;
window.getElementGearData = () => elementGearData;

// 後面維持原本顯示樣式/計算/面板程式碼



function combineStats(list) {
  const out = {};
  for (const o of list) if (o) for (const k in o) out[k] = (out[k] || 0) + (o[k] || 0);
  return out;
}

/* ====== 顯示名稱與顏色（星力不變色；只看突破） ====== */

const divineNameMap = {
  weapon:   "神聖・聖靈劍",
  shield:   "神聖・守護盾",
  hat:      "神聖・聖冠",
  suit:     "神聖・聖鎧",
  shoes:    "神聖・天羽靴",
  glove:    "神聖・聖手套",
  cape:     "神聖・天羽披風",
  accessory:"神聖・祝福飾",
  badge:    "神聖・榮耀徽章"
};

function getEquipmentDisplayName(eq) {
  const brk = eq.break || 0;
  if (brk < 10) return eq.name;
  const slotKey = eq.slotKey || Object.keys(elementGearData).find(k => elementGearData[k] === eq);
  return divineNameMap[slotKey] || ("神聖・" + eq.name);
}
window.getEquipmentDisplayName = getEquipmentDisplayName;

function getEquipmentNameClass(eq) {
  const brk = eq.break || 0;
  if (brk >= 10) return "eq-name-brk-10";
  if (brk === 9) return "eq-name-brk-9";
  if (brk === 8) return "eq-name-brk-8";
  if (brk === 7) return "eq-name-brk-7";
  if (brk === 6) return "eq-name-brk-6";
  if (brk === 5) return "eq-name-brk-5";
  if (brk === 4) return "eq-name-brk-4";
  switch ((eq.rarity || "").toLowerCase()) {
    case "legendary": return "eq-name-legendary";
    case "epic":      return "eq-name-epic";
    case "rare":      return "eq-name-rare";
    default:          return "eq-name-normal";
  }
}
window.getEquipmentNameClass = getEquipmentNameClass;

function ensureElementEquipmentStyles() {
  if (document.getElementById("element-eq-style")) return;
  const style = document.createElement("style");
  style.id = "element-eq-style";
  style.textContent = `
    .eq-name { font-weight: 700; }
    .eq-name-normal { color: #ddd; }
    .eq-name-rare { color: #4aa3ff; }
    .eq-name-epic { color: #b277ff; }
    .eq-name-legendary { color: #ffcc33; }

    /* Break 4~9：單色 */
    .eq-name-brk-4 { color: #28c9b5; }
    .eq-name-brk-5 { color: #2f9bff; }
    .eq-name-brk-6 { color: #7a5cff; }
    .eq-name-brk-7 { color: #ff6ec7; }
    .eq-name-brk-8 { color: #ff9f1c; }
    .eq-name-brk-9 { color: #ff4d4d; }

  /* Break 10：霓虹燈效果，數種顏色循環變換 */
.eq-name.eq-name-brk-10 {
  background: none !important;
  -webkit-background-clip: initial !important;
  
  /* 初始顏色與文字陰影，作為動畫起點 */
  color: #ff00ff; /* 初始紫色 */
  text-shadow:
    0 0 5px rgba(255, 0, 255, 0.6),
    0 0 10px rgba(255, 0, 255, 0.4);

  /* 移除原本的描邊效果，專注於霓虹光 */
  -webkit-text-stroke: none !important;

  /* 霓虹燈顏色變換動畫 */
  animation: neonGlow 2.5s infinite ease-in-out;
}

/* 定義霓虹燈顏色變換的動畫 */
@keyframes neonGlow {
  0%, 100% {
    color: #ff00ff; /* 紫色 */
    text-shadow:
      0 0 5px rgba(255, 0, 255, 0.6),
      0 0 10px rgba(255, 0, 255, 0.4);
  }
  33% {
    color: #00ffff; /* 青色 */
    text-shadow:
      0 0 5px rgba(0, 255, 255, 0.6),
      0 0 10px rgba(0, 255, 255, 0.4);
  }
  66% {
    color: #00ff00; /* 綠色 */
    text-shadow:
      0 0 5px rgba(0, 255, 0, 0.6),
      0 0 10px rgba(0, 255, 0, 0.4);
  }
}

    @keyframes whiteGlow {
      from {
        text-shadow:
          0 0 4px rgba(255, 255, 255, 0.85),
          0 0 10px rgba(255, 255, 255, 0.55),
          0 0 16px rgba(255, 255, 255, 0.35);
      }
      to {
        text-shadow:
          0 0 10px rgba(255, 255, 255, 1),
          0 0 18px rgba(255, 255, 255, 0.8),
          0 0 26px rgba(255, 255, 255, 0.6);
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * 計算裝備最終屬性（依賴外部：getStarforceConfig, breakthroughData, setBonusData）
 */
function calculateElementEquipmentStats(eq, playerJob) {
  const jobStats = (eq.jobStats && eq.jobStats[playerJob]) ? eq.jobStats[playerJob] : {};
  const baseAndUpgrade = combineStats([eq.stats, jobStats, eq.upgradeStats]);
  const finalStats = { ...baseAndUpgrade };

  const starCfg = getStarforceConfig?.(eq.starforce || 0) || { bonusPercent: 0 };
  const brData = breakthroughData?.[(eq.break || 0) - 1] || { bonusPercent: 0 };
  const totalBonusPercent =
    (eq.advance || 0) * 0.2 +
    (eq.starforce || 0) * (starCfg.bonusPercent || 0) +
    (eq.break || 0) * (brData.bonusPercent || 0);

  for (const k in baseAndUpgrade) {
    const base = baseAndUpgrade[k];
    if (!base) continue;
    finalStats[k] = (finalStats[k] || 0) + base * totalBonusPercent;
  }

  let divineCount = 0;
  for (const key in elementGearData) {
    const g = elementGearData[key];
    if (g.isDivine || ((g.break || 0) >= 10)) divineCount++;
  }
  let setPct = 0;
  if (Array.isArray(setBonusData)) {
    for (const s of setBonusData) if (divineCount >= s.count) setPct = s.bonusPercent;
  }
  if (setPct > 0) {
    for (const k in finalStats) if (finalStats[k]) finalStats[k] += finalStats[k] * setPct;
  }

  for (const k in finalStats) finalStats[k] = Number(finalStats[k]);
  return finalStats;
}

/* 套用到玩家 */
function applyElementEquipmentBonusToPlayer() {
  const bonus = {
    atk:0, def:0, hp:0, mp:0, str:0, agi:0, int:0, luk:0,
    recover:0, damageReduce:0, critRate:0, critMultiplier:0, skillDamage:0
  };
  const playerJob = (player.job ?? "").toLowerCase();

  for (const key in elementGearData) {
    const eq = elementGearData[key];
    const stats = calculateElementEquipmentStats(eq, playerJob);
    for (const s in stats) {
      if (s === "skillDamage" || s === "skillDmgPercent") {
        const v = stats[s];
        if (typeof v === "number" && !isNaN(v)) bonus.skillDamage += (v <= 1 ? v : v / 100);
      } else if (bonus[s] !== undefined) {
        bonus[s] += stats[s];
      }
    }
  }

  if (player?.coreBonus?.bonusData) {
    player.coreBonus.bonusData.elementEquip = bonus;
    if (typeof updateAllUI === 'function') updateAllUI();
  }
}

/* 動作分派 */
function handleElementAction(type, key) {
  switch (type) {
    case 'upgrade':    if (typeof upgradeElementEquipment === 'function') upgradeElementEquipment(key); break;
    case 'advance':    if (typeof advanceElementEquipment === 'function') advanceElementEquipment(key); break;
    case 'starforce':  if (typeof starforceElementEquipment === 'function') starforceElementEquipment(key); break;
    case 'break':      if (typeof breakElementEquipment === 'function') breakElementEquipment(key); break;
    default: console.warn(`未知元素強化類型：${type}`);
  }
}

/* 面板與渲染 */
function openElementEquipmentPanel() {
  ensureElementEquipmentStyles();
  let modal = document.getElementById("element-equipment-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "element-equipment-modal";
    modal.style.cssText = `
      position: fixed; top: 10vh; left: 50%; transform: translateX(-50%);
      width: 55vw; max-width: 250px; max-height: 50vh; background: #222;
      border: 1px solid #888; border-radius: 6px; padding: 10px; z-index: 1000;
      display: flex; flex-direction: column; overflow: hidden; color: #fff;
    `;
    const list = document.createElement("div");
    list.id = "element-equipment-list";
    list.style.cssText = `overflow-y: auto; max-height: 60vh; padding-right: 4px; font-size: 12px;`;
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "關閉";
    closeBtn.style.cssText = `margin-top: 10px; align-self: flex-end;`;
    closeBtn.onclick = () => modal.style.display = 'none';
    modal.appendChild(list);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);
  }
  updateElementEquipmentPanelContent();
  modal.style.display = 'flex';
}

function updateElementEquipmentPanelContent() {
  const list = document.getElementById("element-equipment-list");
  if (!list) return;
  list.innerHTML = "";
  const playerJob = (player.job ?? "").toLowerCase();

  const PCT_KEYS = new Set(["skillDamage", "skillDmgPercent"]);
  const toPctText = (v) => `${(v <= 1 ? v * 100 : v).toFixed(2)}%`;
  const toPctOrNum = (val, stat) => PCT_KEYS.has(stat) ? toPctText(val) : parseFloat(val.toFixed(2));

  for (const key in elementGearData) {
    const eq = elementGearData[key];
    const div = document.createElement("div");
    div.style.marginBottom = "10px";

    const jobStats = (eq.jobStats && eq.jobStats[playerJob]) ? eq.jobStats[playerJob] : {};
    const starCfg = getStarforceConfig?.(eq.starforce || 0) || { bonusPercent: 0 };
    const brData = breakthroughData?.[(eq.break || 0) - 1] || { bonusPercent: 0 };

    const totalBonusPercent =
      (eq.advance || 0) * 0.2 +
      (eq.starforce || 0) * (starCfg.bonusPercent || 0) +
      (eq.break || 0) * (brData.bonusPercent || 0);

    let divineCount = 0;
    for (const k in elementGearData) {
      const g = elementGearData[k];
      if (g.isDivine || ((g.break || 0) >= 10)) divineCount++;
    }
    let setPct = 0;
    if (Array.isArray(setBonusData)) {
      for (const s of setBonusData) if (divineCount >= s.count) setPct = s.bonusPercent;
    }

    const statsHtml = [];
    const combined = calculateElementEquipmentStats(eq, playerJob);

    for (const stat in combined) {
      const totalValue = combined[stat];
      if (!totalValue) continue;

      let name = stat;
      switch (stat) {
        case 'atk': name = '攻擊力'; break;
        case 'def': name = '防禦力'; break;
        case 'hp':  name = '血量'; break;
        case 'mp':  name = '魔力'; break;
        case 'str': name = '力量'; break;
        case 'agi': name = '敏捷'; break;
        case 'int': name = '智力'; break;
        case 'luk': name = '幸運'; break;
        case 'recover': name = '恢復率'; break;
        case 'skillDamage': name = '技能傷害'; break;
      }

      const baseV = eq.stats[stat] || 0;
      const jobV  = jobStats[stat] || 0;
      const upV   = eq.upgradeStats[stat] || 0;
      const baseUp = (baseV + jobV + upV) || 0;

      const advV = baseUp * ((eq.advance || 0) * 0.2);
      const starV = baseUp * ((eq.starforce || 0) * (starCfg.bonusPercent || 0));
      const brV = baseUp * ((eq.break || 0) * (brData.bonusPercent || 0));
      const setV = (baseUp + advV + starV + brV) * setPct;

      const seg = [];
      if (baseV) seg.push(`${toPctOrNum(baseV, stat)} (基礎)`);
      if (jobV)  seg.push(`${toPctOrNum(jobV, stat)} (職業)`);
      if (upV)   seg.push(`${toPctOrNum(upV, stat)} (強化)`);
      if (advV)  seg.push(`${toPctOrNum(advV, stat)} (進階)`);
      if (starV) seg.push(`${toPctOrNum(starV, stat)} (星力)`);
      if (brV)   seg.push(`${toPctOrNum(brV, stat)} (突破)`);
      if (setV)  seg.push(`${toPctOrNum(setV, stat)} (套裝)`);

      statsHtml.push(`
        <div>
          ${name}: ${seg.map(s => `+${s}`).join(' ')}
          <br>
          <strong style="margin-left: 10px;">總計: +${toPctOrNum(totalValue, stat)}</strong>
        </div>
      `);
    }

    div.innerHTML = `
      <div style="border:1px solid #444; padding:8px; border-radius:4px; background:#333;">
        <strong class="eq-name ${getEquipmentNameClass(eq)}">${getEquipmentDisplayName(eq)}</strong>
        （LV${eq.level} / 進階${eq.advance} / 星力${eq.starforce}★ / 突破${eq.break}）
        ${eq.isDivine ? ' ✨神聖套裝' : ''}<br>
        <div style="margin-top: 5px; margin-bottom: 5px;">
          <strong>最終倍率:</strong> ${(totalBonusPercent * 100).toFixed(2)}% (進階+星力+突破)
          ${setPct > 0 ? ` + ${(setPct * 100).toFixed(2)}% (套裝)` : ''}
        </div>
        <hr style="margin:8px 0; border-color:#555;">
        ${statsHtml.join('')}
        <hr style="margin:8px 0; border-color:#555;">
        <button onclick="handleElementAction('upgrade', '${key}')">🔨 強化</button>
        <button onclick="handleElementAction('advance', '${key}')">✨ 進階</button>
        <button onclick="handleElementAction('starforce', '${key}')">🌟 星力</button>
        <button onclick="handleElementAction('break', '${key}')">💥 突破</button>
      </div>
    `;
    list.appendChild(div);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  ensureElementEquipmentStyles();
  if (typeof player !== 'undefined') applyElementEquipmentBonusToPlayer();
});