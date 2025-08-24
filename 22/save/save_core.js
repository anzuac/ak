// ==========================
// save_core.js
// 專門用於儲存和載入遊戲主要資料的模組
// ==========================

// =====================
// 全域設定
// =====================
window.DEBUG_MODE = false; // 測試時 true, 上線時改 false


const GAME_SAVE_KEY = 'GAME_SAVE_V2';

//console.log("Save Core 模組已載入。");

/**
 * 將 player 物件的資料儲存到 Local Storage
 */
function saveGame() {
    console.log("正在嘗試儲存遊戲資料...");
    if (typeof player === 'undefined' || !player) {
        console.error("無法儲存：player 物件不存在。");
        return;
    }

    const jobChangeDoneLevelsArray = Array.from(window.__jobChangeDoneLevels || new Set());

    const savableState = {
        nickname: player.nickname,
        job: player.job,
        level: player.level,
        exp: player.exp,
        statPoints: player.statPoints,
        gold: player.gold,
        gem: player.gem,
        stone: player.stone,
        
        baseStats: {
            hp: player.baseStats.hp,
            atk: player.baseStats.atk,
            def: player.baseStats.def,
            mp: player.baseStats.mp,
            str: player.baseStats.str,
            agi: player.baseStats.agi,
            int: player.baseStats.int,
            luk: player.baseStats.luk,
        },
        
        magicShieldEnabled: player.magicShieldEnabled,
        baseSkillDamage: player.baseSkillDamage,
        coreBonusData: player.coreBonus?.bonusData,
        elementEquipmentData: window.getElementGearData ? window.getElementGearData() : null,
        inventoryData: window.inventory || {},
        skillsState: window.Skills_exportState ? window.Skills_exportState() : null,

        jobChangeDoneLevels: jobChangeDoneLevelsArray,

        recoveryLevel:
          (player?.recoverySystem?.level
            ?? (typeof recoverySystem !== 'undefined' ? recoverySystem?.level : undefined)
            ?? 1),
    };

    try {
        localStorage.setItem(GAME_SAVE_KEY, JSON.stringify(savableState));
        console.log("✅ 遊戲資料已成功儲存！");
    } catch (e) {
        console.error("❌ 遊戲儲存失敗:", e);
    }
}

/**
 * 從 Local Storage 載入資料，並應用到 player 物件
 * @returns {boolean} 如果成功載入則回傳 true，否則 false
 */
function loadGame() {
    console.log("正在嘗試載入遊戲資料...");
    try {
        const rawData = localStorage.getItem(GAME_SAVE_KEY);
        if (!rawData) {
            console.log("沒有找到遊戲存檔。");
            return false;
        }

        const loadedData = JSON.parse(rawData);
        if (!loadedData || typeof loadedData !== 'object') {
            console.error("載入的資料格式不正確。");
            return false;
        }

        player.nickname = loadedData.nickname ?? "";
        player.job = loadedData.job ?? "";
        player.level = parseInt(loadedData.level) || 1;
        player.exp = parseInt(loadedData.exp) || 0;
        player.statPoints = parseInt(loadedData.statPoints) || 0;
        player.gold = parseInt(loadedData.gold) || 0;
        player.gem = parseInt(loadedData.gem) || 0;
        player.stone = parseInt(loadedData.stone) || 0;
        player.magicShieldEnabled = loadedData.magicShieldEnabled ?? false;
        player.baseSkillDamage = loadedData.baseSkillDamage ?? 0.10;

        if (loadedData.baseStats) {
            Object.assign(player.baseStats, loadedData.baseStats);
        }
        
        if (loadedData.coreBonusData && player.coreBonus?.bonusData) {
            Object.assign(player.coreBonus.bonusData, loadedData.coreBonusData);
        }
        if (player.skillBonus?.bonusData) {
            player.skillBonus.bonusData = {};
        }

        if (loadedData.inventoryData && window.inventory) {
            Object.assign(window.inventory, loadedData.inventoryData);
        }

        if (loadedData.skillsState && window.Skills_applyState) {
            window.Skills_applyState(loadedData.skillsState);
        }

        // ✅ 載入轉職紀錄，並將陣列轉換為 Set
        if (Array.isArray(loadedData.jobChangeDoneLevels)) {
            window.__jobChangeDoneLevels = new Set(loadedData.jobChangeDoneLevels);
        } else {
            window.__jobChangeDoneLevels = new Set();
        }

        // ✅ 以 player 為主儲放恢復系統等級
        player.recoverySystem = player.recoverySystem || {};
        player.recoverySystem.level = loadedData.recoveryLevel || 1;

        // ✅ 同步到執行中的 recoverySystem（若模組已載入）
        if (typeof syncRecoveryFromPlayer === 'function') {
            syncRecoveryFromPlayer();
        }

        // 🏆 修正：載入裝備資料後，重新套用裝備效果
        if (loadedData.elementEquipmentData && window.elementGearData) {
            Object.assign(window.elementGearData, loadedData.elementEquipmentData);
            // 確保在載入裝備數據後立即重新應用它們的加成
            if (typeof applyElementEquipmentBonusToPlayer === 'function') {
                applyElementEquipmentBonusToPlayer();
            }
        }
        
        // 🏆 修正：重新計算總屬性
        // 這行現在放在更合適的位置，確保在裝備加成後執行
        if (typeof recomputeTotalStats === 'function') recomputeTotalStats();

        player.currentHP = player.totalStats.hp;
        player.currentMP = player.totalStats.mp;
        player.shield = 0;
        player.statusEffects = {};
        player.abnormalInflict = {};
        player.recoverPercent = 0;
        player.damageReduce = 0;
        
        console.log("✅ 遊戲資料已成功載入！");
        player.expToNext = getExpToNext(player.level);
        
        if (typeof rebuildActiveSkills === 'function') rebuildActiveSkills();
        if (typeof updateAllUI === 'function') updateAllUI();
        
        return true;
    } catch (e) {
        console.error("❌ 遊戲載入失敗:", e);
        localStorage.removeItem(GAME_SAVE_KEY);
        console.log("已清除損壞的存檔。");
    }
    return false;
}

window.saveGame = saveGame;
window.loadGame = loadGame;

document.addEventListener('DOMContentLoaded', () => {
    const hasSave = localStorage.getItem(GAME_SAVE_KEY) !== null;
    if (hasSave) {
        console.log("已偵測到遊戲存檔，準備跳過設定角色畫面。");
    }
});
