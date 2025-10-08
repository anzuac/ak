// ========== element_equipment (Hub-tab version; Break-only color + Break10 glow + divine naming) ==========

(function(w){
  "use strict";

  // -------- 基本資料 --------
  const elementGearData = {
    weapon:   { slotKey:"weapon",   name:"武器",   level:0, advance:0, starforce:0, break:0, stats:{ atk:0 }, upgradeStats:{}, isDivine:false, jobStats:{ warrior:{str:1}, mage:{int:1}, archer:{agi:1}, thief:{luk:1} } },
    shield:   { slotKey:"shield",   name:"盾牌",   level:0, advance:0, starforce:0, break:0, stats:{ def:0, hp:0 }, upgradeStats:{}, isDivine:false, jobStats:{ warrior:{str:1}, mage:{int:1}, archer:{agi:1}, thief:{luk:1} } },
    hat:      { slotKey:"hat",      name:"帽子",   level:0, advance:0, starforce:0, break:0, stats:{ def:0, hp:0 }, upgradeStats:{}, isDivine:false, jobStats:{ warrior:{str:1}, mage:{int:1}, archer:{agi:1}, thief:{luk:1} } },
    suit:     { slotKey:"suit",     name:"套服",   level:0, advance:0, starforce:0, break:0, stats:{ def:0 }, upgradeStats:{}, isDivine:false, jobStats:{ warrior:{str:2}, mage:{int:2}, archer:{agi:2}, thief:{luk:2} } },
    shoes:    { slotKey:"shoes",    name:"鞋子",   level:0, advance:0, starforce:0, break:0, stats:{}, upgradeStats:{}, isDivine:false, jobStats:{ warrior:{str:3}, mage:{int:3}, archer:{agi:3}, thief:{luk:3} } },
    glove:    { slotKey:"glove",    name:"手套",   level:0, advance:0, starforce:0, break:0, stats:{ atk:0 }, upgradeStats:{}, isDivine:false, jobStats:{ warrior:{str:3}, mage:{int:3}, archer:{agi:3}, thief:{luk:3} } },
    cape:     { slotKey:"cape",     name:"披風",   level:0, advance:0, starforce:0, break:0, stats:{ def:0, hp:0 }, upgradeStats:{}, isDivine:false, jobStats:{ warrior:{str:1}, mage:{int:1}, archer:{agi:1}, thief:{luk:1} } },
    accessory:{ slotKey:"accessory",name:"飾品",   level:0, advance:0, starforce:0, break:0, stats:{ hp:0, mp:2 }, upgradeStats:{}, isDivine:false, jobStats:{ warrior:{str:1}, mage:{int:1}, archer:{agi:1}, thief:{luk:1} } },
    badge:    { slotKey:"badge",    name:"徽章",   level:0, advance:0, starforce:0, break:0, stats:{}, upgradeStats:{}, isDivine:false, jobStats:{ warrior:{str:0}, mage:{int:0}, archer:{agi:0}, thief:{luk:0} } },
  };

  w.elementGearData = elementGearData;
  w.getElementGearData = () => elementGearData;

  function combineStats(list) {
    const out = {};
    for (const o of list) if (o) for (const k in o) out[k] = (out[k] || 0) + (o[k] || 0);
    return out;
  }

  // -------- 名稱 & 顏色 --------
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
      @keyframes eqGlow {
        0%,100%{ text-shadow:0 0 6px rgba(255,255,255,.85),0 0 18px rgba(255,255,255,.55); }
        50%{ text-shadow:0 0 8px rgba(255,255,255,1),0 0 22px rgba(255,255,255,.75); }
      }

      /* 卡片風格，與 Town/Hub 深色背景一致 */
      .eq-card {
        background:#0b1220; border:1px solid #1f2937; border-radius:10px;
        padding:10px; color:#e5e7eb;
      }
      .eq-row { margin:6px 0; font-size:13px; }
      .eq-hr { margin:8px 0; border:none; border-top:1px solid #1f2937; }
      .eq-actions button {
        background:#1f2937; border:1px solid #334155; color:#e5e7eb;
        border-radius:8px; padding:6px 10px; cursor:pointer; margin-right:6px;
      }
      .eq-actions button:hover { filter:brightness(1.1); }
    `;
    document.head.appendChild(style);
  }

  // -------- 計算 --------
  function n(v, d){ v = Number(v); return isFinite(v) ? v : (d||0); }

  /**
   * 依賴可選外部：
   *   getStarforceConfig(stars)->{bonusPercent}、 breakthroughData[idx]->{bonusPercent}、 setBonusData=[{count,bonusPercent}]
   *   getBaseJob(jobStr)->"warrior"/"mage"/"archer"/"thief"
   */
  function calculateElementEquipmentStats(eq, playerJob) {
    const jobStats = (eq.jobStats && eq.jobStats[playerJob]) ? eq.jobStats[playerJob] : {};
    const baseAndUpgrade = combineStats([eq.stats, jobStats, eq.upgradeStats]);
    const finalStats = { ...baseAndUpgrade };

    const starCfg = (typeof w.getStarforceConfig === 'function' ? w.getStarforceConfig(n(eq.starforce,0)) : null) || { bonusPercent: 0 };
    const brData  = (w.breakthroughData && w.breakthroughData[n(eq.break,0)-1]) || { bonusPercent: 0 };

    const totalBonusPercent =
      (n(eq.advance,0) * 0.2) +
      (n(eq.starforce,0) * n(starCfg.bonusPercent,0)) +
      (n(eq.break,0)     * n(brData.bonusPercent,0));

    for (const k in baseAndUpgrade) {
      const base = n(baseAndUpgrade[k],0);
      if (!base) continue;
      finalStats[k] = n(finalStats[k],0) + base * totalBonusPercent;
    }

    // 神聖套裝（全身計數）
    let divineCount = 0;
    for (const key in elementGearData) {
      const g = elementGearData[key];
      if (g?.isDivine || n(g?.break,0) >= 10) divineCount++;
    }
    let setPct = 0;
    if (Array.isArray(w.setBonusData)) {
      for (const s of w.setBonusData) if (divineCount >= s.count) setPct = s.bonusPercent;
    }
    if (setPct > 0) {
      for (const k in finalStats) if (finalStats[k]) finalStats[k] += finalStats[k] * setPct;
    }

    for (const k in finalStats) finalStats[k] = Number(finalStats[k]);
    return finalStats;
  }
  w.calculateElementEquipmentStats = calculateElementEquipmentStats;

  function applyElementEquipmentBonusToPlayer() {
    if (!w.player) return;
    const bonus = {
      atk:0, def:0, hp:0, mp:0, str:0, agi:0, int:0, luk:0,
      recover:0, damageReduce:0, critRate:0, critMultiplier:0, skillDamage:0
    };

    const baseJob = (typeof w.getBaseJob === 'function') ? w.getBaseJob(w.player.job) : String(w.player.job||'').replace(/\d+$/,'');
    for (const key in elementGearData) {
      const eq = elementGearData[key];
      const stats = calculateElementEquipmentStats(eq, baseJob);
      for (const s in stats) {
        if (s === "skillDamage" || s === "skillDmgPercent") {
          const v = stats[s];
          if (typeof v === "number" && !isNaN(v)) bonus.skillDamage += (v <= 1 ? v : v / 100);
        } else if (bonus[s] !== undefined) {
          bonus[s] += stats[s];
        }
      }
    }

    if (w.player?.coreBonus) {
      w.player.coreBonus.bonusData = w.player.coreBonus.bonusData || {};
      w.player.coreBonus.bonusData.elementEquip = bonus;
    }
    w.recomputeTotalStats?.();
    w.updateAllUI?.();
  }
  w.applyElementEquipmentBonusToPlayer = applyElementEquipmentBonusToPlayer;

  // -------- 操作派發（強化/進階/星力/突破）--------
  function handleElementAction(type, key) {
    switch (type) {
      case 'upgrade':    w.upgradeElementEquipment?.(key); break;
      case 'advance':    w.advanceElementEquipment?.(key); break;
      case 'starforce':  w.starforceElementEquipment?.(key); break;
      case 'break':      w.breakElementEquipment?.(key); break;
      default: console.warn(`未知元素強化類型：${type}`);
    }
    // 操作後重算
    applyElementEquipmentBonusToPlayer();
    // 若在 Hub 內，請記得外部呼叫容器的立即重繪（我們這裡嘗試）
    w.EquipHub?.requestRerender?.();
  }
  w.handleElementAction = handleElementAction;

  // -------- 分頁渲染（給 EquipHub 用；非彈窗）--------
  function renderElementEquip(container){
    ensureElementEquipmentStyles();
    if (!container) return;

    const baseJob = (typeof w.getBaseJob === 'function') ? w.getBaseJob(w.player?.job) : String(w.player?.job||'').replace(/\d+$/,'');
    let divineCount = 0;
    for (const k in elementGearData) { const g = elementGearData[k]; if (g?.isDivine || n(g?.break,0) >= 10) divineCount++; }

    let setPct = 0;
    if (Array.isArray(w.setBonusData)) {
      for (const s of w.setBonusData) if (divineCount >= s.count) setPct = s.bonusPercent;
    }

    const head =
      '<div style="margin-bottom:8px;opacity:.9">職業：<b>'+ (baseJob||'—') +
      '</b>｜神聖件數：<b>'+ divineCount +
      '</b>'+ (setPct>0? '｜套裝加成：<b>'+ (setPct*100).toFixed(2) +'%</b>' : '') +'</div>';

    const list = Object.keys(elementGearData).map(function(key){
      const eq = elementGearData[key];
      const starCfg = (typeof w.getStarforceConfig === 'function' ? w.getStarforceConfig(n(eq.starforce,0)) : null) || { bonusPercent: 0 };
      const brData  = (w.breakthroughData && w.breakthroughData[n(eq.break,0)-1]) || { bonusPercent: 0 };
      const jobStats = (eq.jobStats && eq.jobStats[baseJob]) ? eq.jobStats[baseJob] : {};
      const baseUp = combineStats([eq.stats, jobStats, eq.upgradeStats]);

      const totalBonusPercent =
        (n(eq.advance,0) * 0.2) +
        (n(eq.starforce,0) * n(starCfg.bonusPercent,0)) +
        (n(eq.break,0)     * n(brData.bonusPercent,0));

      const combined = calculateElementEquipmentStats(eq, baseJob);

      const PCT_KEYS = new Set(["skillDamage","skillDmgPercent"]);
      const toPctText = (v) => `${(v <= 1 ? v * 100 : v).toFixed(2)}%`;
      const toPctOrNum = (val, stat) => PCT_KEYS.has(stat) ? toPctText(val) : parseFloat(val.toFixed(2));

      const names = { atk:"攻擊力", def:"防禦力", hp:"血量", mp:"魔力", str:"力量",
                      agi:"敏捷", int:"智力", luk:"幸運", recover:"恢復率", skillDamage:"技能傷害" };

      const segs = [];
      for (const stat in combined) {
        const totalValue = combined[stat];
        if (!totalValue) continue;

        const baseV = n(eq.stats[stat],0);
        const jobV  = n(jobStats[stat],0);
        const upV   = n(eq.upgradeStats[stat],0);
        const y = baseV + jobV + upV;

        const advV  = y * (n(eq.advance,0) * 0.2);
        const starV = y * (n(eq.starforce,0) * n(starCfg.bonusPercent,0));
        const brV   = y * (n(eq.break,0)     * n(brData.bonusPercent,0));
        const setV  = (y + advV + starV + brV) * n(setPct,0);

        const parts = [];
        if (baseV) parts.push(`+${toPctOrNum(baseV, stat)}(基礎)`);
        if (jobV)  parts.push(`+${toPctOrNum(jobV,  stat)}(職業)`);
        if (upV)   parts.push(`+${toPctOrNum(upV,   stat)}(強化)`);
        if (advV)  parts.push(`+${toPctOrNum(advV,  stat)}(進階)`);
        if (starV) parts.push(`+${toPctOrNum(starV, stat)}(星力)`);
        if (brV)   parts.push(`+${toPctOrNum(brV,   stat)}(突破)`);
        if (setV)  parts.push(`+${toPctOrNum(setV,  stat)}(套裝)`);

        segs.push(
          `<div class="eq-row">
             ${names[stat] || stat}：${parts.join(' ')}<br>
             <strong style="margin-left:10px">總計：+${toPctOrNum(totalValue, stat)}</strong>
           </div>`
        );
      }

      return `
        <div class="eq-card">
          <div class="${getEquipmentNameClass(eq)}">${getEquipmentDisplayName(eq)}</div>
          <div class="eq-row">LV${n(eq.level,0)}｜進階 ${n(eq.advance,0)}｜星力 ${n(eq.starforce,0)}★｜突破 ${n(eq.break,0)} ${eq.isDivine ? '｜✨ 神聖' : ''}</div>
          <div class="eq-row">最終倍率：<b>${(totalBonusPercent*100).toFixed(2)}%</b>${n(setPct,0)>0?` + 套裝 <b>${(setPct*100).toFixed(2)}%</b>`:''}</div>
          <hr class="eq-hr">
          ${segs.join('')}
          <hr class="eq-hr">
          <div class="eq-actions">
            <button onclick="handleElementAction('upgrade','${key}')">🔨 強化</button>
            <button onclick="handleElementAction('advance','${key}')">✨ 進階</button>
            <button onclick="handleElementAction('starforce','${key}')">🌟 星力</button>
            <button onclick="handleElementAction('break','${key}')">💥 突破</button>
          </div>
        </div>
      `;
    }).join('<div style="height:8px"></div>');

    container.innerHTML =
      '' +
      head +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px">'+ list +'</div>';
  }
  w.renderElementEquip = renderElementEquip;

  // -------- 自動註冊到 EquipHub（若存在）--------
  if (w.EquipHub && typeof w.EquipHub.registerTab === 'function') {
    w.EquipHub.registerTab({
      id: 'element_equip',
      title: '元素裝備',
      render: renderElementEquip,
      tick: function(){ /* need none */ },
      onOpen: function(){ applyElementEquipmentBonusToPlayer(); }
    });
  }

  // 啟動時套用一次，以確保 coreBonus 更新
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