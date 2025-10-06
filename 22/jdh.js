// =======================  
// town_system.js — 城鎮系統（ES5 / 可直上）  ★升級：銀行/礦洞/訓練8小時、探索升級2小時、進度條  
// =======================  
(function (w) {  
  "use strict";  
  
  // ====== 可調參數 ======  
  var LS_KEY = "TOWN_V2";  
  
  // 主城：每級 +20% 產出（銀行/礦洞），上限 10  
  var MAIN_CITY_YIELD_PER_LV = 0.20;  
  var MAIN_CITY_MAX = 10;  
  
  // 銀行（Gold） — 上限 10，升級等待 8 小時  
  var BANK_BASE_PER_MIN = 10;  
  var BANK_PER_LV = 5;  
  var BANK_COST_LV1 = 20000;  
  var BANK_COST_GROWTH = 1.5;  
  var BANK_MAX = 10;  
  var BANK_UP_HOURS = 8;  
  
  // 礦洞（強化石） — 上限 10，升級等待 8 小時  
  var MINE_BASE_PER_MIN = 20;  
  var MINE_PER_LV = 10;  
  var MINE_COST_LV1 = 20000;  
  var MINE_COST_GROWTH = 2.0;  
  var MINE_MAX = 10;  
  var MINE_UP_HOURS = 8;  
  
  // 訓練營（EXP） — 上限 10，升級等待 8 小時（不受主城影響）  
  var CAMP_BASE_PER_HR = 100;  
  var CAMP_PER_LV = 100;  
  
var CAMP_GEM_COST_BASE = 100;  
function campNextGemCost(){  
  
  return CAMP_GEM_COST_BASE * Math.max(1, state.campLv || 1);  
}  
  var CAMP_UPGRADE_WAIT_HOURS = 8;  
  var CAMP_MAX = 10;  
  
  // 探索：每分鐘一次、每日上限 +10%/級；上限 15，升級 500 鑽 ×(lv+1)，等待 2 小時  
  var EXPLORE_TICK_SEC = 60;  
  var EXPLORE_CAP_PER_LV = 0.10;  
  var EXPLORE_MAX = 15;  
  var EXPLORE_UP_COST_BASE = 500; // cost = 500 * (lv+1)  
  var EXPLORE_UP_HOURS = 2;  
  
  // 探索掉落表  
  var EXPLORE_TABLE = [  
    { name: "鑽石",           type: "gem",    cap: 20,  rate: 0.01 },  
    { name: "SP點數券",       type: "item",   key: "sp點數券", cap: 5,   rate: 0.02 },  
    { name: "精華",       type: "ess_any",cap: 100, rate: 0.05 },  
    { name: "技能升級券",     type: "item",   key: "技能升級券", cap: 5,   rate: 0.01 },  
    { name: "元素碎片",       type: "item",   key: "元素碎片",   cap: 200, rate: 0.03 },  
    { name: "進階石",         type: "item",   key: "進階石",     cap: 100, rate: 0.03 },  
    { name: "元素精華",       type: "item",   key: "元素精華",   cap: 10,  rate: 0.003 },  
    { name: "衝星石",         type: "item",   key: "衝星石",     cap: 50,  rate: 0.05 },  
    { name: "星之碎片",       type: "item",   key: "星之碎片",   cap: 50,  rate: 0.03 },  
  ];  
  
  // ====== 工具 ======  
  function nowSec() { return Math.floor(Date.now() / 1000); }  
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }  
  function toInt(n){ n=Number(n); return (isFinite(n)? Math.floor(n) : 0); }  
  function byId(id){ return document.getElementById(id); }  
  function fmt(n){ return Number(n||0).toLocaleString(); }  
  function notify(msg){ try{ w.logPrepend && w.logPrepend(msg); }catch(_){ console.log(msg); } }  
  function upd(){ try{ w.updateResourceUI && w.updateResourceUI(); }catch(_){ } }  
  function save(){ try{ w.saveGame && w.saveGame(); }catch(_){ } }  
  
  // 背包接口護欄  
  function addItem(name, qty){  
    qty = toInt(qty||1);  
    if (qty<=0) return;  
    try{ w.addItem && w.addItem(name, qty); } catch(_){}  
  }  
  function getItemQuantity(name){  
    try{ return toInt(w.getItemQuantity ? w.getItemQuantity(name) : 0); }  
    catch(_){ return 0; }  
  }  
  function removeItem(name, qty){  
    qty = toInt(qty||1);  
    if (qty<=0) return false;  
    try{  
      if (w.removeItem){ w.removeItem(name, qty); return true; }  
    }catch(_){}  
    return false;  
  }  
  
  // 隨機抽一個擁有的「名字含 精華」道具（你可擴充）  
  function pickOwnedEssence(){  
    var probables = ["森林精華","沼澤精華","熔岩精華","天水精華","風靈精華","雷光精華","冰霜精華","黯影精華","煉獄精華","聖光精華","核心精華","精華"];  
    var candidates = [];  
    for (var i=0;i<probables.length;i++){  
      var key = probables[i];  
      var qty = getItemQuantity(key);  
      if (qty>0) candidates.push(key);  
    }  
    if (!candidates.length) return null;  
    return candidates[Math.floor(Math.random()*candidates.length)];  
  }  
  
  // ====== 狀態 ======  
  var state = load();  
  
  function load(){  
    try{  
      var raw = localStorage.getItem(LS_KEY);  
    if (!raw) return {  
  mainCityLv: 0,  
  mainCityFeed: 0,  
  
  bankLv: 1, bankUpStart: 0, bankProducedToday: 0,  
  mineLv: 1, mineUpStart: 0, mineProducedToday: 0,  
  
  campLv: 1, campUpStart: 0, campProducedToday: 0,  
  
  exploreLv: 0, exploreUpStart: 0,  
  
  lastTick: nowSec(),  
  _accGold: 0, _accStone: 0, _accExp: 0,  
  
  // ★ 這兩個是「畫面進度條」專用的秒數累積（不影響實際產出）  
  _prodCarrySec: 0,      // 銀行/礦洞 每 60s 的視覺進度  
  _campCarrySec: 0,      // 訓練營 每 3600s 的視覺進度  
  
  // 探索每日  
  // 探索每日  
exploreToday: dailyKey(),  
  dropsCount: {},  
  _exploreCarry: 0,  
    
  // 🔹 新增：探索歷史紀錄（字串陣列；最新在最前）  
  exploreLog: [],  
};  
      var obj = JSON.parse(raw);  
obj.dropsCount   = obj.dropsCount   || {};  
obj._exploreCarry= obj._exploreCarry|| 0;  
// 🔹 新增（容錯）  
obj.exploreLog   = obj.exploreLog   || [];  
      obj.bankProducedToday = obj.bankProducedToday||0;  
      obj.mineProducedToday = obj.mineProducedToday||0;  
      obj.campProducedToday = obj.campProducedToday || 0;  
obj._prodCarrySec = obj._prodCarrySec || 0;  
obj._campCarrySec = obj._campCarrySec || 0;  
      return obj;  
    }catch(_){  
      return {  
        mainCityLv: 0, mainCityFeed: 0,  
        bankLv: 1, bankUpStart: 0, bankProducedToday: 0,  
        mineLv: 1, mineUpStart: 0, mineProducedToday: 0,  
        campLv: 1, campUpStart: 0,  
        exploreLv: 0, exploreUpStart: 0,  
        lastTick: nowSec(), _accGold:0,_accStone:0,_accExp:0,  
        exploreToday: dailyKey(), dropsCount:{}, _exploreCarry:0,  
      };  
    }  
  }  
  function saveLocal(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(_){ } }  
  
  function dailyKey(){  
    var d = new Date();  
    return d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();  
  }  
  function ensureToday(){  
    var key = dailyKey();  
    if (state.exploreToday !== key){  
      state.exploreToday = key;  
      state.dropsCount = {};  
      state.bankProducedToday = 0;  
      state.mineProducedToday = 0;  
      saveLocal();  
    }  
  }  
  
  // ====== 計算與升級 ======  
  function mainCityYieldMult(){  
    var lv = clamp(state.mainCityLv, 0, MAIN_CITY_MAX);  
    return 1 + lv * MAIN_CITY_YIELD_PER_LV;  
  }  
  
  function bankPerMin(){  
    var lv = clamp(state.bankLv, 1, BANK_MAX);  
    return (BANK_BASE_PER_MIN + (lv - 1) * BANK_PER_LV) * mainCityYieldMult();  
  }  
  function bankNextCost(){  
    var lv = clamp(state.bankLv, 1, BANK_MAX);  
    var cost = BANK_COST_LV1;  
    for (var i=1; i<lv; i++) cost = Math.ceil(cost * BANK_COST_GROWTH);  
    return cost;  
  }  
  function bankUpRemainSec(){  
    if (!state.bankUpStart) return 0;  
    var end = state.bankUpStart + BANK_UP_HOURS*3600;  
    return Math.max(0, end - nowSec());  
  }  
  
  function minePerMin(){  
    var lv = clamp(state.mineLv, 1, MINE_MAX);  
    return (MINE_BASE_PER_MIN + (lv - 1) * MINE_PER_LV) * mainCityYieldMult();  
  }  
  function mineNextCost(){  
    var lv = clamp(state.mineLv, 1, MINE_MAX);  
    var cost = MINE_COST_LV1;  
    for (var i=1; i<lv; i++) cost = Math.ceil(cost * MINE_COST_GROWTH);  
    return cost;  
  }  
  function mineUpRemainSec(){  
    if (!state.mineUpStart) return 0;  
    var end = state.mineUpStart + MINE_UP_HOURS*3600;  
    return Math.max(0, end - nowSec());  
  }  
  
  function campPerHour(){  
    var lv = clamp(state.campLv, 1, CAMP_MAX);  
    return (CAMP_BASE_PER_HR + (lv - 1) * CAMP_PER_LV);  
  }  
  function campUpgradeStatus(){  
    if (!state.campUpStart) return null;  
    var dur = CAMP_UPGRADE_WAIT_HOURS * 3600;  
    var end = state.campUpStart + dur;  
    return { start: state.campUpStart, end: end, remainSec: Math.max(0, end - nowSec()) };  
  }  
  
  function exploreNextCost(){  
    if (state.exploreLv >= EXPLORE_MAX) return 0;  
    return EXPLORE_UP_COST_BASE * (state.exploreLv + 1); // 500 × (lv+1)  
  }  
  function exploreUpRemainSec(){  
    if (!state.exploreUpStart) return 0;  
    var end = state.exploreUpStart + EXPLORE_UP_HOURS*3600;  
    return Math.max(0, end - nowSec());  
  }  
  function todayCapBase(){  
    var out = [];  
    for (var i=0;i<EXPLORE_TABLE.length;i++){  
      var base = EXPLORE_TABLE[i].cap;  
      var cap = Math.floor(base * (1 + clamp(state.exploreLv,0,EXPLORE_MAX) * EXPLORE_CAP_PER_LV));  
      out.push(cap);  
    }  
    return out;  
  }  
  
  // ====== 動作 ======  
  function tryUpgradeBank(){  
    if (state.bankLv >= BANK_MAX){ notify("🏦 銀行已滿級"); return; }  
    if (bankUpRemainSec() > 0){ notify("⏳ 銀行升級進行中…"); return; }  
    var cost = bankNextCost();  
    var g = toInt(w.player && (w.player.gold||0));  
    if (g < cost){ notify("💰 金幣不足，升級失敗（需要 "+fmt(cost)+"）"); return; }  
    w.player.gold = g - cost;  
    state.bankUpStart = nowSec();  
    saveLocal(); upd(); save();  
    notify("🏦 銀行開始升級（需 8 小時）");  
    renderIfOpen();  
  }  
  function tryFinishBankUpgrade(){  
    var rem = bankUpRemainSec();  
    if (rem>0) return;  
    if (!state.bankUpStart) return;  
    state.bankUpStart = 0;  
    state.bankLv = clamp(state.bankLv+1, 1, BANK_MAX);  
    saveLocal(); renderIfOpen();  
    notify("🏦 銀行升級完成 → Lv."+state.bankLv);  
  }  
  
  function tryUpgradeMine(){  
    if (state.mineLv >= MINE_MAX){ notify("⛏ 礦洞已滿級"); return; }  
    if (mineUpRemainSec() > 0){ notify("⏳ 礦洞升級進行中…"); return; }  
    var cost = mineNextCost();  
    var g = toInt(w.player && (w.player.gold||0));  
    if (g < cost){ notify("💰 金幣不足，升級失敗（需要 "+fmt(cost)+"）"); return; }  
    w.player.gold = g - cost;  
    state.mineUpStart = nowSec();  
    saveLocal(); upd(); save();  
    notify("⛏ 礦洞開始升級（需 8 小時）");  
    renderIfOpen();  
  }  
  function tryFinishMineUpgrade(){  
    var rem = mineUpRemainSec();  
    if (rem>0) return;  
    if (!state.mineUpStart) return;  
    state.mineUpStart = 0;  
    state.mineLv = clamp(state.mineLv+1, 1, MINE_MAX);  
    saveLocal(); renderIfOpen();  
    notify("⛏ 礦洞升級完成 → Lv."+state.mineLv);  
  }  
  
function beginCampUpgrade(){  
  var st = campUpgradeStatus();  
  if (st && st.remainSec > 0){ notify("⏳ 訓練營升級進行中…"); return; }  
  
  // 先檢查鑽石成本  
  var cost = campNextGemCost();  
  var curGem = toInt(w.player && (w.player.gem || 0));  
  if (curGem < cost){  
    notify("💎 鑽石不足，升級需要 " + fmt(cost) + " 顆");  
    return;  
  }  
  // 扣鑽  
  w.player.gem = curGem - cost;  
  upd(); save();  
  
  // 開始等待（8 小時）  
  state.campUpStart = nowSec();  
  saveLocal(); renderIfOpen();  
  notify("🏋️ 訓練營開始升級（耗費 " + fmt(cost) + "💎，需 " + CAMP_UPGRADE_WAIT_HOURS + " 小時）");  
}  
  function tryFinishCampUpgrade(){  
    var st = campUpgradeStatus();  
    if (!st) return;  
    if (st.remainSec>0) return;  
    state.campUpStart = 0;  
    state.campLv = clamp(state.campLv+1, 1, CAMP_MAX);  
    saveLocal(); renderIfOpen();  
    notify("🏋️ 訓練營升級完成 → Lv."+state.campLv);  
  }  
  
// 可調參數：進度條對單顆機率的加成倍數（滿條時）與單顆最大上限  
var MAINCITY_PROGRESS_BONUS_MAX = 5;   // 滿條時 = 基礎機率的 5 倍  
var MAINCITY_PER_HIT_CAP        = 0.30; // 單顆機率不超過 30%（0.30）  
  
function tryFeedEssence(count){  
  if (state.mainCityLv >= MAIN_CITY_MAX){ notify("🏰 主城已滿級"); return 0; }  
  count = toInt(count||1);  
  if (count<=0) return 0;  
  var fed = 0;  
  for (var i=0; i<count; i++){  
    var key = pickOwnedEssence();  
    if (!key) break;  
    if (!removeItem(key,1)) break;  
    fed++;  
    state.mainCityFeed += 1;  
  
    var lv = Math.max(1, state.mainCityLv||0);  
    var p0 = 0.01 / lv;                // 基礎機率：1% / Lv  
    var pityNeed = 100 * lv;           // 保底需求  
    var prog = Math.min(1, (state.mainCityFeed || 0) / pityNeed); // 0~1 的進度  
  
    // 動態機率：從 p0 線性增加到 p0 * MAINCITY_PROGRESS_BONUS_MAX  
    var p = p0 * (1 + (MAINCITY_PROGRESS_BONUS_MAX - 1) * prog);  
    // 上限保護  
    if (p > MAINCITY_PER_HIT_CAP) p = MAINCITY_PER_HIT_CAP;  
  
    var pity = (state.mainCityFeed >= pityNeed); // 保底達成  
    var hit = pity || (Math.random() < p);  
  
    if (hit){  
      state.mainCityLv = clamp(state.mainCityLv+1, 0, MAIN_CITY_MAX);  
      state.mainCityFeed = 0;  
      notify("🏰 主城升級成功！→ Lv."+state.mainCityLv+"（銀行/礦洞產量 +20%）");  
      if (state.mainCityLv>=MAIN_CITY_MAX) break;  
    }  
  }  
  if (fed===0) notify("❌ 沒有可用的『精華』道具");  
  saveLocal(); renderIfOpen(); upd(); save();  
  return fed;  
}  
  
  // 探索升級：500 鑽 ×(lv+1)，等待 2 小時  
  function tryUpgradeExplore(){  
    if (state.exploreLv >= EXPLORE_MAX){ notify("🔎 探索已滿級"); return; }  
    if (exploreUpRemainSec() > 0){ notify("⏳ 探索升級進行中…"); return; }  
    var cost = exploreNextCost();  
    var g = toInt(w.player && (w.player.gem||0));  
    if (g < cost){ notify("💎 鑽石不足，升級失敗（需要 "+fmt(cost)+"）"); return; }  
    w.player.gem = g - cost;  
    state.exploreUpStart = nowSec();  
    saveLocal(); upd(); save();  
    notify("🔎 探索開始升級（需 "+EXPLORE_UP_HOURS+" 小時）");  
    renderIfOpen();  
  }  
  function tryFinishExploreUpgrade(){  
    var rem = exploreUpRemainSec();  
    if (rem>0) return;  
    if (!state.exploreUpStart) return;  
    state.exploreUpStart = 0;  
    state.exploreLv = clamp(state.exploreLv+1, 0, EXPLORE_MAX);  
    saveLocal(); renderIfOpen();  
    notify("🔎 探索升級完成 → Lv."+state.exploreLv);  
  }  
  
  // ====== 探索（每分鐘抽一次）======  
function doExploreOnce(){  
  ensureToday();  
  var caps = todayCapBase();  
  var gotAny = false;  
  var drops = []; // 🔹 記錄這次掉落了哪些  
  
  for (var i=0;i<EXPLORE_TABLE.length;i++){  
    var rec = EXPLORE_TABLE[i];  
    var used = toInt(state.dropsCount[i] || 0);  
    var cap = caps[i];  
    if (used >= cap) continue; // 今日對此項已到上限  
  
    if (Math.random() < rec.rate){  
      // 命中  
      if (rec.type === "gem"){  
        if (w.player){   
          w.player.gem = toInt(w.player.gem||0) + 1;   
          drops.push("💎 鑽石 ×1");   
          gotAny = true;   
        }  
      } else if (rec.type === "item"){  
        addItem(rec.key || rec.name, 1);  
        drops.push("📦 " + rec.name + " ×1");  
        gotAny = true;  
      } else if (rec.type === "ess_any"){  
        var chosen = pickOwnedEssence() || "精華";  
        addItem(chosen, 1);  
        drops.push("✨ " + chosen + " ×1");  
        gotAny = true;  
      }  
      state.dropsCount[i] = used + 1;  
    }  
  }  
  
// 🔹 時間字串  
var hh = new Date().getHours().toString().padStart(2,'0');  
var mm = new Date().getMinutes().toString().padStart(2,'0');  
var line;  
  
if (gotAny){  
  saveLocal(); upd(); save();  
  line = hh + ':' + mm + ' 取得：' + drops.join('、');  
} else {  
  if (typeof notify === "function") notify("🔍 探索這次沒有收穫…");  
  line = hh + ':' + mm + ' 未獲得任何物品';  
}  
  
// 🔹 寫入紀錄  
state.exploreLog.unshift(line);  
if (state.exploreLog.length > 30) state.exploreLog.length = 30;  
saveLocal();  
}  
  
  // ====== 產出輪詢（每 1 秒跑，依時間差補算）======  
  var TICK_INTERVAL = 1; // 秒  
  function tick(){  
    // 完成升級檢查  
    tryFinishBankUpgrade();  
    tryFinishMineUpgrade();  
    tryFinishCampUpgrade();  
    tryFinishExploreUpgrade();  
  
    var t = nowSec();  
var dt = Math.max(0, t - (state.lastTick||t));  
if (dt<=0){ state.lastTick = t; saveLocal(); return; }  
  
ensureToday();  
  
// === 銀行/礦洞：實際產出 ===  
var perMinGold = bankPerMin();  
var perMinStone = minePerMin();  
  
state._accGold  += (dt / 60)   * perMinGold;  
state._accStone += (dt / 60)   * perMinStone;  
  
var gWhole = Math.floor(state._accGold);  
var sWhole = Math.floor(state._accStone);  
if (gWhole>0 && w.player){  
  w.player.gold = toInt(w.player.gold||0) + gWhole;  
  state.bankProducedToday += gWhole;     // ★ 今日統計  
  state._accGold -= gWhole;  
}  
if (sWhole>0 && w.player){  
  w.player.stone = toInt(w.player.stone||0) + sWhole;  
  state.mineProducedToday += sWhole;     // ★ 今日統計  
  state._accStone -= sWhole;  
}  
  
// === 訓練營：實際產出（每小時） ===  
var perHrExp = campPerHour();  
state._accExp += (dt / 3600) * perHrExp;  
  
var eWhole = Math.floor(state._accExp);  
if (eWhole>0){  
  if (typeof w.gainExp === "function") w.gainExp(eWhole);  
  else if (w.player) w.player.exp = toInt((w.player.exp||0) + eWhole);  
  state.campProducedToday += eWhole;     // ★ 今日統計  
  state._accExp -= eWhole;  
}  
  
// === 視覺用進度條秒數（不影響產出） ===  
// 銀行/礦洞進度：每 60 秒一輪  
state._prodCarrySec = (state._prodCarrySec || 0) + dt;  
while (state._prodCarrySec >= 60) state._prodCarrySec -= 60;  
  
// 訓練營進度：每 3600 秒（1 小時）一輪  
state._campCarrySec = (state._campCarrySec || 0) + dt;  
while (state._campCarrySec >= 3600) state._campCarrySec -= 3600;  
  
// === 探索（不變） ===  
state._exploreCarry = (state._exploreCarry||0) + dt;  
while (state._exploreCarry >= EXPLORE_TICK_SEC){  
  state._exploreCarry -= EXPLORE_TICK_SEC;  
  doExploreOnce();  
}  
  
state.lastTick = t;  
saveLocal();  
renderIfOpen();  
upd();  
  }  
  // ====== UI（維持你原本結構，只在卡片內新增幾行與進度條）======  
  var $modal;  
  function openModal(){  
    ensureModal();  
    renderModal();  
    $modal.style.display = "flex";  
  }  
  function closeModal(){ if ($modal) $modal.style.display = "none"; }  
  
  function ensureModal(){  
    if ($modal) return;  
    var m = document.createElement("div");  
    m.id = "townModal";  
    m.style.cssText = "position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.65);z-index:9999;padding:12px;";  
    var wrap = document.createElement("div");  
    wrap.style.cssText = "width:min(720px,96vw);max-height:92vh;overflow:auto;background:#121319;color:#eef;border:1px solid #3b3f5c;border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.5);font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;";  
    var head = document.createElement("div");  
    head.style.cssText = "position:sticky;top:0;background:#0f1016;padding:10px 12px;border-bottom:1px solid #2b2f4a;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between";  
    head.innerHTML = '<div style="font-weight:800;letter-spacing:.5px">🏙 城鎮系統</div><button id="townCloseBtn" style="background:#333;color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer">✖</button>';  
    var body = document.createElement("div");  
    body.id = "townBody";  
    body.style.cssText = "padding:12px;display:grid;grid-template-columns:1fr;gap:12px;";  
  
    wrap.appendChild(head);  
    wrap.appendChild(body);  
    m.appendChild(wrap);  
    document.body.appendChild(m);  
    $modal = m;  
  
    var btn = document.getElementById("townCloseBtn");  
    if (btn) btn.onclick = closeModal;  
    m.addEventListener("click", function(e){ if (e.target===m) closeModal(); });  
  }  
  function renderIfOpen(){ if ($modal && $modal.style.display==="flex") renderModal(); }  
  
  function sectionCard(title, innerHtml){  
    return ''+  
      '<div style="background:#191b25;border:1px solid #2f3555;border-radius:10px;padding:10px;">' +  
      '<div style="font-weight:700;margin-bottom:6px">'+ title +'</div>' +  
      innerHtml +  
      '</div>';  
  }  
  function bar(pct){  
    pct = clamp(pct,0,100);  
    return '<div style="height:8px;background:#1c2144;border-radius:999px;overflow:hidden;margin-top:6px">'+  
           '<span style="display:block;height:100%;width:'+pct+'%;background:linear-gradient(90deg,#6aa9ff,#79ffc8)"></span>'+  
           '</div>';  
  }  
  
  function renderModal(){  
    var body = byId("townBody"); if (!body) return;  
  
    var goldPerMin = bankPerMin();  
    var stonePerMin = minePerMin();  
    var expPerHr = campPerHour();  
  
    // 銀行/礦洞生產進度（每 60s）  
var prodCarry = state._prodCarrySec || 0;  
var nextProdSec = Math.max(0, Math.ceil(60 - prodCarry));  
var prodPct = Math.floor((prodCarry / 60) * 100);  
  
// 訓練營生產進度（每 3600s）  
var campCarry = state._campCarrySec || 0;  
var nextCampMin = Math.max(0, Math.ceil((3600 - campCarry) / 60));  
var campProdPct = Math.floor((campCarry / 3600) * 100);  
  
    // 主城  
    var needFeed = 100 * Math.max(1, state.mainCityLv||1);  
// 👉 進度條＋機率提示版  
var lvNow = Math.max(0, state.mainCityLv || 0);  
var pityNeed = 100 * Math.max(1, lvNow || 1);   // 保底需求  
var fed = Math.max(0, state.mainCityFeed || 0);  
var prog = Math.min(1, fed / pityNeed);         // 0~1  
var pct = Math.round(prog * 100);  
var perHit = 1 / Math.max(1, lvNow || 1);       // 單顆成功率（%）  
var perHitText = perHit.toFixed(2) + "%";       // 顯示  
  
// 下一級產能預告（銀行/礦洞 +20%）  
var bankPreview = (bankPerMin() * 1.20).toFixed(1);  
var minePreview = (minePerMin() * 1.20).toFixed(1);  
  
// 小工具：純 HTML 進度條  
function barHtml(p) {  
  var w = Math.max(0, Math.min(100, Math.round(p)));  
  // 顏色分級：<=60% 藍、<=90% 橘、>90% 綠  
  var col = (w <= 60) ? "#3b82f6" : (w <= 90 ? "#f59e0b" : "#22c55e");  
  return '' +  
  '<div style="margin-top:8px;border:1px solid #2f3555;border-radius:8px;height:10px;overflow:hidden;background:#111b2a;">' +  
    '<div style="height:100%;width:'+w+'%;background:'+col+';box-shadow:0 0 8px rgba(255,255,255,.15) inset"></div>' +  
  '</div>' +  
  '<div style="display:flex;justify-content:space-between;opacity:.85;margin-top:4px;font-size:12px">' +  
    '<div>升級進度（保底）</div><div>'+ w +'%</div>' +  
  '</div>';  
}  
  
var mainCityHtml =  
  '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+  
    '<div>等級：<b>Lv.'+ lvNow +'</b></div>'+  
    '<div>產量加成：<b>'+ (MAIN_CITY_YIELD_PER_LV*100*lvNow).toFixed(0) +'%</b>（銀行/礦洞）</div>'+  
    '<div>本級已餵：<b>'+ fed +'</b> / 保底 <b>'+ pityNeed +'</b></div>'+  
  '</div>'+  
  
  // 進度條  
  barHtml(pct) +  
  
  // 機率提示  
  '<div style="margin-top:6px;opacity:.9">單顆成功率增加：<b>'+ perHitText +'</b>；' +  
  '餵 10 顆成功率 ≈ <b>'+ (100 * (1 - Math.pow(1 - perHit/100, 10))).toFixed(1) +'%</b>，' +  
  '餵 50 顆成功率 ≈ <b>'+ (100 * (1 - Math.pow(1 - perHit/100, 50))).toFixed(1) +'%</b></div>' +  
  
  // 升級後預告  
  '<div style="margin-top:4px;opacity:.8;font-size:12px">升級後產量預估：銀行 <b>'+ bankPreview +'</b> 金幣/分、礦洞 <b>'+ minePreview +'</b> 強化石/分</div>'+  
  
  // 操作鈕  
  '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">'+  
    '<button id="btnFeed1"  style="background:#3a6;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer">餵 1 顆精華</button>'+  
    '<button id="btnFeed10" style="background:#284;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer">餵 10 顆精華</button>'+  
    '<button id="btnFeed50" style="background:#173;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer">餵 50 顆精華</button>'+  
  '</div>';  
  
 // 銀行  
    var bankRemain = bankUpRemainSec();  
    var bankPct = bankRemain>0 ? Math.floor(((BANK_UP_HOURS*3600 - bankRemain)/(BANK_UP_HOURS*3600))*100) : 0;  
    var bankHtml =  
      '<div>等級：<b>Lv.'+state.bankLv+' / '+BANK_MAX+'</b></div>'+  
      '<div>當前產量：<b>'+fmt(goldPerMin.toFixed(1))+'</b> 金幣 / 分鐘</div>'+  
      '<div class="mini" style="opacity:.85;margin-top:2px">今日總獲得：<b>'+fmt(state.bankProducedToday)+'</b>　下次入帳倒數：<b>'+nextProdSec+'s</b></div>'+  
      bar(prodPct) +  
      (bankRemain>0  
        ? '<div style="color:#9cf;margin-top:8px">升級中（剩餘 '+fmt(Math.ceil(bankRemain/60))+' 分）</div>'+ bar(bankPct)  
        : '<div style="opacity:.85;margin-top:6px">下一級費用：<b>'+fmt(bankNextCost())+'</b> 金幣</div>'+  
          '<div style="margin-top:8px"><button id="btnBankUp" style="background:#6a6ad0;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer" '+(state.bankLv>=BANK_MAX?'disabled':'')+'>開始升級（8 小時）</button></div>'  
      );  
  
    // 礦洞  
    var mineRemain = mineUpRemainSec();  
    var minePct = mineRemain>0 ? Math.floor(((MINE_UP_HOURS*3600 - mineRemain)/(MINE_UP_HOURS*3600))*100) : 0;  
    var mineHtml =  
      '<div>等級：<b>Lv.'+state.mineLv+' / '+MINE_MAX+'</b></div>'+  
      '<div>當前產量：<b>'+fmt(stonePerMin.toFixed(1))+'</b> 強化石 / 分鐘</div>'+  
      '<div class="mini" style="opacity:.85;margin-top:2px">今日總獲得：<b>'+fmt(state.mineProducedToday)+'</b>　下次入帳倒數：<b>'+nextProdSec+'s</b></div>'+  
      bar(prodPct) +  
      (mineRemain>0  
        ? '<div style="color:#9cf;margin-top:8px">升級中（剩餘 '+fmt(Math.ceil(mineRemain/60))+' 分）</div>'+ bar(minePct)  
        : '<div style="opacity:.85;margin-top:6px">下一級費用：<b>'+fmt(mineNextCost())+'</b> 金幣</div>'+  
          '<div style="margin-top:8px"><button id="btnMineUp" style="background:#6ab06a;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer" '+(state.mineLv>=MINE_MAX?'disabled':'')+'>開始升級（8 小時）</button></div>'  
      );  
  
    // 訓練營  
    var campSt = campUpgradeStatus();  
    var campRemain = campSt ? campSt.remainSec : 0;  
    var campPct = campRemain>0 ? Math.floor(((CAMP_UPGRADE_WAIT_HOURS*3600 - campRemain)/(CAMP_UPGRADE_WAIT_HOURS*3600))*100) : 0;  
 var campHtml =  
  '<div>等級：<b>Lv.' + state.campLv + ' / ' + CAMP_MAX + '</b>（不受主城影響）</div>' +  
  '<div>當前產量：<b>' + fmt(expPerHr) + '</b> EXP / 小時</div>' +  
  '<div class="mini" style="opacity:.85;margin-top:2px">今日總獲得：<b>' + fmt(state.campProducedToday || 0) + '</b>　下一次入帳：約 <b>' + nextCampMin + ' 分</b></div>' +  
  bar(campProdPct) +  
  (campRemain > 0 ?  
    '<div style="color:#9cf;margin-top:6px">升級中（剩餘 ' + fmt(Math.ceil(campRemain / 60)) + ' 分）</div>' + bar(campPct) :  
    '<div style="margin-top:6px;opacity:.85">升級成本：<b>' + fmt(campNextGemCost()) + '</b> 💎</div>' +  
    '<div style="margin-top:8px"><button id="btnCampUp" style="background:#d06a6a;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer" ' + (state.campLv >= CAMP_MAX ? 'disabled' : '') + '>開始升級（需等待 ' + CAMP_UPGRADE_WAIT_HOURS + ' 小時）</button></div>'  
  );  
    // 探索  
    var caps = todayCapBase();  
    var rows = '';  
    for (var i=0;i<EXPLORE_TABLE.length;i++){  
      var rec = EXPLORE_TABLE[i];  
      var used = toInt(state.dropsCount[i]||0);  
      var cap = caps[i];  
      rows += '<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px dashed #2a2f4a">'+  
              '<div>'+rec.name+' <span style="opacity:.7">（機率 '+(rec.rate*100).toFixed(2)+'%）</span></div>'+  
              '<div><b>'+used+'</b> / '+cap+'</div>'+  
              '</div>';  
    }  
    var exploreRemain = exploreUpRemainSec();  
    var explorePct = exploreRemain>0 ? Math.floor(((EXPLORE_UP_HOURS*3600 - exploreRemain)/(EXPLORE_UP_HOURS*3600))*100) : 0;  
    var sinceCarry = (state._exploreCarry||0)%EXPLORE_TICK_SEC;  
    var toNextExplore = Math.max(0, EXPLORE_TICK_SEC - sinceCarry);  
    var exploreTickPct = Math.floor(((EXPLORE_TICK_SEC - toNextExplore)/EXPLORE_TICK_SEC)*100);  
  
    var exploreHtml =  
  '<div>探索等級：<b>Lv.' + state.exploreLv + ' / ' + EXPLORE_MAX + '</b>（每級每日上限 +10%）</div>' +  
  '<div class="mini" style="opacity:.85;margin-top:2px">下次探索倒數：<b>' + Math.ceil(toNextExplore) + 's</b></div>' +  
  bar(exploreTickPct) +  
  '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #2a2f4a">' + rows + '</div>' +  
    
  // === 這一段就是你原本的（完整保留） ===  
  (exploreRemain > 0 ?  
    '<div style="color:#9cf;margin-top:8px">升級中（剩餘 ' + fmt(Math.ceil(exploreRemain / 60)) + ' 分）</div>' + bar(explorePct) :  
    '<div style="margin-top:8px"><button id="btnExploreUp" style="background:#5360ff;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer" ' + (state.exploreLv >= EXPLORE_MAX ? 'disabled' : '') + '>提升探索等級（花費 ' + fmt(exploreNextCost()) + ' 鑽石｜需 2 小時）</button></div>'  
  ) +  
    
  // === 新增：探索紀錄（接在原本區塊後面） ===  
  '<div style="margin-top:12px;border-top:1px solid #2a2f4a;padding-top:6px">' +  
  '<div style="opacity:.9;font-weight:700;margin-bottom:6px">探索紀錄</div>' +  
  '<div style="max-height:140px;overflow:auto;border:1px solid #2f3555;border-radius:6px;padding:6px 8px;background:#151826">' +  
  (state.exploreLog && state.exploreLog.length ?  
    state.exploreLog.map(function(s) {  
      return '<div style="padding:2px 0;border-bottom:1px dashed #2a2f4a">' + s + '</div>';  
    }).join('') :  
    '<div style="opacity:.6">（目前沒有紀錄）</div>'  
  ) +  
  '</div>' +  
  '</div>';  
    body.innerHTML =  
      sectionCard("🏰 主城", mainCityHtml) +  
      sectionCard("🏦 銀行", bankHtml) +  
      sectionCard("⛏ 礦洞", mineHtml) +  
      sectionCard("🏋️ 訓練營", campHtml) +  
      sectionCard("🔍 探索（每日）", exploreHtml);  
  
    // 綁定  
var b1 = byId("btnFeed1");  
if (b1) b1.onclick = function(){ tryFeedEssence(1); };  
  
var b10 = byId("btnFeed10");  
if (b10) b10.onclick = function(){  
  var lv = Math.max(1, state.mainCityLv || 1);  
  var p  = 1 / lv / 100; // 單顆機率（0~1）  
  var chance = 100 * (1 - Math.pow(1 - p, 10));  
  var ok = confirm(  
    "確定餵 10 顆精華嗎？\n\n" +  
    "當前單顆成功率：約 " + (p*100).toFixed(2) + "%\n" +  
    "本次成功率（10 顆）約 " + chance.toFixed(1) + "%\n\n" +  
    "升級後銀行/礦洞產量將 +20%"  
  );  
  if (ok) tryFeedEssence(10);  
};  
  
var b50 = byId("btnFeed50");  
if (b50) b50.onclick = function(){  
  var lv = Math.max(1, state.mainCityLv || 1);  
  var p  = 1 / lv / 100; // 單顆機率（0~1）  
  var chance = 100 * (1 - Math.pow(1 - p, 50));  
  var ok = confirm(  
    "確定餵 50 顆精華嗎？\n\n" +  
    "當前單顆成功率：約 " + (p*100).toFixed(2) + "%\n" +  
    "本次成功率（50 顆）約 " + chance.toFixed(1) + "%\n\n" +  
    "升級後銀行/礦洞產量將 +20%"  
  );  
  if (ok) tryFeedEssence(50);  
};  
  
    var bb = byId("btnBankUp"); if (bb) bb.onclick = tryUpgradeBank;  
    var bm = byId("btnMineUp"); if (bm) bm.onclick = tryUpgradeMine;  
    var bc = byId("btnCampUp"); if (bc) bc.onclick = beginCampUpgrade;  
    var be = byId("btnExploreUp"); if (be) be.onclick = tryUpgradeExplore;  
  }  
  
  // ====== 啟動 ======  
  function init(){  
    setInterval(tick, TICK_INTERVAL * 1000);  
  
    // 每日重置（銀行/礦洞 今日總獲得 + 探索統計）  
    setInterval(function(){  
      var key = dailyKey();  
      if (state._lastDailyKey !== key){  
        state._lastDailyKey = key;  
state.bankProducedToday = 0;  
state.mineProducedToday = 0;  
state.campProducedToday = 0; // ★ 新增  
state.exploreToday = key;  
state.dropsCount = {};  
        saveLocal(); renderIfOpen();  
      }  
    }, 30*1000);  
  
    // 測試進入按鈕（若主頁沒有）  
    if (!byId("townBtn")){  
      var btn = document.createElement("button");  
      btn.id = "townBtn";  
      btn.innerHTML = "🏙 城鎮";  
      btn.style.cssText = "position:fixed;right:12px;bottom:60px;z-index:10001;border:none;border-radius:10px;background:#5360ff;color:#fff;padding:8px 12px;font-weight:700;";  
      btn.onclick = openModal;  
      document.body.appendChild(btn);  
    }  
  }  
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);  
  else init();  
  
  // ====== 對外 API ======  
  w.Town = {  
    open: openModal,  
    feedEssence: tryFeedEssence,  
    bankUpgrade: tryUpgradeBank,  
    mineUpgrade: tryUpgradeMine,  
    campBeginUpgrade: beginCampUpgrade,  
    setExploreLevel: function(lv){ lv=toInt(lv); if(lv<0)lv=0; state.exploreLv=clamp(lv,0,EXPLORE_MAX); saveLocal(); renderIfOpen(); },  
    _state: state  
  };  
  
})(window);  