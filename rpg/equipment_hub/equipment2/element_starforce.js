// ===============================
// element_starforce.js
// 星力強化系統（上限 50 / 兼容 element_equipment 的 bonus 計算）
// 規則：
// - 上限：50★
// - 1~30★：失敗不降等
// - 31~50★：失敗有 25% 降等（但 30/35/40/45/50 為保底等級，失敗不降）
// - 成本：1~10★ 使用「楓幣」，11~50★ 使用「衝星石」
// - 成功率：從 100% 開始遞減；20★（含）後固定 30%；31★（含）起固定 20%
// - 加成：1~10 每★ +1%；11~20 每★ +2%；21~30 每★ +3%；31~50 每★ +4%
//   （對 element_equipment：回傳「平均每★加成」，讓 total = 星數 * 平均值 = 真正累計）
// ===============================

(() => {
  "use strict";

  const STARFORCE_MAX_LEVEL = 50;

  function n(v, d){ v = Number(v); return Number.isFinite(v) ? v : (d||0); }
  function round2(x){ return parseFloat(n(x,0).toFixed(2)); }

  // ---- 保底等級（失敗不降等，31~50 才可能降等）----
  function isProtectedLevel(level){
    // 30, 35, 40, 45, 50 為保底
    return level === 30 || level === 35 || level === 40 || level === 45 || level === 50;
  }

  // ---- 每一★的「該星區間」加成（百分比，小數表示）----
  function starforcePerLevelBonus(level){
    // level=1 代表升到 1★ 的那顆
    if (level <= 0) return 0;
    if (level <= 10) return 0.01;   // 1~10
    if (level <= 20) return 0.02;   // 11~20
    if (level <= 30) return 0.03;   // 21~30
    return 0.04;                    // 31~50
  }

  // ---- 累計到目前星數的總加成（小數）----
  function starforceCumulativeBonus(level){
    level = Math.min(Math.max(0, Math.floor(level)), STARFORCE_MAX_LEVEL);
    let sum = 0;
    for (let i = 1; i <= level; i++){
      sum += starforcePerLevelBonus(i);
    }
    return sum; // 例如到 12★：1%*10 + 2%*2 = 0.14
  }

  // ---- 對 element_equipment 提供：取得「平均每★加成」----
  // element_equipment 會用：total = starforceLevel * bonusPercent
  // 因加成分段不同，這裡回傳 avg = (累計總加成 / 星數)，讓 total 正確等於分段總和。
  function getStarforceBonusPercent(starforceLevel){
    const L = Math.floor(n(starforceLevel,0));
    if (L <= 0) return 0;
    return starforceCumulativeBonus(L) / L;
  }

  // ---- 成功率 & 成本設定 ----
  function getSuccessRate(currentLevel){
    // currentLevel = 目前星數（升到下一顆用這個）
    if (currentLevel < 20) {
      // 從 100% 線性遞減至 30%（於 19->20 的嘗試落到 30）
      const t = currentLevel;                // 0..19
      const rate = 100 - (70 * (t / 19));    // 100 -> 30
      return Math.max(30, Math.round(rate));
    }
    if (currentLevel < 30) return 30;        // 20..29 -> 固定 30%
    return 20;                                // 30..49 -> 固定 20%
  }

  function getCostConfig(currentLevel){
    // 針對「升下一顆」的成本
    if (currentLevel < 10){
      // 升 1..10★ 使用楓幣（延用原本指數成本感）
      return { costItem: "楓幣", costAmount: 1000 * Math.pow(2, currentLevel), note:"gold" };
    }
    if (currentLevel < STARFORCE_MAX_LEVEL){
      // 11~49★ 使用衝星石，每次 1 個
      return { costItem: "衝星石", costAmount: 1, note:"stone" };
    }
    // 已達上限
    return { costItem: null, costAmount: 0, note:"cap" };
  }

  // ---- 提供給其他模組的組合設定 ----
  function getStarforceConfig(starforceLevel){
    const L = Math.floor(n(starforceLevel,0));
    const avgBonus = getStarforceBonusPercent(L);

    if (L >= STARFORCE_MAX_LEVEL) {
      return {
        costItem: null,
        costAmount: 0,
        successRate: 0,
        failDropRate: 0,
        bonusPercent: avgBonus
      };
    }

    const successRate = getSuccessRate(L);
    const cost = getCostConfig(L);

    // 降等率（只有 31~50 才會用到；且保底等級不降）
    const failDropRate = (L >= 30) ? 25 : 0;

    return {
      costItem: cost.costItem,
      costAmount: cost.costAmount,
      successRate,
      failDropRate,           // 單一降等率（不做雙降）
      bonusPercent: avgBonus, // 平均每★，給 element_equipment 使用
    };
  }

  // ---- 動作 ----
  function starforceElementEquipment(key){
    const eq = window.elementGearData?.[key];
    if (!eq) return;

    const currentLevel = n(eq.starforce, 0);

    if (currentLevel >= STARFORCE_MAX_LEVEL){
      alert(`⚠️ ${eq.name} 已達星力上限（${STARFORCE_MAX_LEVEL}★）`);
      window.applyElementEquipmentBonusToPlayer?.();
      window.updateElementEquipmentPanelContent?.();
      if (typeof window.updateAllUI === "function") window.updateAllUI();
      return;
    }

    const cfg = getStarforceConfig(currentLevel);

    // 成本檢查
    if (cfg.costItem === "楓幣"){
      if (window.player?.gold < cfg.costAmount){
        alert(`❌ 星力失敗：需要 ${cfg.costAmount} 楓幣`);
        return;
      }
      window.player.gold -= cfg.costAmount;
    } else if (cfg.costItem){
      if (typeof window.getItemQuantity !== 'function' || typeof window.removeItem !== 'function'){
        alert("❌ 遊戲初始化不完整，缺少 getItemQuantity 或 removeItem。");
        return;
      }
      if (window.getItemQuantity(cfg.costItem) < cfg.costAmount){
        alert(`❌ 星力失敗：需要 ${cfg.costItem} ×${cfg.costAmount}`);
        return;
      }
      window.removeItem(cfg.costItem, cfg.costAmount);
    } else {
      // 無成本（只可能發生在上限，已 return）
    }

    // 擲骰
    const roll = Math.random() * 100;
    let message = '';

    if (roll < cfg.successRate){
      eq.starforce = currentLevel + 1;
      message = `🌟 ${eq.name} 星力成功！已提升至 ${eq.starforce}★`;
      window.saveGame?.();
    } else {
      // 失敗：1~30 不降等；31~50 有 25% 降等（但保底等級不降）
      const nowLevel = currentLevel; // 仍是失敗前等級
      if (nowLevel >= 30 && !isProtectedLevel(nowLevel)){
        const dropRoll = Math.random() * 100;
        if (dropRoll < cfg.failDropRate){
          eq.starforce = Math.max(0, nowLevel - 1);
          message = `💥 ${eq.name} 星力失敗，等級下降至 ${eq.starforce}★`;
          window.saveGame?.();
        } else {
          message = `💥 ${eq.name} 星力失敗，等級維持在 ${nowLevel}★`;
        }
      } else {
        message = `💥 ${eq.name} 星力失敗，等級維持在 ${nowLevel}★`;
      }
    }

    alert(message);

    // 更新加成與 UI
    window.applyElementEquipmentBonusToPlayer?.();
    window.updateElementEquipmentPanelContent?.();
    if (typeof window.updateAllUI === "function") window.updateAllUI();
  }

  // ---- 導出 ----
  window.STARFORCE_MAX_LEVEL = STARFORCE_MAX_LEVEL;
  window.getStarforceBonusPercent = getStarforceBonusPercent;
  window.getStarforceConfig = getStarforceConfig;
  window.starforceElementEquipment = starforceElementEquipment;

})();