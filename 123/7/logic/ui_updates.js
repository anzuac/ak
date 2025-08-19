// 🆕 彙整 Boss 自身 Buff（顯示實際數值，含 DEF）
function getBossSelfBuffStatus(monster) {
  if (!monster) return "無";

  const segs = [];
  const toTurns = (n) => {
    const t = Number(n || 0);
    return t > 0 ? `${t}回合` : null;
  };

  // 基礎攻防
  const baseAtk = Number(monster._uiBaseAtk ?? monster.baseAtk ?? monster.atk ?? 0);
  const baseDef = Number(monster._uiBaseDef ?? monster.naturalDef ?? monster.def ?? 0);

  // 1) 狂怒 ATK buff
  const enrTurns = Number(monster._enragedTurns || 0);
  const enrMul   = Number(monster._enrageMul   || 1);
  if (enrTurns > 0 && enrMul > 1 && isFinite(baseAtk)) {
    const boosted = Math.round(baseAtk * enrMul);
    const diff = boosted - baseAtk;
    segs.push(`ATK+${diff}（${boosted}，${toTurns(enrTurns) || "持續中"}）`);
  }

  // 2) DEF：形態倍率（常駐）
  const phaseMul = Number(monster._phaseDefMul || 1);
  if (phaseMul > 1 && isFinite(baseDef)) {
    const phaseVal = Math.round(baseDef * phaseMul);
    const phaseDiff = phaseVal - baseDef;
    segs.push(`DEF+${phaseDiff}（${phaseVal}，常駐）`);
  }

  // ✅ 修正：新增專屬 DEF 增益邏輯
  const defTurns = Number(monster._defBuffTurns || 0);
  const defMul   = Number(monster._defMulForUi  || 1);
  if (defTurns > 0 && defMul > 1 && isFinite(baseDef)) {
    const defVal  = Math.round(baseDef * defMul);
    const defDiff = defVal - baseDef;
    segs.push(`DEF+${defDiff}（${defVal}，${toTurns(defTurns) || "持續中"}）`);
  }

  // ✅ 修正：護盾增益
  const shieldTurns = Number(monster._rootShieldTurns || 0);
  const shieldMul   = Number(monster._shieldMul       || 1);
  // **注意**：如果護盾是疊加在 DEF 面板上的，這裡的計算可能需要修改
  // 目前的邏輯是將護盾視為一種防禦加成來計算
  // 如果你的需求是「護盾值」而不是「防禦倍率」，這段邏輯需要再調整
  if (shieldTurns > 0 && shieldMul > 1 && isFinite(baseDef)) {
    const shieldVal = Math.round(baseDef * shieldMul);
    const shieldDiff = shieldVal - baseDef;
    segs.push(`護盾：DEF+${shieldDiff}（${shieldVal}，${toTurns(shieldTurns) || "持續中"}）`);
  }

  // 4) 蓄力技能
  if (monster.isCharging) {
    const chargeSkillName =
      monster.nextSkill?.name ||
      (monster.skills || []).find(s => s.isChargeAttack)?.name ||
      "蓄力";
    segs.push(`蓄力：${chargeSkillName}（1回合）`);
  }

  return segs.length ? segs.join(" | ") : "無";
}

// 🆕 彙整 Boss 冷卻狀態
function getBossCooldownStatus(monster) {
  if (!monster) return { buff: "無", skills: "無" };
  
  const namesByKey = {};
  (monster.skills || []).forEach(s => {
    if (!s || !s.key) return;
    namesByKey[s.key] = s.name || s.key;
  });
  
  const skillCDs = monster.skillCooldowns || {};
  const buffParts = [];
  const atkParts = [];
  
  for (const key in skillCDs) {
    const cd = Number(skillCDs[key] || 0);
    if (cd <= 0) continue;
    const name = namesByKey[key] || key;
    
    const isBuff = /(^|-)buff$/.test(key);
    (isBuff ? buffParts : atkParts).push(`${name}：${cd}`);
  }
  
  buffParts.sort();
  atkParts.sort();
  
  return {
    buff: buffParts.length ? buffParts.join(" | ") : "無",
    skills: atkParts.length ? atkParts.join(" | ") : "無"
  };
}

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
  
  // ===== 基礎資訊 =====
  const eliteRateForItems = monster.isElite ? 2 : 1; 
  const eliteChancePct = (difficulty.eliteChance ?? 0) * 100; // 🆕 精英怪出現機率
  
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
  
  // ===== 內建描述 =====
  const builtInText = (typeof getMonsterBuiltInEffects === "function") ? getMonsterBuiltInEffects(monster) : "無";
  const abnormalText = (typeof getMonsterAbnormalEffects === "function") ? getMonsterAbnormalEffects(monster) : "無";
  const buffText = (typeof getMonsterBuffEffects === "function") ? getMonsterBuffEffects(monster) : "無";
  const buffSkillText = (typeof getMonsterBuiltInBuffSkills === "function") ? getMonsterBuiltInBuffSkills(monster) : "無";
  
  // ===== Boss 狀態 =====
  const bossSelfStatus = getBossSelfBuffStatus(monster);
  const bossCd = getBossCooldownStatus(monster);
  
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
  
  // ===== 顯示區 =====
  infoBox.innerHTML = `
    <strong>${monster.name}${monster.isElite ? " [精英]" : ""}</strong><br>
    等級：${monster.level}<br>
    HP：${Math.max(hp, 0)} / ${monster.maxHp}<br>
    ATK：${monster.atk}｜DEF：${monster.def}｜EXP：${baseExp}<br>
    精英怪出現機率：${fmtPct(eliteChancePct)}%<br><br>

    狀態效果：<br>
    🌟 Boss 狀態：${bossSelfStatus}<br>
    ⏳ Boss Buff 冷卻：${bossCd.buff}<br>
    ⏳ Boss 技能冷卻：${bossCd.skills}<br>
    🔸 內建：${builtInText}<br>
    🔹 異常：${abnormalText}<br>
    🔺 強化狀態：${buffText || "無"}<br>
    🔸 強化技能：${buffSkillText}<br><br>
    
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
  `;
}