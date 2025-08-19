// skills_common.js
registerCommonSkill({
  Id: "fortuneAura",
name: "幸運祝福",
level: 1,
type: "buff",
mpCost: 0,
cooldown: 150, // 和持續時間一致，避免重疊
currentCooldown: 0,
durationSec: 60,
description: "持續 60 秒：經驗 +30%、掉寶 +20%、楓幣 +30%（不可疊加）",

use() {
  // 冷卻中就不重複施放
  if (this.currentCooldown > 0) {
    logPrepend?.(`⏳ ${this.name} 冷卻中（剩餘 ${this.currentCooldown}s）`);
    return;
  }
  
  // 檢查是否有舊的定時器，避免重複啟動
  if (player.coreBonus.bonusData.fortuneAura) {
    logPrepend?.(`💡 ${this.name} 效果已在持續中。`);
    return;
  }
  
  // 🆕 將加成寫入 coreBonus.bonusData
  player.coreBonus.bonusData.fortuneAura = {
    expBonus: 0.30,
    dropBonus: 0.20,
    goldBonus: 0.30,
  };
  
  // 🆕 設定 60 秒後自動移除加成
  // 注意：這裡不需要額外的 `player.__fortuneAuraTimer`
  setTimeout(() => {
    delete player.coreBonus.bonusData.fortuneAura;
    logPrepend?.(`✨ ${this.name} 效果結束。`);
    // 呼叫更新 UI
    updateResourceUI?.();
  }, this.durationSec * 1000);
  
  // 進入冷卻
  this.currentCooldown = this.cooldown;
  
  logPrepend?.(
    `🌀 發動【${this.name}】！持續 ${this.durationSec}s：` +
    `經驗 +30%、掉寶 +20%、楓幣 +30%`
  );
  // 呼叫更新 UI，讓主面板立即顯示加成
  updateResourceUI?.();
},

// 此技能不設計升級成本
getUpgradeCost() { return 0; }
});