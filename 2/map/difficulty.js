// map/difficulty.js
(function () {
  // 預設倍率（全部是數字，避免 NaN）
  const DEFAULTS = {
    hp: 1, atk: 1, def: 1, exp: 1, gold: 1, stone: 1, item: 1, // 新增 'item' (其他道具) 倍率
    eliteChance: 0.10,                // 精英機率 10%
  };

  // 難度表：這裡的倍率已根據您的要求精確調整
  const PRESET = {
    simple:  { label: "簡單", hp:1,   atk:1,   def:1,   exp:1,   gold:1,   stone:1,   item:1,   eliteChance:0.10 },
    normal:  { label: "普通", hp:1.5, atk:1.5, def:1.5, exp:1.2, gold:1.1, stone:1,   item:1.1, eliteChance:0.10 }, // 新增普通難度
    hard:    { label: "困難", hp:2,   atk:2,   def:2,   exp:1.25,gold:1.25,stone:1,   item:1.2, eliteChance:0.15 },
    hell:    { label: "地獄", hp:3,   atk:3,   def:3,   exp:1.5, gold:1.5, stone:1,   item:1.4, eliteChance:0.18 },
    nightmare:{label: "噩夢", hp:4,   atk:4,   def:4,   exp:1.75,gold:1.75,stone:1,   item:1.6, eliteChance:0.20 },
    nightmare:{label: "？？？", hp:400,   atk:400,   def:400,   exp:175,gold:175,stone:1,   item:1.6, eliteChance:1 },
  };

  let currentKey = "simple"; // 預設難度設定為 "簡單"

  // 對外：取得目前難度倍率（會與 DEFAULTS 合併，確保每個欄位都有數字）
  window.getCurrentDifficulty = function () {
    const p = PRESET[currentKey] || PRESET.simple; // 如果找不到，預設為 simple
    return {
      hp: +p.hp || DEFAULTS.hp,
      atk: +p.atk || DEFAULTS.atk,
      def: +p.def || DEFAULTS.def,
      exp: +p.exp || DEFAULTS.exp,
      gold: +p.gold || DEFAULTS.gold,
      stone: +p.stone || DEFAULTS.stone,
      item: +p.item || DEFAULTS.item, // 確保 item 倍率也包含在內
      eliteChance: +p.eliteChance || DEFAULTS.eliteChance,
    };
  };

  // 對外：初始化下拉式選單 UI（將選項塞入 HTML 中的 #difficultySelect 元素）
  window.initDifficultyUI = function () {
    const sel = document.getElementById("difficultySelect");
    if (!sel) return; // 如果找不到元素就返回

    sel.innerHTML = ""; // 清空現有選項
    for (const key of Object.keys(PRESET)) {
      const opt = document.createElement("option"); // 創建新的選項元素
      opt.value = key; // 設定選項的值 (例如 "normal", "hard")
      opt.textContent = PRESET[key].label; // 設定選項顯示的文字 (例如 "簡單", "困難")
      if (key === currentKey) opt.selected = true; // 如果是當前難度，則設為預選
      sel.appendChild(opt); // 將選項加入下拉式選單
    }
    sel.onchange = (e) => { // 監聽下拉式選單的變化事件
      currentKey = e.target.value || "simple"; // 更新當前難度，如果值為空則預設為 "simple"
      // 如果需要，可以在這裡呼叫您的 UI 更新函數，讓介面立即反映難度變化
      // 例如： updateMonsterInfo?.(currentMonster, monsterHP);
    };
  };

  // 當 DOM 內容完全載入後，自動初始化難度下拉式選單
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDifficultyUI);
  } else {
    initDifficultyUI(); // 如果 DOM 已經準備好，則立即執行
  }
})();

window.setDifficultySelectDisabled = function (disabled) {
  const sel = document.getElementById("difficultySelect");
  if (sel) sel.disabled = !!disabled;
};