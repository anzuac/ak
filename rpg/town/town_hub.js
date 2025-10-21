// =======================
// town_hub.js — 分頁容器（城鎮 / 探索）ES5（節流版 + 反劫持切頁保護）
// =======================
(function (w) {
  "use strict";

  function byId(id){ return document.getElementById(id); }

  var _tabs = []; // { id, title, render(containerEl), tick(dtSec), onOpen()?, onClose()? }
  var _activeId = null;
  var _modal = null;
  var _body = null;
  var _tabBar = null;

  var _lastTick = Date.now();
  var _renderAccum = 0;         // 每 ~1s 重繪一次
  var _loopTickAccum = 0;       // rAF dt 累積，每秒才 tick
  var _rerenderPending = false; // 外部要求立即重繪

  // 🔒 反劫持切頁保護：
  // - 預設禁止程式呼叫 switchTo() 切換分頁（只能用 UI 按鈕）
  // - 需要時可用 TownHub.enableProgrammaticSwitch(true) 臨時開啟
  var _progSwitchEnabled = false;
  var _lastUserSwitchAt = 0; // 防抖：使用者快速點連續切換仍可，但外部不行

  function registerTab(def){
    if (!def || !def.id || !def.title || typeof def.render !== 'function') return;
    for (var i = 0; i < _tabs.length; i++) {
      if (_tabs[i].id === def.id) { _tabs[i] = def; rebuildTabBar(); return; }
    }
    _tabs.push(def);
    rebuildTabBar();
  }

  function ensureModal(){
    if (_modal) return;
    var m = document.createElement('div');
    m.id = 'townHubModal';
    m.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.65);z-index:9999;padding:12px;';

    var wrap = document.createElement('div');
    wrap.style.cssText = 'width:min(860px,96vw);max-height:92vh;overflow:hidden;background:#111827;color:#e5e7eb;border:1px solid #334155;border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.5);font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;display:flex;flex-direction:column;';

    var head = document.createElement('div');
    head.style.cssText = 'background:#0f172a;padding:10px 12px;border-bottom:1px solid #334155;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between';
    head.innerHTML = '<div style="font-weight:800;letter-spacing:.5px">🏙 城鎮 / 探索</div>'+
                     '<button id="townHubClose" style="background:#334155;color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer">✖</button>';

    var tabs = document.createElement('div');
    tabs.id = 'townHubTabs';
    tabs.style.cssText = 'display:flex;gap:8px;padding:8px 12px;background:#0b1220;border-bottom:1px solid #1f2937;flex-wrap:wrap;';

    var body = document.createElement('div');
    body.id = 'townHubBody';
    body.setAttribute('data-tab-container', 'town'); // 標記
    body.style.cssText = 'padding:12px;overflow:auto;flex:1;';

    wrap.appendChild(head);
    wrap.appendChild(tabs);
    wrap.appendChild(body);
    m.appendChild(wrap);
    document.body.appendChild(m);

    _modal = m; _body = body; _tabBar = tabs;

    var btn = document.getElementById('townHubClose');
    if (btn) btn.onclick = close;
    m.addEventListener('click', function(e){ if (e.target === m) close(); });
  }

  function rebuildTabBar(){
    if (!_modal) ensureModal();
    _tabBar.innerHTML = '';
    for (var i=0;i<_tabs.length;i++){
      (function(def){
        var btn = document.createElement('button');
        btn.textContent = def.title;
        btn.style.cssText = 'background:' + (_activeId===def.id?'#1d4ed8':'#1f2937') + ';color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer';
        // 使用者點擊 → 強制切頁（force=true）
        btn.onclick = function(){
          _lastUserSwitchAt = Date.now();
          switchTo(def.id, true);
        };
        _tabBar.appendChild(btn);
      })(_tabs[i]);
    }
    if (!_activeId && _tabs.length>0) switchTo(_tabs[0].id, true);
  }

  function getTab(id){
    for (var i=0;i<_tabs.length;i++) if (_tabs[i].id===id) return _tabs[i];
    return null;
  }

  function renderActive(){
    if (!_body) return;
    _body.innerHTML = '';
    var cur = getTab(_activeId);
    if (cur) {
      // 標記目前 owner，供分頁內部檢查（避免誤重繪）
      _body.setAttribute('data-tab-owner', String(cur.id||''));
      cur.render(_body);
    }
  }

  function switchTo(id, force){
    // 若沒有強制，就屬於「程式觸發」；預設禁止，以防外部亂切（造成你看到的瘋狂跳）
    if (!force && !_progSwitchEnabled) {
      return; // 直接忽略
    }
    if (_activeId === id) return;
    var old = getTab(_activeId);
    var cur = getTab(id);
    if (!cur) return;

    if (old && typeof old.onClose === 'function') {
      try { old.onClose(); } catch(_) {}
    }
    _activeId = id;
    renderActive();
    if (cur && typeof cur.onOpen === 'function') {
      try { cur.onOpen(); } catch(_) {}
    }
    rebuildTabBar();
  }

  function open(){ ensureModal(); _modal.style.display='flex'; renderActive(); }
  function close(){
    if(_modal) _modal.style.display='none';
    var t=getTab(_activeId);
    if(t&&t.onClose) {
      try { t.onClose(); } catch(_) {}
    }
  }

  // ★ 節流後的主迴圈：把 dt 累積到每秒才呼叫各分頁 tick(1)
  function tickLoop(){
    var now = Date.now();
    var dt = Math.max(0, (now - _lastTick) / 1000);
    _lastTick = now;

    _loopTickAccum += dt;
    if (_loopTickAccum >= 1) {
      var steps = Math.floor(_loopTickAccum);
      _loopTickAccum -= steps;
      for (var i=0;i<_tabs.length;i++){
        var def = _tabs[i];
        if (def && typeof def.tick === 'function') {
          try { def.tick(steps); } catch (e) { /* 忽略單一分頁錯誤 */ }
        }
      }
    }

    // Modal 開啟時每 ~1s 重繪；或外部要求立即重繪
    _renderAccum += dt;
    if ((_modal && _modal.style.display === 'flex' && _renderAccum >= 1) || _rerenderPending) {
      _renderAccum = 0;
      _rerenderPending = false;
      renderActive();
    }

    requestAnimationFrame(tickLoop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureModal);
  else ensureModal();
  requestAnimationFrame(tickLoop);

  w.TownHub = {
    open: open,
    close: close,
    registerTab: registerTab,
    // 供外部（真的必要時）開關「程式切頁」能力；預設 false
    enableProgrammaticSwitch: function (on){ _progSwitchEnabled = !!on; },
    // 僅內部：UI 按鈕會用 force=true
    switchTo: switchTo,
    // 外部可要求立即重繪一次（按鈕點擊後用）
    requestRerender: function(){ _rerenderPending = true; },
    // 提供查詢目前分頁
    getActiveId: function(){ return _activeId; }
  };
})(window);