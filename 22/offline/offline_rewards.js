// =======================
// offline_rewards.js
// 離線獎勵（以等級為基準）+ 彈窗領取
// 放在 player.js 後面載入
// =======================
(function () {
  const LS_KEY = "rpg_last_offline_ts";

  // ---- 參數（可調） ----
  const MAX_HOURS = 8; // 本次離線最多結算 8 小時
  const OFFLINE_EXP_EFF = 0.8;  // EXP 全域效率（避免離線過肥）
  const OFFLINE_EXP_CAP = 1.0;  // 每次結算的 EXP 上限（相對 expToNext 的比例）

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
    for (const r of OFFLINE_EXP_RATES) {
      if (level >= r.min && level <= r.max) return r.rate;
    }
    return 0.005; // fallback
  }

  // ---- 計算核心 ----
  function calcOfflineReward(level, hours) {
    hours = Math.max(0, Math.min(MAX_HOURS, hours || 0));
    if (hours <= 0) return { exp: 0, stones: 0, gold: 0 };

    const expToNext = (typeof getExpToNext === "function") ? getExpToNext(level) : 1000;

    // 取加成（沒有就當 0）
    const expRateBonus  = Number(window.player?.expRateBonus  || 0);
    const dropRateBonus = Number(window.player?.dropRateBonus || 0);
    const goldRateBonus = Number(window.player?.goldRateBonus || 0);

    // EXP
    const rate = getExpRateByLevel(level);
    let expGain = expToNext * rate * hours * OFFLINE_EXP_EFF;
    expGain *= (1 + expRateBonus);
    expGain = Math.min(expGain, expToNext * OFFLINE_EXP_CAP);

    // Stones
    let stones = offlineStoneBase(level) * hours * OFFLINE_STONE_EFF;
    stones *= (1 + dropRateBonus);
    stones = Math.min(stones, OFFLINE_STONE_CAP);

    // Gold
    let gold = offlineGoldBase(level) * hours * OFFLINE_GOLD_EFF;
    gold *= (1 + goldRateBonus);
    gold = Math.min(gold, OFFLINE_GOLD_CAP);

    return {
      exp: Math.floor(expGain),
      stones: Math.floor(stones),
      gold: Math.floor(gold),
      hours: hours
    };
  }

  // ---- 入庫（找得到你的函式則用，否則回退）----
  function grantRewards(r) {
    try {
      if (r.exp > 0) {
        if (typeof window.gainExp === "function") {
          window.gainExp(r.exp);
        } else {
          window.player.exp = (window.player.exp || 0) + r.exp;
        }
      }
      if (r.stones > 0) {
        if (typeof window.addStone === "function") {
          window.addStone(r.stones);
        } else {
          window.player.stone = (window.player.stone || 0) + r.stones;
        }
      }
      if (r.gold > 0) {
        // 不用 addGoldFromKill（避免戰鬥倍率）；直接加金
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
    const backdrop = document.createElement("div");
    backdrop.id = "offlineBackdrop";
    Object.assign(backdrop.style, {
      position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh",
      background: "rgba(0,0,0,0.6)", zIndex: 9998
    });

    // 視窗
    const box = document.createElement("div");
    box.id = "offlineModal";
    Object.assign(box.style, {
      position: "fixed", left: "50%", top: "20vh", transform: "translateX(-50%)",
      width: "92vw", maxWidth: "360px", background: "#1a1a2e", color: "#fff",
      border: "1px solid #5c628e", borderRadius: "8px", padding: "14px", zIndex: 9999,
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)", fontSize: "13px"
    });

    const title = document.createElement("div");
    title.textContent = "離線獎勵結算";
    Object.assign(title.style, { fontSize: "16px", fontWeight: "bold", marginBottom: "8px", borderBottom: "1px solid #444", paddingBottom: "6px" });

    const lv = window.player?.level || 1;
    const tip = document.createElement("div");
    tip.innerHTML = `你離線了 <b>${reward.hours.toFixed(2)}</b> 小時（最多結算 ${MAX_HOURS} 小時）`;

    const list = document.createElement("div");
    list.style.margin = "8px 0 12px 0";
    list.innerHTML = `
      <div>🔹 EXP：<b>${fmt(reward.exp)}</b></div>
      <div>🔹 強化石：<b>${fmt(reward.stones)}</b>（8h 上限 ${fmt(OFFLINE_STONE_CAP)}）</div>
      <div>🔹 楓幣：<b>${fmt(reward.gold)}</b>（8h 上限 ${fmt(OFFLINE_GOLD_CAP)}）</div>
      <div style="opacity:.8;margin-top:6px;">（等級 ${lv} 的基準計算，已套用你的加成率）</div>
    `;

    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, { display: "flex", gap: "8px", marginTop: "8px" });

    const ok = document.createElement("button");
    ok.textContent = "領取";
    Object.assign(ok.style, { flex: 1, padding: "8px", background: "#6a6ad0", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" });
    ok.onclick = () => {
      grantRewards(reward);
      cleanup();
    };

    const cancel = document.createElement("button");
    cancel.textContent = "關閉";
    Object.assign(cancel.style, { flex: 1, padding: "8px", background: "#444", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" });
    cancel.onclick = cleanup;

    btnRow.appendChild(ok);
    btnRow.appendChild(cancel);

    box.appendChild(title);
    box.appendChild(tip);
    box.appendChild(list);
    box.appendChild(btnRow);

    document.body.appendChild(backdrop);
    document.body.appendChild(box);

    function cleanup() {
      try { box.remove(); } catch {}
      try { backdrop.remove(); } catch {}
      // 領或關都刷新一次 lastSeen
      localStorage.setItem(LS_KEY, Date.now().toString());
    }
  }

  // ---- 初始化：進遊戲時檢查 ----
  function checkAndShow() {
    // 基本條件
    if (!window.player || typeof window.player.level !== "number") {
      // player 還沒準備好，稍後再試
      setTimeout(checkAndShow, 200);
      return;
    }

    const now = Date.now();
    const last = Number(localStorage.getItem(LS_KEY) || 0);
    // 首次啟動：只記時間，不結算
    if (!last) {
      localStorage.setItem(LS_KEY, now.toString());
      return;
    }

    const diffSec = Math.max(0, (now - last) / 1000);
    // 少於 60 秒就不彈（避免刷新頁面狂跳）
    if (diffSec < 60) {
      localStorage.setItem(LS_KEY, now.toString());
      return;
    }

    const hours = diffSec / 3600;
    const reward = calcOfflineReward(window.player.level || 1, hours);
    if (reward.exp + reward.stones + reward.gold <= 0) {
      // 沒有可領
      localStorage.setItem(LS_KEY, now.toString());
      return;
    }

    showModal(reward);
  }

  // 供你手動測試：OfflineRewards.test(3) → 模擬 3 小時
  window.OfflineRewards = {
    test(hours = 1) {
      const r = calcOfflineReward(window.player?.level || 1, hours);
      showModal(r);
    }
  };

  // 等頁面可用就跑
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAndShow);
  } else {
    checkAndShow();
  }
})();