// reward_tracker.js — 掉落與獎勵追蹤（累積 / 每小時平均 / 近期紀錄 / 物品掉落率）
// + 🌍 全域掉落清單：按鈕放在「隱藏」旁，彈窗顯示「基準 / 含難度 / 含難度＋玩家」＋可排序
// + 物品統計：支援排序（掉落率 / 掉落次數 / 名稱；低→高 / 高→低）
(function () {
  const state = {
    totals: { exp: 0, gold: 0, stone: 0 },
    kills: 0, // 用於掉落率分母（每次 record 視為擊殺1次）
    items: new Map(), // key: itemKey -> { name, icon?, countDrops, qtyTotal }
    session: { running:false, sessionStartMs:0, activeElapsedMs:0, lastResumeMs:0 },
    historyLimit: 4,
    rateTimer: null,
    hookedLog: false,

    // 物品清單排序
    itemSortKey: 'rate',   // 'rate' | 'count' | 'name'
    itemSortDir: 'desc',   // 'asc' | 'desc'

    // 全域掉落視窗排序
    globalSortKey: 'final', // 'base' | 'diff' | 'final'
    globalSortDir: 'desc'   // 'asc' | 'desc'
  };

  const els = {
    exp:null, gold:null, stone:null,
    expHr:null, goldHr:null, stoneHr:null,
    history:null, body:null, toggleBtn:null,
    itemsGrid:null,

    // 全域掉落 UI
    globalBtn: null, globalModal:null, globalBody:null
  };

  const $ = id => document.getElementById(id);
  const fmt = n => (Number(n)||0).toLocaleString('zh-Hant');
  const now = () => Date.now();

  // ================= 綁定 DOM =================
  function bindDom() {
    els.exp     = $('reward-exp');
    els.gold    = $('reward-gold');
    els.stone   = $('reward-stone');
    els.expHr   = $('reward-exp-hr');
    els.goldHr  = $('reward-gold-hr');
    els.stoneHr = $('reward-stone-hr');
    els.history = $('reward-history');
    els.body    = $('reward-body');
    els.toggleBtn = $('toggleRewardBtn');
    els.itemsGrid = $('reward-items-grid');

    if (els.toggleBtn) {
      els.toggleBtn.onclick = toggleVisibility;
    }

    // 全域掉落：建立彈窗殼 + 把按鈕插在「隱藏」旁
    ensureGlobalDropModal();
    mountGlobalDropButtonNearToggle();
  }
  function ensureBound() {
    if (els.history && els.exp && els.gold && els.stone && els.itemsGrid) return true;
    bindDom();
    return (els.history && els.exp && els.gold && els.stone && els.itemsGrid);
  }

  // ================= 每小時平均 =================
  function activeElapsedMs() {
    const s = state.session;
    return s.running ? s.activeElapsedMs + (now() - s.lastResumeMs) : s.activeElapsedMs;
  }
  function ratePerHour(total) {
    const ms = Math.max(activeElapsedMs(), 30*1000);
    return total * (3600000 / ms);
  }
  function updateTotalsUI() {
    if (!ensureBound()) return;
    els.exp.textContent   = fmt(state.totals.exp);
    els.gold.textContent  = fmt(state.totals.gold);
    els.stone.textContent = fmt(state.totals.stone);
  }
  function updateRatesUI() {
    if (!ensureBound()) return;
    const ready = activeElapsedMs() >= 60*1000;
    els.expHr   && (els.expHr.textContent   = ready ? fmt(Math.floor(ratePerHour(state.totals.exp)))  : '計算中…');
    els.goldHr  && (els.goldHr.textContent  = ready ? fmt(Math.floor(ratePerHour(state.totals.gold))) : '計算中…');
    els.stoneHr && (els.stoneHr.textContent = ready ? ratePerHour(state.totals.stone).toFixed(2)      : '計算中…');
  }
  function ensureRateTimer() {
    if (!state.rateTimer) state.rateTimer = setInterval(updateRatesUI, 5000);
  }

  // ================= 近期紀錄 =================
  function addHistory(delta, meta) {
    if (!ensureBound()) return;
    if (els.history.firstElementChild?.classList?.contains('empty')) els.history.firstElementChild.remove();
    const p = [];
    if (delta.exp)   p.push(`EXP +${fmt(delta.exp)}`);
    if (delta.gold)  p.push(`金錢 +${fmt(delta.gold)}`);
    if (delta.stone) p.push(`強化石 +${fmt(delta.stone)}`);
    if (!p.length) return;
    const t = new Date();
    const hh = String(t.getHours()).padStart(2,'0');
    const mm = String(t.getMinutes()).padStart(2,'0');
    const ss = String(t.getSeconds()).padStart(2,'0');
    const from = [meta?.monster ? ` ${meta.monster}` : '', meta?.map ? ` @ ${meta.map}` : ''].join('');
    const row = document.createElement('div');
    row.textContent = `[${hh}:${mm}:${ss}] ${p.join('、')}${from}`;
    els.history.prepend(row);
    while (els.history.children.length > state.historyLimit) els.history.lastElementChild?.remove();
  }

  // ================= 物品統計 & 掉落率 =================
  function itemKeyOf(x) {
    if (!x) return '';
    if (typeof x === 'string') return x;
    return String(x.id ?? x.name ?? '');
  }
  function itemNameOf(x) {
    if (typeof x === 'string') return x;
    return x?.name ?? String(x?.id ?? '物品');
  }
  function itemQtyOf(x) {
    if (!x) return 1;
    if (typeof x === 'string') return 1;
    const q = Number(x.qty ?? x.quantity ?? 1);
    return Math.max(1, Math.floor(q));
  }
  function itemIconOf(x) {
    if (x && typeof x === 'object' && x.icon) return String(x.icon);
    return null; // 你之後可放 URL
  }

  function recordItems(items) {
    if (!Array.isArray(items) || !items.length) return;
    for (const it of items) {
      const key = itemKeyOf(it);
      if (!key) continue;
      const name = itemNameOf(it);
      const qty = itemQtyOf(it);
      const icon = itemIconOf(it);
      const cur = state.items.get(key) || { name, icon, countDrops:0, qtyTotal:0 };
      cur.name = name;
      cur.icon = icon || cur.icon;
      cur.countDrops += 1;     // 該物至少掉過一次（本次）
      cur.qtyTotal   += qty;   // 總數量（若一次掉多個）
      state.items.set(key, cur);
    }
    updateItemsGridUI();
  }

  // 物品排序
  function getSortedItems() {
    const kills = Math.max(1, state.kills);
    const arr = [];
    for (const [key, it] of state.items.entries()) {
      const rate = (it.countDrops / kills) * 100; // %
      arr.push({ key, ...it, rate });
    }
    const dir = state.itemSortDir === 'asc' ? 1 : -1;
    const key = state.itemSortKey;
    arr.sort((a,b) => {
      if (key === 'name') {
        const cmp = String(a.name).localeCompare(String(b.name));
        return cmp * dir;
      }
      if (key === 'count') {
        const diff = a.countDrops - b.countDrops;
        if (diff) return diff * dir;
        return String(a.name).localeCompare(String(b.name));
      }
      // key === 'rate'
      const diff = a.rate - b.rate;
      if (diff) return diff * dir;
      return String(a.name).localeCompare(String(b.name));
    });
    return arr;
  }

  function updateItemsGridUI() {
    if (!ensureBound()) return;
    const grid = els.itemsGrid;
    if (!grid) return;

    // 建立排序控制列（僅建立一次）
    if (!grid.previousElementSibling || !grid.previousElementSibling.classList?.contains('rt-sortbar')) {
      const bar = document.createElement('div');
      bar.className = 'rt-sortbar';
      bar.style.cssText = 'display:flex;gap:6px;align-items:center;margin:6px 0;';
      bar.innerHTML = `
        <span style="opacity:.8">排序：</span>
        <button id="rt-sort-rate"  class="rt-btn">掉落率</button>
        <button id="rt-sort-count" class="rt-btn">次數</button>
        <button id="rt-sort-name"  class="rt-btn">名稱</button>
        <span style="width:8px"></span>
        <button id="rt-sort-asc"  class="rt-btn">低→高</button>
        <button id="rt-sort-desc" class="rt-btn">高→低</button>
      `;
      grid.parentNode.insertBefore(bar, grid);
      const css = document.createElement('style');
      css.textContent = `
        .rt-btn{background:#2b2b2b;color:#fff;border:1px solid #444;border-radius:6px;padding:4px 8px;cursor:pointer}
        .rt-btn:hover{background:#3a3a3a}
      `;
      document.head.appendChild(css);

      $('rt-sort-rate') ?.addEventListener('click', ()=>{ state.itemSortKey='rate';  updateItemsGridUI(); });
      $('rt-sort-count')?.addEventListener('click', ()=>{ state.itemSortKey='count'; updateItemsGridUI(); });
      $('rt-sort-name') ?.addEventListener('click', ()=>{ state.itemSortKey='name';  updateItemsGridUI(); });
      $('rt-sort-asc')  ?.addEventListener('click', ()=>{ state.itemSortDir='asc';  updateItemsGridUI(); });
      $('rt-sort-desc') ?.addEventListener('click', ()=>{ state.itemSortDir='desc'; updateItemsGridUI(); });
    }

    if (state.items.size === 0) {
      grid.innerHTML = '<div class="empty">目前尚無物品掉落</div>';
      return;
    }

    const items = getSortedItems();
    const frags = [];
    for (const it of items) {
      const iconHtml = it.icon
        ? `<img src="${it.icon}" alt="" style="width:20px;height:20px;object-fit:cover;border-radius:4px;margin-right:6px;">`
        : `<div style="width:20px;height:20px;border-radius:4px;background:#333;margin-right:6px;"></div>`;
      frags.push(`
        <div style="background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:6px;display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;align-items:center;">
            ${iconHtml}
            <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${it.name}">${it.name}</div>
          </div>
          <div style="font-size:12px;color:#cfd3e1;">
            次數：${fmt(it.countDrops)}　數量：${fmt(it.qtyTotal)}
          </div>
          <div style="font-size:12px;">掉落率：${it.rate.toFixed(2)}%</div>
        </div>
      `);
    }
    grid.innerHTML = frags.join('');
  }

  // ================= 顯示/隱藏 =================
  function toggleVisibility() {
    if (!ensureBound()) return;
    const hidden = els.body?.style.display === 'none';
    els.body.style.display = hidden ? '' : 'none';
    if (els.toggleBtn) {
      els.toggleBtn.textContent = hidden ? '隱藏' : '顯示';
      els.toggleBtn.setAttribute('aria-expanded', hidden ? 'true' : 'false');
    }
  }

  // ================= 日誌攔截（備援） =================
  // 解析：🎉 擊敗 XXX，獲得 楓幣 50、強化石 2 顆、EXP 30、物品A、物品B
  function parseFromLog(text) {
    if (!text || text.indexOf('🎉') === -1) return null;
    const out = { exp:0, gold:0, stone:0, items:[] };
    const mGold  = text.match(/楓幣\s+(\d+)/);
    const mStone = text.match(/強化石\s+(\d+)/);
    const mExp   = text.match(/EXP\s+(\d+)/i);
    if (mGold)  out.gold  = Number(mGold[1])  || 0;
    if (mStone) out.stone = Number(mStone[1]) || 0;
    if (mExp)   out.exp   = Number(mExp[1])   || 0;

    // 抓「並獲得 ...」後面的清單（物品之間用「、」）
    const part = text.split('，並獲得 ')[1];
    if (part) {
      // 先去掉已知的數值詞串
      const stripped = part
        .replace(/楓幣\s+\d+/g,'')
        .replace(/強化石\s+\d+\s*顆?/g,'')
        .replace(/EXP\s+\d+/ig,'')
        .trim();
      // 取到結尾或下一行為止
      const list = stripped.split(/、|，/).map(s => s.trim()).filter(Boolean);
      for (const name of list) {
        if (!name) continue;
        const mQty = name.match(/(.+?)\s*[x×＊*]\s*(\d+)$/i);
        if (mQty) out.items.push({ name: mQty[1].trim(), qty: Number(mQty[2]) });
        else out.items.push({ name });
      }
    }
    return out;
  }

  let origLog = null;
  function hookLog() {
    if (state.hookedLog) return;
    if (typeof window.logPrepend !== 'function') {
      const t = setInterval(() => {
        if (typeof window.logPrepend === 'function') {
          clearInterval(t);
          hookLog();
        }
      }, 200);
      return;
    }
    origLog = window.logPrepend;
    window.logPrepend = function (text) {
      try {
        const parsed = parseFromLog(String(text||''));
        if (parsed) {
          API.record({ exp:parsed.exp, gold:parsed.gold, stone:parsed.stone }, null, parsed.items);
        }
      } catch (e) {}
      return origLog.apply(this, arguments);
    };
    state.hookedLog = true;
  }

  // ================= 🌍 全域掉落（按鈕在「隱藏」旁；三欄＋可排序） =================
  function ensureGlobalDropModal() {
    if (els.globalModal) return;

    const css = `
      .gdm-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.45);
                      display:none; align-items:center; justify-content:center; z-index:9998; }
      .gdm-wrap { width:min(92vw,880px); background:#111; color:#fff; border-radius:12px;
                  box-shadow:0 8px 25px rgba(0,0,0,.6); overflow:hidden; }
      .gdm-head { background:#222; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
      .gdm-body { padding:14px; max-height:70vh; overflow:auto; }
      .gdm-table { width:100%; border-collapse:collapse; }
      .gdm-table th, .gdm-table td { border-bottom:1px solid #333; padding:6px 8px; text-align:left; }
      .gdm-table th { color:#aaa; font-weight:600; }
      .gdm-btn { background:#444; color:#fff; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; }
      .gdm-btn:hover { background:#666; }
      .gdm-group { display:flex; gap:6px; align-items:center; }
      .gdm-label { color:#bbb; font-size:12px; opacity:.9; }
      .rt-inline-btn { background:#2b2b2b; color:#fff; border:1px solid #444; border-radius:6px; padding:4px 8px; cursor:pointer; }
      .rt-inline-btn:hover { background:#3a3a3a; }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const modal = document.createElement("div");
    modal.id = "rt-global-drop-modal";
    modal.className = "gdm-backdrop";
    modal.innerHTML = `
      <div class="gdm-wrap">
        <div class="gdm-head">
          <strong>🌍 全域掉落一覽</strong>
          <div class="gdm-group">
            <span class="gdm-label">排序欄位：</span>
            <button id="gdmSortKeyBase"  class="gdm-btn">基準</button>
            <button id="gdmSortKeyDiff"  class="gdm-btn">含難度</button>
            <button id="gdmSortKeyFinal" class="gdm-btn">含難度＋玩家</button>
          </div>
          <div class="gdm-group">
            <span class="gdm-label">方向：</span>
            <button id="gdmSortDesc" class="gdm-btn">高→低</button>
            <button id="gdmSortAsc"  class="gdm-btn">低→高</button>
            <button id="gdmClose"    class="gdm-btn">關閉</button>
          </div>
        </div>
        <div class="gdm-body" id="gdmBody"></div>
      </div>
    `;
    document.body.appendChild(modal);
    els.globalModal = modal;
    els.globalBody  = document.getElementById('gdmBody');

    document.getElementById('gdmClose')?.addEventListener('click', ()=> modal.style.display='none');
    document.getElementById('gdmSortDesc')?.addEventListener('click', ()=> { state.globalSortDir='desc'; openGlobalDropModal(); });
    document.getElementById('gdmSortAsc') ?.addEventListener('click', ()=> { state.globalSortDir='asc';  openGlobalDropModal(); });
    document.getElementById('gdmSortKeyBase') ?.addEventListener('click', ()=> { state.globalSortKey='base';  openGlobalDropModal(); });
    document.getElementById('gdmSortKeyDiff') ?.addEventListener('click', ()=> { state.globalSortKey='diff';  openGlobalDropModal(); });
    document.getElementById('gdmSortKeyFinal')?.addEventListener('click', ()=> { state.globalSortKey='final'; openGlobalDropModal(); });
  }

  function mountGlobalDropButtonNearToggle() {
    // 已有就跳過
    if (els.globalBtn && document.body.contains(els.globalBtn)) return;

    const btn = document.createElement('button');
    btn.id = 'rt-btn-global-drops';
    btn.className = 'rt-inline-btn';
    btn.textContent = '🌍 全域掉落表';
    btn.addEventListener('click', openGlobalDropModal);

    if (els.toggleBtn && els.toggleBtn.parentNode) {
      // 插在「隱藏」按鈕後面
      btn.style.marginLeft = '6px';
      els.toggleBtn.insertAdjacentElement('afterend', btn);
      els.globalBtn = btn;
      return;
    }

    // 找不到隱藏按鈕 → 退回右下角浮動
    btn.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      padding: 8px 14px; border-radius: 8px; background: #2b2b2b;
      color: #fff; border: 1px solid #666; cursor: pointer; font-size: 14px;
    `;
    document.body.appendChild(btn);
    els.globalBtn = btn;
  }

  // ====== 全域掉落：倍率 & 產生表格 ======
  function fmtPct(rate){
    const n = Number(rate);
    if (!Number.isFinite(n)) return "0%";
    return (n * 100).toFixed(n < 0.01 ? 2 : 1) + "%";
  }
  function getGlobalRateMultipliers() {
    const diff = (typeof getCurrentDifficulty === 'function' ? getCurrentDifficulty() : null) || {};
    const diffMul   = Number(diff.item ?? 1);
    const playerMul = 1 + Number(player?.dropRateBonus ?? 0);
    return { diffMul, playerMul };
  }
  function buildAndSortGlobalRates(sortKey='final', sortDir='desc') {
    if (typeof GLOBAL_DROP_RATES !== "object" || !GLOBAL_DROP_RATES) return [];
    const { diffMul, playerMul } = getGlobalRateMultipliers();
    const out = [];
    for (const key in GLOBAL_DROP_RATES) {
      const it = GLOBAL_DROP_RATES[key];
      if (!it || typeof it.rate !== "number") continue;
      const base  = it.rate;
      const diff  = base * diffMul;
      const final = diff * playerMul;
      out.push({ key, name: it.name || key, base, diff, final });
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const key = (sortKey === 'base' || sortKey === 'diff') ? sortKey : 'final';
    out.sort((a,b)=>{
      const d = a[key] - b[key];
      if (d) return d * dir;
      return String(a.name).localeCompare(String(b.name));
    });
    return out;
  }

  function openGlobalDropModal(){
    ensureGlobalDropModal();
    const modal = els.globalModal;
    const body  = els.globalBody;
    if (!modal || !body) return;

    const data = buildAndSortGlobalRates(state.globalSortKey, state.globalSortDir);
    if (!data.length) {
      body.innerHTML = `<div style="opacity:.7;padding:8px;">（目前沒有全域掉落資料）</div>`;
    } else {
      const rows = data.map(x=>`
        <tr>
          <td>${x.name}</td>
          <td>${fmtPct(x.base)}</td>
          <td>${fmtPct(x.diff)}</td>
          <td>${fmtPct(x.final)}</td>
        </tr>`).join("");
      body.innerHTML = `
        <table class="gdm-table">
          <thead>
            <tr>
              <th>物品名稱</th>
              <th>基準</th>
              <th>含難度</th>
              <th>含難度＋玩家</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="opacity:.7; font-size:12px; margin-top:6px; line-height:1.6;">
          ※ 基準：不含任何加成。含難度：乘上 difficulty.item。<br>
          ※ 含難度＋玩家：再乘上 (1 + player.dropRateBonus)。
        </div>`;
    }
    modal.style.display = "flex";
  }

  // ================= Public API =================
  const API = {
    init(opts={}) {
      state.historyLimit = Math.max(1, Number(opts.historyLimit || 4));
      bindDom();
      updateTotalsUI();
      updateRatesUI();
      ensureRateTimer();
      updateItemsGridUI();
    },
    startSession() {
      if (state.session.running) return;
      state.session.running = true;
      state.session.sessionStartMs = state.session.sessionStartMs || now();
      state.session.lastResumeMs = now();
      ensureRateTimer();
      updateRatesUI();
    },
    pauseSession() {
      if (!state.session.running) return;
      state.session.running = false;
      state.session.activeElapsedMs += (now() - state.session.lastResumeMs);
      state.session.lastResumeMs = 0;
      updateRatesUI();
    },
    resumeSession() {
      if (state.session.running) return;
      state.session.running = true;
      state.session.lastResumeMs = now();
      ensureRateTimer();
    },
    endSession() {
      if (state.session.running) {
        state.session.running = false;
        state.session.activeElapsedMs += (now() - state.session.lastResumeMs);
        state.session.lastResumeMs = 0;
      }
      updateRatesUI();
      // 可保留計時器讓 /hr 繼續顯示
    },

// ✅ 核心：每次擊殺後呼叫；items 可傳字串陣列或物件陣列 {id?, name?, qty?, icon?}
    record(delta={}, meta, items=[]) {
      ensureBound();
      state.kills += 1;

      const addExp   = Math.max(0, Number(delta.exp   || 0));
      const addGold  = Math.max(0, Number(delta.gold  || 0));
      const addStone = Math.max(0, Number(delta.stone || 0));
      state.totals.exp   += addExp;
      state.totals.gold  += addGold;
      state.totals.stone += addStone;

      updateTotalsUI();
      updateRatesUI();
      addHistory({ exp:addExp, gold:addGold, stone:addStone }, meta);
      recordItems(items);
    },

    reset() {
      state.totals = { exp:0, gold:0, stone:0 };
      state.kills = 0;
      state.items.clear();
      if (ensureBound()) {
        els.history.innerHTML = '<div class="empty">目前尚無掉落紀錄</div>';
      }
      updateTotalsUI();
      updateRatesUI();
      updateItemsGridUI();
    },

    // 不改 rpg.js 的備援：自動從日誌解析 🎉 行
    autoHookLog() { hookLog(); }
  };

  window.RewardTracker = API;

  // 自動初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => API.init());
  } else {
    API.init();
  }
})();