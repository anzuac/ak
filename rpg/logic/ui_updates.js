// 掉落資訊顯示狀態，預設為顯示
let isDropsVisible = true;

// 隱藏/顯示掉落資訊的開關函式
function toggleDropsDisplay() {
  isDropsVisible = !isDropsVisible;
  // 更新怪物資訊面板以套用新的顯示狀態
  if (currentMonster) {
    updateMonsterInfo(currentMonster, monsterHP);
  }
}

// 在 DOM 載入後，為按鈕綁定事件
document.addEventListener('DOMContentLoaded', () => {
  const btnToggleDrops = document.getElementById('btnToggleDrops');
  if (btnToggleDrops) {
    btnToggleDrops.addEventListener('click', toggleDropsDisplay);
  }
});

// ==============================
// Boss 狀態/冷卻 顯示工具（完整版）
// 與 updateMonsterInfo() 相容：提供 getBossSelfBuffStatus / getBossCooldownStatus
// ==============================

(function () {
  // 小工具：安全取得 BossCore 方法
  const hasCore = () => typeof window.BossCore === "object" && window.BossCore;

  // 兼容：從 BossCore 或 buffState 取「buff 剩餘秒數」
  function getBuffTurns(mon, kind /* 'atk' | 'def' | 'shield' | 'speedMul' */) {
    if (!mon) return 0;
    // 1) 優先用 BossCore 的 getBuffTurns（它會把 alias 映射好）
    if (hasCore() && typeof BossCore.getBuffTurns === "function") {
      return Number(BossCore.getBuffTurns(mon, kind) || 0);
    }
    // 2) 後備：直接讀 monster.buffState.buffs
    const map = mon?.buffState?.buffs || {};
    const keyByKind = {
      atk: "atkMul",
      def: "defMul",
      shield: "shieldMul",
      speedMul: "speedMul" // 新增
    };
    const b = map[keyByKind[kind]];
    
    return Number(b?.remainSec || 0);
  }

  // 兼容：從 BossCore 或 skillCooldowns 取技能冷卻
  function getSkillCd(mon, key) {
    if (!mon || !key) return 0;
    if (hasCore() && typeof BossCore.getSkillCooldown === "function") {
      return Number(BossCore.getSkillCooldown(mon, key) || 0);
    }
    return Number(mon?.skillCooldowns?.[key] || 0);
  }

  // 顯示目前生效中的 Boss Buff（剩餘秒）
  function getBossSelfBuffStatus(mon) {
    if (!mon) return "無";

    // 如果 BossCore._applyPanel 有寫入 UI 欄位，優先用它們（數字表示剩餘秒）
    const rawAtk = Number(mon._enragedTurns || 0);
    const rawDef = Number(mon._defBuffTurns || 0);
    const rawShield = Number(mon._rootShieldTurns || 0);

    let atkS = rawAtk, defS = rawDef, shieldS = rawShield;

    // 若 UI 欄位不存在，fallback 用 buffState
    if (!atkS) atkS = getBuffTurns(mon, "atk");
    if (!defS) defS = getBuffTurns(mon, "def");
    if (!shieldS) shieldS = getBuffTurns(mon, "shield");
    
    // --- 新增：取得攻擊速度 Buff 剩餘秒數 ---
    const speedS = getBuffTurns(mon, "speedMul");
    // --- 新增結束 ---

    const parts = [];
    if (atkS > 0) parts.push(`💪 攻擊↑（${atkS}s）`);
    if (defS > 0) parts.push(`🛡️ 防禦↑（${defS}s）`);
    if (shieldS > 0) parts.push(`🔰 護盾↑（${shieldS}s）`);
    if (speedS > 0) parts.push(`⚡ 攻速↑（${speedS}s）`); // 新增顯示行

    return parts.length ? parts.join("、") : "無";
  }

  // === 修正處：重寫 getBossCooldownStatus 以顯示所有技能冷卻 ===
  function getBossCooldownStatus(mon) {
    if (!mon || !Array.isArray(mon.skills)) {
      return { all: "無" };
    }

    const allSkillsParts = [];
    for (const s of mon.skills) {
      if (!s || !s.key) continue;
      
      const cd = getSkillCd(mon, s.key);
      const label = s.name || s.key;
      
      allSkillsParts.push(`${label}：${cd > 0 ? cd + "s" : "就緒"}`);
    }

    return {
      all: allSkillsParts.length ? allSkillsParts.join("、") : "無",
    };
  }

  // 導出給 updateMonsterInfo 使用
  window.getBossSelfBuffStatus = getBossSelfBuffStatus;
  window.getBossCooldownStatus = getBossCooldownStatus;
})();

function updateMonsterInfo(monster, hp) {
  const difficulty = (typeof getCurrentDifficulty === "function" ? getCurrentDifficulty() : {}) || {};
  const infoBox = document.getElementById("monsterInfo");
  if (!infoBox) return;

  const fmtPct = (v) => {
    const s = (Math.round(v * 10) / 10).toString();
    return s.endsWith(".0") ? s.slice(0, -2) : s;
  };

  const playerDropBonus = Number(player?.dropRateBonus || 0);
  const playerGoldBonus = Number(player?.goldRateBonus || 0);

  const eliteRateForItems = monster.isElite ? 2 : 1;
  const eliteChancePct = (difficulty.eliteChance ?? 0) * 100;

  let expBase = Math.floor((monster.baseExp || 0) * (1 + (monster.level - 1) * 0.2));
  if (monster.isElite) expBase = Math.floor(expBase * 1.5);
  const baseExp = Math.floor(expBase * (difficulty.exp ?? 1));

  const baseGoldLeft = Math.floor((monster.baseGold || 0) * (difficulty.gold ?? 1));
  const finalGoldRight = Math.floor(baseGoldLeft * (1 + playerGoldBonus));

  // ===== 強化石 =====
  let stoneRows = "";
  if (monster.dropRates?.stone) {
    const baseStonePct = (monster.dropRates.stone.chance || 0) * 100;
    const finalStonePct = baseStonePct * (1 + playerDropBonus);
    const bonusLv = Math.floor(monster.level / 5);
    const stoneMin = Math.floor(((monster.dropRates.stone.min || 0) + bonusLv) * (difficulty.stone ?? 1));
    const stoneMax = Math.floor(((monster.dropRates.stone.max || 0) + bonusLv) * (difficulty.stone ?? 1));
    stoneRows = `
      <div>強化石（機率）</div>
      <div>${fmtPct(baseStonePct)}%</div>
      <div>${fmtPct(finalStonePct)}%</div>
      <div style="grid-column: 1 / -1; opacity:.85">強化石數量：${stoneMin} ~ ${stoneMax} 顆</div>
    `;
  }

  // ===== 狀態顯示 =====
  const bossSelfStatus = (typeof getBossSelfBuffStatus === "function") ? getBossSelfBuffStatus(monster) : "無";
  const bossCd = (typeof getBossCooldownStatus === "function") ? getBossCooldownStatus(monster) : { all: "無" };

  const currentRoundSafe = (typeof round === "number" && isFinite(round)) ? round : 0;
  const playerAppliedAbnormalText =
    (typeof getMonsterAbnormalEffects === "function") ?
    getMonsterAbnormalEffects(monster) :
    "無";
  const abnormalResistText =
    (typeof getMonsterAbnormalResistances === "function") ?
    getMonsterAbnormalResistances(monster, currentRoundSafe) :
    "無";

  const buffText = (typeof getMonsterBuffEffects === "function") ? getMonsterBuffEffects(monster) : "無";
  const buffSkillText = (typeof getMonsterBuiltInBuffSkills === "function") ? getMonsterBuiltInBuffSkills(monster) : "無";

  // ===== 區域掉落 =====
  let regionalRows = "";
  if (monster.dropRates) {
    for (const itemName in monster.dropRates) {
      if (itemName === "gold" || itemName === "stone" || itemName === "exp") continue;
      const cfg = monster.dropRates[itemName];
      if (!cfg || !(cfg.chance > 0)) continue;
      const basePct = cfg.chance * 100 * (difficulty.item ?? 1) * eliteRateForItems;
      const finalPct = basePct * (1 + playerDropBonus);
      regionalRows += `
        <div>${itemName}</div>
        <div>${fmtPct(basePct)}%</div>
        <div>${fmtPct(finalPct)}%</div>
      `;
    }
  }

  // ===== 全域掉落 =====
  let globalRows = "";
  if (typeof GLOBAL_DROP_RATES === "object" && GLOBAL_DROP_RATES) {
    for (const key in GLOBAL_DROP_RATES) {
      const it = GLOBAL_DROP_RATES[key];
      if (!it) continue;
      const basePct = (it.rate || 0) * 100 * (difficulty.item ?? 1) * eliteRateForItems;
      const finalPct = basePct * (1 + playerDropBonus);
      globalRows += `
        <div>${it.name}</div>
        <div>${fmtPct(basePct)}%</div>
        <div>${fmtPct(finalPct)}%</div>
      `;
    }
  }

  const gridStyle = `
    display:grid;
    grid-template-columns: 160px 1fr 1fr;
    gap:6px 12px;
    align-items:center;
  `.trim();

  // ===== 額外：虛弱效果顯示 =====
  let weakenRow = "";
  if (monster.statusEffects?.weaken && monster.statusEffects.weaken.duration > 0) {
    const baseAtk = monster.atk_base || monster.atk;
    const baseDef = monster.def_base || monster.def;
    const atkLoss = baseAtk - monster.atk;
    const defLoss = baseDef - monster.def;
    weakenRow = `⚔️ 虛弱效果：ATK -${atkLoss}，DEF -${defLoss}（剩餘 ${monster.statusEffects.weaken.duration} 回合）<br>`;
  }
  
  const dropsDisplay = isDropsVisible ? 'block' : 'none';

  // ===== 顯示區 =====
  infoBox.innerHTML = `
    <strong>${monster.name}${monster.isElite ? " [精英]" : ""}</strong><br>
    等級：${monster.level}<br>
    HP：${Math.max(hp, 0)} / ${monster.maxHp}<br>
    ATK：${monster.atk}｜DEF：${monster.def}｜EXP：${baseExp}｜<span class="muted">SPD：${(monster.speedPct || 1).toFixed(2)}x</span><br>
    精英怪出現機率：${fmtPct(eliteChancePct)}%<br><br>

    狀態效果：<br>
    🌟 Boss 狀態：${bossSelfStatus}<br>
    ⏳ Boss 技能冷卻：${bossCd.all}<br>
    🔸 玩家造成異常：${playerAppliedAbnormalText}<br>
    🔹 異常抗性：${abnormalResistText}<br>
    ${weakenRow}
    🔺 強化狀態：${buffText}<br>
    🔸 強化技能：${buffSkillText}<br>
    
    <div id="dropInfoSection" style="display:${dropsDisplay};">
      <br>
      📦 掉落預覽
      <div style="${gridStyle}; margin-top:6px;">
        <div></div><div class="muted">基準</div><div class="muted">含玩家</div>
        <div>楓幣</div>
        <div>${baseGoldLeft} 楓幣</div>
        <div>${finalGoldRight} 楓幣</div>
        ${stoneRows || ""}
        <div style="grid-column: 1 / -1; font-weight:600; margin-top:6px;">區域限定掉落</div>
        ${regionalRows || `<div>（無）</div><div></div><div></div>`}
        <div style="grid-column: 1 / -1; font-weight:600; margin-top:6px;">全域掉落</div>
        ${globalRows || `<div>（無）</div><div></div><div></div>`}
      </div>
      <div style="margin-top:6px; opacity:.7; font-size:12px;">
        ※ 機率顯示到小數點一位；左欄不含玩家加成。
      </div>
    </div>
  `;
}
