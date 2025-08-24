// statusEffects.js
// 處理怪物身上的持續性異常狀態，並加入狀態抗性機制
// 放在檔案頂部或 applyStatusToMonster 上方，集中管理中文名稱與顯示開關
const STATUS_ZH = {
  burn: "燃燒",
  poison: "中毒",
  bleed: "流血",
  deadly_poison: "劇毒",
  weaken: "虛弱",
  chaos: "混亂",
  paralyze: "麻痺",
  frostbite: "凍傷",
};

// 測試時不要在戰鬥紀錄顯示被抗性擋下的訊息
const SHOW_RESIST_LOG = false;
// ★ 新增：將抗性回合數定義為常數
const RESISTANCE_DURATION = 20;

// 狀態效果處理函式集合
const statusEffectsHandlers = {
    // 燃燒：每回合根據玩家攻擊力的一定比例造成傷害
    burn: (monster, player, statusData) => {
        const damage = Math.floor((player.totalStats?.atk || 0) * (statusData.multiplier || 0));
        if (damage <= 0) return null;
        monster.hp -= damage;
        return { damage, logText: `🔥 ${monster.name} 因燃燒受到 ${damage} 傷害` };
    },

    // 中毒：每回合根據玩家攻擊力的一定比例造成傷害
    poison: (monster, player, statusData) => {
        const damage = Math.floor((player.totalStats?.atk || 0) * (statusData.multiplier || 0));
        if (damage <= 0) return null;
        monster.hp -= damage;
        return { damage, logText: `🧪 ${monster.name} 因中毒受到 ${damage} 傷害` };
    },
    
    // 流血：每回合根據玩家攻擊力的一定比例造成傷害
    bleed: (monster, player, statusData) => {
        const damage = Math.floor((player.totalStats?.atk || 0) * (statusData.multiplier || 0));
        if (damage <= 0) return null;
        monster.hp -= damage;
        return { damage, logText: `🩸 ${monster.name} 因流血受到 ${damage} 傷害` };
    },

    // 劇毒：每回合根據怪物最大生命值的一定比例造成傷害
    deadly_poison: (monster, player, statusData) => {
        const damage = Math.floor((monster.maxHp || 0) * (statusData.multiplier || 0));
        if (damage <= 0) return null;
        monster.hp -= damage;
        return { damage, logText: `☠️ ${monster.name} 因劇毒受到 ${damage} 傷害` };
    },

    // 虛弱：降低怪物攻擊和防禦力
    weaken: (monster, player, statusData) => {
        if (!statusData.applied) {
            const weakenRate = 0.40; // 降低 40%
            monster.atk_base = monster.atk; // 備份原始值
            monster.def_base = monster.def;
            monster.atk = Math.floor(monster.atk * (1 - weakenRate));
            monster.def = Math.floor(monster.def * (1 - weakenRate));
            statusData.applied = true; // 標記為已套用
            return { logText: `⚔️ ${monster.name} 陷入虛弱狀態，攻防下降！` };
        }
        return null;
    },
    
    // 混亂：50% 機率攻擊自己（此狀態在 rpg.js 中處理）
    chaos: () => null,

    // 麻痺：無法行動（此狀態在 rpg.js 中處理）
    paralyze: () => null,

    // 凍傷：無法行動 + 持續傷害（在 rpg.js 和這裡同時處理）
    frostbite: (monster, player, statusData) => {
        const damage = Math.floor((player.totalStats?.atk || 0) * (statusData.multiplier || 0));
        if (damage <= 0) return null;
        monster.hp -= damage;
        return { damage, logText: `❄️ ${monster.name} 因凍傷受到 ${damage} 傷害` };
    }
};

/**
 * 處理怪物身上的所有持續性異常狀態。
 * 此函式在每個回合開始時被呼叫。
 * @param {object} monster - 怪物物件
 * @param {object} player - 玩家物件
 * @param {number} round - 當前回合數
 */
function processMonsterStatusEffects(monster, player, round) {
    if (!monster || !monster.statusEffects) return;

    for (const effectType in monster.statusEffects) {
        const status = monster.statusEffects[effectType];
        if (status?.duration > 0) {
            const handler = statusEffectsHandlers[effectType];
            if (handler) {
                const result = handler(monster, player, status);
                if (result) {
                    logPrepend?.(result.logText);
                }
            }
            status.duration--;
        }
    }
    
    // 清除持續時間為 0 的狀態
    for (const effectType in monster.statusEffects) {
        if (monster.statusEffects[effectType].duration <= 0) {
            // 虛弱恢復
            if (effectType === 'weaken' && monster.statusEffects.weaken.applied) {
                monster.atk = monster.atk_base;
                monster.def = monster.def_base;
                logPrepend?.(`🛡️ ${monster.name} 的虛弱狀態已解除，攻防恢復。`);
            }
            // 施加時已經開啟抗性倒數，這裡不再寫入
            delete monster.statusEffects[effectType];
        }
    }
}

/**
 * 應用或更新怪物身上的異常狀態。
 * @param {object} monster - 怪物物件
 * @param {string} type - 狀態類型
 * @param {number} duration - 持續回合數
 * @param {number} multiplier - 傷害倍率或效果強度
 * @param {number} currentRound - 當前回合數，用於抗性計算
 */
function applyStatusToMonster(monster, type, duration, multiplier, currentRound) {
    if (!monster || !type || !Number.isFinite(duration)) return;

    monster.statusEffects = monster.statusEffects || {};
    monster.statusResistance = monster.statusResistance || {};

    // 抗性檢查（施加當下即開始倒數）
    const lastAppliedRound = monster.statusResistance[type] || -Infinity;
    const elapsed = currentRound - lastAppliedRound;
    if (elapsed < RESISTANCE_DURATION) {
        // 不顯示英文、不顯示倒數；如需顯示改成中文，打開 SHOW_RESIST_LOG
        if (SHOW_RESIST_LOG) {
            const zh = STATUS_ZH[type] || type;
            logPrepend?.(`🛡️ ${monster.name} 對【${zh}】具有抗性，效果無效。`);
        }
        return;
    }

    // 已有該異常 → 不允許重複施加（避免永遠維持 3 回合）
    if (monster.statusEffects[type]) {
        if (SHOW_RESIST_LOG) {
            const zh = STATUS_ZH[type] || type;
            logPrepend?.(`⚠️ ${monster.name} 已處於【${zh}】狀態，無法重複施加。`);
        }
        return;
    }

    // 記錄這次施加的回合 → 馬上開啟抗性倒數
    monster.statusResistance[type] = currentRound;

    // 確保至少 1 回合
    const safeDuration = Math.max(1, duration);

    // 套用異常
    monster.statusEffects[type] = { duration: safeDuration, multiplier };
    const zh = STATUS_ZH[type] || type;
    logPrepend?.(`🧪 ${monster.name} 陷入【${zh}】狀態，持續 ${safeDuration} 回合。`);
}

// 🆕 彙整玩家對怪物造成的異常狀態 (修正版)
function getMonsterAbnormalEffects(monster) {
  const se = monster.statusEffects || {};
  const abnormalEffects = [];
  
  const symbolMap = {
    "poison": "☠️", "burn": "🔥", "deadly_poison": "☠️",
    "weaken": "🌀", "chaos": "🤪", "paralyze": "⚡", 
    "frostbite": "❄️", "bleed": "🩸"
  };

  for (const key in se) {
    if (se.hasOwnProperty(key) && se[key].duration > 0) {
      const symbol = symbolMap[key] || '✨';
      abnormalEffects.push(`${symbol} ${key.charAt(0).toUpperCase() + key.slice(1)}（${se[key].duration}回合）`);
    }
  }
  
  return abnormalEffects.length > 0 ? abnormalEffects.join("、") : "無";
}

// 🆕 彙整怪物異常抗性 (修正版)
function getMonsterAbnormalResistances(monster, currentRound) {
    if (!monster || !monster.statusResistance) return "無";
    const resistances = [];
    const symbolMap = {
        "poison": "☠️", "burn": "🔥", "deadly_poison": "☠️",
        "weaken": "🌀", "chaos": "🤪", "paralyze": "⚡", 
        "frostbite": "❄️", "bleed": "🩸"
    };

    for (const key in monster.statusResistance) {
        const lastAppliedRound = monster.statusResistance[key] || 0;
        const remainingRounds = RESISTANCE_DURATION - (currentRound - lastAppliedRound);
        
        if (remainingRounds > 0) {
            const symbol = symbolMap[key] || '🛡️';
            resistances.push(`${symbol} ${key.charAt(0).toUpperCase() + key.slice(1)}（${remainingRounds}回合）`);
        }
    }
    return resistances.length > 0 ? resistances.join("、") : "無";
}

// 將函式暴露給全域環境，讓其他檔案可以呼叫
window.processMonsterStatusEffects = processMonsterStatusEffects;
window.applyStatusToMonster = applyStatusToMonster;
window.getMonsterAbnormalEffects = getMonsterAbnormalEffects;
window.getMonsterAbnormalResistances = getMonsterAbnormalResistances;