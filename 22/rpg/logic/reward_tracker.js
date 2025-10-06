// reward_tracker.js — 掉落與獎勵追蹤（累積 / 每小時平均 / 近期紀錄 / 物品掉落率）
// 支援：A) rpg.js 直接呼叫 record(..., items)；B) autoHookLog() 解析 🎉 日誌做備援
(function () {
  const state = {
    totals: { exp: 0, gold: 0, stone: 0 },
    kills: 0, // 用於掉落率分母（每次 record 視為擊殺1次）
    items: new Map(), // key: itemKey -> { name, icon?, countDrops, qtyTotal }
    session: { running:false, sessionStartMs:0, activeElapsedMs:0, lastResumeMs:0 },
    historyLimit: 4,
    rateTimer: null,
    hookedLog: false
  };

  const els = {
    exp:null, gold:null, stone:null,
    expHr:null, goldHr:null, stoneHr:null,
    history:null, body:null, toggleBtn:null,
    itemsGrid:null
  };

  const $ = id => document.getElementById(id);
  const fmt = n => (Number(n)||0).toLocaleString('zh-Hant');
  const now = () => Date.now();

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
  }
  function ensureBound() {
    if (els.history && els.exp && els.gold && els.stone && els.itemsGrid) return true;
    bindDom();
    return (els.history && els.exp && els.gold && els.stone && els.itemsGrid);
  }

  // ===== 每小時平均 =====
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

  // ===== 近期紀錄 =====
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

  // ===== 物品統計 & 掉落率 =====
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

  function updateItemsGridUI() {
    if (!ensureBound()) return;
    const grid = els.itemsGrid;
    if (!grid) return;

    if (state.items.size === 0) {
      grid.innerHTML = '<div class="empty">目前尚無物品掉落</div>';
      return;
    }

    // 建立小卡片：顯示 名稱 / 掉落次數 / 總數量 / 掉落率
    // 掉落率 = countDrops / kills * 100%
    const kills = Math.max(1, state.kills);
    const frags = [];
    for (const [key, it] of state.items.entries()) {
      const rate = (it.countDrops / kills) * 100;
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
          <div style="font-size:12px;">掉落率：${rate.toFixed(2)}%</div>
        </div>
      `);
    }
    grid.innerHTML = frags.join('');
  }

  // ===== 顯示/隱藏 =====
  function toggleVisibility() {
    if (!ensureBound()) return;
    const hidden = els.body?.style.display === 'none';
    els.body.style.display = hidden ? '' : 'none';
    if (els.toggleBtn) {
      els.toggleBtn.textContent = hidden ? '隱藏' : '顯示';
      els.toggleBtn.setAttribute('aria-expanded', hidden ? 'true' : 'false');
    }
  }

  // ===== 日誌攔截（備援）=====
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
        // 若像「x3」則當作數量
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

  // ===== Public API =====
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