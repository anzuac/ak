// dungeon_gate.js — 全域副本入口守門員（一次載入，全副本通用）
(function (w) {
  "use strict";

  // ====== 設定值（可改）======
  const CFG = {
    // 'block'：若主線在跑就擋住（彈警告）；'autoStop'：自動幫停主線再進
    mode: 'block',
    // autoStop 模式下，等待主線真正停止（autoEnabled=false）的輪詢間隔/逾時
    waitPollMs: 150,
    waitTimeoutMs: 6000,
    // 自動禁用的按鈕選擇器（可綁多個）
    buttonSelectors: ['.btn-start[data-dungeon]'],
    // 被禁用時的樣式
    disabledStyle: { opacity: 0.6, pointerEvents: 'none', cursor: 'not-allowed' },
    // 提示文字
    hintTitle: '請先停止主線戰鬥',
    alertText: '請先停止主線戰鬥，再進入副本。'
  };

  // ====== 小工具 ======
  function setDisabled(el, disabled) {
    if (!el) return;
    el.disabled = !!disabled;
    if (disabled) {
      el.setAttribute('data-dg-disabled', '1');
      Object.assign(el.style, CFG.disabledStyle);
      if (!el.getAttribute('title')) el.setAttribute('title', CFG.hintTitle);
    } else {
      el.removeAttribute('data-dg-disabled');
      el.style.opacity = '';
      el.style.pointerEvents = '';
      el.style.cursor = '';
      if (el.getAttribute('title') === CFG.hintTitle) el.removeAttribute('title');
    }
  }

  function forEachGateButton(fn){
    CFG.buttonSelectors.forEach(sel=>{
      var els = document.querySelectorAll(sel);
      for (var i=0;i<els.length;i++) fn(els[i]);
    });
  }

  function updateButtonsDisabled(){
    var dis = !!w.autoEnabled;
    forEachGateButton(el => setDisabled(el, dis));
  }

  // 若你的主線有派發事件，就用事件；否則用輪詢偵測 autoEnabled
  function startAutoEnabledWatcher(){
    var last = null;
    function tick(){
      if (w.autoEnabled !== last) {
        last = w.autoEnabled;
        updateButtonsDisabled();
      }
      setTimeout(tick, 200);
    }
    tick();
  }

  // 等待主線停止（autoEnabled=false）
  function waitAutoStopped(){
    return new Promise((resolve, reject)=>{
      const t0 = Date.now();
      (function loop(){
        if (!w.autoEnabled) return resolve();
        if (Date.now() - t0 > CFG.waitTimeoutMs) return reject(new Error('timeout'));
        setTimeout(loop, CFG.waitPollMs);
      })();
    });
  }

  // ====== 對外 API ======
  const DungeonGate = {
    config: CFG,

    /**
     * 確保世界空轉再執行 fn。
     * - block：若在戰鬥中，直接 alert 並返回 false
     * - autoStop：幫忙停主線，等停妥後才執行
     * 回傳：true 代表已執行，false 代表被擋/失敗
     */
    requireIdleAndRun(fn){
      if (typeof fn !== 'function') return false;

      // 已經空轉，直接執行
      if (!w.autoEnabled) { fn(); return true; }

      if (CFG.mode === 'block') {
        try { alert(CFG.alertText); } catch(_){}
        return false;
      }

      // autoStop 模式
      // 1) 發停戰鬥指令
      w.stopAfterEncounter = true;     // 停在當前場次結束（若你支援）
      w.autoEnabled = false;           // 立即關閉（依你的主線邏輯可保留/可拿掉）
      // 2) 等待偵測 autoEnabled=false
      waitAutoStopped().then(()=> fn()).catch(()=>{
        // 等不到，還是擋掉，避免副本與主線並跑
        try { alert(CFG.alertText); } catch(_){}
      });
      return true;
    },

    /**
     * 包裝一個按鈕，點擊時會先檢查 requireIdleAndRun，再執行 runFn。
     */
    bindButton(el, runFn){
      if (!el || typeof runFn !== 'function') return;
      el.addEventListener('click', (e)=>{
        // 若已被禁用就不處理
        if (el.hasAttribute('data-dg-disabled')) { e.preventDefault(); return; }
        DungeonGate.requireIdleAndRun(runFn);
      });
      // 初始狀態套用一次
      setDisabled(el, !!w.autoEnabled);
    },

    /**
     * 批次綁定（用在你的固定 selector；預設支援 .btn-start[data-dungeon]）
     * 使用方式：在你的 tab render 完成後呼叫一次。
     */
    bindButtons(selector, getRunFn){
      var sel = selector || CFG.buttonSelectors[0];
      var els = document.querySelectorAll(sel);
      for (var i=0;i<els.length;i++){
        (function(btn){
          // 避免重複綁
          if (btn.__dg_bound) return;
          btn.__dg_bound = true;

          // 你的 getRunFn(btn) 回傳「真正要執行的函式」
          var run = (typeof getRunFn === 'function') ? getRunFn(btn) : null;
          if (typeof run === 'function') DungeonGate.bindButton(btn, run);
        })(els[i]);
      }
      updateButtonsDisabled();
    },

    /**
     * 便利函式：把副本啟動流程包起來（可直接丟進來）
     * 例：DungeonGate.start(()=> DungeonBattle.start(cfg));
     */
    start(runFn){ return DungeonGate.requireIdleAndRun(runFn); }
  };

  // 導出
  w.DungeonGate = DungeonGate;

  // 啟動監看器（沒有事件就輪詢）
  if (w.addEventListener) {
    // 若你主系統有自訂事件，可在那邊 dispatch('rpg:autoStateChanged')
    w.addEventListener('rpg:autoStateChanged', updateButtonsDisabled);
  }
  startAutoEnabledWatcher();

})(window);