// =======================================================
// job_passives_store.js — 職業被動：純資料層（用「被動能力券」）ES5
// - 優先使用 SaveHub 做統一存檔（fallback: localStorage）
// - canLevelUp/tryLevelUp：檢查/扣除 道具「被動能力券」
// - 其餘存檔/事件流不變；不包含 UI / Toast（資料層）
// 依賴（建議）：save_hub_es5.js（可無，則回退 localStorage）
// =======================================================
(function (w) {
  "use strict";
  if (w.JobPassiveStore) return;

  // ===== 常數 =====
  var SAVE_NS  = "job_passives";   // SaveHub 命名空間
  var SAVE_KEY = "被動券"; // localStorage 回退鍵
  var COST_PER_LEVEL = 1; // 每級消耗 1 張券（僅做檢查與消耗）
  var MAX_LV = 10;

  // ===== 介面：道具券（被動能力券）=====
  function getTickets(){
    try{
      if (typeof w.getItemQuantity === 'function') return (w.getItemQuantity('被動能力券')|0);
    }catch(_){}
    return 0;
  }
  function consumeTickets(n){
    n = (n|0) || 1;
    try{
      if (typeof w.getItemQuantity==='function' && typeof w.removeItem==='function'){
        if ((w.getItemQuantity('被動能力券')|0) >= n){
          w.removeItem('被動能力券', n);
          return true;
        }
      }
    }catch(_){}
    return false;
  }

  // ===== 技能定義 =====
  var SKILLS = {
    warrior: { key: "fortitude",  cap: MAX_LV, name: "堅韌護體" },
    mage:    { key: "manaGuard",  cap: MAX_LV, name: "魔力護體" },
    thief:   { key: "flurry",     cap: MAX_LV, name: "連續攻擊" },
    archer:  { key: "quickdraw",  cap: MAX_LV, name: "先手再動" }
  };

  // 取基底職（若有進階職，規一化為基底）
  function getBaseJobSafe(job){
    var j = String(job||"").toLowerCase();
    if (typeof w.getBaseJob === 'function') return w.getBaseJob(j);
    return j.replace(/\d+$/, "");
  }

  // ===== 存檔層（SaveHub 優先 / localStorage 回退）=====
  function freshState(){
    return {
      warrior:{ fortitude:0 },
      mage:{    manaGuard:0 },
      thief:{   flurry:0 },
      archer:{  quickdraw:0 }
    };
  }

  function clampLv(x){ x = Number(x)||0; return Math.max(0, Math.min(MAX_LV, x)); }

  function normalizeState(o){
    o = o || {};
    o.warrior = o.warrior || { fortitude:0 };
    o.mage    = o.mage    || { manaGuard:0 };
    o.thief   = o.thief   || { flurry:0 };
    o.archer  = o.archer  || { quickdraw:0 };
    o.warrior.fortitude = clampLv(o.warrior.fortitude);
    o.mage.manaGuard    = clampLv(o.mage.manaGuard);
    o.thief.flurry      = clampLv(o.thief.flurry);
    o.archer.quickdraw  = clampLv(o.archer.quickdraw);
    return o;
  }

  // SaveHub 讀寫（若不存在則用 localStorage）
  var useSaveHub = !!w.SaveHub;
  if (useSaveHub){
    // 註冊命名空間（可做版本遷移）
    try{
      var spec = {}; spec[SAVE_NS] = { version: 1, migrate: function(old){ return normalizeState(old||freshState()); } };
      w.SaveHub.registerNamespaces(spec);
    }catch(_){}
  }

  function loadState(){
    try{
      if (useSaveHub){
        var s = w.SaveHub.get(SAVE_NS, freshState());
        return normalizeState(s);
      }else{
        var raw = localStorage.getItem(SAVE_KEY);
        return normalizeState(raw ? JSON.parse(raw)||freshState() : freshState());
      }
    }catch(_){
      return freshState();
    }
  }
  function saveState(s){
    try{
      if (useSaveHub) w.SaveHub.set(SAVE_NS, s);
      else localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    }catch(_){}
  }

  var state = loadState();

  // ===== 事件訂閱 =====
  var subs = [];
  function snapshotLevels(){
    return {
      warrior:{ fortitude: state.warrior.fortitude|0 },
      mage:{    manaGuard: state.mage.manaGuard|0 },
      thief:{   flurry:    state.thief.flurry|0 },
      archer:{  quickdraw: state.archer.quickdraw|0 }
    };
  }
  function notify(){ for (var i=0;i<subs.length;i++){ try{ subs[i](snapshotLevels()); }catch(_){ } } }

  // ===== 能否升級 / 嘗試升級 =====
  function canLevelUp(jobKey){
    var base = getBaseJobSafe(w.player && w.player.job);
    if (base !== jobKey) return false; // 只有本職能升級
    if (getTickets() < COST_PER_LEVEL) return false;

    if (jobKey === 'warrior') return (state.warrior.fortitude < SKILLS.warrior.cap);
    if (jobKey === 'mage')    return (state.mage.manaGuard   < SKILLS.mage.cap);
    if (jobKey === 'thief')   return (state.thief.flurry     < SKILLS.thief.cap);
    if (jobKey === 'archer')  return (state.archer.quickdraw < SKILLS.archer.cap);
    return false;
  }

  function tryLevelUp(jobKey){
    if (!canLevelUp(jobKey)) return false;
    if (!consumeTickets(COST_PER_LEVEL)) return false;

    if (jobKey === 'warrior') state.warrior.fortitude++;
    else if (jobKey === 'mage') state.mage.manaGuard++;
    else if (jobKey === 'thief') state.thief.flurry++;
    else if (jobKey === 'archer') state.archer.quickdraw++;
    else return false;

    saveState(state);
    notify();
    return true;
  }

  // ===== 直接設級（GM / 同步用）=====
  function setLevel(jobKey, key, lv){
    lv = clampLv(lv|0);
    if (jobKey==='warrior' && key==='fortitude') state.warrior.fortitude = lv;
    if (jobKey==='mage'    && key==='manaGuard') state.mage.manaGuard    = lv;
    if (jobKey==='thief'   && key==='flurry')    state.thief.flurry      = lv;
    if (jobKey==='archer'  && key==='quickdraw') state.archer.quickdraw  = lv;
    saveState(state);
    notify();
  }

  // ===== 對外 API =====
  w.JobPassiveStore = {
    getState: function(){ return JSON.parse(JSON.stringify(state)); },
    getLevels: snapshotLevels,
    tryLevelUp: tryLevelUp,
    setLevel: setLevel,
    canLevelUp: canLevelUp,
    getConfig: function(){
      return {
        COST_PER_LEVEL: COST_PER_LEVEL,
        MAX_LV: MAX_LV,
        SKILLS: JSON.parse(JSON.stringify(SKILLS))
      };
    },
    subscribe: function(fn){ if (typeof fn === 'function') subs.push(fn); },
    unsubscribe: function(fn){ subs = subs.filter(function(f){ return f!==fn; }); }
  };
})(window);