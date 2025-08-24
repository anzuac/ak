// 📦 status_manager_player.js (狀態效果優化與統一設定)

/**
 * 產生一個在 min (包含) 和 max (包含) 之間的隨機整數。
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} - 隨機整數
 */
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ⚙️ 統一設定所有狀態效果的數值與特性
// duration: 狀態持續回合的隨機範圍 [min, max]
// cooldown: 狀態冷卻回合的隨機範圍 [min, max]
// damage: 傷害公式的參數
// type: 狀態類型 (e.g., 'damage', 'debuff')
// overlap: 疊加方式 ('stack' - 累加回合數, 'refresh' - 刷新回合數)
const statusConfig = {
  poison: {
    duration: [3, 5],
    cooldown: [3, 5],
    damage: 0.01,
    type: 'damage',
    overlap: 'refresh', // 毒素刷新持續時間
    logText: (damage) => `☠️ 你中毒了，損失 ${damage} HP`
  },
  burn: {
    duration: [2, 4],
    cooldown: [3, 5],
    damage: 0.1,
    type: 'damage',
    overlap: 'refresh', // 燃燒刷新持續時間
    logText: (damage) => `🔥 你燃燒中，損失 ${damage} HP`
  },
  paralyze: {
    duration: [1, 2],
    cooldown: [5, 8],
    type: 'debuff',
    overlap: 'refresh', // 麻痺刷新持續時間
    logTextEnd: () => `⚡ 麻痺效果結束`
  },
  weaken: {
    duration: [2, 4],
    cooldown: [4, 6],
    type: 'debuff',
    overlap: 'refresh', // 虛弱刷新持續時間
    logTextEnd: () => `🌀 虛弱效果結束`
  },
  freeze: {
    duration: [4, 6],
    cooldown: [5, 8],
    damage: 0.01,
    type: 'damage',
    overlap: 'refresh', // 凍傷刷新持續時間
    logText: (damage) => `❄️ 凍傷造成 ${damage} 傷害`
  },
  bleed: {
    duration: [3, 5],
    cooldown: [4, 6],
    damage: 0.03,
    type: 'damage',
    overlap: 'stack', // 流血效果可以疊加回合數
    logText: (damage) => `🩸 流血造成 ${damage} 傷害`
  }
};

/**
 * 處理怪物對玩家施加的狀態效果。
 * @param {Object} monster - 怪物物件
 */
function applyStatusFromMonster(monster) {
  if (!monster || !player) return;

  if (!player.statusEffects) player.statusEffects = {};
  if (!player.statusCooldown) player.statusCooldown = {};

  const logs = [];

  // 遍歷所有可能的狀態效果，統一處理
  for (const status in statusConfig) {
    const config = statusConfig[status];
    const monsterHasStatus = monster[status] || (monster.extra && monster.extra[status]);
    const monsterChance = monster[status + 'Chance'] || (monster.extra && monster.extra[status + 'Chance']);
    
    // 檢查施加條件：怪物是否具備此狀態、是否通過機率判定、是否在冷卻中
    if (monsterHasStatus && Math.random() * 100 < monsterChance && !player.statusCooldown[status]) {
      const [minDuration, maxDuration] = config.duration;
      const [minCooldown, maxCooldown] = config.cooldown;
      
      const newTurns = getRandomInt(minDuration, maxDuration);
      
      // 根據疊加方式更新回合數
      if (config.overlap === 'stack') {
        player.statusEffects[status] = (player.statusEffects[status] || 0) + newTurns;
        logs.push(`✅ ${monster.name} 對你施加了 ${status}（+${newTurns} 回合）`);
      } else { // 'refresh'
        player.statusEffects[status] = newTurns;
        logs.push(`✅ ${monster.name} 對你施加了 ${status}（刷新至 ${newTurns} 回合）`);
      }

      // 設定隨機冷卻時間
      player.statusCooldown[status] = getRandomInt(minCooldown, maxCooldown);
    }
  }

  // 插入戰鬥紀錄
  if (logs.length > 0) {
    logPrepend(logs.join("<br>"));
  }
}

/**
 * 每回合處理玩家所有狀態效果的運行。
 */
function processPlayerStatusEffects() {
  if (!player.statusEffects) return;
  const logs = [];

  // 遍歷所有生效中的狀態效果
  for (const status in player.statusEffects) {
    const config = statusConfig[status];
    const turnsLeft = player.statusEffects[status];

    if (turnsLeft > 0) {
      if (config.type === 'damage') {
        let damage = 0;
        // 燃燒是根據攻擊力，其他是根據最大 HP
        if (status === 'burn') {
            damage = Math.floor(player.totalStats.atk * config.damage);
        } else {
            damage = Math.floor(player.totalStats.hp * config.damage);
        }
        player.currentHP -= damage;
        logs.push(config.logText(damage));
      }
      // 其他狀態類型（如 debuff）可以在這裡添加邏輯
      
      player.statusEffects[status]--;

      // 如果狀態回合數歸零，紀錄結束訊息並刪除
      if (player.statusEffects[status] <= 0) {
        if (config.logTextEnd) {
          logs.push(config.logTextEnd());
        }
        delete player.statusEffects[status];
      }
    }
  }

  // 處理狀態冷卻時間的遞減
  if (player.statusCooldown) {
    for (const status in player.statusCooldown) {
      if (player.statusCooldown[status] > 0) {
        player.statusCooldown[status]--;
        if (player.statusCooldown[status] <= 0) {
          delete player.statusCooldown[status];
        }
      }
    }
  }

  // 顯示所有回合發生的狀態效果訊息
  if (logs.length > 0) {
    logPrepend(logs.join("<br>"));
  }
}
