// dungeon/common/tickets.js
// —— TicketManager（免費票 + 背包票雙軌）——
// 1) 自動回復的「免費票」用 localStorage 獨立存檔（只管 count/cap/lastTs）
// 2) 購買/掉落的票 → 一律透過 inventory 進入「背包」
// 3) 消耗優先扣「免費票」，不足再扣「背包票」（透過 removeItem）
// 4) get()/getBreakdown() 回傳合併視圖（free + bag）
// 5) registerKind 可擴充票種（需提供 ITEM_NAME 才能串背包）
// 6) 不用 DOMContentLoaded，載入即掛上 window.TicketManager

(function (w) {
  "use strict";
  if (w.TicketManager) return; // 已有就不覆蓋

  // ====== 票券種類設定（可擴充；購買請用 addItem 到背包） ======
  // ITEM_NAME 必填，用來對應 inventory 的品項名稱
  var KINDS = {
    ResourceTicket: {
      STORE_KEY: "resource_ticket_v2",
      NAME: "資源票（免費）",
      ITEM_NAME: "資源票",           // 背包內對應的道具名
      PERIOD_MS: 30 * 60 * 1000,     // 每 30 分回復 1 張免費票
      DEFAULT_CAP: 20,
      EXPAND_COST_GEM: 100,          // 只提供參考，實際扣鑽石在商店/外部處理
      EXPAND_DELTA: 5,
      GIFT_ON_EXPAND: 1              // 擴充後贈送「背包票」數量
    },
    ChallengeTicket: {
      STORE_KEY: "challenge_ticket_v2",
      NAME: "挑戰券（免費）",
      ITEM_NAME: "挑戰券",
      PERIOD_MS: 30 * 60 * 1000,
      DEFAULT_CAP: 20,
      EXPAND_COST_GEM: 100,
      EXPAND_DELTA: 5,
      GIFT_ON_EXPAND: 1
    }
  };

  // ====== 內部狀態（只存「免費票」）======
  // { kind: { count, cap, lastTs } }
  var STATES = {};

  // ====== 時間 / 存取工具 ======
  function _now(){ return Date.now(); }

  function _load(kind){
    if (STATES[kind]) return STATES[kind];
    var cfg = KINDS[kind]; if (!cfg) throw new Error("[TicketManager] Unknown kind: " + kind);
    var st  = { count:0, cap: (cfg.DEFAULT_CAP || 1), lastTs: _now() };
    try {
      var raw = localStorage.getItem(cfg.STORE_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        st.count  = Math.max(0, Number(o.count)||0);
        st.cap    = Math.max(1, Number(o.cap)||st.cap);
        st.lastTs = Number(o.lastTs)||_now();
      }
    } catch(_) {}
    STATES[kind] = st;
    return st;
  }

  function _save(kind){
    var cfg = KINDS[kind], st = _load(kind);
    try { localStorage.setItem(cfg.STORE_KEY, JSON.stringify(st)); } catch(_){}
  }

  // 只回復「免費票」
  function _refill(kind, now){
    var cfg = KINDS[kind], st = _load(kind);
    now = now || _now();
    if (st.count >= st.cap){ st.lastTs = now; _save(kind); return; }
    var elapsed = Math.max(0, now - st.lastTs);
    var add = Math.floor(elapsed / cfg.PERIOD_MS);
    if (add > 0){
      var room = st.cap - st.count;
      var gain = Math.min(add, room);
      st.count  += gain;
      st.lastTs += gain * cfg.PERIOD_MS;
      _save(kind);
    }
  }

  // ====== 背包橋接（容錯：若沒 inventory API，提供備援小背包） ======
  var hasInv = typeof w.getItemQuantity === "function"
            && typeof w.addItem === "function"
            && typeof w.removeItem === "function";

  if (!hasInv) {
    // 簡單備援，避免整體掛掉（之後接上正式 inventory 即會自動用正式的）
    w._tmBag = w._tmBag || {};
    w.getItemQuantity = function(name){ return w._tmBag[name] || 0; };
    w.addItem = function(name, n){ w._tmBag[name]=(w._tmBag[name]||0)+(n||1); };
    w.removeItem = function(name, n){
      var cur = w._tmBag[name] || 0;
      w._tmBag[name] = Math.max(0, cur - (n||1));
    };
  }

  function _bagCount(kind){
    var cfg = KINDS[kind]; if (!cfg || !cfg.ITEM_NAME) return 0;
    try { return Math.max(0, Number(w.getItemQuantity(cfg.ITEM_NAME)) || 0); } catch(_){ return 0; }
  }

  function _bagAdd(kind, n){
    var cfg = KINDS[kind]; if (!cfg || !cfg.ITEM_NAME) return;
    try { w.addItem(cfg.ITEM_NAME, n||1); } catch(_) {}
  }

  function _bagRemove(kind, n){
    var cfg = KINDS[kind]; if (!cfg || !cfg.ITEM_NAME) return false;
    var need = Math.max(0, n||1);
    var have = _bagCount(kind);
    if (have < need) return false;
    try { w.removeItem(cfg.ITEM_NAME, need); return true; } catch(_){ return false; }
  }

  // ====== API ======
  var TM = {
    // 登記新票種（需提供至少：STORE_KEY, ITEM_NAME）
    registerKind: function(kind, config){
      var clone = {};
      for (var k in config) if (config.hasOwnProperty(k)) clone[k]=config[k];
      if (!clone.STORE_KEY) throw new Error("registerKind needs STORE_KEY");
      if (!clone.ITEM_NAME) throw new Error("registerKind needs ITEM_NAME");
      clone.NAME = clone.NAME || (clone.ITEM_NAME + "（免費）");
      clone.PERIOD_MS = clone.PERIOD_MS || (30*60*1000);
      clone.DEFAULT_CAP = Math.max(1, Number(clone.DEFAULT_CAP||20));
      clone.EXPAND_COST_GEM = Number(clone.EXPAND_COST_GEM||0);
      clone.EXPAND_DELTA = Math.max(1, Number(clone.EXPAND_DELTA||1));
      clone.GIFT_ON_EXPAND = Math.max(0, Number(clone.GIFT_ON_EXPAND||0));
      KINDS[kind] = clone;
      // 觸發一次載入，確保有 state
      _load(kind);
    },

    getConfig: function(kind){ return KINDS[kind]; },

    // 回傳合併視圖（不破壞內部狀態）
    // { free: {count, cap, lastTs}, bag: {count}, total: number }
    get: function(kind){
      _refill(kind);
      var st = _load(kind);
      var bag = _bagCount(kind);
      return {
        free: { count: st.count, cap: st.cap, lastTs: st.lastTs },
        bag:  { count: bag },
        total: st.count + bag
      };
    },

    // 比 get 更明確的拆解
    getBreakdown: function(kind){ return this.get(kind); },

    // 只回補免費票（手動觸發可選）
    refill: function(kind){ _refill(kind); },

    timeToNext: function(kind){
      var cfg = KINDS[kind], st = _load(kind);
      _refill(kind);
      if (st.count >= st.cap) return 0;
      var elapsed = Math.max(0, _now() - st.lastTs);
      return cfg.PERIOD_MS - (elapsed % cfg.PERIOD_MS);
    },

    // 是否可消耗 n 張（含免費 + 背包）
    canSpend: function(kind, n){
      n = n || 1;
      _refill(kind);
      var st = _load(kind);
      var bag = _bagCount(kind);
      return (st.count + bag) >= n;
    },

    // 消耗：先扣免費，不足再扣背包
    spend: function(kind, n){
      n = n || 1;
      _refill(kind);
      var st = _load(kind);
      if ((st.count + _bagCount(kind)) < n) return false;

      var useFree = Math.min(n, st.count);
      st.count -= useFree;
      n -= useFree;

      if (n > 0) {
        if (!_bagRemove(kind, n)) {
          // 理論上不會發生（前面 canSpend 判過），保險起見回滾免費扣款
          st.count += useFree;
          _save(kind);
          return false;
        }
      }
      _save(kind);
      return true;
    },

    // 直接發免費票（系統/活動用途）
    addFree: function(kind, n){
      n = Math.max(0, Number(n)||0);
      if (!n) return;
      var st = _load(kind);
      st.count = Math.min(st.cap, st.count + n);
      st.lastTs = _now();
      _save(kind);
    },

    // 直接發到背包（便利函數；購買請直接用 addItem 亦可）
    addToBag: function(kind, n){
      _bagAdd(kind, n||1);
    },

    // 設定/擴充上限（不處理鑽石扣除；由外部商店負責）
    setCap: function(kind, cap){
      cap = Math.max(1, Number(cap)||1);
      var st = _load(kind);
      st.cap = cap;
      st.count = Math.min(st.count, st.cap);
      _save(kind);
    },

    // 擴充上限 + 贈送背包票（不扣鑽石；由外部商店負責扣）
    expand: function(kind, times){
      var cfg = KINDS[kind], st = _load(kind);
      var t = Math.max(1, Number(times)||1);
      st.cap   += cfg.EXPAND_DELTA * t;
      st.count  = Math.min(st.cap, st.count); // 免費票不超過上限
      _save(kind);
      if (cfg.GIFT_ON_EXPAND > 0) _bagAdd(kind, cfg.GIFT_ON_EXPAND * t); // 送「背包票」
    }
  };

  w.TicketManager = TM;

})(window);