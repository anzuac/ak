// sp_system.js — SP點數加成（寫入 coreBonus.bonusData.sp）
// UI：這支檔案只建立彈窗，不新增入口按鈕。請在你的 UI 上自己綁 openSpModal()。

(function (w) {
  "use strict";

  // ===== 設定 =====
  const STORAGE_KEY = "sp.v1";
  const RESET_COST_GEMS = 300;
  const AUTO_SAVE_AFTER_CHANGE = true;

  const REDEEM_ITEM_ID = "sp點數券";
  const REDEEM_POINTS_PER_ITEM = 1;

  // 數值點數上限
  const STAT_LIMITS = {
    hp: 2000, 
    mp: 200, 
    atk: 2000, 
    def: 2000,
    crit: 100, 
    critDmg: 100, 
    aspd: 100,
    exp: 200, 
    drop: 200,
    gold: 200,
  };

  // 百分比點數上限（每點是固定%數，見 PERCENT_BONUS_PER_POINT）
  const PERCENT_LIMITS = { 
    hp: 300, 
    mp: 100, 
    atk: 300, 
    def: 200 };

  // 顯示名稱
  const NAMES = {
    hp: "HP", mp: "MP", atk: "攻擊力", def: "防禦力",
    crit: "爆擊率", critDmg: "爆擊傷害", aspd: "攻擊速度",
    exp: "經驗值", drop: "掉落率", gold: "金幣掉落率",
  };
  const PERCENT_NAMES = { hp: "HP%", mp: "MP%", atk: "攻擊力%", def: "防禦力%" };

  // 固定（與職業無關）的每點效益
  const FIXED_POINTS_BONUS = {
    atk: 5,
    def: 3,
    crit: 0.001,     // +0.1% / 點
    critDmg: 0.002,  // +0.2% / 點
    aspd: 0.0005,    // +0.05 / 點
    exp: 0.005,       // +0.5% / 點
    drop: 0.005,      // +0.5% / 點
    gold: 0.005,      // +0.5% / 點
  };

  // 百分比效益（每點提供的%數；用來「放大自己用 SP 投資的數值」）
  const PERCENT_BONUS_PER_POINT = {
    hp: 0.01, 
    mp: 0.01, 
    atk: 0.01, 
    def: 0.01,  // 每點 +1%
  };

  // 取得父系職業（保險版）
  function getBaseJobSafeLocal(job) {
    const j = String(job || "").toLowerCase();
    if (typeof w.getBaseJob === "function") return w.getBaseJob(j);
    return j.replace(/\d+$/, ""); // mage5 -> mage
  }

  // 依父系職業決定 HP/MP 每點效益
  function getDynamicPointsBonus() {
    const baseJob = getBaseJobSafeLocal(w.player?.job);
    let hpPerPoint = 20, mpPerPoint = 2; // 預設
    if (baseJob === "warrior") { hpPerPoint = 10; mpPerPoint = 3; }
    else if (baseJob === "mage") { hpPerPoint = 40; mpPerPoint = 1; }
    else if (baseJob === "thief" || baseJob === "archer") { hpPerPoint = 20; mpPerPoint = 2; }
    return { hpPerPoint, mpPerPoint };
  }

  // ===== 內部狀態 =====
  const SP = {
    total: 0,
    unspent: 0,
    // 數值型投資（flat）
    stats: { hp:0, mp:0, atk:0, def:0, crit:0, critDmg:0, aspd:0, exp:0, drop:0, gold:0 },
    // 百分比投資（percent）
    percents: { hp:0, mp:0, atk:0, def:0 }
  };

  // ===== 計算：回傳 flat / percent / total（四大屬性），其他為純數值 =====
  function computeCoreBonusFromPoints(points, percents) {
    const PB = getDynamicPointsBonus();
    const FX = FIXED_POINTS_BONUS;
    const PCT = PERCENT_BONUS_PER_POINT;

    // 先算數值點數的加值（這是「SP 直加的量」）
    const hpFromSp  = (points.hp  || 0) * (PB.hpPerPoint || 0);
    const mpFromSp  = (points.mp  || 0) * (PB.mpPerPoint || 0);
    const atkFromSp = (points.atk || 0) * (FX.atk || 0);
    const defFromSp = (points.def || 0) * (FX.def || 0);

    // 百分比放大：只放大「自己投資的 SP 量」
    const hpPercent  = Math.floor(hpFromSp  * ((percents.hp  || 0) * (PCT.hp  || 0)));
    const mpPercent  = Math.floor(mpFromSp  * ((percents.mp  || 0) * (PCT.mp  || 0)));
    const atkPercent = Math.floor(atkFromSp * ((percents.atk || 0) * (PCT.atk || 0)));
    const defPercent = Math.floor(defFromSp * ((percents.def || 0) * (PCT.def || 0)));

    return {
      hp:  { flat: hpFromSp,  percent: hpPercent,  total: hpFromSp  + hpPercent },
      mp:  { flat: mpFromSp,  percent: mpPercent,  total: mpFromSp  + mpPercent },
      atk: { flat: atkFromSp, percent: atkPercent, total: atkFromSp + atkPercent },
      def: { flat: defFromSp, percent: defPercent, total: defFromSp + defPercent },

      // 其餘屬性：維持你原規則（每點固定）
      critRate:       (points.crit || 0)    * (FX.crit || 0),
      critMultiplier: (points.critDmg || 0) * (FX.critDmg || 0),
      attackSpeedPct: (points.aspd || 0)    * (FX.aspd || 0),
      expBonus:       (points.exp  || 0)    * (FX.exp  || 0),
      dropBonus:      (points.drop || 0)    * (FX.drop || 0),
      goldBonus:      (points.gold || 0)    * (FX.gold || 0),
    };
  }

  // ===== 顯示用：總能力（基礎 + SP + SP%）=====
  function computeTotalStats() {
    const total = w.player?.totalStats || {};
    const c = computeCoreBonusFromPoints(SP.stats, SP.percents);

    return {
      hp:   { base: Number(total.hp || 0),  flat: c.hp.flat,  percent: c.hp.percent,  bonus: c.hp.total },
      mp:   { base: Number(total.mp || 0),  flat: c.mp.flat,  percent: c.mp.percent,  bonus: c.mp.total },
      atk:  { base: Number(total.atk || 0), flat: c.atk.flat, percent: c.atk.percent, bonus: c.atk.total },
      def:  { base: Number(total.def || 0), flat: c.def.flat, percent: c.def.percent, bonus: c.def.total },

      crit:    { base: Number(total.critRate || 0),       bonus: c.critRate },
      critDmg: { base: Number(total.critMultiplier || 0), bonus: c.critMultiplier },
      aspd:    { base: Number(total.attackSpeedPct || 0), bonus: c.attackSpeedPct },
      exp:     { base: Number((w.player?.expRateBonus)  || 0), bonus: c.expBonus  },
      drop:    { base: Number((w.player?.dropRateBonus) || 0), bonus: c.dropBonus },
      gold:    { base: Number((w.player?.goldRateBonus) || 0), bonus: c.goldBonus },
    };
  }

  // ===== 存檔 / 載入 =====
  function saveLocal() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(SP)); } catch(_) {}
  }
  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return;
      SP.total   = Number(obj.total)   || 0;
      SP.unspent = Number(obj.unspent) || 0;
      SP.stats   = Object.assign({ hp:0, mp:0, atk:0, def:0, crit:0, critDmg:0, aspd:0, exp:0, drop:0, gold:0 }, obj.stats || {});
      SP.percents= Object.assign({ hp:0, mp:0, atk:0, def:0 }, obj.percents || {});
    } catch(_) {}
  }

  // ===== 套用到 player（只寫 total 進 coreBonus）=====
  function applyToPlayer() {
    if (!w.player || !player.coreBonus) return;
    const c = computeCoreBonusFromPoints(SP.stats, SP.percents);
    player.coreBonus.bonusData = player.coreBonus.bonusData || {};
    player.coreBonus.bonusData.sp = {
      hp: c.hp.total, mp: c.mp.total, atk: c.atk.total, def: c.def.total,
      critRate: c.critRate, critMultiplier: c.critMultiplier,
      attackSpeedPct: c.attackSpeedPct, expBonus: c.expBonus,
      dropBonus: c.dropBonus, goldBonus: c.goldBonus
    };
    w.updateResourceUI?.();
  }

  // ===== UI =====
  let $modal, $statContent, $percentContent, $remain, $resetBtn, $totalStats, $redeemBtn, $redeemInfo;

  function ensureModal() {
    if ($modal) return;

    $modal = document.createElement("div");
    $modal.id = "spModal";
    $modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,.6);
      display: none; z-index: 99999; align-items: center; justify-content: center; padding: 16px;
    `;

    const wrap = document.createElement("div");
    wrap.style.cssText = `
      background:#1f1f1f; color:#fff; width: min(980px, 96vw); max-height: 90vh; overflow:auto;
      border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,.4); padding: 16px 16px 8px;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans TC", sans-serif;
    `;

    const header = document.createElement("div");
    header.style.cssText = `display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;`;
    header.innerHTML = `
      <div style="font-size:18px; font-weight:700;">🌟 SP 加點</div>
      <div><button id="spCloseBtn" style="background:#333; color:#fff; border:0; padding:6px 10px; border-radius:8px; cursor:pointer;">✖</button></div>
    `;

    const topBar = document.createElement("div");
    topBar.style.cssText = `display:flex; gap:16px; align-items:center; flex-wrap: wrap; margin-bottom: 10px;`;
    $remain = document.createElement("div");
    $remain.style.cssText = `font-weight:600;`;
    const tips = document.createElement("div");
    tips.style.cssText = `opacity:.8; font-size:12px;`;
    tips.textContent = "每項有上限；重置會退回全部點數，需花費 300 鑽石";
    $resetBtn = document.createElement("button");
    $resetBtn.textContent = `🔄 重置 (300💎)`;
    $resetBtn.style.cssText = `background:#a82; color:#fff; border:0; padding:6px 10px; border-radius:8px; cursor:pointer;`;
    topBar.appendChild($remain);
    topBar.appendChild(tips);
    topBar.appendChild($resetBtn);

    // 兌換 SP
    const redeemContainer = document.createElement("div");
    redeemContainer.style.cssText = `display:flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-bottom: 10px; border-top: 1px solid #333; padding-top: 10px;`;
    const redeemRow = document.createElement("div");
    redeemRow.style.cssText = `display:flex; align-items:center; gap:8px;`;
    $redeemBtn = document.createElement("button");
    $redeemBtn.textContent = `兌換 SP (1 張 ${REDEEM_ITEM_ID})`;
    $redeemBtn.style.cssText = `background:#2a8; color:#fff; border:0; padding:6px 10px; border-radius:8px; cursor:pointer;`;
    $redeemInfo = document.createElement("div");
    $redeemInfo.style.cssText = `font-size:12px; opacity:.8;`;
    redeemRow.appendChild($redeemBtn);
    redeemRow.appendChild($redeemInfo);
    redeemContainer.appendChild(redeemRow);

    const statHeader = document.createElement("h4");
    statHeader.textContent = "數值點數（每點直加）";
    statHeader.style.cssText = "margin: 0 0 10px;";

    // 數值點數表格
    $statContent = document.createElement("div");
    $statContent.style.cssText = `
      display:grid; grid-template-columns: auto 1fr auto auto; gap: 8px 12px; align-items:center;
      border-top: 1px solid #333; padding-top: 8px;
    `;

    const percentHeader = document.createElement("h4");
    percentHeader.textContent = "百分比點數（放大「自己投資的 SP 數值」）";
    percentHeader.style.cssText = "margin: 10px 0; border-top: 1px solid #333; padding-top: 8px;";

    // 百分比點數表格
    $percentContent = document.createElement("div");
    $percentContent.style.cssText = `
      display:grid; grid-template-columns: auto 1fr auto auto; gap: 8px 12px; align-items:center;
    `;

    // 表頭
    function appendHeadRow(container) {
      ["項目", "已分配", "＋1", "＋10"].forEach(n => {
        const el = document.createElement("div");
        el.style.cssText = `opacity:.7; font-size:12px;`;
        el.textContent = n;
        container.appendChild(el);
      });
    }
    appendHeadRow($statContent);
    appendHeadRow($percentContent);

    // 數值列
    function addStatRow(key) {
      const name = document.createElement("div");
      name.id = `sp-stat-name-${key}`;
      name.style.cssText = `white-space: nowrap;`;

      const val = document.createElement("div");
      val.id = `sp-stat-val-${key}`;
      val.style.cssText = `font-weight:700;`;

      const btn1 = document.createElement("button");
      btn1.textContent = "+1";
      btn1.style.cssText = `background:#333; color:#fff; border:0; padding:6px 8px; border-radius:8px; cursor:pointer;`;
      btn1.addEventListener("click", () => adjustStat(key, +1));

      const btn10 = document.createElement("button");
      btn10.textContent = "+10";
      btn10.style.cssText = `background:#333; color:#fff; border:0; padding:6px 8px; border-radius:8px; cursor:pointer;`;
      btn10.addEventListener("click", () => adjustStat(key, +10));

      $statContent.appendChild(name);
      $statContent.appendChild(val);
      $statContent.appendChild(btn1);
      $statContent.appendChild(btn10);
    }

    // 百分比列
    function addPercentRow(key) {
      const name = document.createElement("div");
      name.id = `sp-percent-name-${key}`;
      name.style.cssText = `white-space: nowrap;`;

      const val = document.createElement("div");
      val.id = `sp-percent-val-${key}`;
      val.style.cssText = `font-weight:700;`;

      const btn1 = document.createElement("button");
      btn1.textContent = "+1";
      btn1.style.cssText = `background:#333; color:#fff; border:0; padding:6px 8px; border-radius:8px; cursor:pointer;`;
      btn1.addEventListener("click", () => adjustPercent(key, +1));

      const btn10 = document.createElement("button");
      btn10.textContent = "+10";
      btn10.style.cssText = `background:#333; color:#fff; border:0; padding:6px 8px; border-radius:8px; cursor:pointer;`;
      btn10.addEventListener("click", () => adjustPercent(key, +10));

      $percentContent.appendChild(name);
      $percentContent.appendChild(val);
      $percentContent.appendChild(btn1);
      $percentContent.appendChild(btn10);
    }

    ["hp","mp","atk","def","crit","critDmg","aspd","exp","drop","gold"].forEach(addStatRow);
    ["hp","mp","atk","def"].forEach(addPercentRow);

    // 總能力
    $totalStats = document.createElement("div");
    $totalStats.style.cssText = `margin-top: 10px; padding-top: 8px; border-top: 1px solid #333;`;
    $totalStats.innerHTML = `<h4 style="margin:0 0 10px;">總能力</h4>`;

    // footer
    const footer = document.createElement("div");
    footer.style.cssText = `display:flex; justify-content:flex-end; gap: 8px; margin-top: 10px;`;
    const btnClose = document.createElement("button");
    btnClose.textContent = "關閉";
    btnClose.style.cssText = `background:#444; color:#fff; border:0; padding:8px 14px; border-radius:10px; cursor:pointer;`;
    btnClose.addEventListener("click", closeSpModal);
    footer.appendChild(btnClose);

    // 組裝
    wrap.appendChild(header);
    wrap.appendChild(topBar);
    wrap.appendChild(redeemContainer);
    wrap.appendChild(statHeader);
    wrap.appendChild($statContent);
    wrap.appendChild(percentHeader);
    wrap.appendChild($percentContent);
        // === 精簡版：戰鬥力（只顯示一行） ===
const $cpInline = document.createElement("div");
$cpInline.id = "sp-cp-inline";
$cpInline.style.cssText = "margin-top:6px;opacity:.9;";
$cpInline.innerHTML = `戰鬥力：<strong id="sp-cp-inline-val">—</strong>`;
wrap.appendChild($cpInline);
    wrap.appendChild($totalStats);

    wrap.appendChild(footer);
    $modal.appendChild(wrap);
    document.body.appendChild($modal);

    // 綁定
    document.getElementById("spCloseBtn").addEventListener("click", closeSpModal);
    $resetBtn.addEventListener("click", resetAll);
    $redeemBtn.addEventListener("click", redeemSpPoints);
  }

function openSpModal() { ensureModal(); render(); refreshInlineCP(); $modal.style.display = "flex"; }
  function closeSpModal() { if ($modal) $modal.style.display = "none"; }

  // ===== 操作 =====
  function spentOfStat(key)    { return Number(SP.stats[key]    || 0); }
  function spentOfPercent(key) { return Number(SP.percents[key] || 0); }

  function adjustStat(key, delta) {
    delta = Math.trunc(Number(delta) || 0);
    if (!delta || delta < 0) return;
    const cur = spentOfStat(key);
    const can = Math.min(delta, SP.unspent, Math.max(0, (STAT_LIMITS[key] || 0) - cur));
    if (can <= 0) return;

    SP.stats[key] = cur + can;
    SP.unspent -= can;
    saveLocal();
    applyToPlayer();
    renderRow(key);
    renderName(key);
    renderRemain();
    renderTotalStats();
    refreshInlineCP();
    if (AUTO_SAVE_AFTER_CHANGE) w.saveGame?.();
  }

  function adjustPercent(key, delta) {
    delta = Math.trunc(Number(delta) || 0);
    if (!delta || delta < 0) return;
    const cur = spentOfPercent(key);
    const can = Math.min(delta, SP.unspent, Math.max(0, (PERCENT_LIMITS[key] || 0) - cur));
    if (can <= 0) return;

    SP.percents[key] = cur + can;
    SP.unspent -= can;
    saveLocal();
    applyToPlayer();
    renderPercentRow(key);
    renderPercentName(key);
    renderRemain();
    renderTotalStats();
    refreshInlineCP();
    if (AUTO_SAVE_AFTER_CHANGE) w.saveGame?.();
  }

  function resetAll() {
    if (!w.player) return;
    const need = RESET_COST_GEMS;
    const curGems = Number(w.player.gem || w.player.gems || 0);
    if (curGems < need) { alert(`重置需要 ${need} 鑽石，你目前只有 ${curGems}`); return; }
    if (!confirm(`確定要重置 SP 加點並退回所有點數嗎？（花費 ${need} 鑽石）`)) return;

    w.player.gem = Math.max(0, curGems - need);

    let refund = 0;
    for (const k in SP.stats)    { refund += Number(SP.stats[k]    || 0); SP.stats[k]    = 0; }
    for (const k in SP.percents) { refund += Number(SP.percents[k] || 0); SP.percents[k] = 0; }
    SP.unspent += refund;

    saveLocal();
    applyToPlayer();
    w.updateResourceUI?.();
    w.logPrepend?.(`🔄 已重置 SP 加點，退回 ${refund} 點（花費 ${need} 鑽石）`);
    render();
    if (AUTO_SAVE_AFTER_CHANGE) w.saveGame?.();
  }

  function addSpPoints(n) {
    const v = Math.max(0, Math.trunc(Number(n) || 0));
    if (!v) return;
    SP.total += v;
    SP.unspent += v;
    saveLocal();
    render();
    if (AUTO_SAVE_AFTER_CHANGE) w.saveGame?.();
  }

  function redeemSpPoints() {
    const curItems = w.getItemQuantity?.(REDEEM_ITEM_ID) || 0;
    if (curItems < 1) { $redeemInfo.textContent = "❌ 道具數量不足！"; return; }
    w.removeItem?.(REDEEM_ITEM_ID, 1);
    addSpPoints(REDEEM_POINTS_PER_ITEM);
    w.updateResourceUI?.();
    w.logPrepend?.(`🎉 使用一張 ${REDEEM_ITEM_ID}，獲得 ${REDEEM_POINTS_PER_ITEM} 點 SP！`);
    $redeemInfo.textContent = `✅ 成功兌換！${REDEEM_ITEM_ID} 剩餘：${w.getItemQuantity?.(REDEEM_ITEM_ID)}`;
    render();
    if (AUTO_SAVE_AFTER_CHANGE) w.saveGame?.();
  }

  // ===== 繪製 =====
  function renderName(key) {
    const el = document.getElementById(`sp-stat-name-${key}`);
    if (!el) return;
    const PB = getDynamicPointsBonus();
    const per =
      (key === "hp") ? PB.hpPerPoint :
      (key === "mp") ? PB.mpPerPoint :
      FIXED_POINTS_BONUS[key] || 0;

    // 顯示每點效益（% 類型的用百分比）
    let perStr = "";
    if (["crit","critDmg","aspd","exp","drop","gold"].includes(key)) {
      perStr = `（<strong>+${(per * 100).toFixed(2)}%</strong> / 點）`;
    } else if (per > 0) {
      perStr = `（<strong>+${Math.floor(per)}</strong> / 點）`;
    }
    el.innerHTML = `${NAMES[key]} ${perStr}（上限：${STAT_LIMITS[key]}）`;
  }

  function renderPercentName(key) {
    const el = document.getElementById(`sp-percent-name-${key}`);
    if (!el) return;
    const perPct = PERCENT_BONUS_PER_POINT[key] || 0;
    const perStr = perPct > 0 ? `（<strong>+${(perPct * 100).toFixed(2)}%</strong> / 點）` : "";
    el.innerHTML = `${PERCENT_NAMES[key]} ${perStr}（上限：${PERCENT_LIMITS[key]}）`;
  }

  function renderRow(key) {
    const el = document.getElementById(`sp-stat-val-${key}`);
    if (el) el.textContent = `${spentOfStat(key)} / ${STAT_LIMITS[key]}`;
  }

  function renderPercentRow(key) {
    const el = document.getElementById(`sp-percent-val-${key}`);
    if (el) el.textContent = `${spentOfPercent(key)} / ${PERCENT_LIMITS[key]}`;
  }

  function renderRemain() {
    if ($remain) $remain.innerHTML = `剩餘可分配：<strong>${SP.unspent}</strong> / 總點數：${SP.total}`;
  }

function renderTotalStats() {
  if (!$totalStats) return;
  const total = computeTotalStats();

  let html = `<h4 style="margin:0 0 10px;">總能力</h4>`;

  // 四大屬性：base 已含 SP，這裡「只顯示」不再相加
  ["hp","mp","atk","def"].forEach(key => {
    const row = total[key]; if (!row) return;

    const finalVal = Math.floor(row.base);                 // ✅ 當前最終值（已含 SP）
    const baseBeforeSp = Math.max(0, Math.floor(row.base - row.bonus)); // 加 SP 前的基礎
    const flatSp = Math.floor(row.flat);                   // SP 直加
    const pctSp  = (Number(row.percent) || 0).toFixed(2);  // SP% 顯示小數兩位

    html += `<div style="margin-bottom:4px;">${NAMES[key]}:
      <strong>${finalVal}</strong>
      (<span style="color:#ccc;">基礎 ${baseBeforeSp}</span>
       <span style="color:#5af;">+${flatSp} SP</span>
       <span style="color:#fa5;">+${pctSp} SP%</span>)</div>`;
  });

  // 其他百分比屬性（右邊這些本來就是百分比，base 已含 SP）
  ["crit","critDmg","aspd","exp","drop","gold"].forEach(key => {
    const row = total[key]; if (!row) return;
    const finalPct = (Number(row.base)  * 100).toFixed(2) + "%"; // 已含 SP
    const spDelta  = (Number(row.bonus) * 100).toFixed(2);       // 其中 SP 帶來的增量
    html += `<div style="margin-bottom:4px;">${NAMES[key]}:
      <strong>${finalPct}</strong>${row.bonus>0 ? ` <span style="color:#5f9;">(+${spDelta}%)</span>` : ""}</div>`;
  });

  $totalStats.innerHTML = html;
}
function refreshInlineCP() {
  const el = document.getElementById("sp-cp-inline-val");
  if (!el) return;

  let cp = null;

  // 先用你主頁已有的函式（若有）
  if (typeof window.getDisplayedCombatPower === "function") {
    try { cp = window.getDisplayedCombatPower(); } catch(_) {}
  }
  if (cp == null && typeof window.computeCombatPower === "function") {
    try { cp = window.computeCombatPower(); } catch(_) {}
  }

  // 再嘗試從主頁 DOM 讀（把選擇器換成你主頁的戰力元素）
  if (cp == null) {
    const node =
      document.getElementById("cp-value") ||
      document.getElementById("combat-power") ||
      document.querySelector("[data-cp]") ||
      document.querySelector(".cp-value");
    if (node) {
      const num = String(node.textContent || "").replace(/[^\d]/g, "");
      if (num) cp = parseInt(num, 10);
    }
  }

  if (cp == null || isNaN(cp)) cp = 0;
  el.textContent = cp;
}
  function render() {
    ["hp","mp","atk","def","crit","critDmg","aspd","exp","drop","gold"].forEach(key => {
      renderName(key);
      renderRow(key);
    });
    ["hp","mp","atk","def"].forEach(key => {
      renderPercentName(key);
      renderPercentRow(key);
    });
    renderRemain();
    renderTotalStats();
    refreshInlineCP();
  }

  // 等 player 準備好再套用
  function applyWhenReady() {
    if (w.player && w.player.coreBonus) {
      applyToPlayer();
      renderTotalStats();
      refreshInlineCP();
    } else {
      setTimeout(applyWhenReady, 50);
    }
  }

// ===== 初始化 =====
  function init() {
    loadLocal();
    ensureModal();
    applyWhenReady();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // 對外
  w.openSpModal = openSpModal;
  w.addSpPoints = addSpPoints;
  w.redeemSpPoints = redeemSpPoints;

})(window);
