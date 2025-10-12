// gacha_medal.js — 怪物獎牌抽獎（分頁化，掛到 GachaHub）
// 依賴：GachaHub、getItemQuantity/removeItem/addItem、player.gold/stone/gem、logPrepend、updateResourceUI

(function (w) {
  "use strict";

  // ===== 基本設定 =====
  var MEDAL_NAME = "怪物獎牌";
  var COST_PER_PULL = 10;

  // ===== 工具 =====
  function randint(a, b){ return Math.floor(Math.random()*(b-a+1))+a; }

  // ===== 獎池（與你原本一致；已做總和正規化）=====
  var POOL = [
    { name: "強化石", type: "stone", min: 100,  max: 1000,  prob: 0.32 },
    { name: "楓幣",   type: "gold",  min: 1000, max: 10000, prob: 0.32 },
    { name: "鑽石",   type: "gem",   min: 5,    max: 100,   prob: 0.03 },
    { name: "技能強化券", type: "item", key: "技能強化券", min: 1, max: 1, prob: 0.03 },
    { name: "低階潛能解放鑰匙", type: "item", key: "低階潛能解放鑰匙", min: 3, max: 15, prob: 0.09 },
    { name: "中階潛能解放鑰匙", type: "item", key: "中階潛能解放鑰匙", min: 2, max: 8, prob: 0.06 },
    { name: "高階潛能解放鑰匙", type: "item", key: "高階潛能解放鑰匙", min: 1, max: 4, prob: 0.02 },
    { name: "SP點數券", type: "item", key: "sp點數券", min: 1, max: 2, prob: 0.13 }
  ];
  (function normalizePool(){
    var sum = 0; for (var i=0;i<POOL.length;i++) sum += Number(POOL[i].prob||0);
    if (sum <= 0) { POOL[0].prob = 1; sum = 1; }
    for (var j=0;j<POOL.length;j++) POOL[j]._prob = (POOL[j].prob||0)/sum;
  })();

  // ===== 內部狀態（僅此分頁用）=====
  var state = {
    history: [] // { t: numberSec, text: "..." }
  };

  // ===== 核心：抽一次 =====
  function rollOne(){
    var x = Math.random(), acc = 0, pick = POOL[POOL.length-1];
    for (var i=0;i<POOL.length;i++){
      acc += POOL[i]._prob;
      if (x <= acc){ pick = POOL[i]; break; }
    }
    return {
      name: pick.name, type: pick.type, key: pick.key,
      qty: randint(pick.min, pick.max)
    };
  }

  // ===== 發放獎勵 =====
  function grant(r){
    if (!r) return;
    switch (r.type){
      case "gold":  w.player.gold  = (w.player.gold  || 0) + r.qty; break;
      case "stone": w.player.stone = (w.player.stone || 0) + r.qty; break;
      case "gem":   w.player.gem   = (w.player.gem   || 0) + r.qty; break;
      case "item":
        if (typeof w.addItem === "function") w.addItem(r.key, r.qty);
        else {
          // 簡單備援背包
          w.player._bag = w.player._bag || {};
          w.player._bag[r.key] = (w.player._bag[r.key] || 0) + r.qty;
        }
        break;
    }
  }

  // ===== 消耗 / 判斷 =====
  function canSpend(times){
    times = Math.max(1, Math.floor(times||1));
    var need = COST_PER_PULL * times;
    var have = (typeof w.getItemQuantity === "function") ? w.getItemQuantity(MEDAL_NAME) : 0;
    return have >= need;
  }
  function spend(times){
    times = Math.max(1, Math.floor(times||1));
    var need = COST_PER_PULL * times;
    if (typeof w.removeItem === "function") w.removeItem(MEDAL_NAME, need);
  }

  // ===== UI: 渲染 =====
  function fmtTime(sec){
    var d = new Date(sec*1000);
    var hh = String(d.getHours()).padStart(2,"0");
    var mm = String(d.getMinutes()).padStart(2,"0");
    var ss = String(d.getSeconds()).padStart(2,"0");
    return hh+":"+mm+":"+ss;
  }

  function render(container){
    // 頂部資訊
    var hasQty = (typeof w.getItemQuantity === "function") ? w.getItemQuantity(MEDAL_NAME) : 0;
    container.innerHTML =
      '<div style="background:#0b1220;border:1px solid #1f2937;border-radius:10px;padding:10px;margin-bottom:12px">'+
        '<div style="font-weight:800;margin-bottom:6px">🎰 怪物獎牌抽獎</div>'+
        '<div style="opacity:.9;line-height:1.6">每抽需 <b>'+COST_PER_PULL+'</b> × 「'+MEDAL_NAME+'」。目前持有：<b>'+hasQty+'</b></div>'+
        '<div style="opacity:.85;margin-top:6px">可能獎勵：強化石(100~1000)、楓幣(1000~10000)、鑽石(5~100)、SP點數券、技能強化券（低機率）、各級潛能解放鑰匙</div>'+
        '<div style="display:flex;gap:8px;margin-top:10px">'+
          '<button id="medalOnceBtn" style="flex:1;background:#2d3463;border:1px solid #5765a0;color:#fff;border-radius:8px;padding:10px;cursor:pointer">單抽</button>'+
          '<button id="medalTenBtn"  style="flex:1;background:#2f4f2f;border:1px solid #6b8f5b;color:#fff;border-radius:8px;padding:10px;cursor:pointer">十連</button>'+
        '</div>'+
      '</div>'+

      '<div style="background:#0b1220;border:1px solid #1f2937;border-radius:10px;padding:10px;margin-bottom:12px">'+
        '<div style="font-weight:700;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between">'+
          '<span>抽獎結果</span>'+
          '<button id="medalClearBtn" style="background:#3a3a3a;color:#fff;border:1px solid #444;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px">清空結果</button>'+
        '</div>'+
        '<div id="medalResultBox" style="max-height:240px;overflow:auto;border:1px solid #1f2937;border-radius:6px;padding:6px 8px;background:#0b1220">'+
          (state.history.length? '' : '<div style="opacity:.6">（結果會顯示在這裡）</div>')+
        '</div>'+
      '</div>';

    // 結果列表
    var box = container.querySelector('#medalResultBox');
    if (state.history.length){
      var html = '';
      for (var i=state.history.length-1;i>=0;i--){
        var h = state.history[i];
        html += '<div style="padding:4px 0;border-bottom:1px dashed #1f2937"><span style="color:#aab;margin-right:6px;font-size:12px">['+fmtTime(h.t)+']</span>'+h.text+'</div>';
      }
      box.innerHTML = html;
    }

    // 綁定事件
    var onceBtn = container.querySelector('#medalOnceBtn');
    var tenBtn  = container.querySelector('#medalTenBtn');
    var clrBtn  = container.querySelector('#medalClearBtn');

    if (onceBtn){
      onceBtn.onclick = function(){
        if (!canSpend(1)){ alert('需要 '+COST_PER_PULL+' 個「'+MEDAL_NAME+'」'); return; }
        spend(1);
        var r = rollOne();
        grant(r);
        w.updateResourceUI && w.updateResourceUI();
        if (typeof w.logPrepend === 'function') w.logPrepend('🎖️ 使用 '+MEDAL_NAME+' 抽獎：獲得「'+r.name+' × '+r.qty+'」');
        // 寫歷史
        state.history.push({ t: Math.floor(Date.now()/1000), text: '單抽：<b>'+r.name+' × '+r.qty+'</b>' });
        if (state.history.length > 200) state.history.shift();
        w.GachaHub && w.GachaHub.requestRerender && w.GachaHub.requestRerender();
      };
    }

    if (tenBtn){
      tenBtn.onclick = function(){
        if (!canSpend(10)){ alert('需要 '+(COST_PER_PULL*10)+' 個「'+MEDAL_NAME+'」'); return; }
        spend(10);
        var results = [];
        for (var i=0;i<10;i++){ var r = rollOne(); grant(r); results.push(r); }
        w.updateResourceUI && w.updateResourceUI();
        if (typeof w.logPrepend === 'function'){
          w.logPrepend('🌟 十連結果：'+ results.map(function(r){ return r.name+' × '+r.qty; }).join('、'));
        }
        var line = '十連：'+ results.map(function(r){ return '<b>'+r.name+' × '+r.qty+'</b>'; }).join('、');
        state.history.push({ t: Math.floor(Date.now()/1000), text: line });
        if (state.history.length > 200) state.history.shift();
        w.GachaHub && w.GachaHub.requestRerender && w.GachaHub.requestRerender();
      };
    }

    if (clrBtn){
      clrBtn.onclick = function(){
        state.history = [];
        w.GachaHub && w.GachaHub.requestRerender && w.GachaHub.requestRerender();
      };
    }
  }

  function tick(){ /* 目前不需要計時邏輯；保留擴充 */ }

  // ===== 註冊到 GachaHub =====
  function registerIntoHub(){
    if (!w.GachaHub || typeof w.GachaHub.registerTab !== 'function') return;
    w.GachaHub.registerTab({
      id: 'gacha_medal',
      title: '怪物獎牌',
      render: render,
      tick: tick
    });
  }

  // 等 DOM Ready（或立即）註冊
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registerIntoHub);
  else registerIntoHub();

  //（可選）保留舊 API 名稱，以防舊碼呼叫
  w.openMedalGachaModal = function(){
    // 改走新分頁：直接打開 GachaHub 並切到本分頁
    if (w.GachaHub){ w.GachaHub.open(); w.GachaHub.switchTo('gacha_medal'); }
  };
  w.medalGachaOnce = function(){
    if (!canSpend(1)) return null;
    spend(1);
    var r = rollOne();
    grant(r);
    w.updateResourceUI && w.updateResourceUI();
    state.history.push({ t: Math.floor(Date.now()/1000), text: '單抽：<b>'+r.name+' × '+r.qty+'</b>' });
    if (typeof w.logPrepend === 'function') w.logPrepend('🎖️ 使用 '+MEDAL_NAME+' 抽獎：獲得「'+r.name+' × '+r.qty+'」');
    w.GachaHub && w.GachaHub.requestRerender && w.GachaHub.requestRerender();
    return r;
  };
  w.medalGachaTen = function(){
    if (!canSpend(10)) return null;
    spend(10);
    var results = [];
    for (var i=0;i<10;i++){ var r = rollOne(); grant(r); results.push(r); }
    w.updateResourceUI && w.updateResourceUI();
    state.history.push({
      t: Math.floor(Date.now()/1000),
      text: '十連：'+ results.map(function(r){ return '<b>'+r.name+' × '+r.qty+'</b>'; }).join('、')
    });
    if (typeof w.logPrepend === 'function'){
      w.logPrepend('🌟 十連結果：'+ results.map(function(r){ return r.name+' × '+r.qty; }).join('、'));
    }
    w.GachaHub && w.GachaHub.requestRerender && w.GachaHub.requestRerender();
    return results;
  };

})(window);