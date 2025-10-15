// =======================
// player_stats_modal.js — 詳細資訊面板（卡片網格版）
// 依賴：window.player、window.deriveFromPrimariesTotals、window.getIgnoreDefBreakdown
// 提供：createStatModal() / openStatModal()
// =======================
(function (w) {
  "use strict";
  if (!w || !w.player) return;

  function n(x){ return Number(x||0); }
  function fmt(nv){ return Number(nv||0).toLocaleString(); }
  function pct(x, d){ d = (d==null?2:d); return (Number(x||0)*100).toFixed(d) + "%"; }
  function r2(v){ return (typeof v==='number'&&!isNaN(v)) ? parseFloat(v.toFixed(2)) : 0; }

  // —— 樣式（卡片 + 網格） —— //
  function ensureStyle() {
    if (document.getElementById("statModalStyle")) return;
    const s = document.createElement("style");
    s.id = "statModalStyle";
    s.textContent = `
      #statModal {
        position: fixed; inset: 0; display: none; z-index: 9999;
        justify-content: center; align-items: center; background: rgba(0,0,0,.65);
      }
      #statModalContent {
        background: #0b1220; color: #e5e7eb; border: 1px solid #1f2937;
        border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,.5);
        width: min(980px, 94vw); max-height: 90vh; overflow: auto; padding: 14px;
        font: 14px/1.6 system-ui, Segoe UI, Roboto, Arial, sans-serif;
      }
      .close-btn {
        position: absolute; top: 10px; right: 14px;
        background:#334155; color:#fff; border:0; border-radius:8px; padding:6px 10px; cursor:pointer;
      }

      /* 區塊容器 */
      .section { margin-bottom: 12px; }
      .section-title { font-weight: 800; letter-spacing:.3px; margin-bottom: 8px; display:flex; align-items:center; gap:8px; }
      .chip { padding: 2px 8px; border-radius: 999px; font-size: 12px; border:1px solid transparent; }
      .chip-blue{ background:#1e3a8a; color:#dbeafe; border-color:#1d4ed8; }
      .chip-green{ background:#064e3b; color:#d1fae5; border-color:#10b981; }
      .chip-amber{ background:#78350f; color:#ffedd5; border-color:#f59e0b; }
      .chip-purple{ background:#3b0764; color:#ede9fe; border-color:#8b5cf6; }
      .muted { opacity:.75; }
      .mono  { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace; }

      /* 卡片 */
      .card { background:#0f172a; border:1px solid #1f2937; border-radius:12px; padding:12px; }
      .card + .card { margin-top: 8px; }
      .card-head { font-weight:700; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .sep { height:1px; background:#1f2937; margin:6px 0; }

      /* 網格：自適應（手機 1~2 欄，桌面 3~4 欄） */
      .grid-tiles { display:grid; gap:8px; grid-template-columns: repeat(2, minmax(0,1fr)); }
      .grid-2 { display:grid; gap:8px 12px; grid-template-columns: repeat(2, minmax(0,1fr)); }
      .grid-3 { display:grid; gap:8px 12px; grid-template-columns: repeat(3, minmax(0,1fr)); }
      .grid-4 { display:grid; gap:8px 12px; grid-template-columns: repeat(4, minmax(0,1fr)); }
      @media (min-width: 720px){
        .grid-tiles{ grid-template-columns: repeat(4, minmax(0,1fr)); }
      }

      /* 數值磁貼 */
      .tile {
        background:#0b1220; border:1px solid #1f2937; border-radius:10px; padding:10px;
        display:flex; flex-direction:column; gap:6px; min-height:68px;
      }
      .tile-label { font-size:12px; opacity:.8; }
      .tile-value { font-size:18px; font-weight:800; }

      /* Key-Value 表 */
      .kv-row { display:flex; justify-content:space-between; gap:8px; }
      .kv-row + .kv-row { margin-top:4px; }
      .kv-row b { color:#f9fafb; }
      .tag { padding:2px 8px; border-radius:999px; background:#111827; border:1px solid #374151; font-size:12px; }

      /* 小表格（來源明細） */
      .source-table { width:100%; border-collapse: collapse; font-size:13px; }
      .source-table th, .source-table td { padding:4px 6px; border-bottom:1px dashed #1f2937; text-align:right; }
      .source-table th:first-child, .source-table td:first-child { text-align:left; }
      .source-table tr:last-child td { border-bottom:0; }
    `;
    document.head.appendChild(s);
  }

  function createStatModal() {
    ensureStyle();
    if (document.getElementById("statModal")) return;
    const modal = document.createElement("div");
    modal.id = "statModal";

    const content = document.createElement("div");
    content.id = "statModalContent";

    const close = document.createElement("button");
    close.className = "close-btn";
    close.textContent = "✖";
    close.onclick = () => { modal.style.display = "none"; };

    modal.appendChild(content);
    modal.appendChild(close);
    document.body.appendChild(modal);
  }

  function openStatModal() {
    const p = w.player;
    const total = p.totalStats;
    const { baseStats, coreBonus, skillBonus } = p;

    const content = document.getElementById("statModalContent");
    if (!content) return;

    // 職業係數
    const jobKey = (p.job ?? "").toLowerCase();
    const jm = (typeof w.jobs !== "undefined" && w.jobs[jobKey]?.statMultipliers)
      ? w.jobs[jobKey].statMultipliers
      : { str:1, agi:1, int:1, luck:1 };

    // 元素裝備（只為呈現核心扣除元素）
    const eq = coreBonus.bonusData.elementEquip || {};
    const coreAtk = coreBonus.atk - (eq.atk || 0);
    const coreDef = coreBonus.def - (eq.def || 0);
    const coreHp  = coreBonus.hp  - (eq.hp  || 0);
    const coreMp  = coreBonus.mp  - (eq.mp  || 0);
    const coreStr = coreBonus.str - (eq.str || 0);
    const coreAgi = coreBonus.agi - (eq.agi || 0);
    const coreInt = coreBonus.int - (eq.int || 0);
    const coreLuk = coreBonus.luk - (eq.luk || 0);

    // 主屬總量（基礎 + 核心 + 元素）
    const totalStr = baseStats.str + coreStr + (eq.str || 0);
    const totalAgi = baseStats.agi + coreAgi + (eq.agi || 0);
    const totalInt = baseStats.int + coreInt + (eq.int || 0);
    const totalLuk = baseStats.luk + coreLuk + (eq.luk || 0);

    // 共用推導（與戰鬥一致）
    const d = w.deriveFromPrimariesTotals(
      { str: totalStr, agi: totalAgi, int: totalInt, luck: totalLuk },
      { str:(jm.str??1), agi:(jm.agi??1), int:(jm.int??1), luck:(jm.luck??1) }
    );

    // 轉成好讀
    const STR = { atk:r2(d.atk.str),   def:r2(d.def.str),   hp:r2(d.hp.str)   };
    const AGI = { atk:r2(d.atk.agi),   def:r2(d.def.agi),   hp:r2(d.hp.agi)   };
    const INT = { atk:r2(d.atk.int),   def:r2(d.def.int),   hp:r2(d.hp.int), mp:r2(d.mp.int) };
    const LUK = { atk:r2(d.atk.luck),  def:r2(d.def.luck),  hp:r2(d.hp.luck)  };

    // 穿防拆解
    const ig = w.getIgnoreDefBreakdown ? w.getIgnoreDefBreakdown() : { sources:[], product:1, combined:n(total.ignoreDefPct) };
    const igRows = (ig.sources||[]).map(s => `<tr><td>${s.label}</td><td>${pct(s.p,2)}</td></tr>`).join("") || `<tr><td class="muted">（無）</td><td></td></tr>`;
    const igFormula = (ig.sources && ig.sources.length)
      ? `1 - Π(1 - pᵢ) = 1 - ${(ig.product).toFixed(6)} = <b>${pct(ig.combined,2)}</b>（上限 99.99%）`
      : `<span class="muted">沒有來源</span>`;

    // —— HTML —— //
    content.innerHTML = `
      <!-- 頂部概覽：四格磁貼 -->
      <div class="section">
        <div class="section-title">
          <span class="chip chip-blue">🧍 玩家</span>
          <span class="tag">${p.nickname || "(未命名)"} · ${p.job || "job?"} · Lv.${p.level}</span>
        </div>
        <div class="grid-tiles">
          <div class="tile"><div class="tile-label">攻擊力</div><div class="tile-value">${fmt(total.atk)}</div></div>
          <div class="tile"><div class="tile-label">防禦力</div><div class="tile-value">${fmt(total.def)}</div></div>
          <div class="tile"><div class="tile-label">HP</div><div class="tile-value">${fmt(total.hp)}</div></div>
          <div class="tile"><div class="tile-label">MP</div><div class="tile-value">${fmt(total.mp)}</div></div>
        </div>
        <div class="sep"></div>
        <div class="grid-4">
          <div class="tile"><div class="tile-label">爆擊率</div><div class="tile-value">${pct(total.critRate,2)}</div></div>
          <div class="tile"><div class="tile-label">爆擊傷害</div><div class="tile-value">${pct(total.critMultiplier,2)}</div></div>
          <div class="tile"><div class="tile-label">攻擊速度</div><div class="tile-value">${pct(total.attackSpeedPct,2)}</div></div>
          <div class="tile"><div class="tile-label">減傷</div><div class="tile-value">${pct(total.damageReduce,2)}</div></div>
        </div>
      </div>

      <!-- 來源拆解（四張卡：ATK/DEF/HP/MP） -->
      <div class="section">
        <div class="section-title">
          <span class="chip chip-green">📊 來源拆解</span>
          <span class="muted">（基礎＋核心＋元素＋主屬貢獻；與戰鬥公式同步）</span>
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-head">攻擊力</div>
            <table class="source-table">
              <tr><td>基礎</td><td>${fmt(baseStats.atk)}</td></tr>
              <tr><td>核心</td><td>${fmt(coreAtk)}</td></tr>
              <tr><td>元素</td><td>${fmt(eq.atk||0)}</td></tr>
              <tr><td>STR</td><td>${fmt(STR.atk)}</td></tr>
              <tr><td>AGI</td><td>${fmt(AGI.atk)}</td></tr>
              <tr><td>INT</td><td>${fmt(INT.atk)}</td></tr>
              <tr><td>LUK</td><td>${fmt(LUK.atk)}</td></tr>
              <tr><td class="muted">技能加成</td><td class="muted">${pct(skillBonus.atkPercent,0)}</td></tr>
            </table>
          </div>

          <div class="card">
            <div class="card-head">防禦力</div>
            <table class="source-table">
              <tr><td>基礎</td><td>${fmt(baseStats.def)}</td></tr>
              <tr><td>核心</td><td>${fmt(coreDef)}</td></tr>
              <tr><td>元素</td><td>${fmt(eq.def||0)}</td></tr>
              <tr><td>STR</td><td>${fmt(STR.def)}</td></tr>
              <tr><td>AGI</td><td>${fmt(AGI.def)}</td></tr>
              <tr><td>INT</td><td>${fmt(INT.def)}</td></tr>
              <tr><td>LUK</td><td>${fmt(LUK.def)}</td></tr>
              <tr><td class="muted">技能加成</td><td class="muted">${pct(skillBonus.defPercent,0)}</td></tr>
            </table>
          </div>

          <div class="card">
            <div class="card-head">HP</div>
            <table class="source-table">
              <tr><td>基礎</td><td>${fmt(baseStats.hp)}</td></tr>
              <tr><td>核心</td><td>${fmt(coreHp)}</td></tr>
              <tr><td>元素</td><td>${fmt(eq.hp||0)}</td></tr>
              <tr><td>STR</td><td>${fmt(STR.hp)}</td></tr>
              <tr><td>AGI</td><td>${fmt(AGI.hp)}</td></tr>
              <tr><td>INT</td><td>${fmt(INT.hp)}</td></tr>
              <tr><td>LUK</td><td>${fmt(LUK.hp)}</td></tr>
              <tr><td class="muted">技能加成</td><td class="muted">${pct(skillBonus.hpPercent,0)}</td></tr>
            </table>
          </div>

          <div class="card">
            <div class="card-head">MP</div>
            <table class="source-table">
              <tr><td>基礎</td><td>${fmt(baseStats.mp)}</td></tr>
              <tr><td>核心</td><td>${fmt(coreMp)}</td></tr>
              <tr><td>元素</td><td>${fmt(eq.mp||0)}</td></tr>
              <tr><td>INT</td><td>${fmt(INT.mp)}</td></tr>
              <tr><td class="muted">技能加成</td><td class="muted">${pct(skillBonus.mpPercent,0)}</td></tr>
            </table>
          </div>
        </div>
      </div>

      <!-- 傷害類 -->
      <div class="section">
        <div class="section-title"><span class="chip chip-amber">💥 傷害類</span></div>
        <div class="grid-3">
          <div class="tile"><div class="tile-label">技能傷害</div><div class="tile-value">${pct(total.skillDamage,1)}</div></div>
          <div class="tile"><div class="tile-label">法術傷害</div><div class="tile-value">${pct(total.spellDamage,1)}</div></div>
          <div class="tile"><div class="tile-label">總傷害</div><div class="tile-value">${pct(total.totalDamage,1)}</div></div>
        </div>
        <div class="muted mono" style="margin-top:6px;">
          內部分布：基礎${pct(p.baseTotalDamage,1)}　核心${pct(p.coreBonus.totalDamage,1)}　技能${pct(p.skillBonus.totalDamage,1)}
        </div>
      </div>

      <!-- 防禦穿透 -->
      <div class="section">
        <div class="section-title"><span class="chip chip-purple">🛡 防禦穿透（Ignore DEF）</span></div>
        <div class="card">
          <div class="grid-2">
            <div class="tile"><div class="tile-label">目前穿防</div><div class="tile-value">${pct(n(ig.combined!=null?ig.combined:total.ignoreDefPct),2)}</div></div>
            <div class="tile"><div class="tile-label">來源數</div><div class="tile-value">${(ig.sources||[]).length}</div></div>
          </div>
          <div class="sep"></div>
          <div class="card-head"><span class="tag">來源</span></div>
          <table class="source-table">${igRows}</table>
          <div class="sep"></div>
          <div class="mono muted">合成：${igFormula}</div>
        </div>
      </div>

      <!-- 其他 -->
      <div class="section">
        <div class="section-title"><span class="chip">🎯 其他</span></div>
        <div class="grid-4">
          <div class="tile"><div class="tile-label">閃避</div><div class="tile-value">${pct(total.dodgePercent,2)}</div></div>
          <div class="tile"><div class="tile-label">回復</div><div class="tile-value">${pct(total.recoverPercent,2)}</div></div>
          <div class="tile"><div class="tile-label">雙擊</div><div class="tile-value">${pct(total.doubleHitChance,2)}</div></div>
          <div class="tile"><div class="tile-label">連擊</div><div class="tile-value">${pct(total.comboRate,2)}</div></div>
        </div>
      </div>

      <!-- 屬性點數（只讀） -->
      <div class="section">
        <div class="section-title"><span class="chip">📦 屬性點數（只讀）</span></div>
        <div class="grid-4">
          <div class="tile"><div class="tile-label">STR</div><div class="tile-value">${fmt(baseStats.str)}</div></div>
          <div class="tile"><div class="tile-label">AGI</div><div class="tile-value">${fmt(baseStats.agi)}</div></div>
          <div class="tile"><div class="tile-label">INT</div><div class="tile-value">${fmt(baseStats.int)}</div></div>
          <div class="tile"><div class="tile-label">LUK</div><div class="tile-value">${fmt(baseStats.luk)}</div></div>
        </div>
        <div class="muted" style="margin-top:6px;">剩餘點數：<b>${fmt(p.statPoints)}</b>（此面板不提供加點）</div>
      </div>
    `;

    document.getElementById("statModal").style.display = "flex";
  }

  // 導出 API
  w.createStatModal = createStatModal;
  w.openStatModal = openStatModal;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function(){
      if (w.player) createStatModal();
    });
  } else {
    if (w.player) createStatModal();
  }

})(window);