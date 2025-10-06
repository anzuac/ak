// equipment2/equip_mastery.js
// 裝備整匯（單檔版；彈窗固定；升級即時寫入 coreBonus；localStorage 保存）

(function () {
  // ===== 設定（1=100%）=====
  // ⚠️ 統一使用 attackSpeedPct（和 player/coreBonus 對得上）
  const STAT_META = {
    skillDamage:   { name: "技能傷害", perLv: 0.002, max: 200 }, // 每級 +0.2%
    dodge:         { name: "閃避率",   perLv: 0.002, max: 100 }, // 每級 +0.2%
    critRate:      { name: "爆擊率",   perLv: 0.004, max: 100 }, // 每級 +0.4%
    critDamage:    { name: "爆擊傷害", perLv: 0.003, max: 100 }, // 每級 +0.3%
    attackSpeedPct:{ name: "攻擊速度", perLv: 0.003, max: 100 }, // 每級 +0.3%（100級=+30%）
  };
  const SAVE_KEY = "equipMasteryLevels_v1";

  // 材料規則
  const MATERIALS = { low: "低階潛能解放鑰匙", mid: "中階潛能解放鑰匙", high: "高階潛能解放鑰匙" };
  function needForLevel(L) {
    if (L <= 50) return { item: MATERIALS.low,  need: 2 * L };
    if (L <= 80) return { item: MATERIALS.mid,  need: 2 * (L - 50) + 2 };
    return { item: MATERIALS.high, need: 2 * (L - 80) + 2 };
  }

  // ===== 狀態 =====
  // ⚠️ 這裡也統一 key：attackSpeedPct
  const levels = { skillDamage: 0, dodge: 0, critRate: 0, critDamage: 0, attackSpeedPct: 0 };

  // ===== 工具 =====
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const fmtPct = (x) => (x * 100).toFixed(2) + "%";
  const nextLv = (k) => clamp(levels[k] + 1, 1, STAT_META[k].max);
  const n = (v) => (typeof v === "number" && isFinite(v)) ? v : 0;

  function getInvCount(itemName) {
    if (typeof window.getItemQuantity === "function") return window.getItemQuantity(itemName) || 0;
    return 0;
  }
  function spend(itemName, amount) {
    if (amount <= 0) return true;
    if (typeof window.removeItem === "function") { window.removeItem(itemName, amount); return true; }
    alert("尚未接上背包扣除 API（removeItem）。");
    return false;
  }

  // ===== 存取 =====
  function saveLevels() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(levels)); } catch (e) {}
  }
  function loadLevels() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) Object.assign(levels, JSON.parse(raw));
    } catch (e) {}
  }

  // ===== 寫入 coreBonus（關鍵）=====
  function ensureCore() {
    if (!window.player) window.player = {};
    if (!player.coreBonus) player.coreBonus = {};
    if (!player.coreBonus.bonusData) player.coreBonus.bonusData = {};
  }

  function applyToCoreBonus() {
    ensureCore();
    const bag = player.coreBonus.bonusData;
    bag.myEquipMastery = {
      skillDamage:    n(levels.skillDamage)   * STAT_META.skillDamage.perLv,
      dodgePercent:   n(levels.dodge)         * STAT_META.dodge.perLv,
      critRate:       n(levels.critRate)      * STAT_META.critRate.perLv,
      critMultiplier: n(levels.critDamage)    * STAT_META.critDamage.perLv,
      attackSpeedPct: n(levels.attackSpeedPct)* STAT_META.attackSpeedPct.perLv, // ★ 這行才會讓攻速真正生效
    };
    if (typeof window.updateAllUI === "function") updateAllUI();
    if (typeof window.updateResourceUI === "function") updateResourceUI();
  }

  // ===== 升級 =====
  function upgradeOne(key) {
    const meta = STAT_META[key];
    if (!meta) return;
    if (levels[key] >= meta.max) { alert(`${meta.name} 已達上限`); return; }

    const L = nextLv(key);
    const { item, need } = needForLevel(L);
    const owned = getInvCount(item);
    if (owned < need) { alert(`${meta.name} 升到 Lv${L} 需要 ${item} ×${need}（持有 ${owned}）`); return; }
    if (!spend(item, need)) return;

    levels[key] = clamp(L, 0, meta.max);
    saveLevels();
    applyToCoreBonus();
    renderPanel();
  }

  // ===== UI =====
  function ensureStyles() {
    if (document.getElementById("equipMasteryStyles")) return;
    const s = document.createElement("style");
    s.id = "equipMasteryStyles";
    s.textContent = `
      .em-wrap { position: fixed; inset: 0; z-index: 9999; }
      .em-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.55); }
      .em-modal {
        position: absolute; left: 50%; top: 10vh; transform: translateX(-50%);
        width: 370px; max-height: 65vh; overflow: auto;
        background: #222; color: #fff; border: 1px solid #555; border-radius: 10px;
        box-shadow: 0 14px 36px rgba(0,0,0,.45);
      }
      .em-header { position: sticky; top: 0; background: #222; padding: 12px 14px; border-bottom: 1px solid #444; font-weight: 700; }
      .em-body { padding: 10px 12px; display: grid; gap: 10px; }
      .em-card { border: 1px solid #444; border-radius: 8px; padding: 10px; }
      .em-row { display: flex; justify-content: space-between; font-size: 13px; }
      .em-bar { height: 6px; background: #333; border-radius: 999px; overflow: hidden; margin: 6px 0; }
      .em-bar i { display:block; height:100%; width:0%; background: linear-gradient(90deg,#6aa5ff,#8be3ff); }
      .em-need { font-size: 12px; opacity: .9; margin-top: 6px; }
      .em-actions { display: flex; gap: 8px; margin-top: 8px; }
      .em-btn { flex:1; padding: 8px 10px; border-radius: 8px; border: 1px solid #444; background: #2b2b2b; color: #fff; cursor: pointer; }
      .em-btn.primary { background: #2563eb; border-color: #2563eb; }
      .em-footer { position: sticky; bottom: 0; background: #222; padding: 10px 12px; border-top: 1px solid #444; display:flex; justify-content:flex-end; }
      .em-close { padding: 6px 12px; border-radius: 8px; border: 1px solid #444; background: #2b2b2b; color: #fff; cursor: pointer; }
      @media (prefers-color-scheme: light) {
        .em-modal { background: #fff; color: #111; border-color: #ddd; }
        .em-header { background: #fff; border-color: #eee; }
        .em-body .em-card { border-color: #e6e6e6; }
        .em-need { color: #444; }
        .em-btn { background: #f3f3f3; color: #111; border-color: #ddd; }
        .em-btn.primary { background: #2563eb; color: #fff; border-color:#2563eb; }
        .em-footer { background: #fff; border-color: #eee; }
        .em-close { background: #f3f3f3; color: #111; border-color:#ddd; }
      }
    `;
    document.head.appendChild(s);
  }

  function cardHTML(key) {
    const meta = STAT_META[key];
    const lv = levels[key];
    const L = nextLv(key);
    const cur = lv * meta.perLv;
    const nxt = (lv < meta.max) ? (L * meta.perLv) : cur;
    const pct = Math.round((lv / meta.max) * 100);
    const { item, need } = needForLevel(L);
    const owned = getInvCount(item);

    const disabled = lv >= meta.max ? "disabled" : "";
    return `
      <div class="em-card">
        <div class="em-row"><span>${meta.name}</span><span>Lv ${lv}/${meta.max}</span></div>
        <div class="em-bar"><i style="width:${pct}%"></i></div>
        <div class="em-row"><span>當前</span><b>${fmtPct(cur)}</b></div>
        <div class="em-row"><span>下一級</span><b>${fmtPct(nxt)}</b></div>
        <div class="em-need">需求：${item} ×${need}（持有 ${owned}）</div>
        <div class="em-actions">
          <button class="em-btn primary" ${disabled} onclick="equipMastery.upgrade('${key}')">升級</button>
        </div>
      </div>
    `;
  }

  function renderPanel() {
    const box = document.getElementById("equipMasteryModal");
    if (!box) return;
    box.querySelector(".em-body").innerHTML = `
      ${cardHTML("skillDamage")}
      ${cardHTML("dodge")}
      ${cardHTML("critRate")}
      ${cardHTML("critDamage")}
      ${cardHTML("attackSpeedPct")}  <!-- ★ 新增攻擊速度卡 -->
    `;
  }

  function openPanel() {
    ensureStyles();
    closePanel();

    const wrap = document.createElement("div");
    wrap.id = "equipMasteryModal";
    wrap.className = "em-wrap";
    wrap.innerHTML = `
      <div class="em-backdrop" onclick="equipMastery.close()"></div>
      <div class="em-modal">
        <div class="em-header">🔧 被動能力</div>
        <div class="em-body"></div>
        <div class="em-footer"><button class="em-close" onclick="equipMastery.close()">關閉</button></div>
      </div>
    `;
    document.body.appendChild(wrap);

    loadLevels();
    applyToCoreBonus();
    renderPanel();
  }

  function closePanel() {
    const el = document.getElementById("equipMasteryModal");
    if (el) el.remove();
  }

  // ===== 對外 API =====
  window.equipMastery = {
    open: openPanel,
    close: closePanel,
    upgrade: upgradeOne,
    apply: applyToCoreBonus,
    levels
  };

  // ===== 主頁按鈕綁定 =====
  document.addEventListener("DOMContentLoaded", () => {
    loadLevels();
    applyToCoreBonus();

    const btn = document.getElementById("equipMasteryBtn");
    if (btn && !btn._emBound) {
      btn._emBound = true;
      btn.addEventListener("click", () => window.equipMastery.open());
    }
  });
})();