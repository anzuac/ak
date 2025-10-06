// ==========================
// save_facade_es5.js
// ES5 風格的存檔門面（包一層你現有的 save_core.js）
// 提供：GameSave.init() / GameSave.requestLoad() / GameSave.requestSave()
//       GameSave.onApply(fn) / GameSave.export() / GameSave.import(data)
// 說明：其他模組只呼叫這裡，像每日/探索那樣的 API。
// ==========================
(function(w) {
  "use strict";
  
  // 事件清單（ES5）
  var _onApplyHandlers = [];
  
  function _safe(fn) { try { fn && fn(); } catch (e) { /* 靜默 */ } }
  
  // --- 對 save_core 的薄包裝 ---
  // 要求：你的 save_core.js 已經在頁面上，並提供
  // window.saveGame(), window.loadGame(), window.SaveCore_applyNowIfPending()
  // ※ 若不存在，也不會爆；只是功能退化。
  function _coreHas(methodName) {
    return typeof w[methodName] === 'function';
  }
  
  function _emitApply() {
    for (var i = 0; i < _onApplyHandlers.length; i++) {
      _safe(_onApplyHandlers[i]);
    }
  }
  
  // 給 save_core 呼叫：當套用成功時「通知門面」
  // 你可以在 save_core.js 內，進階套用完成處加上：
  //   if (typeof window.GameSave__notifyApplied === 'function') window.GameSave__notifyApplied();
  w.GameSave__notifyApplied = function() {
    _emitApply();
  };
  
  // 允許外部在系統就緒時補觸發一次（基礎/進階都會在 save_core 做）
  function applyNowIfPending() {
    if (_coreHas('SaveCore_applyNowIfPending')) {
      w.SaveCore_applyNowIfPending();
    }
  }
  
  // ---- 門面 API ----
  var GameSave = {
    // 初始化：註冊一次性 DOMContentLoaded 行為與補套用
    init: function() {
      // 避免多次
      if (GameSave.__inited) return;
      GameSave.__inited = true;
      
      // DOM 準備好就先 load（若外層沒主動叫）
      function tryLoad() {
        if (_coreHas('loadGame')) w.loadGame();
        // 主動催一次待套用
        applyNowIfPending();
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", tryLoad);
      } else {
        tryLoad();
      }
    },
    
    // 要存（像每日/探索那樣在資源變動後叫一次）
    requestSave: function() {
      if (_coreHas('saveGame')) w.saveGame();
    },
    
    // 要讀檔（選單或初次進入時可手動再叫）
    requestLoad: function() {
      if (_coreHas('loadGame')) w.loadGame();
    },
    
    // 存檔套用完成通知（像每日/探索：onReady/refresh）
    onApply: function(handler) {
      if (typeof handler === 'function') {
        _onApplyHandlers.push(handler);
      }
    },
    
    // 匯出（整份主存檔 JSON；從 A/B 槽讀 active）
    export: function() {
      try {
        // 直接從 save_core 的 slot 讀字串（保持和 core 同命名）
        var NS = "GAME_SAVE_V2";
        var MANIFEST_KEY = NS + ":manifest";
        var SLOT_A = NS + ":slotA";
        var SLOT_B = NS + ":slotB";
        
        var manifestRaw = localStorage.getItem(MANIFEST_KEY);
        if (!manifestRaw) return null;
        var m = JSON.parse(manifestRaw);
        var key = (m && m.active === "slotB") ? SLOT_B : SLOT_A;
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    
    // 匯入（直接覆蓋 active 槽；給你測試或雲同步用）
    import: function(dataObj) {
      if (!dataObj || typeof dataObj !== 'object') return false;
      try {
        var NS = "GAME_SAVE_V2";
        var MANIFEST_KEY = NS + ":manifest";
        var SLOT_A = NS + ":slotA";
        var SLOT_B = NS + ":slotB";
        
        var json = JSON.stringify(dataObj);
        // 直接寫入 slotA 並翻 manifest 為 slotA
        localStorage.setItem(SLOT_A, json);
        localStorage.setItem(MANIFEST_KEY, JSON.stringify({
          schemaVersion: dataObj.schemaVersion || 2,
          active: "slotA",
          backup: "slotB",
          savedAt: Date.now(),
          size: json.length,
          checksum: "" // 門面不校驗，交給 core 下次寫時覆蓋
        }));
        // 載入 → 立即嘗試套用
        if (_coreHas('loadGame')) w.loadGame();
        applyNowIfPending();
        return true;
      } catch (e) { return false; }
    }
  };
  
  w.GameSave = GameSave;
  
})(window);