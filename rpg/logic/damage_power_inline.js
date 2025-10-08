// damage_power_inline.js — 主頁顯示「傷害力區間」+ 可縮到右邊的最小化
(function (w) {
  "use strict";

  var LS_KEY = "DMG_CARD_COLLAPSED_V1";

  function fmt(n){ return (Number(n)||0).toLocaleString(); }

  // 讀取戰鬥最後浮動設定（和 _applyDamageVariance 同步）
  function readJitter() {
    try {
      if (typeof w.DAMAGE_JITTER_PCT === "number" && w.DAMAGE_JITTER_PCT >= 0) {
        return w.DAMAGE_JITTER_PCT; // 0~1
      }
    } catch(_) {}
    return 0.12; // fallback
  }

  // 讀取最終攻擊力
  function readAtk() {
    try { return Math.max(0, Math.floor(w.player?.totalStats?.atk || 0)); }
    catch (_) { return 0; }
  }

  // 注入樣式（含縮小樣式）
  function ensureStyle() {
    if (document.getElementById("dmgPowerCardStyle")) return;
    var s = document.createElement("style");
    s.id = "dmgPowerCardStyle";
    s.textContent = `
      #dmgPowerCard{
        position:fixed;right:14px;bottom:80px;z-index:9998;
        background:#0b1220;color:#e5e7eb;border:1px solid #1f2937;
        border-radius:12px;padding:10px 12px;min-width:220px;
        font:13px/1.5 system-ui,Segoe UI,Roboto,Arial,sans-serif;
        box-shadow:0 8px 24px rgba(0,0,0,.35);
        transition: transform .18s ease, opacity .18s ease, right .18s ease, bottom .18s ease, width .18s ease, padding .18s ease;
      }
      #dmgPowerCard .dmg-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;}
      #dmgPowerCard .dmg-title{display:flex;align-items:center;gap:6px;font-weight:800;letter-spacing:.2px}
      #dmgPowerCard .dmg-toggle{
        background:#111827;border:1px solid #374151;color:#9ca3af;border-radius:8px;
        padding:2px 6px;cursor:pointer;font-size:12px;line-height:1;
      }
      #dmgPowerCard.collapsed{
        right:-2px; padding:6px 8px; min-width:auto; width:auto;
      }
      #dmgPowerCard.collapsed .dmg-body{ display:none; }
      #dmgPowerCard.collapsed .dmg-title b{ display:none; }
      #dmgPowerCard.collapsed .dmg-toggle{ opacity:.85; }
      #dmgPowerCard .dmg-pill{
        display:inline-flex;align-items:center;justify-content:center;
        width:22px;height:22px;border-radius:999px;background:#111827;border:1px solid #374151;
        font-size:13px;
      }
    `;
    document.head.appendChild(s);
  }

  // 建立 UI 卡片
  function ensureCard() {
    ensureStyle();
    var card = document.getElementById("dmgPowerCard");
    if (card) return card;

    card = document.createElement("div");
    card.id = "dmgPowerCard";
    card.innerHTML = `
      <div class="dmg-head">
        <div class="dmg-title">
          <span class="dmg-pill">⚔️</span>
          <b>傷害力（不含怪物防禦）</b>
        </div>
        <button class="dmg-toggle" title="縮小/展開">⟷</button>
      </div>
      <div class="dmg-body">
        <div id="dmgPowerMain" style="font-weight:700;">—</div>
        <div id="dmgPowerSub" style="font-size:12px;opacity:.8;">—</div>
      </div>
    `;
    document.body.appendChild(card);

    // 綁定縮小/展開
    var btn = card.querySelector(".dmg-toggle");
    btn.addEventListener("click", toggleCollapse);
    // 也允許點整個 header 的左邊區塊來切換
    card.querySelector(".dmg-title").addEventListener("click", toggleCollapse);

    // 恢復上次狀態
    var saved = localStorage.getItem(LS_KEY);
    if (saved === "1") card.classList.add("collapsed");

    return card;
  }

  function isCollapsed() {
    var card = document.getElementById("dmgPowerCard");
    return !!(card && card.classList.contains("collapsed"));
  }

  function toggleCollapse() {
    var card = ensureCard();
    card.classList.toggle("collapsed");
    localStorage.setItem(LS_KEY, card.classList.contains("collapsed") ? "1" : "0");
  }

  function render() {
    var atk = readAtk();
    var pct = readJitter();
    var min = Math.floor(atk * (1 - pct));
    var max = Math.floor(atk * (1 + pct));

    var card = ensureCard();
    var main = card.querySelector("#dmgPowerMain");
    var sub  = card.querySelector("#dmgPowerSub");

    if (atk <= 0) {
      if (main) main.textContent = "ATK — → — ~ —";
      if (sub)  sub.textContent  = "(浮動 ±" + (pct * 100).toFixed(1) + "%)";
      return;
    }

    if (main) main.innerHTML = `ATK ${fmt(atk)} → <b>${fmt(min)} ~ ${fmt(max)}</b>`;
    
  }

  // 每秒更新一次
  var _timer = null;
  function start() {
    render();
    if (_timer) clearInterval(_timer);
    _timer = setInterval(render, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  // 對外
  w.refreshDamagePowerCard = render;
  w.toggleDamagePowerCard  = toggleCollapse;

})(window);