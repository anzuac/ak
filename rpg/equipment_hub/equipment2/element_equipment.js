// ========== element_equipment (Hub-tab; Liberation + Divine-only Set; Card UI + 上限/總合 + 每卡上限顯示) ==========
(function(w){
  "use strict";

  // -------- 基本資料（更新：基礎能力 + 解放/星力/突破欄位） --------
  const elementGearData = {
    weapon:   { slotKey:"weapon",   name:"武器",   level:0, liberation:0, starforce:0, break:0,
                stats:{ atk:5 }, upgradeStats:{}, isDivine:false,
                jobStats:{ warrior:{}, mage:{}, archer:{}, thief:{} } },

    shield:   { slotKey:"shield",   name:"盾牌",   level:0, liberation:0, starforce:0, break:0,
                stats:{ hp:100, def:2 }, upgradeStats:{}, isDivine:false,
                jobStats:{ warrior:{}, mage:{}, archer:{}, thief:{} } },

    hat:      { slotKey:"hat",      name:"帽子",   level:0, liberation:0, starforce:0, break:0,
                stats:{ def:2 }, upgradeStats:{}, isDivine:false,
                jobStats:{ warrior:{str:3}, mage:{int:3}, archer:{agi:3}, thief:{luk:3} } },

    suit:     { slotKey:"suit",     name:"套服",   level:0, liberation:0, starforce:0, break:0,
                stats:{ hp:100, mp:2, def:3 }, upgradeStats:{}, isDivine:false,
                jobStats:{ warrior:{}, mage:{}, archer:{}, thief:{} } },

    shoes:    { slotKey:"shoes",    name:"鞋子",   level:0, liberation:0, starforce:0, break:0,
                stats:{ hp:50 }, upgradeStats:{}, isDivine:false,
                jobStats:{ warrior:{str:2}, mage:{int:2}, archer:{agi:2}, thief:{luk:2} } },

    glove:    { slotKey:"glove",    name:"手套",   level:0, liberation:0, starforce:0, break:0,
                stats:{ atk:3 }, upgradeStats:{}, isDivine:false,
                jobStats:{ warrior:{}, mage:{}, archer:{}, thief:{} } },

    cape:     { slotKey:"cape",     name:"披風",   level:0, liberation:0, starforce:0, break:0,
                stats:{ def:3 }, upgradeStats:{}, isDivine:false,
                jobStats:{ warrior:{str:2}, mage:{int:2}, archer:{agi:2}, thief:{luk:2} } },

    accessory:{ slotKey:"accessory",name:"飾品",   level:0, liberation:0, starforce:0, break:0,
                stats:{ hp:30, mp:1 }, upgradeStats:{}, isDivine:false,
                jobStats:{ warrior:{}, mage:{}, archer:{}, thief:{} } },

    badge:    { slotKey:"badge",    name:"徽章",   level:0, liberation:0, starforce:0, break:0,
                stats:{}, upgradeStats:{}, isDivine:false,
                jobStats:{ warrior:{}, mage:{}, archer:{}, thief:{} } },
  };
  w.elementGearData = elementGearData;
  w.getElementGearData = () => elementGearData;

  function combineStats(list) {
    const out = {};
    for (const o of list) if (o) for (const k in o) out[k] = (out[k] || 0) + (o[k] || 0);
    return out;
  }
  function n(v, d){ v = Number(v); return Number.isFinite(v) ? v : (d||0); }

  // 若沒有外部提供 getUpgradeLevelCap，提供一個 fallback（強化上限 = 20 + 5×解放等級，封頂 LR=45）
  if (typeof w.getUpgradeLevelCap !== 'function') {
    w.getUpgradeLevelCap = function getUpgradeLevelCap(eq){
      const lib = Math.max(0, Math.floor(Number(eq?.liberation || 0)));
      return 20 + 5 * Math.min(lib, 5);
    };
  }

  // -------- 名稱 & 顏色（Break10 才會神聖命名）--------
  const divineNameMap = {
    weapon:"神聖・聖靈劍", shield:"神聖・守護盾", hat:"神聖・聖冠", suit:"神聖・聖鎧",
    shoes:"神聖・天羽靴", glove:"神聖・聖手套", cape:"神聖・天羽披風", accessory:"神聖・祝福飾", badge:"神聖・榮耀徽章"
  };
  function getEquipmentDisplayName(eq) {
    const brk = eq.break || 0;
    if (brk < 10) return eq.name;
    const slotKey = eq.slotKey || Object.keys(elementGearData).find(k => elementGearData[k] === eq);
    return divineNameMap[slotKey] || ("神聖・" + eq.name);
  }
  w.getEquipmentDisplayName = getEquipmentDisplayName;

  function getEquipmentNameClass(eq) {
    const brk = eq.break || 0;
    if (brk >= 10) return "eq-name eq-name-brk-10";
    if (brk === 9) return "eq-name eq-name-brk-9";
    if (brk === 8) return "eq-name eq-name-brk-8";
    if (brk === 7) return "eq-name eq-name-brk-7";
    if (brk === 6) return "eq-name eq-name-brk-6";
    if (brk === 5) return "eq-name eq-name-brk-5";
    if (brk === 4) return "eq-name eq-name-brk-4";
    switch ((eq.rarity || "").toLowerCase()) {
      case "legendary": return "eq-name eq-name-legendary";
      case "epic":      return "eq-name eq-name-epic";
      case "rare":      return "eq-name eq-name-rare";
      default:          return "eq-name eq-name-normal";
    }
  }
  w.getEquipmentNameClass = getEquipmentNameClass;

  function ensureElementEquipmentStyles() {
    if (document.getElementById("element-eq-style")) return;
    const style = document.createElement("style");
    style.id = "element-eq-style";
    style.textContent = `
      .eq-name { font-weight: 700; }
      .eq-name-normal { color: #e5e7eb; }
      .eq-name-rare { color: #60a5fa; }
      .eq-name-epic { color: #c084fc; }
      .eq-name-legendary { color: #fbbf24; }
      .eq-name-brk-4 { color: #2dd4bf; }
      .eq-name-brk-5 { color: #38bdf8; }
      .eq-name-brk-6 { color: #818cf8; }
      .eq-name-brk-7 { color: #f472b6; }
      .eq-name-brk-8 { color: #f59e0b; }
      .eq-name-brk-9 { color: #f87171; }
      .eq-name-brk-10 { background:none!important; -webkit-background-clip:initial!important; color:#fff;
        text-shadow:0 0 6px rgba(255,255,255,.85),0 0 18px rgba(255,255,255,.55); animation:eqGlow 2.6s infinite ease-in-out; }
      @keyframes eqGlow { 0%,100%{ text-shadow:0 0 6px rgba(255,255,255,.85),0 0 18px rgba(255,255,255,.55); }
                          50%{ text-shadow:0 0 8px rgba(255,255,255,1),0 0 22px rgba(255,255,255,.75); } }

      /* 卡片風格 */
      .eq-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px }
      .eq-card { position:relative; background:#0b1220; border:1px solid #1f2937; border-radius:12px; padding:12px; color:#e5e7eb; }
      .eq-head { display:flex; align-items:center; justify-content:space-between; }
      .eq-tags { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
      .eq-tag { font-size:11px; border:1px solid #374151; background:#0f172a; padding:2px 6px; border-radius:999px; }
      .eq-rbadge { position:absolute; top:10px; right:12px; font-size:11px; background:#111827; border:1px solid #374151; border-radius:8px; padding:2px 6px; opacity:.95; }
      .eq-hr { margin:10px 0; border:none; border-top:1px solid #1f2937; }
      .eq-row { margin:6px 0; font-size:13px; }
      .eq-statlist { display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; }
      .eq-stat { font-size:13px; opacity:.95; }
      .eq-actions { display:flex; flex-wrap:wrap; gap:6px; }
      .eq-actions button { background:#1f2937; border:1px solid #334155; color:#e5e7eb; border-radius:8px; padding:6px 10px; cursor:pointer; }
      .eq-actions button[disabled] { opacity:.5; cursor:not-allowed; }
      .eq-actions button:hover { filter:brightness(1.08); }

      .eq-topbar { background:#0f172a; border:1px solid #1f2937; border-radius:12px; padding:10px; margin-bottom:12px; }
      .eq-badge { display:inline-block; background:#111827; border:1px solid #374151; border-radius:8px; padding:4px 8px; margin:4px 6px 0 0; font-size:12px; }

      .eq-star { font-size:12px; opacity:.85; }
      .eq-val { font-weight:700; }
    `;
    document.head.appendChild(style);
  }

  // -------- 輔助：是否為「神聖命名」(Break ≥ 10) --------
  function isDivineNamed(eq){ return n(eq.break,0) >= 10; }
  function getDivineCount() {
    let c = 0;
    for (const k in elementGearData) if (isDivineNamed(elementGearData[k])) c++;
    return c;
  }

  // -------- 解放階級顯示（0 顯示 N）--------
  const LIB_RANKS = ["R","SR","SSR","UR","LR"];
  function getLiberationRankText(level){
    const L = Math.floor(n(level,0));
    if (L <= 0) return "N";
    return LIB_RANKS[Math.min(L-1, LIB_RANKS.length-1)] || "N";
  }

  // -------- 計算核心：每件裝備最終值（星力 + 解放 + 突破）--------
  const LIBERATION_PER_LVL = (w.getLiberationPerLevelBonus?.() ?? 0.05);

  function calculateElementEquipmentStats(eq, playerBaseJob, liberationUnlocked) {
    const jobStats = (eq.jobStats && eq.jobStats[playerBaseJob]) ? eq.jobStats[playerBaseJob] : {};
    const baseUp = combineStats([eq.stats, jobStats, eq.upgradeStats]);  // y 基底
    const finalStats = { ...baseUp };

    const starCfg = (typeof w.getStarforceConfig === 'function' ? w.getStarforceConfig(n(eq.starforce,0)) : null) || { bonusPercent: 0 };
    const brData  = (w.breakthroughData && w.breakthroughData[n(eq.break,0)-1]) || { bonusPercent: 0 };

    const starPct = n(eq.starforce,0) * n(starCfg.bonusPercent,0);             // 星力總%
    const libPct  = (liberationUnlocked ? n(eq.liberation,0) : 0) * LIBERATION_PER_LVL; // 解放總%
    const brPct   = n(eq.break,0)     * n(brData.bonusPercent,0);              // 突破總%

    for (const k in baseUp) {
      const y = n(baseUp[k],0);
      if (!y) continue;
      finalStats[k] = y + y*starPct + y*libPct + y*brPct;
    }

    for (const k in finalStats) finalStats[k] = Number(finalStats[k]);
    return { finalStats, baseUp, starPct, libPct, brPct };
  }
  w.calculateElementEquipmentStats = function(eq, job){
    const baseJob = (typeof w.getBaseJob === 'function') ? w.getBaseJob(job) : String(job||'').replace(/\d+$/,'');
    return calculateElementEquipmentStats(eq, baseJob, getDivineCount()>=9).finalStats;
  };

  // -------- 套裝加成（漸進／累積；僅計神聖件數 & 神聖基底）--------
  function computeSetBonuses(baseUpSum, divineCount) {
    const out = {
      addAtk:0, addHp:0, addDef:0,
      addRecoverPct:0, addSkillDamage:0, addIgnoreDefPct:0, addTotalDamage:0,
      liberationUnlocked: divineCount >= 9
    };
    if (divineCount >= 2) out.addAtk         += n(baseUpSum.atk,0) * 0.50;
    if (divineCount >= 3) out.addHp          += n(baseUpSum.hp,0)  * 1.00;
    if (divineCount >= 4) out.addDef         += n(baseUpSum.def,0) * 0.30;
    if (divineCount >= 5) out.addRecoverPct  += 0.30;
    if (divineCount >= 6) out.addSkillDamage += 0.15;
    if (divineCount >= 7) out.addIgnoreDefPct+= 0.20;
    if (divineCount >= 8) out.addTotalDamage += 0.20;
    return out;
  }

  // -------- 寫入 player.coreBonus + 總合快取（供 UI 顯示）--------
  function applyElementEquipmentBonusToPlayer() {
    if (!w.player) return;

    const bonus = {
      atk:0, def:0, hp:0, mp:0, str:0, agi:0, int:0, luk:0,
      recoverPercent:0, damageReduce:0, critRate:0, critMultiplier:0,
      skillDamage:0, ignoreDefPct:0, totalDamage:0
    };

    const equipTotals = { atk:0, def:0, hp:0, mp:0, str:0, agi:0, int:0, luk:0,
      recoverPercent:0, damageReduce:0, critRate:0, critMultiplier:0,
      skillDamage:0, ignoreDefPct:0, totalDamage:0
    }; // 全身裝備最終值總合（含百分比欄位）
    const baseJob = (typeof w.getBaseJob === 'function') ? w.getBaseJob(w.player.job) : String(w.player.job||'').replace(/\d+$/,'');
    const divineCount = getDivineCount();
    const liberationUnlocked = divineCount >= 9;

    const baseUpSumDivine = {};
    for (const key in elementGearData) {
      const eq = elementGearData[key];
      const calc = calculateElementEquipmentStats(eq, baseJob, liberationUnlocked);

      for (const s in calc.finalStats) {
        if (bonus[s] !== undefined) bonus[s] += n(calc.finalStats[s],0);
        if (equipTotals[s] !== undefined) equipTotals[s] += n(calc.finalStats[s],0);
      }

      if (isDivineNamed(eq)) {
        for (const s in calc.baseUp) baseUpSumDivine[s] = (baseUpSumDivine[s] || 0) + n(calc.baseUp[s],0);
      }
    }

    const setB = computeSetBonuses(baseUpSumDivine, divineCount);
    bonus.atk           += setB.addAtk;
    bonus.hp            += setB.addHp;
    bonus.def           += setB.addDef;
    bonus.recoverPercent+= setB.addRecoverPct;
    bonus.skillDamage   += setB.addSkillDamage;
    bonus.ignoreDefPct  += setB.addIgnoreDefPct;
    bonus.totalDamage   += setB.addTotalDamage;

    if (w.player?.coreBonus) {
      w.player.coreBonus.bonusData = w.player.coreBonus.bonusData || {};
      w.player.coreBonus.bonusData.elementEquip = bonus;
    }

    w.__ElementEquipSetSummary = {
      divineCount,
      setBonuses: setB,
      baseUpSumDivine,
      equipTotals
    };

    w.recomputeTotalStats?.();
    w.updateAllUI?.();
  }
  w.applyElementEquipmentBonusToPlayer = applyElementEquipmentBonusToPlayer;

  // -------- 操作派發（強化 → 星力 → 突破 → 解放）--------
  function handleElementAction(type, key) {
    switch (type) {
      case 'upgrade':    w.upgradeElementEquipment?.(key); break;
      case 'starforce':  w.starforceElementEquipment?.(key); break;
      case 'break':      w.breakElementEquipment?.(key); break;
      case 'liberate':   w.liberateElementEquipment?.(key); break;
      default: console.warn(`未知元素強化類型：${type}`);
    }
    applyElementEquipmentBonusToPlayer();
    w.EquipHub?.requestRerender?.();
  }
  w.handleElementAction = handleElementAction;

  // -------- 分頁渲染（卡片版）--------
  function renderElementEquip(container){
    ensureElementEquipmentStyles();
    if (!container) return;

    const baseJob = (typeof w.getBaseJob === 'function') ? w.getBaseJob(w.player?.job) : String(w.player?.job||'').replace(/\d+$/,'');
    applyElementEquipmentBonusToPlayer();

    const sum = w.__ElementEquipSetSummary || { divineCount:0, setBonuses:{}, baseUpSumDivine:{}, equipTotals:{} };
    const sb = sum.setBonuses || {};
    const divineCount = sum.divineCount || 0;
    const equipTotals = sum.equipTotals || {};
    const liberationUnlocked = divineCount >= 9;

    // 顯示欄位（含百分比型）
    const names = {
      atk:"攻擊力", def:"防禦力", hp:"血量", mp:"魔力",
      str:"力量", agi:"敏捷", int:"智力", luk:"幸運",
      recoverPercent:"回復力", damageReduce:"傷害減免",
      critRate:"爆擊率", critMultiplier:"爆傷",
      skillDamage:"技能傷害", ignoreDefPct:"穿透防禦", totalDamage:"總傷害"
    };
    const statOrder = [
      "atk","def","hp","mp","str","agi","int","luk",
      "recoverPercent","damageReduce","critRate","critMultiplier","skillDamage","ignoreDefPct","totalDamage"
    ];
    const percentKeys = new Set(["recoverPercent","damageReduce","critRate","critMultiplier","skillDamage","ignoreDefPct","totalDamage"]);

    // 上限規則說明（強化）
    const upCapText = "20 + 5×解放（N=20, R=25, SR=30, SSR=35, UR=40, LR=45）";
    const sfCap  = (w.STARFORCE_MAX_LEVEL ?? 50);
    const brkCap = (w.BREAKTHROUGH_MAX_LEVEL ?? 10);
    const libCap = "LR（5階）";

    // 裝備總能力徽章（含百分比型）
    const fmtBadge = (k, v) => percentKeys.has(k) ? ( (v*100).toFixed(2) + "%" ) : ( v.toFixed(2) );
    const totalsBadges = `
      <span class="eq-badge">攻擊力（裝備）合計 +${fmtBadge("atk", n(equipTotals.atk,0))}</span>
      <span class="eq-badge">HP（裝備）合計 +${fmtBadge("hp", n(equipTotals.hp,0))}</span>
      <span class="eq-badge">防禦力（裝備）合計 +${fmtBadge("def", n(equipTotals.def,0))}</span>
      <span class="eq-badge">MP（裝備）合計 +${fmtBadge("mp", n(equipTotals.mp,0))}</span>
      <span class="eq-badge">STR 合計 +${fmtBadge("str", n(equipTotals.str,0))}</span>
      <span class="eq-badge">AGI 合計 +${fmtBadge("agi", n(equipTotals.agi,0))}</span>
      <span class="eq-badge">INT 合計 +${fmtBadge("int", n(equipTotals.int,0))}</span>
      <span class="eq-badge">LUK 合計 +${fmtBadge("luk", n(equipTotals.luk,0))}</span>
      <span class="eq-badge">回復力（裝備）合計 +${fmtBadge("recoverPercent", n(equipTotals.recoverPercent,0))}</span>
      <span class="eq-badge">傷害減免（裝備）合計 +${fmtBadge("damageReduce", n(equipTotals.damageReduce,0))}</span>
      <span class="eq-badge">爆擊率（裝備）合計 +${fmtBadge("critRate", n(equipTotals.critRate,0))}</span>
      <span class="eq-badge">爆傷（裝備）合計 +${fmtBadge("critMultiplier", n(equipTotals.critMultiplier,0))}</span>
      <span class="eq-badge">技能傷害（裝備）合計 +${fmtBadge("skillDamage", n(equipTotals.skillDamage,0))}</span>
      <span class="eq-badge">穿透防禦（裝備）合計 +${fmtBadge("ignoreDefPct", n(equipTotals.ignoreDefPct,0))}</span>
      <span class="eq-badge">總傷害（裝備）合計 +${fmtBadge("totalDamage", n(equipTotals.totalDamage,0))}</span>
    `;

    const topbar = `
      <div class="eq-topbar">
        <div>職業：<b>${baseJob||'—'}</b>｜神聖件數：<b>${divineCount}</b>｜解放：<b>${liberationUnlocked?'已解鎖':'未解鎖(需神聖9件)'}</b></div>

        <div style="margin-top:6px">上限：
          <span class="eq-badge">強化 ${upCapText}</span>
          <span class="eq-badge">星力 ${sfCap}</span>
          <span class="eq-badge">突破 ${brkCap}</span>
          <span class="eq-badge">解放 ${libCap}</span>
        </div>

        <div style="margin-top:6px">套裝能力加成（僅計神聖裝備基底）：</div>
        <div>
          <span class="eq-badge">攻擊力 +${(n(sb.addAtk,0)).toFixed(2)}</span>
          <span class="eq-badge">HP +${(n(sb.addHp,0)).toFixed(2)}</span>
          <span class="eq-badge">防禦力 +${(n(sb.addDef,0)).toFixed(2)}</span>
          <span class="eq-badge">回復力 +${((n(sb.addRecoverPct,0))*100).toFixed(0)}%</span>
          <span class="eq-badge">技能傷害 +${((n(sb.addSkillDamage,0))*100).toFixed(0)}%</span>
          <span class="eq-badge">穿透防禦 +${((n(sb.addIgnoreDefPct,0))*100).toFixed(0)}%</span>
          <span class="eq-badge">總傷害 +${((n(sb.addTotalDamage,0))*100).toFixed(0)}%</span>
        </div>

        <div style="margin-top:8px">裝備總能力（最終值合計）：</div>
        <div>${totalsBadges}</div>
      </div>
    `;

    // 小卡列表
    const list = Object.keys(elementGearData).map(function(key){
      const eq = elementGearData[key];
      const jobStats = (eq.jobStats && eq.jobStats[baseJob]) ? eq.jobStats[baseJob] : {};
      const baseUp = combineStats([eq.stats, jobStats, eq.upgradeStats]); // y
      const calcPack = calculateElementEquipmentStats(eq, baseJob, liberationUnlocked);
      const combined = calcPack.finalStats;

      const starCfg = (typeof w.getStarforceConfig === 'function' ? w.getStarforceConfig(n(eq.starforce,0)) : null) || { bonusPercent: 0 };
      const brData  = (w.breakthroughData && w.breakthroughData[n(eq.break,0)-1]) || { bonusPercent: 0 };

      const rightBadge = `<div class="eq-rbadge">${getLiberationRankText(eq.liberation)}</div>`;
      const capThis = w.getUpgradeLevelCap(eq);

      const tags = [];
      tags.push(`<span class="eq-tag">LV ${n(eq.level,0)} / ${capThis}</span>`);
      tags.push(`<span class="eq-tag">${n(eq.starforce,0)}★</span>`);
      tags.push(`<span class="eq-tag">BRK ${n(eq.break,0)}</span>`);
      if (isDivineNamed(eq)) tags.push(`<span class="eq-tag">✨ 神聖</span>`);

      // 依欄位型態格式化
      const fmt = (k, v) => (percentKeys.has(k) ? ( (v*100).toFixed(2) + "%" ) : v.toFixed(2));

      const statLines = [];
      for (const s of statOrder) {
        const totalV = n(combined[s],0);
        if (!totalV) continue;

        // 分段（百分比型也分段顯示，但以%格式）
        const y = n(baseUp[s],0);
        const starV = y * (n(eq.starforce,0) * n(starCfg.bonusPercent,0));
        const libV  = y * ((liberationUnlocked ? n(eq.liberation,0) : 0) * LIBERATION_PER_LVL);
        const brV   = y * (n(eq.break,0) * n(brData.bonusPercent,0));

        const segs = [];
        if (y)      segs.push(`基礎/職/強 <span class="eq-val">+${fmt(s, y)}</span>`);
        if (starV)  segs.push(`星力 <span class="eq-val">+${fmt(s, starV)}</span>`);
        if (libV)   segs.push(`解放 <span class="eq-val">+${fmt(s, libV)}</span>`);
        if (brV)    segs.push(`突破 <span class="eq-val">+${fmt(s, brV)}</span>`);

        statLines.push(
          `<div class="eq-stat">
             ${names[s]||s}：<span class="eq-val">+${fmt(s, totalV)}</span>
             <div class="eq-star" style="margin-top:2px;opacity:.8">${segs.join('｜')}</div>
           </div>`
        );
      }

      return `
        <div class="eq-card">
          ${rightBadge}
          <div class="eq-head">
            <div class="${getEquipmentNameClass(eq)}">${getEquipmentDisplayName(eq)}</div>
          </div>
          <div class="eq-tags">${tags.join('')}</div>
          <div class="eq-star" style="opacity:.8;margin-top:2px;">強化上限：LV${capThis}</div>

          <hr class="eq-hr">
          <div class="eq-statlist">
            ${statLines.length ? statLines.join('') : '<div class="eq-row" style="opacity:.7">尚無屬性</div>'}
          </div>

          <hr class="eq-hr">
          <div class="eq-actions">
            <button onclick="handleElementAction('upgrade','${key}')">🔨 強化</button>
            <button onclick="handleElementAction('starforce','${key}')">🌟 星力</button>
            <button onclick="handleElementAction('break','${key}')">💥 突破</button>
            <button onclick="handleElementAction('liberate','${key}')" ${liberationUnlocked?'':'disabled title="需神聖9件解鎖解放"'}>🌀 解放</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = topbar + `<div class="eq-grid">${list}</div>`;
  }
  w.renderElementEquip = renderElementEquip;

  // -------- 自動註冊到 EquipHub（若存在）--------
  if (w.EquipHub && typeof w.EquipHub.registerTab === 'function') {
    w.EquipHub.registerTab({
      id: 'element_equip',
      title: '元素裝備',
      render: renderElementEquip,
      tick: function(){ /* none */ },
      onOpen: function(){ applyElementEquipmentBonusToPlayer(); }
    });
  }

  // 啟動時套用一次，確保 coreBonus 更新
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){
      ensureElementEquipmentStyles();
      applyElementEquipmentBonusToPlayer();
    });
  } else {
    ensureElementEquipmentStyles();
    applyElementEquipmentBonusToPlayer();
  }

})(window);
