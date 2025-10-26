// equipment2/equip_mastery.js
// 裝備整匯（單檔版；卡片網格；升級即時寫 coreBonus；SaveHub 統一存檔（優先）/ localStorage 後備）

(function () {
  // ===== 參數設定（1=100%）=====
  // ⚠️ 與 coreBonus 對齊：攻速 key 用 attackSpeedPct
  const STAT_META = {
    skillDamage:    { name: "技能傷害", perLv: 0.002, max: 200 }, // 每級 +0.2%
    dodge:          { name: "閃避率",   perLv: 0.002, max: 100 }, // 每級 +0.2%
    critRate:       { name: "爆擊率",   perLv: 0.004, max: 100 }, // 每級 +0.4%
    critDamage:     { name: "爆擊傷害", perLv: 0.003, max: 100 }, // 每級 +0.3%
    attackSpeedPct: { name: "攻擊速度", perLv: 0.003, max: 100 }, // 每級 +0.3%（100級=+30%）
  };

  // —— 統一存檔：SaveHub 優先；localStorage 後備 —— //
  const SAVEHUB_NS = "equip_mastery_v2";           // 新命名空間
  const SAVE_KEY   = "equipMasteryLevels_v1";      // 舊 localStorage key（自動遷移來源）

  // 材料規則（維持原樣）
  const MATERIALS = {
    low:  "低階潛能解放鑰匙",
    mid:  "中階潛能解放鑰匙",
    high: "高階潛能解放鑰匙",
  };
  function needForLevel(L) {
    if (L <= 50) return { item: MATERIALS.low,  need: 2 * L };
    if (L <= 80) return { item: MATERIALS.mid,  need: 2 * (L - 50) + 2 };
    return { item: MATERIALS.high, need: 2 * (L - 80) + 2 };
  }

  // ===== 狀態 =====
  const levels = {
    skillDamage: 0,
    dodge: 0,
    critRate: 0,
    critDamage: 0,
    attackSpeedPct: 0,
  };

  // ===== 工具 =====
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const fmtPct = (x) => (x * 100).toFixed(2) + "%";
  const nextLv = (k) => clamp(levels[k] + 1, 1, STAT_META[k].max);
  const n = (v) => (typeof v === "number" && isFinite(v)) ? v : 0;

  function getInvCount(itemName) {
    try {
      if (typeof window.getItemQuantity === "function") return window.getItemQuantity(itemName) || 0;
    } catch(_) {}
    return 0;
  }
  function spend(itemName, amount) {
    if (amount <= 0) return true;
    if (typeof window.removeItem === "function") { window.removeItem(itemName, amount); return true; }
    alert("尚未接上背包扣除 API（removeItem）。");
    return false;
  }

  // ===== SaveHub 包裝（最小侵入；優先使用） =====
  const SH = window.SaveHub || null;

  function freshLevels(){
    return { skillDamage:0, dodge:0, critRate:0, critDamage:0, attackSpeedPct:0 };
  }
  function normalize(obj){
    obj = obj || {};
    const out = freshLevels();
    for (const k in out) {
      const cap = (STAT_META[k] && STAT_META[k].max) || 0;
      out[k] = clamp(Number(obj[k]||0) | 0, 0, cap);
    }
    return out;
  }
  // 註冊 SaveHub 命名空間（若有提供）
  (function registerSaveHub(){
    if (!SH) return;
    try {
      const schema = {
        version: 1,
        migrate: function(old){ return normalize(old || freshLevels()); }
      };
      if (typeof SH.registerNamespaces === "function"){
        const pack = {}; pack[SAVEHUB_NS] = schema; SH.registerNamespaces(pack);
      } else if (typeof SH.registerNamespace === "function"){
        SH.registerNamespace(SAVEHUB_NS, schema);
      }
    } catch(e) { console && console.warn && console.warn("[equip_mastery] SaveHub register failed:", e); }
  })();

  function shGet(defVal){
    if (!SH) return defVal;
    try{
      if (typeof SH.get === "function") return SH.get(SAVEHUB_NS, defVal);
      if (typeof SH.read === "function") return SH.read(SAVEHUB_NS, defVal);
    }catch(e){ console && console.warn && console.warn("[equip_mastery] SaveHub get failed:", e); }
    return defVal;
  }
  function shSet(val){
    if (!SH) return;
    try{
      if (typeof SH.set === "function"){ SH.set(SAVEHUB_NS, val); return; }
      if (typeof SH.write === "function"){ SH.write(SAVEHUB_NS, val); return; }
    }catch(e){ console && console.warn && console.warn("[equip_mastery] SaveHub set failed:", e); }
  }

  // ===== 存取（SaveHub 優先；含舊檔遷移） =====
  function saveLevels() {
    try {
      if (SH) {
        shSet(levels);
      } else {
        localStorage.setItem(SAVE_KEY, JSON.stringify(levels));
      }
    } catch (e) {}
  }

  function loadLevels() {
    try {
      if (SH) {
        // 讀 SaveHub
        let data = shGet(null);
        // 若 SaveHub 尚無資料、但舊 L.S. 有 → 單向遷移
        if (!data) {
          const raw = localStorage.getItem(SAVE_KEY);
          if (raw) {
            try {
              const legacy = JSON.parse(raw);
              data = normalize(legacy);
              shSet(data);
              // 遷移成功後移除舊 key，避免雙寫
              localStorage.removeItem(SAVE_KEY);
            } catch(_) {
              data = null;
            }
          }
        }
        Object.assign(levels, normalize(data || freshLevels()));
      } else {
        // 沒有 SaveHub：維持原本 localStorage
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) Object.assign(levels, normalize(JSON.parse(raw)));
      }
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
      skillDamage:    n(levels.skillDamage)    * STAT_META.skillDamage.perLv,
      dodgePercent:   n(levels.dodge)          * STAT_META.dodge.perLv,
      critRate:       n(levels.critRate)       * STAT_META.critRate.perLv,
      critMultiplier: n(levels.critDamage)     * STAT_META.critDamage.perLv,
      attackSpeedPct: n(levels.attackSpeedPct) * STAT_META.attackSpeedPct.perLv, // ★ 攻速生效
    };
    if (typeof window.updateAllUI === "function") updateAllUI();
    if (typeof window.updateResourceUI === "function") updateResourceUI();
  }

  // ===== 升級（維持原邏輯） =====
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
    // 視情況重繪
    renderPanel();
    if (_growthBodyRef) renderGrowthTab(_growthBodyRef);
  }

  // ===== 樣式（維持原樣式內容） =====
  function ensureStyles() {
    if (document.getElementById("equipMasteryStyles")) return;
    const s = document.createElement("style");
    s.id = "equipMasteryStyles";
    s.textContent = `
      /* ===== 強制深色主題 ===== */
      .em-wrap { position: fixed; inset: 0; z-index: 9999; }
      .em-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.55); }
      .em-modal {
        position: absolute; left: 50%; top: 10vh; transform: translateX(-50%);
        width: 380px; max-height: 70vh; overflow: auto;
        background: #0b1220; color: #e5e7eb; border: 1px solid #1f2937; border-radius: 12px;
        box-shadow: 0 14px 36px rgba(0,0,0,.45);
      }
      .em-header { position: sticky; top: 0; background: #0b1220; padding: 12px 14px; border-bottom: 1px solid #1f2937; font-weight: 700; }
      .em-body { padding: 12px; }
      .em-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px; }
      .em-card { background:#111827; border: 1px solid #1f2937; border-radius: 12px; padding: 12px; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
      .em-row { display: flex; justify-content: space-between; font-size: 13px; }
      .em-bar { height: 8px; background: #0b1220; border-radius: 999px; overflow: hidden; margin: 8px 0; }
      .em-bar i { display:block; height:100%; width:0%; background: linear-gradient(90deg,#60a5fa,#34d399); }
      .em-need { font-size: 12px; color:#9ca3af; margin-top: 8px; }
      .em-actions { display: flex; gap: 8px; margin-top: 10px; }
      .em-btn { flex:1; padding: 10px 12px; border-radius: 10px; border: 1px solid #1f2937; background: #0f172a; color: #e5e7eb; cursor: pointer; }
      .em-btn.primary { background: #2563eb; border-color: #1d4ed8; }
      .em-btn:disabled { opacity:.5; cursor:not-allowed; }
      .em-footer { position: sticky; bottom: 0; background: #0b1220; padding: 10px 12px; border-top: 1px solid #1f2937; display:flex; justify-content:flex-end; }
      .em-close { padding: 8px 12px; border-radius: 10px; border: 1px solid #1f2937; background: #0f172a; color: #e5e7eb; cursor: pointer; }
      .em-card .hint { color:#94a3b8; }
    `;
    document.head.appendChild(s);
  }

  // ===== 卡片 HTML（維持原邏輯與排版） =====
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

  // ===== 彈窗入口（標題已改為「🧠 能力精通」） =====
  function openPanel() {
    ensureStyles();
    closePanel();

    const wrap = document.createElement("div");
    wrap.id = "equipMasteryModal";
    wrap.className = "em-wrap";
    wrap.innerHTML = `
      <div class="em-backdrop" onclick="equipMastery.close()"></div>
      <div class="em-modal">
        <div class="em-header">🧠 能力精通</div>
        <div class="em-body"><div class="em-grid" id="emBodyGrid"></div></div>
        <div class="em-footer"><button class="em-close" onclick="equipMastery.close()">關閉</button></div>
      </div>
    `;
    document.body.appendChild(wrap);

    loadLevels();
    applyToCoreBonus();
    renderPanel();
  }
  function renderPanel() {
    const grid = document.getElementById("emBodyGrid");
    if (!grid) return;
    grid.innerHTML =
      cardHTML("skillDamage") +
      cardHTML("dodge") +
      cardHTML("critRate") +
      cardHTML("critDamage") +
      cardHTML("attackSpeedPct");
  }
  function closePanel() { const el = document.getElementById("equipMasteryModal"); if (el) el.remove(); }

  // ===== GrowthHub 分頁（保留；標題改為「能力精通」）=====
  var _growthBodyRef = null;
  function renderGrowthTab(container){
    ensureStyles();
    loadLevels();
    applyToCoreBonus();

    container.innerHTML =
      '<div style="background:#0b1220;border:1px solid #1f2937;border-radius:10px;padding:12px">'+
        '<div style="font-weight:700;margin-bottom:8px">🧠 能力精通</div>'+
        '<div id="emTabBody" class="em-grid"></div>'+
      '</div>';

    const body = container.querySelector('#emTabBody');
    body.innerHTML =
      cardHTML("skillDamage") +
      cardHTML("dodge") +
      cardHTML("critRate") +
      cardHTML("critDamage") +
      cardHTML("attackSpeedPct");

    _growthBodyRef = container; // 記錄給升級後重繪
  }

  // ===== 對外 API =====
  window.equipMastery = {
    open: openPanel,
    close: closePanel,
    upgrade: upgradeOne,
    apply: applyToCoreBonus,
    levels
  };

  // ===== 自動註冊 GrowthHub 分頁（如果存在就掛上，否則略過）=====
  (function tryRegisterGrowthTab(){
    if (window.GrowthHub && typeof GrowthHub.registerTab === 'function') {
      GrowthHub.registerTab({
        id: 'equip_mastery',
        title: '能力精通',
        render: renderGrowthTab,
        tick: function(){ /* 不需要每秒邏輯 */ }
      });
    }
  })();

  // ===== 初始化 =====
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