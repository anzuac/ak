// dungeon/common/tickets.js (修正版)
// —— TicketManager（免費票 + 背包票雙軌）——
// 修正：重整歸零、時間超前、舊存檔 parse fail 問題
// 相容舊資料，不需清除紀錄

(function (w) {
  "use strict";
  if (w.TicketManager) return; // 已有就不覆蓋

  // ====== 票券種類設定（可擴充） ======
  var KINDS = {
    ResourceTicket: {
      STORE_KEY: "resource_ticket_v2",
      NAME: "資源票（免費）",
      ITEM_NAME: "資源票",
      PERIOD_MS: 30 * 60 * 1000,  // 每 30 分補 1 張
      DEFAULT_CAP: 20,
      EXPAND_COST_GEM: 100,
      EXPAND_DELTA: 5,
      GIFT_ON_EXPAND: 1
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

  // ====== 狀態：僅管理免費票 ======
  // { kind: { count, cap, lastTs } }
  var STATES = {};

  // ====== 工具 ======
  function _now(){ return Date.now(); }

  function _save(kind){
    var cfg = KINDS[kind], st = STATES[kind];
    if (!cfg || !st) return;
    try { localStorage.setItem(cfg.STORE_KEY, JSON.stringify(st)); } catch(_) {}
  }

  // ---- 改良版：安全載入（修正歸零） ----
  function _load(kind){
    if (STATES[kind]) return STATES[kind];
    var cfg = KINDS[kind];
    if (!cfg) throw new Error("[TicketManager] Unknown kind: " + kind);

    var st = { count: 0, cap: (cfg.DEFAULT_CAP || 1), lastTs: 0 };
    try {
      var raw = localStorage.getItem(cfg.STORE_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") {
          st.count  = Math.max(0, Number(o.count) || 0);
          st.cap    = Math.max(1, Number(o.cap) || st.cap);
          st.lastTs = Math.max(0, Number(o.lastTs) || 0);
        }
      }
    } catch(e) {
      console.warn("[TicketManager] load parse error:", e);
    }

    // ⛔ 修正重整歸零：若 lastTs 為 0，假設半滿起始
    if (!st.lastTs) {
      st.lastTs = _now() - cfg.PERIOD_MS * Math.floor(st.cap / 2);
      st.count  = Math.floor(st.cap / 2);
    }

    // clamp 時間與上限
    if (st.count > st.cap) st.count = st.cap;
    if (st.lastTs > _now()) st.lastTs = _now();

    STATES[kind] = st;
    _save(kind);
    return st;
  }

  // ---- 改良版：回復計算 ----
  function _refill(kind, now){
    var cfg = KINDS[kind], st = _load(kind);
    now = now || _now();

    if (st.count >= st.cap){
      // 已滿，校正 lastTs 不得超前
      st.lastTs = Math.min(now, st.lastTs);
      _save(kind);
      return;
    }

    var elapsed = Math.max(0, now - st.lastTs);
    if (elapsed < cfg.PERIOD_MS) return; // 不滿一周期

    var add = Math.floor(elapsed / cfg.PERIOD_MS);
    if (add > 0){
      var room = st.cap - st.count;
      var gain = Math.min(add, room);
      st.count += gain;
      // ⏱ 對齊實際剩餘時間，不讓 lastTs 超前
      st.lastTs = now - (elapsed % cfg.PERIOD_MS);
      _save(kind);
    }
  }

  // ====== 背包橋接（容錯） ======
  var hasInv = typeof w.getItemQuantity === "function"
            && typeof w.addItem === "function"
            && typeof w.removeItem === "function";

  if (!hasInv) {
    w._tmBag = w._tmBag || {};
    w.getItemQuantity = function(name){ return w._tmBag[name] || 0; };
    w.addItem = function(name, n){ w._tmBag[name]=(w._tmBag[name]||0)+(n||1); };
    w.removeItem = function(name, n){
      var cur = w._tmBag[name] || 0;
      w._tmBag[name] = Math.max(0, cur - (n||1));
    };
  }

  function _bagCount(kind){
    var cfg = KINDS[kind];
    if (!cfg || !cfg.ITEM_NAME) return 0;
    try { return Math.max(0, Number(w.getItemQuantity(cfg.ITEM_NAME)) || 0); } catch(_){ return 0; }
  }
  function _bagAdd(kind, n){ var cfg = KINDS[kind]; if(cfg&&cfg.ITEM_NAME) try{ w.addItem(cfg.ITEM_NAME,n||1);}catch(_){}} 
  function _bagRemove(kind, n){
    var cfg = KINDS[kind]; if (!cfg || !cfg.ITEM_NAME) return false;
    var need = Math.max(0, n||1);
    var have = _bagCount(kind);
    if (have < need) return false;
    try { w.removeItem(cfg.ITEM_NAME, need); return true; } catch(_){ return false; }
  }

  // ====== API ======
  var TM = {
    registerKind: function(kind, config){
      var c = {};
      for (var k in config) if (config.hasOwnProperty(k)) c[k]=config[k];
      if (!c.STORE_KEY) throw new Error("registerKind needs STORE_KEY");
      if (!c.ITEM_NAME) throw new Error("registerKind needs ITEM_NAME");
      c.NAME = c.NAME || (c.ITEM_NAME + "（免費）");
      c.PERIOD_MS = c.PERIOD_MS || (30*60*1000);
      c.DEFAULT_CAP = Math.max(1, Number(c.DEFAULT_CAP||20));
      c.EXPAND_COST_GEM = Number(c.EXPAND_COST_GEM||0);
      c.EXPAND_DELTA = Math.max(1, Number(c.EXPAND_DELTA||1));
      c.GIFT_ON_EXPAND = Math.max(0, Number(c.GIFT_ON_EXPAND||0));
      KINDS[kind] = c;
      _load(kind); // 初始化狀態
    },

    getConfig: function(kind){ return KINDS[kind]; },

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

    getBreakdown: function(kind){ return this.get(kind); },

    refill: function(kind){ _refill(kind); },

    timeToNext: function(kind){
      var cfg = KINDS[kind], st = _load(kind);
      _refill(kind);
      if (st.count >= st.cap) return 0;
      var elapsed = Math.max(0, _now() - st.lastTs);
      return cfg.PERIOD_MS - (elapsed % cfg.PERIOD_MS);
    },

    canSpend: function(kind, n){
      n = n || 1;
      _refill(kind);
      var st = _load(kind);
      var bag = _bagCount(kind);
      return (st.count + bag) >= n;
    },

    spend: function(kind, n){
      n = n || 1;
      _refill(kind);
      var st = _load(kind);
      if ((st.count + _bagCount(kind)) < n) return false;

      var useFree = Math.min(n, st.count);
      st.count -= useFree;
      n -= useFree;

      if (n > 0 && !_bagRemove(kind, n)) {
        st.count += useFree; // 回滾
        _save(kind);
        return false;
      }
      _save(kind);
      return true;
    },

    addFree: function(kind, n){
      n = Math.max(0, Number(n)||0);
      if (!n) return;
      var st = _load(kind);
      st.count = Math.min(st.cap, st.count + n);
      st.lastTs = _now();
      _save(kind);
    },

    addToBag: function(kind, n){ _bagAdd(kind, n||1); },

    setCap: function(kind, cap){
      cap = Math.max(1, Number(cap)||1);
      var st = _load(kind);
      st.cap = cap;
      st.count = Math.min(st.count, st.cap);
      _save(kind);
    },

    expand: function(kind, times){
      var cfg = KINDS[kind], st = _load(kind);
      var t = Math.max(1, Number(times)||1);
      st.cap   += cfg.EXPAND_DELTA * t;
      st.count  = Math.min(st.cap, st.count);
      _save(kind);
      if (cfg.GIFT_ON_EXPAND > 0) _bagAdd(kind, cfg.GIFT_ON_EXPAND * t);
    }
  };

  w.TicketManager = TM;

})(window);
