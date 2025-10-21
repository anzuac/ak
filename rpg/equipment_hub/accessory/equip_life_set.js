// =======================================================
// equip_life_set.js — 生命套裝（項鍊／戒指／耳環）ES5（固定機率版）
// - 存檔：SaveHub 優先（命名空間 life_set_v1），無 SaveHub 時回退 localStorage
// - 首次載入若 SaveHub 無資料且 localStorage(life_accessory_set_v1) 有舊檔，會自動遷移並移除舊檔
// - 讀背包：getItemQuantity / removeItem
// - 掛載到 EquipHub：EquipHub.registerTab
// - 回復力加成 = 強化(每等+2%) + 突破(每階+5%) + 套裝效果(全三件達破4：HP+5000 / MP+300 / 回復+50%)
// - 解放：須先達成套裝效果後開啟；每次成功+5等強化上限；最多3次
// - 成本：強化/突破/解放 隨等級/階段/解放次數遞增（新版曲線已實作）
// - ✅ 成功率固定，不隨失敗提高（無保底/無失敗累加）
// =======================================================
(function () {
  if (window.LifeSetTab) return;

  // ====== SaveHub / Storage ======
  var SAVEHUB = window.SaveHub || null;
  var NS = "life_set_v1";
  var OLD_LS_KEY = "life_accessory_set_v1"; // 舊 localStorage 存檔鍵（自動遷移來源）

  function freshPart(){ return { level:0, enhFail:0, stage:0, lib:0, libFail:0 }; } // 保留舊欄位以相容
  function freshState(){ return { items: { necklace: freshPart(), ring: freshPart(), earring: freshPart() } }; }

  function toInt(n){ n = Number(n); return isFinite(n) ? Math.floor(n) : 0; }
  function normalizePart(p){
    p = p && typeof p==="object" ? p : freshPart();
    return {
      level: toInt(p.level||0),
      enhFail: toInt(p.enhFail||0), // 固定機率，不使用，但保留避免舊檔報錯
      stage: toInt(p.stage||0),
      lib: toInt(p.lib||0),
      libFail: toInt(p.libFail||0)  // 固定機率，不使用，但保留避免舊檔報錯
    };
  }
  function normalizeState(s){
    s = s && typeof s==="object" ? s : freshState();
    s.items = s.items || {};
    s.items.necklace = normalizePart(s.items.necklace);
    s.items.ring     = normalizePart(s.items.ring);
    s.items.earring  = normalizePart(s.items.earring);
    return s;
  }

  (function registerSaveHub(){
    if (!SAVEHUB) return;
    try{
      var schema = {
        version: 1,
        migrate: function(old){ return normalizeState(old||{}); }
      };
      if (typeof SAVEHUB.registerNamespaces === "function") {
        var pack = {}; pack[NS] = schema; SAVEHUB.registerNamespaces(pack);
      } else if (typeof SAVEHUB.registerNamespace === "function") {
        SAVEHUB.registerNamespace(NS, schema);
      }
    }catch(e){ console && console.warn && console.warn("[life_set] SaveHub register failed", e); }
  })();

  function shGet(def){
    if (!SAVEHUB) return def;
    try{
      if (typeof SAVEHUB.get === "function") return SAVEHUB.get(NS, def);
      if (typeof SAVEHUB.read === "function") return SAVEHUB.read(NS, def);
    }catch(e){ console && console.warn && console.warn("[life_set] SaveHub read failed", e); }
    return def;
  }
  function shSet(val){
    if (!SAVEHUB) return;
    try{
      if (typeof SAVEHUB.set === "function") { SAVEHUB.set(NS, val); return; }
      if (typeof SAVEHUB.write === "function") { SAVEHUB.write(NS, val); return; }
    }catch(e){ console && console.warn && console.warn("[life_set] SaveHub write failed", e); }
  }

  function lsRead(){
    try{ var raw = localStorage.getItem(OLD_LS_KEY); return raw ? JSON.parse(raw) : null; }catch(_){ return null; }
  }
  function lsWrite(s){
    try{ localStorage.setItem(OLD_LS_KEY, JSON.stringify(s)); }catch(_){}
  }
  function lsRemove(){
    try{ localStorage.removeItem(OLD_LS_KEY); }catch(_){}
  }

  // 載入：SaveHub 優先；無則嘗試遷移 localStorage 舊檔
  var STATE = (function load(){
    var s = shGet(null);
    if (!s){
      var old = lsRead();
      if (old){
        s = normalizeState(old);
        shSet(s); // 遷移到 SaveHub
        lsRemove();
      }
    }
    return normalizeState(s || freshState());
  })();

  function save(){
    // 同步寫回 SaveHub；若沒有 SaveHub，才使用 localStorage 後備
    if (SAVEHUB) shSet(STATE);
    else lsWrite(STATE);
  }

  // ====== 常數 ======
  var ENHANCE_ITEM = "生命強化石";
  var BREAK_ITEM   = "生命突破石";

  var BASE_ENHANCE_MAX = 10;     // 初始強化上限
  var LIBERATION_CAP_INC = 5;    // 每次解放 +5
  var LIBERATION_MAX_TIMES = 3;  // 最多 3 次

  // ✅ 成功率固定（不再因失敗累加）
  var ENH_BASE_CHANCE = 0.20;    // 強化基礎成功率 20%（固定）
  var ENH_FAIL_STEP   = 0.00;    // 失敗不再提高機率（保留欄位但不生效）
  var ENH_PITY_CAP    = 1.00;    // 無意義（固定機率），保留避免舊檔報錯

  var BT_BASE_CHANCE  = 0.10;    // 突破成功率 10%（固定）
  var BT_COST         = 20;      // 舊常數，僅作參考，實際成本走函式

  var LIB_BASE_CHANCE = 0.10;    // 解放基礎成功率 10%（固定）
  var LIB_FAIL_STEP   = 0.00;    // 失敗不再提高機率

  var ENH_LV_INC_REC  = 0.02;    // 每等 +2% 回復力
  var BT_STAGE_INC_REC= 0.05;    // 每階 +5% 回復力

  // 套裝效果（當三件皆達 突破4）
  var SET_HP   = 5000;
  var SET_MP   = 300;
  var SET_REC  = 0.50;           // 回復 +50%

  // 名稱冠名（突破 0~4）
  var PREFIX = ["生命", "守護", "命運", "祝福", "生命女神祝福"];

  // ====== 工具 ======
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function rand01(){ return Math.random(); }

  // 背包
  function hasItem(name, need){ return (getItemQuantity?getItemQuantity(name):0) >= need; }
  function consumeItem(name, n){
    if (typeof removeItem === 'function') removeItem(name, n);
    else if (window.inventory){ window.inventory[name] = Math.max((window.inventory[name]||0)-n,0); }
    try { saveGame && saveGame(); } catch(_){}
  }

  // 顯示名
  function partTitle(key, stage){
    var base = (key==='necklace'?'項鍊': key==='ring'?'戒指':'耳環');
    var pre  = PREFIX[clamp(stage,0,4)] || PREFIX[0];
    return pre + base;
  }

  // 強化上限（受解放影響）
  function maxEnhanceOf(part){
    var base = BASE_ENHANCE_MAX;
    var plus = clamp(part.lib, 0, LIBERATION_MAX_TIMES) * LIBERATION_CAP_INC;
    return base + plus;
  }

  // ✅ 固定成功率
  function enhanceChance(part){ return ENH_BASE_CHANCE; }
  function liberationChance(part){ return clamp(LIB_BASE_CHANCE, 0, 1); }

  // ✅ 強化消耗（新規）：隨 等級/突破階/解放次數 遞增
  //    cost = 8 + 4*level + 6*stage + 10*lib
  function enhanceCostStones(part){
    var lv = part.level|0, st = part.stage|0, lb = part.lib|0;
    return Math.max(1, 8 + 4*lv + 6*st + 10*lb);
  }

  // ✅ 突破/解放成本：實作版
  // 突破（生命突破石）：base = 20*(lv+1)；weight = 1 + 0.25*stage
  function breakthroughCost(part){
    var lv = part.level|0, st = part.stage|0;
    var base = 20 * (lv + 1);
    var weight = 1 + 0.25 * st;
    return Math.max(1, Math.floor(base * weight));
  }
  // 解放（生命突破石）：base = 30*(lv+1)；weight = 1 + 0.50*lib
  function liberationCost(part){
    var lv = part.level|0, lb = part.lib|0;
    var base = 30 * (lv + 1);
    var weight = 1 + 0.50 * lb;
    return Math.max(1, Math.floor(base * weight));
  }

  // 整體回復力加成（小數）
  function partRecoverBonus(part){
    return (part.level * ENH_LV_INC_REC) + (part.stage * BT_STAGE_INC_REC);
  }

  // 套裝是否達成（全三件 stage==4）
  function setUnlocked(){
    var it = STATE.items;
    return it.necklace.stage>=4 && it.ring.stage>=4 && it.earring.stage>=4;
  }

  // 套裝效果 → 寫入 coreBonus
  function applyCoreBonus(){
    if (!window.player || !player.coreBonus) return;
    player.coreBonus.bonusData = player.coreBonus.bonusData || {};
    var slot = player.coreBonus.bonusData.lifeSet = player.coreBonus.bonusData.lifeSet || {};

    // 清空再寫（避免殘留）
    slot.hp = 0; slot.mp = 0; slot.recoverPercent = 0;

    // 三件合計回復力
    var rec =
      partRecoverBonus(STATE.items.necklace) +
      partRecoverBonus(STATE.items.ring) +
      partRecoverBonus(STATE.items.earring);

    // 套裝滿破加成
    if (setUnlocked()){
      slot.hp += SET_HP;
      slot.mp += SET_MP;
      rec += SET_REC;
    }

    slot.recoverPercent = rec;

    try { updateResourceUI && updateResourceUI(); } catch(_){}
  }

  // ====== 動作 ======
  function enhance(key){
    var part = STATE.items[key]; if (!part) return { ok:false, reason:'no_part' };
    var maxLv = maxEnhanceOf(part);
    if (part.level >= maxLv) return { ok:false, reason:'max_level' };

    var need = enhanceCostStones(part);
    if (!hasItem(ENHANCE_ITEM, need)) return { ok:false, reason:'no_stone', need:need };

    consumeItem(ENHANCE_ITEM, need);

    var chance = enhanceChance(part);
    var roll = rand01();
    if (roll <= chance){
      part.level += 1;
      save(); applyCoreBonus(); try { EquipHub && EquipHub.requestRerender(); } catch(_){}
      return { ok:true, level:part.level, chance:chance };
    } else {
      save(); try { EquipHub && EquipHub.requestRerender(); } catch(_){}
      return { ok:false, reason:'fail', chance:chance, nextChance: enhanceChance(part) };
    }
  }

  function breakthrough(key){
    var part = STATE.items[key]; if (!part) return { ok:false, reason:'no_part' };
    if (part.stage >= 4) return { ok:false, reason:'max_stage' };

    var needBrk = breakthroughCost(part);
    if (!hasItem(BREAK_ITEM, needBrk)) return { ok:false, reason:'no_break', need:needBrk };

    consumeItem(BREAK_ITEM, needBrk);

    var roll = rand01();
    if (roll <= BT_BASE_CHANCE){
      part.stage += 1;
      save(); applyCoreBonus(); try { EquipHub && EquipHub.requestRerender(); } catch(_){}
      return { ok:true, stage:part.stage };
    } else {
      save(); try { EquipHub && EquipHub.requestRerender(); } catch(_){}
      return { ok:false, reason:'fail' };
    }
  }

  function liberate(key){
    var part = STATE.items[key]; if (!part) return { ok:false, reason:'no_part' };
    if (!setUnlocked()) return { ok:false, reason:'set_locked' };
    if (part.lib >= LIBERATION_MAX_TIMES) return { ok:false, reason:'max_lib' };

    var needLib = liberationCost(part);
    if (!hasItem(BREAK_ITEM, needLib)) return { ok:false, reason:'no_break', need:needLib };

    consumeItem(BREAK_ITEM, needLib);

    var chance = liberationChance(part);
    var roll = rand01();
    if (roll <= chance){
      part.lib += 1;
      save(); applyCoreBonus(); try { EquipHub && EquipHub.requestRerender(); } catch(_){}
      return { ok:true, lib:part.lib, newMax: maxEnhanceOf(part) };
    } else {
      save(); try { EquipHub && EquipHub.requestRerender(); } catch(_){}
      return { ok:false, reason:'fail', nextChance: liberationChance(part) };
    }
  }

  // ====== UI（掛 EquipHub）======
  function render(container){
    applyCoreBonus(); // 進頁就同步一次

    var it = STATE.items;
    var unlocked = setUnlocked();

    function card(key, label){
      var p = it[key];
      var maxLv = maxEnhanceOf(p);
      var enhChance = Math.round(enhanceChance(p)*100);
      var libChance = Math.round(liberationChance(p)*100);

      var recPct = Math.round(partRecoverBonus(p)*1000)/10; // x.x%

      var costEnh = enhanceCostStones(p);
      var haveEnh = getItemQuantity?getItemQuantity(ENHANCE_ITEM):0;
      var haveBrk = getItemQuantity?getItemQuantity(BREAK_ITEM):0;

      var costBreak = breakthroughCost(p);
      var costLib   = liberationCost(p);

      var title = partTitle(key, p.stage);

      var html =
        '<div class="life-card'+(p.stage>=4?' life-goddess':'')+'" style="border:1px solid #253041;border-radius:12px;background:#0e172a;padding:12px;display:grid;gap:10px">'+
          '<div style="display:flex;gap:8px;align-items:center">'+
            '<div class="life-title" style="font-weight:800">'+title+'</div>'+
            (p.stage>=4 ? '<span class="life-badge life-badge--goddess" style="margin-left:6px">生命女神祝福</span>' : '')+
            '<div style="margin-left:auto;opacity:.85">回復力加成：<b>'+recPct+'%</b></div>'+
          '</div>'+

          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
            // 強化
            '<div style="border:1px dashed #253041;border-radius:10px;padding:10px">'+
              '<div style="font-weight:700;margin-bottom:6px">強化</div>'+
              '<div>等級：<b>'+p.level+'</b> / '+maxLv+'（每等 +2% 回復力）</div>'+
              '<div>消耗：<b>'+ENHANCE_ITEM+' × '+costEnh+'</b>（持有 '+fmt(haveEnh)+'）</div>'+
              '<div>成功率：<b>'+enhChance+'%</b></div>'+
              '<div style="margin-top:8px"><button id="btn-enh-'+key+'" style="background:#10b981;border:0;color:#0b1220;border-radius:8px;padding:6px 10px;cursor:pointer">強化</button></div>'+
            '</div>'+

            // 突破
            '<div style="border:1px dashed #253041;border-radius:10px;padding:10px">'+
              '<div style="font-weight:700;margin-bottom:6px">突破</div>'+
              '<div>階段：<b>'+p.stage+'</b> / 4（每階 +5% 回復力，並更名）</div>'+
              '<div>消耗：<b>'+BREAK_ITEM+' × '+fmt(costBreak)+'</b>（持有 '+fmt(haveBrk)+'）</div>'+
              '<div>成功率：<b>'+Math.round(BT_BASE_CHANCE*100)+'%</b></div>'+
              '<div style="margin-top:8px"><button id="btn-bt-'+key+'" style="background:#3b82f6;border:0;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer">突破</button></div>'+
            '</div>'+
          '</div>'+

          // 解放
          '<div style="border:1px dashed #31415a;border-radius:10px;padding:10px;'+(unlocked?'':'opacity:.6')+'">'+
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
              '<div style="font-weight:700">解放</div>'+
              (unlocked?'<span style="background:#16a34a;color:#0b1220;padding:2px 8px;border-radius:999px;font-size:12px">已解鎖（三件達破4）</span>':'<span style="background:#6b7280;color:#111827;padding:2px 8px;border-radius:999px;font-size:12px">尚未解鎖（需全套破4）</span>')+
            '</div>'+
            '<div>解放次數：<b>'+p.lib+'</b> / '+LIBERATION_MAX_TIMES+'（每次 +5 強化上限）</div>'+
            '<div>消耗：<b>'+BREAK_ITEM+' × '+fmt(liberationCost(p))+'</b>（持有 '+fmt(haveBrk)+'）</div>'+
            '<div>成功率：<b>'+libChance+'%</b></div>'+
            '<div style="margin-top:8px"><button id="btn-lib-'+key+'" '+(unlocked?'':'disabled style="opacity:.5;cursor:not-allowed"')+' class="btn-lib" style="background:#f59e0b;border:0;color:#111827;border-radius:8px;padding:6px 10px;cursor:pointer">解放</button></div>'+
          '</div>'+
        '</div>';

      return html;
    }

    var setBadge = setUnlocked()
      ? '<span style="background:#10b981;color:#0b1220;padding:2px 8px;border-radius:999px;font-size:12px">套裝效果啟動</span>'
      : '<span style="background:#6b7280;color:#111827;padding:2px 8px;border-radius:999px;font-size:12px">尚未啟動</span>';

    var setDesc =
      '<div class="life-set-banner'+(unlocked?' life-goddess life-set-banner--goddess':'')+'" style="border:1px solid #1f2937;border-radius:12px;background:#0b1220;padding:12px;display:grid;gap:8px;margin-bottom:12px">'+
        '<div style="display:flex;gap:10px;align-items:center">'+
          '<div style="font-weight:800">生命套裝</div>'+ setBadge +
          '<div style="margin-left:auto;opacity:.85">材料：<b>'+ENHANCE_ITEM+'</b> / <b>'+BREAK_ITEM+'</b></div>'+
        '</div>'+
        '<div style="opacity:.9">全三件達 <b>突破 4</b> 時解鎖：HP +'+fmt(SET_HP)+'、MP +'+fmt(SET_MP)+'、回復力 +'+Math.round(SET_REC*100)+'%</div>'+
      '</div>';

    container.innerHTML =
      setDesc +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px">'+
        card('necklace','項鍊')+
        card('ring','戒指')+
        card('earring','耳環')+
      '</div>';

    // 綁事件
    function bind(id, fn){
      var el = container.querySelector('#'+id);
      if (el) el.onclick = function(){
        var r = fn();
        if (!r || !r.ok){
          if (r && r.reason==='no_stone') alert('強化失敗：'+ENHANCE_ITEM+' 不足（需要 '+r.need+'）');
          else if (r && r.reason==='no_break') alert('操作失敗：'+BREAK_ITEM+' 不足（需要 '+r.need+'）');
          else if (r && r.reason==='max_level') alert('已達強化上限');
          else if (r && r.reason==='max_stage') alert('已達最大突破階段');
          else if (r && r.reason==='set_locked') alert('尚未解鎖：需全套突破 4');
          else if (r && r.reason==='max_lib') alert('已達最大解放次數');
          else if (r && r.reason==='fail') alert('失敗（固定機率 '+Math.round((r.nextChance||0)*100)+'%）');
          else alert('操作失敗');
        }
      };
    }
    bind('btn-enh-necklace', function(){ return enhance('necklace'); });
    bind('btn-enh-ring',     function(){ return enhance('ring'); });
    bind('btn-enh-earring',  function(){ return enhance('earring'); });

    bind('btn-bt-necklace',  function(){ return breakthrough('necklace'); });
    bind('btn-bt-ring',      function(){ return breakthrough('ring'); });
    bind('btn-bt-earring',   function(){ return breakthrough('earring'); });

    bind('btn-lib-necklace', function(){ return liberate('necklace'); });
    bind('btn-lib-ring',     function(){ return liberate('ring'); });
    bind('btn-lib-earring',  function(){ return liberate('earring'); });
  }

  // ====== 註冊到 EquipHub ======
  if (window.EquipHub && typeof EquipHub.registerTab === 'function'){
    EquipHub.registerTab({
      id: 'life-set',
      title: '生命套裝',
      render: render,
      tick: function(){ /* 每秒由 EquipHub 節流重繪即可 */ },
      onOpen: function(){ applyCoreBonus(); },
      onClose: function(){ applyCoreBonus(); }
    });
  }

  // 對外（可選）
  window.LifeSetTab = {
    getState: function(){ return JSON.parse(JSON.stringify(STATE)); },
    applyCoreBonus: applyCoreBonus,
    enhance: enhance,
    breakthrough: breakthrough,
    liberate: liberate
  };

  // 等 player 準備好再執行
  (function waitPlayer(){
    if (typeof window.player === "undefined") return setTimeout(waitPlayer, 100);
    applyCoreBonus();
  })();
})();