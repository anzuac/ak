// ==========================
// save_facade_es5.js — 單槽版門面
// ==========================
(function(w) {
  "use strict";

  var _onApplyHandlers = [];
  function _safe(fn) { try { fn && fn(); } catch (e) {} }
  function _coreHas(name) { return typeof w[name] === 'function'; }
  function _emitApply() { for (var i=0;i<_onApplyHandlers.length;i++) _safe(_onApplyHandlers[i]); }

  w.GameSave__notifyApplied = function() { _emitApply(); };

  var GameSave = {
    init: function() {
      if (GameSave.__inited) return;
      GameSave.__inited = true;
      function tryLoad() {
        if (_coreHas('loadGame')) w.loadGame();
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", tryLoad);
      } else {
        tryLoad();
      }
    },
    requestSave: function() { if (_coreHas('saveGame')) w.saveGame(); },
    requestLoad: function() { if (_coreHas('loadGame')) return w.loadGame(); return false; },
    onApply: function(handler) { if (typeof handler === 'function') _onApplyHandlers.push(handler); },

    // 便利查詢：是否有存檔
    has: function() { return typeof w.hasGameSave === 'function' ? w.hasGameSave() : false; },

    // 直接匯出目前單槽 JSON 物件（供雲端同步）
    export: function() {
      try {
        var raw = localStorage.getItem("GAME_SAVE_V4:data");
        return raw ? JSON.parse(raw) : null;
      } catch(e){ return null; }
    },
    // 直接匯入（覆蓋單槽）
    import: function(obj) {
      if (!obj || typeof obj !== 'object') return false;
      try {
        var json = JSON.stringify(obj);
        localStorage.setItem("GAME_SAVE_V4:data", json);
        localStorage.setItem("GAME_SAVE_V4:meta", JSON.stringify({
          schemaVersion: obj.schemaVersion || 2,
          importedAt: Date.now(),
          size: json.length,
          checksum: "imported"
        }));
        if (_coreHas('loadGame')) w.loadGame();
        return true;
      } catch(e){ return false; }
    }
  };

  w.GameSave = GameSave;
})(window);