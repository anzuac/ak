// scoped_tickets.js — 每個副本自管的輕量票券器（雙軌/持久化）
// ✅ 雙軌：免費票（定時回復）＋背包票（道具）
// ✅ 全自動存檔：localStorage（依 ns 隔離）
// ✅ 介面：get/refill/timeToNext/canSpend/spend/expand/addFree/addToBag/setCap/getConfig
// ✅ 存檔接口：exportState() / applyState(s)（可給 SaveHub 用；也可不管）
(function (w) {
  "use strict";

  function createScopedTickets(cfg, ns) {
    var C = Object.assign({
      NAME: (cfg && cfg.ITEM_NAME ? cfg.ITEM_NAME : "票券") + "（免費）",
      ITEM_NAME: "票券",
      PERIOD_MS: 300 * 60 * 1000,
      DEFAULT_CAP: 5,
      EXPAND_COST_GEM: 100,
      EXPAND_DELTA: 5,
      GIFT_ON_EXPAND: 1
    }, cfg || {});

    var STORAGE_KEY = "scoped_ticket_" + String(ns || C.ITEM_NAME || "ticket").replace(/[^\w\-]+/g, "_") + "_v1";

    // ---- 狀態 ----
    // { count:number, cap:number, lastTs:number }
    var st = { count: 0, cap: Math.max(1, C.DEFAULT_CAP || 1), lastTs: 0 };

    // ---- 持久化 ----
    function now() { return Date.now(); }
    function save() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(st)); } catch(_) {}
    }
    function load() {
      var ok = false;
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var o = JSON.parse(raw);
          if (o && typeof o === "object") {
            st.cap    = Math.max(1, Number(o.cap) || st.cap);
            st.count  = Math.max(0, Math.min(Number(o.count) || 0, st.cap));
            st.lastTs = Math.max(0, Number(o.lastTs) || 0);
            // 如果 lastTs 超前（時鐘異常），壓回 now
            if (st.lastTs > now()) st.lastTs = now();
            ok = true;
          }
        }
      } catch (e) { /* parse fail 就用預設 */ }
      if (!ok) {
        // 第一次：半滿起始，避免剛載入就是 0
        var half = Math.floor(st.cap / 2);
        st.count  = half;
        st.lastTs = now() - (C.PERIOD_MS * half);
        save();
      }
    }
    load();

    // ---- 背包橋接（容錯）----
    var hasInv = typeof w.getItemQuantity === "function"
              && typeof w.addItem === "function"
              && typeof w.removeItem === "function";
    if (!hasInv) {
      w._scopedBag = w._scopedBag || {};
      if (!w.getItemQuantity) w.getItemQuantity = function (name) { return w._scopedBag[name] || 0; };
      if (!w.addItem) w.addItem = function (name, n) { w._scopedBag[name] = (w._scopedBag[name] || 0) + (n || 1); };
      if (!w.removeItem) w.removeItem = function (name, n) {
        var cur = w._scopedBag[name] || 0;
        w._scopedBag[name] = Math.max(0, cur - (n || 1));
      };
    }
    function bagCount() { try { return Math.max(0, Number(w.getItemQuantity(C.ITEM_NAME)) || 0); } catch (_) { return 0; } }
    function bagAdd(n) { try { w.addItem(C.ITEM_NAME, n || 1); } catch (_) {} }
    function bagRemove(n) {
      n = Math.max(1, Number(n) || 1);
      if (bagCount() < n) return false;
      try { w.removeItem(C.ITEM_NAME, n); return true; } catch (_) { return false; }
    }

    // ---- 回復邏輯（含持久化）----
    function refill() {
      var changed = false;
      if (st.count >= st.cap) {
        // 滿倉就暫停計時；避免刷新後又多送
        var t = now();
        if (st.lastTs !== t) { st.lastTs = t; changed = true; }
        if (changed) save();
        return;
      }
      var el = Math.max(0, now() - st.lastTs);
      if (el < C.PERIOD_MS) return;
      var add = Math.floor(el / C.PERIOD_MS);
      if (add > 0) {
        var room = st.cap - st.count;
        var gain = Math.min(add, room);
        if (gain > 0) {
          st.count += gain;
          changed = true;
        }
        var aligned = now() - (el % C.PERIOD_MS);
        if (aligned !== st.lastTs) { st.lastTs = aligned; changed = true; }
      }
      if (changed) save();
    }

    // ---- 對外 API ----
    return {
      getConfig: function () { return C; },

      get: function () {
        refill();
        return { free: { count: st.count, cap: st.cap, lastTs: st.lastTs }, bag: { count: bagCount() }, total: st.count + bagCount() };
      },

      refill: refill,

      timeToNext: function () {
        refill();
        if (st.count >= st.cap) return 0;
        var el = Math.max(0, now() - st.lastTs);
        return C.PERIOD_MS - (el % C.PERIOD_MS);
      },

      canSpend: function (n) {
        n = Math.max(1, Number(n) || 1);
        refill();
        return (st.count + bagCount()) >= n;
      },

      spend: function (n) {
        n = Math.max(1, Number(n) || 1);
        refill();
        if ((st.count + bagCount()) < n) return false;
        var useFree = Math.min(n, st.count);
        st.count -= useFree;
        n -= useFree;
        if (n > 0 && !bagRemove(n)) {
          // 回滾
          st.count += useFree;
          return false;
        }
        // 成功花費：重置 lastTs 起算（避免卡住）
        st.lastTs = now();
        save();
        return true;
      },

      addFree: function (n) {
        n = Math.max(0, Number(n) || 0);
        if (!n) return;
        st.count = Math.min(st.cap, st.count + n);
        st.lastTs = now();
        save();
      },

      addToBag: function (n) { bagAdd(n || 1); /* 背包走 inventory 本身的存檔 */ },

      setCap: function (cap) {
        cap = Math.max(1, Number(cap) || 1);
        st.cap = cap;
        if (st.count > st.cap) st.count = st.cap;
        save();
      },

      expand: function (times) {
        var t = Math.max(1, Number(times) || 1);
        st.cap += (C.EXPAND_DELTA || 1) * t;
        if (st.count > st.cap) st.count = st.cap;
        // 贈票進背包
        if ((C.GIFT_ON_EXPAND || 0) > 0) bagAdd((C.GIFT_ON_EXPAND || 0) * t);
        save();
      },

      exportState: function () {
        return { ns: ns || "", config: C, state: { count: st.count | 0, cap: st.cap | 0, lastTs: Math.max(0, st.lastTs | 0) } };
      },

      applyState: function (s) {
        try {
          var o = (s && s.state) || s || {};
          var cap = Math.max(1, Number(o.cap) || st.cap);
          var cnt = Math.max(0, Number(o.count) || 0);
          var ts  = Math.max(0, Number(o.lastTs) || 0);
          st.cap   = cap;
          st.count = Math.min(cnt, cap);
          st.lastTs = (ts > now() ? now() : ts);
          save();
        } catch (e) { console.warn("[scoped_tickets] applyState error:", e); }
      }
    };
  }

  w.createScopedTickets = createScopedTickets;
})(window);