// damage_power_inline.js — 主頁顯示「傷害力區間」+ 可縮到右邊的最小化
// ✅ 與戰鬥同源：浮動使用 window.DAMAGE_JITTER_PCT（fallback ±10%）
// ✅ 顯示「總傷害 %」，並先乘總傷後再做浮動（符合新戰鬥流程）
// ✅ 額外顯示「含怪防（估）」：使用 window.currentMonster.def + 玩家穿防（ignoreDefPct）推估，貼近實戰
(function(w) {
  "use strict";

  var LS_KEY = "DMG_CARD_COLLAPSED_V1";

  function fmt(n) { return (Number(n) || 0).toLocaleString(); }

  // 與 Rpg_玩家.js 的 _applyDamageVariance 一致：讀取全域浮動百分比
  function readJitter() {
    try {
      if (typeof w.DAMAGE_JITTER_PCT === "number" && w.DAMAGE_JITTER_PCT >= 0) {
        return w.DAMAGE_JITTER_PCT; // 0~1（例：0.10 = ±10%）
      }
    } catch (_) {}
    return 0.10; // 預設 ±10%
  }

  // 讀取最終攻擊力（不含怪防）
  function readAtk() {
    try { return Math.max(0, Math.floor(w.player?.totalStats?.atk || 0)); }
    catch (_) { return 0; }
  }

  // 讀取總傷害（小數）
  function readTotalDamage() {
    try { return Number(w.player?.totalStats?.totalDamage) || 0; }
    catch (_) { return 0; }
  }

  // 讀取穿防％（小數）
  function readIgnoreDefPct() {
    try { return Math.max(0, Math.min(1, Number(w.player?.totalStats?.ignoreDefPct) || 0)); }
    catch (_) { return 0; }
  }

  // 讀取目前戰鬥怪物資訊（若有）
  function readMonsterInfo() {
    var m = w.currentMonster || null;
    if (!m) return { name: "", def: 0, shield: 0 };
    var name = (typeof m.name === 'string' ? m.name : '') || '';
    var def = Math.max(0, Math.floor(Number(m.def) || 0));
    var shield = Math.max(0, Math.floor(Number(m.shield) || 0));
    return { name: name, def: def, shield: shield };
  }

  // 注入樣式（含縮小樣式）
  function ensureStyle() {
    if (document.getElementById("dmgPowerCardStyle")) return;
    var s = document.createElement("style");
    s.id = "dmgPowerCardStyle"; // 修正筆誤
    s.textContent = `
      #dmgPowerCard{
        position:fixed;right:14px;bottom:80px;z-index:9998;
        background:#0b1220;color:#e5e7eb;border:1px solid #1f2937;
        border-radius:12px;padding:10px 12px;min-width:240px;
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
      #dmgPowerCard.collapsed{ right:-2px; padding:6px 8px; min-width:auto; width:auto; }
      #dmgPowerCard.collapsed .dmg-body{ display:none; }
      #dmgPowerCard.collapsed .dmg-title b{ display:none; }
      #dmgPowerCard.collapsed .dmg-toggle{ opacity:.85; }
      #dmgPowerCard .dmg-pill{
        display:inline-flex;align-items:center;justify-content:center;
        width:22px;height:22px;border-radius:999px;background:#111827;border:1px solid #374151;
        font-size:13px;
      }
      #dmgPowerSub{ font-size:12px;opacity:.85; }
      #dmgPowerHint{ font-size:11px;opacity:.6;margin-top:4px; }
      #dmgPowerDef{ font-size:12px;opacity:.9;margin-top:4px; }
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
        <div id="dmgPowerSub">—</div>
        <div id="dmgPowerDef"></div>
        <div id="dmgPowerHint">（總傷害與末端浮動已套用；上列不含怪防/護盾）</div>
      </div>
    `;
    document.body.appendChild(card);

    // 綁定縮小/展開
    var btn = card.querySelector(".dmg-toggle");
    btn.addEventListener("click", toggleCollapse);
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
    var td  = readTotalDamage();
    var pct = readJitter();
    var pen = readIgnoreDefPct();            // 穿防（小數）
    var mon = readMonsterInfo();

    // 依照新戰鬥流程：ATK × (1+TD) → 浮動
    var tdMul = 1 + td;
    var atkAfterTD = Math.floor(atk * tdMul);

    var minNoDef = Math.floor(atkAfterTD * (1 - pct));
    var maxNoDef = Math.floor(atkAfterTD * (1 + pct));

    // 含怪防（推估，不含暴擊/護盾；吃穿防％）
    var defEff = Math.max(0, Math.floor(mon.def * (1 - pen))); // 有效防禦
    var minWithDef = Math.max(minNoDef - defEff, 1);
    var maxWithDef = Math.max(maxNoDef - defEff, 1);

    var card = ensureCard();
    var main = card.querySelector("#dmgPowerMain");
    var sub  = card.querySelector("#dmgPowerSub");
    var defL = card.querySelector("#dmgPowerDef");

    if (atk <= 0) {
      if (main) main.textContent = "ATK — → — ~ —";
      if (sub)  sub.textContent  = "總傷 +0.0% · 穿防 0.0% · 浮動 ±" + (pct * 100).toFixed(1) + "%";
      if (defL) defL.textContent = "";
      return;
    }

    if (main) main.innerHTML = `ATK ${fmt(atk)} → <b>${fmt(minNoDef)} ~ ${fmt(maxNoDef)}</b>`;
    if (sub)  sub.textContent  = `總傷 +${(td * 100).toFixed(1)}% · 穿防 ${(pen * 100).toFixed(1)}% · 浮動 ±${(pct * 100).toFixed(1)}%`;

    if (defL) {
      if (mon.def > 0) {
        var namePart = mon.name ? `（${mon.name}）` : "";
        var shieldPart = mon.shield > 0 ? ` · 護盾 ${fmt(mon.shield)}` : "";
        defL.innerHTML = `含怪防估：<b>${fmt(minWithDef)} ~ ${fmt(maxWithDef)}</b> · DEF ${fmt(mon.def)} → 有效 ${fmt(defEff)}${shieldPart} ${namePart}`;
      } else {
        defL.textContent = "";
      }
    }
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