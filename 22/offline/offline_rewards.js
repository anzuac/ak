// =======================
// offline_rewards.js
// 離線獎勵（以等級為基準）+ 彈窗領取（修正：避免 EXP 雙重倍率）
// 放在 player.js 後面載入
// =======================
(function () {
  const LS_KEY = "rpg_last_offline_ts";

  // ---- 參數（可調） ----
  const MAX_HOURS = 8;     // 本次離線最多結算幾小時
  const OFFLINE_EXP_EFF = 0.8;  // EXP 全域效率（避免離線過肥）
  const OFFLINE_EXP_CAP = 1.0;  // 單次結算 EXP 上限（相對 expToNext 的比例）

  // 強化石：8 小時最多 6000
  const OFFLINE_STONE_EFF = 0.8;
  const OFFLINE_STONE_CAP = 6000;

  // 楓幣：8 小時最多 50000
  const OFFLINE_GOLD_EFF = 0.8;
  const OFFLINE_GOLD_CAP = 50000;

  // EXP 每小時基準（依等級區間）
  const OFFLINE_EXP_RATES = [
    { min: 1,  max: 10,  rate: 0.050 }, // 5%/h
    { min: 11, max: 20,  rate: 0.030 }, // 3%/h
    { min: 21, max: 30,  rate: 0.020 }, // 2%/h
    { min: 31, max: 40,  rate: 0.010 }, // 1%/h
    { min: 41, max: 50,  rate: 0.006 }, // 0.6%/h
    { min: 51, max: 60,  rate: 0.003 }, // 0.3%/h
    { min: 61, max: 70,  rate: 0.0015 },// 0.15%/h
    { min: 71, max: 100, rate: 0.0008 },// 0.08%/h
  ];

  // 每小時基礎掉落（等級可微調）
  function offlineStoneBase(level) { return 20 + level * 5; }
  function offlineGoldBase(level)  { return 200 + level * 30; }

  function getExpRateByLevel(level) {
    for (var i=0;i<OFFLINE_EXP_RATES.length;i++){
      var r = OFFLINE_EXP_RATES[i];
      if (level >= r.min && level <= r.max) return r.rate;
    }
    return 0.005; // fallback
  }

  // ---- 計算核心（已移除 EXP 的倍率相乘，避免與 gainExp 重複）----
  function calcOfflineReward(level, hours) {
    hours = Math.max(0, Math.min(MAX_HOURS, hours || 0));
    if (hours <= 0) return { exp: 0, stones: 0, gold: 0, hours: 0 };

    var expToNext = (typeof getExpToNext === "function") ? getExpToNext(level) : 1000;

    // 玩家加成（石頭/金幣仍可吃）
    var dropRateBonus = Number(window.player && window.player.dropRateBonus || 0);
    var goldRateBonus = Number(window.player && window.player.goldRateBonus || 0);

    // EXP（不乘 expRateBonus，避免雙重）
    var rate = getExpRateByLevel(level);
    var expGain = expToNext * rate * hours * OFFLINE_EXP_EFF;
    expGain = Math.min(expGain, expToNext * OFFLINE_EXP_CAP);

    // Stones
    var stones = offlineStoneBase(level) * hours * OFFLINE_STONE_EFF;
    stones *= (1 + dropRateBonus);
    stones = Math.min(stones, OFFLINE_STONE_CAP);

    // Gold
    var gold = offlineGoldBase(level) * hours * OFFLINE_GOLD_EFF;
    gold *= (1 + goldRateBonus);
    gold = Math.min(gold, OFFLINE_GOLD_CAP);

    return {
      exp: Math.floor(expGain),
      stones: Math.floor(stones),
      gold: Math.floor(gold),
      hours: hours
    };
  }

  // ---- 入庫（修正：EXP 直接用 raw 流程，不走 gainExp 以避免倍率加成）----
  function grantRawExp(amount){
    amount = Math.max(0, Math.floor(Number(amount)||0));
    if (!amount) return;
    if (!window.player) return;

    // 這段是「不乘倍率的升級流程」，參考你的 gainExp，但去掉 (1+expRateBonus)
    var p = window.player;
    p.exp = Math.round((p.exp || 0) + amount);

    // while 升級
    if (typeof getExpToNext !== "function") return;
    while (p.level < (window.MAX_LEVEL || 200)) {
      var need = getExpToNext(p.level);
      if (p.exp < need) break;
      p.exp -= need;
      // 觸發你的升級流程
      if (typeof window.levelUp === "function") {
        window.levelUp();
      } else {
        // 簡化保底（若沒 levelUp）
        p.level++;
        p.expToNext = getExpToNext(p.level);
      }
    }
  }

  function grantRewards(r) {
    try {
      if (r.exp > 0) {
        // 👉 不使用 gainExp，避免再乘以 expRateBonus
        grantRawExp(r.exp);
      }
      if (r.stones > 0) {
        if (typeof window.addStone === "function") {
          window.addStone(r.stones);
        } else {
          window.player.stone = (window.player.stone || 0) + r.stones;
        }
      }
      if (r.gold > 0) {
        window.player.gold = (window.player.gold || 0) + r.gold;
      }
    } finally {
      if (typeof window.updateResourceUI === "function") window.updateResourceUI();
    }
  }

  // ---- 彈窗 UI ----
  function fmt(n) { return Number(n || 0).toLocaleString(); }

  function showModal(reward) {
    // 背景
    var backdrop = document.createElement("div");
    backdrop.id = "offlineBackdrop";
    backdrop.style.position = "fixed";
    backdrop.style.left = 0;
    backdrop.style.top = 0;
    backdrop.style.width = "100vw";
    backdrop.style.height = "100vh";
    backdrop.style.background = "rgba(0,0,0,0.6)";
    backdrop.style.zIndex = 9998;

    // 視窗
    var box = document.createElement("div");
    box.id = "offlineModal";
    box.style.position = "fixed";
    box.style.left = "50%";
    box.style.top = "20vh";
    box.style.transform = "translateX(-50%)";
    box.style.width = "92vw";
    box.style.maxWidth = "360px";
    box.style.background = "#1a1a2e";
    box.style.color = "#fff";
    box.style.border = "1px solid #5c628e";
    box.style.borderRadius = "10px";
    box.style.padding = "14px";
    box.style.zIndex = 9999;
    box.style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)";
    box.style.fontSize = "13px";

    var title = document.createElement("div");
    title.textContent = "離線獎勵結算";
    title.style.fontSize = "16px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "8px";
    title.style.borderBottom = "1px solid #444";
    title.style.paddingBottom = "6px";

    var lv = (window.player && window.player.level) || 1;

    var tip = document.createElement("div");
    tip.innerHTML = '你離線了 <b>' + reward.hours.toFixed(2) + '</b> 小時（最多結算 '+MAX_HOURS+' 小時）';

    var list = document.createElement("div");
    list.style.margin = "8px 0 12px 0";
    list.innerHTML =
      '<div>🔹 EXP：<b>'+ fmt(reward.exp) +'</b></div>'+
      '<div>🔹 強化石：<b>'+ fmt(reward.stones) +'</b>（8h 上限 '+ fmt(OFFLINE_STONE_CAP) +'）</div>'+
      '<div>🔹 楓幣：<b>'+ fmt(reward.gold) +'</b>（8h 上限 '+ fmt(OFFLINE_GOLD_CAP) +'）</div>'+
      '<div style="opacity:.8;margin-top:6px;">（等級 '+ lv +' 的基準計算，EXP 已避免與線上倍率重複）</div>';

    var btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "8px";

    var ok = document.createElement("button");
    ok.textContent = "領取";
    ok.style.flex = 1;
    ok.style.padding = "8px";
    ok.style.background = "#6a6ad0";
    ok.style.color = "#fff";
    ok.style.border = "none";
    ok.style.borderRadius = "6px";
    ok.style.cursor = "pointer";
    ok.onclick = function(){
      grantRewards(reward);
      cleanup();
    };

    var cancel = document.createElement("button");
    cancel.textContent = "關閉";
    cancel.style.flex = 1;
    cancel.style.padding = "8px";
    cancel.style.background = "#444";
    cancel.style.color = "#fff";
    cancel.style.border = "none";
    cancel.style.borderRadius = "6px";
    cancel.style.cursor = "pointer";
    cancel.onclick = cleanup;

    btnRow.appendChild(ok);
    btnRow.appendChild(cancel);

    box.appendChild(title);
    box.appendChild(tip);
    box.appendChild(list);
    box.appendChild(btnRow);

    document.body.appendChild(backdrop);
    document.body.appendChild(box);

    function cleanup(){
      try { box.remove(); } catch(_){}
      try { backdrop.remove(); } catch(_){}
      localStorage.setItem(LS_KEY, Date.now().toString());
    }
  }

  // ---- 初始化：進遊戲時檢查 ----
  function checkAndShow() {
    // player 未準備好 → 稍後再試
    if (!window.player || typeof window.player.level !== "number") {
      setTimeout(checkAndShow, 200);
      return;
    }

    var now = Date.now();
    var last = Number(localStorage.getItem(LS_KEY) || 0);

    // 首次啟動：只記時間，不結算
    if (!last) {
      localStorage.setItem(LS_KEY, now.toString());
      return;
    }

    var diffSec = Math.max(0, (now - last) / 1000);
    // 少於 60 秒不彈（避免刷新頁面狂跳）
    if (diffSec < 60) {
      localStorage.setItem(LS_KEY, now.toString());
      return;
    }

    var hours = diffSec / 3600;
    var reward = calcOfflineReward(window.player.level || 1, hours);

    if ((reward.exp|0) + (reward.stones|0) + (reward.gold|0) <= 0) {
      localStorage.setItem(LS_KEY, now.toString());
      return;
    }

    showModal(reward);
  }

  // 手動測試：OfflineRewards.test(3) → 模擬 3 小時
  window.OfflineRewards = {
    test: function(hours){
      hours = Number(hours)||1;
      var r = calcOfflineReward(window.player && window.player.level || 1, hours);
      showModal(r);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAndShow);
  } else {
    checkAndShow();
  }
})();