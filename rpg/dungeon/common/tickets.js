// dungeon/common/tickets.js  —— 同步建立 TicketManager（不要用 DOMContentLoaded）
(function (w) {
  "use strict";

  if (w.TicketManager) return; // 已有就不覆蓋

  // 你可以在這裡直接定義資源票設定（與 waves_config 無相依）
  var KINDS = {
    ResourceTicket: {
      STORE_KEY: "resource_ticket_v1",
      NAME: "資源票",
      PERIOD_MS: 30 * 60 * 1000,
      DEFAULT_CAP: 20,
      EXPAND_COST_GEM: 100,
      EXPAND_DELTA: 5,
      GIFT_ON_EXPAND: 1
    },
    ChallengeTicket: { 
STORE_KEY: "challenge_ticket_v1",
      NAME: "挑戰券",
      PERIOD_MS: 30 * 60 * 1000,
      DEFAULT_CAP: 20,
      EXPAND_COST_GEM: 100 ,
      EXPAND_DELTA: 5,
      GIFT_ON_EXPAND: 1
    }
  };

  // 內部狀態：每種票的 {count, cap, lastTs}
  var STATES = {}; // { kind: { count, cap, lastTs } }

  function _now(){ return Date.now(); }
  function _load(kind){
    if (STATES[kind]) return STATES[kind];
    var cfg = KINDS[kind];
    var st  = { count:0, cap: (cfg?.DEFAULT_CAP || 1), lastTs: _now() };
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

  var TM = {
    // 讓外部能登記其他票種（可選）
    registerKind: function(kind, config){ KINDS[kind] = Object.assign({}, config); },

    getConfig: function(kind){ return KINDS[kind]; },

    get: function(kind){ _refill(kind); return Object.assign({}, _load(kind)); },

    refill: function(kind){ _refill(kind); },

    timeToNext: function(kind){
      var cfg = KINDS[kind], st = _load(kind);
      _refill(kind);
      if (st.count >= st.cap) return 0;
      var elapsed = Math.max(0, _now() - st.lastTs);
      return cfg.PERIOD_MS - (elapsed % cfg.PERIOD_MS);
    },

    canSpend: function(kind, n){
      _refill(kind);
      var st = _load(kind);
      return st.count >= (n||1);
    },

    spend: function(kind, n){
      n = n || 1;
      _refill(kind);
      var st = _load(kind);
      if (st.count < n) return false;
      st.count = Math.max(0, st.count - n);
      _save(kind);
      return true;
    },

    expand: function(kind, times){
      var cfg = KINDS[kind], st = _load(kind);
      var t = Math.max(1, times||1);
      st.cap   += cfg.EXPAND_DELTA * t;
      st.count  = Math.min(st.cap, st.count + cfg.GIFT_ON_EXPAND * t);
      _save(kind);
    }
  };

  w.TicketManager = TM; // ★ 立刻掛上全域
})(window);