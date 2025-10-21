// save_hub_es5.js — 統一存檔中樞（穩定版）
(function(global){
  var SAVE_KEY = "GAME__C16"; // 全遊戲單一存檔包
  var WRITE_DELAY = 300;         // 批次寫入去抖（毫秒）
  var _timer = null;
  var _listeners = { change: [] };
  var _state = { _meta: { schema: 1 }, data: {} }; // { data: { namespace: {...} } }
  var _specs = {}; // { ns: { version, migrate(old)->new } }

  // I/O：localStorage
  function readRaw(){
    try{
      var raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(_){ return null; }
  }
  function writeRaw(obj){
    try{ localStorage.setItem(SAVE_KEY, JSON.stringify(obj)); }catch(_){}
  }

  // 初始化
  (function init(){
    var saved = readRaw();
    if (saved && saved.data) _state = saved; else writeRaw(_state);
  })();

  // 工具
  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
  function extend(dst, src){ if(!src) return dst; for(var k in src) if(src.hasOwnProperty(k)) dst[k]=src[k]; return dst; }
  function emit(evt, payload){
    var arr = _listeners[evt] || [];
    for (var i=0;i<arr.length;i++){ try{ arr[i](payload); }catch(_){ } }
  }
  function scheduleWrite(){
    if (_timer) return;
    _timer = setTimeout(function(){
      _timer = null;
      writeRaw(_state);
      emit('change', { type:'flush' });
    }, WRITE_DELAY);
  }

  // 對外 API
  var SaveHub = {
    // 註冊命名空間規格（含版本與遷移器）
    registerNamespaces: function(specs){
      for (var ns in specs) if (specs.hasOwnProperty(ns)) _specs[ns] = specs[ns];
    },

    // 取得命名空間資料；第一次可給 defaultObj
    get: function(ns, defaultObj){
      if (!_state.data.hasOwnProperty(ns)){
        // —— 可選：舊版遷移（預設不做；要做可自行打開並改 key）
        // try{
        //   var oldRaw = localStorage.getItem('OLD_KEY_FOR_' + ns.toUpperCase());
        //   if (oldRaw){ _state.data[ns] = JSON.parse(oldRaw); }
        // }catch(_){}
        if (!_state.data.hasOwnProperty(ns)){
          _state.data[ns] = clone(defaultObj || {});
        }
        scheduleWrite();
      }
      var spec = _specs[ns];
      if (spec && typeof spec.version === 'number'){
        var node = _state.data[ns] || {};
        var ver = (node && node._ver) || 0;
        if (ver < spec.version && typeof spec.migrate === 'function'){
          var migrated = spec.migrate(clone(node)) || {};
          migrated._ver = spec.version;
          _state.data[ns] = migrated;
          scheduleWrite();
        } else if (ver === 0){
          node._ver = spec.version;
          scheduleWrite();
        }
      }
      return clone(_state.data[ns]);
    },

    // 設定命名空間資料（部分合併或整包替換）
    set: function(ns, partialObj, options){
      var cur = _state.data[ns] || {};
      var opt = options || {};
      var next = opt.replace ? clone(partialObj) : extend(clone(cur), partialObj);
      _state.data[ns] = next;
      scheduleWrite();
      emit('change', { type:'set', ns: ns });
    },

    on: function(evt, fn){
      _listeners[evt] = _listeners[evt] || [];
      _listeners[evt].push(fn);
      return function off(){
        var a = _listeners[evt]; if (!a) return;
        var i = a.indexOf(fn); if (i>=0) a.splice(i,1);
      };
    },

    flush: function(){
      if (_timer){ clearTimeout(_timer); _timer = null; }
      writeRaw(_state);
      emit('change', { type:'flush' });
    },

    _dump: function(){ return clone(_state); } // 除錯用
  };

  global.SaveHub = SaveHub;
})(this);