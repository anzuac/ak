// personal_potential_tab.js — 個人潛能（上潛能 4 條；N 起；能力方塊=直套；選擇方塊=彈窗）
// ✅ 仿「裝備系統」的獨立存檔版：只使用 localStorage 'equip:pp:v1'；載入不寫檔；寫檔失敗自動改用記憶體快取
// 依賴：growth_hub.js（GrowthHub）
// 可選：player.js（coreBonus，用於即時計算加成；寫入失敗會靜默略過）、背包 API（getItemQuantity/addItem/removeItem）

(function (w) {
  "use strict";

  if (!w.GrowthHub) { console.error("❌ personal_potential_tab: GrowthHub 未載入"); return; }

  var TAB_ID = "personalPotential";
  var TAB_TITLE = "個人潛能";

  // ====== 存檔（仿裝備系統：單一 LS key，載入不寫檔，修改才嘗試寫檔）======
  var LS_KEY = "equip:pp:v1";
  function defaultState(){ return { _ver:1, sessionTier:"N", appliedLines:[], used:{ cube:0, select:0 } }; }

  var memState = defaultState(); // 寫檔失敗時的記憶體快取
  function safeLoad(){
    try{
      var raw = w.localStorage.getItem(LS_KEY);
      if (!raw) return defaultState();
      var o = JSON.parse(raw);
      if (!o || typeof o!=="object" || (o._ver|0)!==1) return defaultState();
      // normalize
      o.sessionTier = String(o.sessionTier||"N").toUpperCase();
      o.appliedLines = Array.isArray(o.appliedLines) ? o.appliedLines : [];
      o.used = (o.used && typeof o.used==="object") ? { cube:o.used.cube|0, select:o.used.select|0 } : { cube:0, select:0 };
      return o;
    }catch(_){ return defaultState(); }
  }
  function safePersist(s){
    memState = JSON.parse(JSON.stringify(s)); // 先記憶體安全快照
    try { w.localStorage.setItem(LS_KEY, JSON.stringify(s)); }
    catch(_) { /* 靜默：保留 memState，不影響其他任何存檔系統 */ }
  }
  var state = safeLoad();

  // ====== 物品名稱 / 背包 ======
  var ITEM_CUBE_APPLY  = "能力方塊";       // 點就消耗並直接套用
  var ITEM_CUBE_SELECT = "選擇能力方塊";   // 點就消耗並彈窗（可確認或放棄）
  var HAS_INV = (typeof w.getItemQuantity==="function" && typeof w.addItem==="function" && typeof w.removeItem==="function");
  function invQty(name){ if(!HAS_INV) return 0; try{ return Math.max(0, Number(w.getItemQuantity(name)||0)); }catch(_){ return 0; } }
  function removeItem(name,n){ if(HAS_INV) try{ w.removeItem(name, Math.max(0,Math.floor(n||0))); }catch(_){ } }
  function addItem(name,n){ if(HAS_INV) try{ w.addItem(name, Math.max(0,Math.floor(n||0))); }catch(_){ } }

  // ====== 階級/機率 ======
  var TIER_MULT = { N:1, R:2, SR:3, SSR:4, UR:5, LR:7, SLR:10 };
  function tryPromote(t){
    t = String(t||"N").toUpperCase();
    if (t==="N"   && Math.random()<0.10)   return "R";
    if (t==="R"   && Math.random()<0.05)   return "SR";
    if (t==="SR"  && Math.random()<0.03)   return "SSR";
    if (t==="SSR" && Math.random()<0.01)   return "UR";
    if (t==="UR"  && Math.random()<0.005)  return "LR";
    if (t==="LR"  && Math.random()<0.0008) return "SLR";
    return t;
  }
  function nextTierChance(from){
    var t = String(from||"N").toUpperCase();
    if (t==="N")  return {to:"R",   p:0.10};
    if (t==="R")  return {to:"SR",  p:0.05};
    if (t==="SR") return {to:"SSR", p:0.03};
    if (t==="SSR")return {to:"UR",  p:0.01};
    if (t==="UR") return {to:"LR",  p:0.005};
    if (t==="LR") return {to:"SLR", p:0.0008};
    return {to:"—", p:0};
  }
  function pickWeighted(arr){
    var sum=0; for (var i=0;i<arr.length;i++) sum += (arr[i].w||0);
    if (sum<=0) return arr[0].v;
    var r=Math.random()*sum, acc=0;
    for (var j=0;j<arr.length;j++){ acc+=(arr[j].w||0); if(r<=acc) return arr[j].v; }
    return arr[arr.length-1].v;
  }
  function distFor(sessionTier){
    var T = String(sessionTier||"N").toUpperCase();
    if (T==="N")   return [{v:"N",w:100}];
    if (T==="R")   return [{v:"R",w:100}];
    if (T==="SR")  return [{v:"R",w:98},{v:"SR",w:2}];
    if (T==="SSR") return [{v:"SR",w:98},{v:"SSR",w:2}];
    if (T==="UR")  return [{v:"SSR",w:98},{v:"UR",w:2}];
    if (T==="LR")  return [{v:"UR",w:98},{v:"LR",w:2}];
    if (T==="SLR") return [{v:"LR",w:97},{v:"SLR",w:3}]; // SLR 特例
    return [{v:"R",w:100}];
  }
  function decideLineTiers(sessionTier, count){
    var out=[], T=String(sessionTier||"N").toUpperCase();
    for (var i=0;i<count;i++) out.push(i===0 ? T : pickWeighted(distFor(T)));
    return out;
  }

  // ====== 詞條池 ======
  var UPPER_DEFINED = [
    { key:"str",   label:"力量",      type:"flat", min:1,  max:3,  prob:4 },
    { key:"agi",   label:"敏捷",      type:"flat", min:1,  max:3,  prob:4 },
    { key:"int",   label:"智力",      type:"flat", min:1,  max:3,  prob:4 },
    { key:"luk",   label:"幸運",      type:"flat", min:1,  max:3,  prob:4 },
    { key:"allStatFlat", label:"全屬性", type:"flat", min:2, max:4, prob:2 },
    { key:"atk",   label:"攻擊力",    type:"flat", min:5,  max:18, prob:1.5 },
    { key:"attackSpeedPct", label:"攻擊速度", type:"pct", min:2, max:5, prob:3 },
    { key:"totalDamage", label:"總傷害",      type:"pct", min:2, max:4, prob:2 },
    { key:"ignoreDefPct", label:"穿透",       type:"pct", min:0.2, max:1, prob:2.3 },
    { key:"skillDamage",  label:"技能攻擊力", type:"pct", min:1, max:3, prob:3 },
    { key:"critRate",     label:"爆擊率",     type:"pct", min:2, max:4, prob:4 },
    { key:"critMultiplier", label:"爆擊傷害", type:"pct", min:1, max:3, prob:2.1 },
    { key:"def",   label:"防禦力",    type:"flat", min:5,  max:20, prob:null },
    { key:"hp",    label:"HP",        type:"flat", min:100,max:400, prob:null },
    { key:"mp",    label:"MP",        type:"flat", min:10, max:30,  prob:null },
    { key:"goldBonus", label:"金幣率", type:"pct",  min:1,  max:4,  prob:null },
    { key:"dropBonus", label:"掉寶率", type:"pct",  min:2,  max:4,  prob:null },
    { key:"expBonus",  label:"經驗率", type:"pct",  min:3,  max:6,  prob:null },
    { key:"dodgePercent", label:"閃避率", type:"pct", min:0.2, max:1, prob:null }
  ];
  (function fillRemainder(defs){
    var fixed = defs.filter(function(d){return typeof d.prob==="number";})
                    .reduce(function(s,d){return s+d.prob;},0);
    var rest  = defs.filter(function(d){return d.prob==null;});
    var rem   = Math.max(0, 100 - fixed);
    var each  = rest.length ? (rem / rest.length) : 0;
    for (var i=0;i<rest.length;i++) rest[i].prob = each;
  })(UPPER_DEFINED);

  function rollOne(defList, tier){
    var arr = defList.map(function(d){ return { v:d, w:d.prob }; });
    var def = pickWeighted(arr);
    var m = TIER_MULT[tier] || 1;
    var vmin=Math.floor(def.min*m), vmax=Math.floor(def.max*m);
    if (vmax < vmin) vmax = vmin;
    var val = vmin + Math.floor(Math.random()*(vmax-vmin+1));
    return { tier:tier, key:def.key, label:def.label, type:def.type, value:val, maxAt:vmax };
  }
  function rollPack(sessionTier){
    var tiers = decideLineTiers(sessionTier, 4), lines=[];
    for (var i=0;i<4;i++) lines.push(rollOne(UPPER_DEFINED, tiers[i]));
    return lines;
  }

  // ====== coreBonus（易揮發寫入）======
  function linesToBonus(lines){
    var out = {
      str:0, agi:0, int:0, luk:0, allStatFlat:0, atk:0, def:0, hp:0, mp:0,
      attackSpeedPct:0, totalDamage:0, ignoreDefPct:0, skillDamage:0,
      critRate:0, critMultiplier:0, dodgePercent:0,
      expBonus:0, dropBonus:0, goldBonus:0
    };
    for (var i=0;i<lines.length;i++){
      var L=lines[i], v=Number(L.value)||0;
      if (L.type==="flat"){
        if (L.key==="allStatFlat") out.allStatFlat+=v;
        else if (out.hasOwnProperty(L.key)) out[L.key]+=v;
      } else {
        out[L.key] = (out[L.key]||0) + v/100;
      }
    }
    if (out.allStatFlat){
      out.str+=out.allStatFlat; out.agi+=out.allStatFlat; out.int+=out.allStatFlat; out.luk+=out.allStatFlat; out.allStatFlat=0;
    }
    return out;
  }
  function applyToCoreBonus(bonus){
    try{
      var CB = w.player && w.player.coreBonus;
      if (!CB || !CB.bonusData) return;
      CB.bonusData.PersonalPotential = bonus;       // 易揮發欄位
      if (typeof w.updateResourceUI==="function") w.updateResourceUI();
    }catch(_){ /* 靜默 */ }
  }

  // ====== 主流程 ======
  function rollWithPromotion(){ state.sessionTier = tryPromote(state.sessionTier); return rollPack(state.sessionTier); }
  function applyLines(lines){
    state.appliedLines = lines.slice();
    applyToCoreBonus(linesToBonus(lines));
    // 仿裝備系統：只有「動作完成」才嘗試寫檔；失敗就保留在 memState
    safePersist(state);
  }

  // ====== UI 元件 ======
  var TIER_STYLE = {
    N:{bg:"#1f2937", fg:"#e5e7eb", br:"#374151"},
    R:{bg:"#334155", fg:"#e5e7eb", br:"#475569"},
    SR:{bg:"#1d4ed8", fg:"#fff", br:"#1e40af"},
    SSR:{bg:"#7c3aed", fg:"#fff", br:"#5b21b6"},
    UR:{bg:"#0ea5e9", fg:"#0b1220", br:"#0369a1"},
    LR:{bg:"#f59e0b", fg:"#0b1220", br:"#b45309"},
    SLR:{bg:"#f43f5e", fg:"#fff", br:"#9f1239"}
  };
  function badgeTier(t, large){
    var s=TIER_STYLE[t]||TIER_STYLE.N, pad=large?"3px 8px":"2px 6px", fs=large?"12px":"11px";
    var span=document.createElement("span");
    span.textContent=t;
    span.style.cssText="display:inline-block;padding:"+pad+";border:1px solid "+s.br+";background:"+s.bg+";color:"+s.fg+";border-radius:"+(large?"999px":"10px")+";font-weight:800;font-size:"+fs+";letter-spacing:.5px";
    return span;
  }
  function tagMax(){
    var x=document.createElement("span");
    x.textContent="MAX";
    x.style.cssText="display:inline-block;padding:2px 6px;border:1px solid #065f46;background:#22c55e;color:#0b1220;border-radius:999px;font-weight:900;font-size:10px;letter-spacing:.5px;margin-left:6px";
    return x;
  }
  function smallIcon(key){
    var map={ str:"💪",agi:"🏃",int:"🧠",luk:"🍀",allStatFlat:"✨", atk:"⚔️",def:"🛡️",hp:"❤️",mp:"🔷",
              attackSpeedPct:"⏩", totalDamage:"📈", ignoreDefPct:"🗡️", skillDamage:"💥",
              critRate:"🎯", critMultiplier:"💣", dodgePercent:"🌀", expBonus:"📚", dropBonus:"🎁", goldBonus:"💰" };
    return map[key]||"•";
  }
  function fmtLineNode(L){
    var unit=(L.type==="pct")?"%":"";
    var row=document.createElement("div");
    row.style.cssText="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border:1px solid #1f2937;border-radius:10px;background:#0b1220";
    var left=document.createElement("div"); left.style.cssText="display:flex;align-items:center;gap:8px;min-width:0";
    var icon=document.createElement("span"); icon.textContent=smallIcon(L.key);
    var name=document.createElement("span"); name.textContent=L.label; name.style.cssText="font-weight:700";
    var tierB=badgeTier(L.tier,false);
    left.appendChild(tierB); left.appendChild(icon); left.appendChild(name);
    var right=document.createElement("div"); right.style.cssText="white-space:nowrap;font-weight:800";
    right.textContent="+"+L.value+unit;
    if (L.maxAt!=null && L.value>=L.maxAt){ right.appendChild(tagMax()); row.style.borderColor="#22c55e"; row.style.boxShadow="0 0 0 1px rgba(34,197,94,.25) inset"; }
    row.appendChild(left); row.appendChild(right); return row;
  }
  function listBlock(titleText, lines){
    var card=document.createElement("div"); card.style.cssText="background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:10px";
    var title=document.createElement("div"); title.textContent=titleText; title.style.cssText="font-weight:800;margin-bottom:6px";
    card.appendChild(title);
    if (!lines||!lines.length){ var empty=document.createElement("div"); empty.textContent="（無）"; empty.style.cssText="opacity:.75"; card.appendChild(empty); return card; }
    var stack=document.createElement("div"); stack.style.cssText="display:flex;flex-direction:column;gap:6px";
    for (var i=0;i<lines.length;i++) stack.appendChild(fmtLineNode(lines[i]));
    card.appendChild(stack); return card;
  }
  function sectionHeader(title, rightNode){
    var head=document.createElement("div"); head.style.cssText="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px";
    var t=document.createElement("div"); t.textContent=title; t.style.cssText="font-weight:900;color:#93c5fd"; head.appendChild(t);
    if (rightNode) head.appendChild(rightNode); return head;
  }

  // ====== 詳細資訊彈窗 ======
  function openInfoModal(){
    var bd=document.createElement("div");
    bd.style.cssText="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);z-index:10000;padding:12px;";
    var wbox=document.createElement("div");
    wbox.style.cssText="width:min(820px,96vw);max-height:92vh;overflow:auto;background:#111827;color:#e5e7eb;border:1px solid #334155;border-radius:12px;padding:12px;box-shadow:0 12px 36px rgba(0,0,0,.5)";

    var head=document.createElement("div");
    head.style.cssText="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:900";
    head.innerHTML="<div>📊 潛能規則 / 機率（上）</div>";
    var close=document.createElement("button");
    close.textContent="關閉";
    close.style.cssText="background:#334155;color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer";
    close.onclick=function(){ document.body.removeChild(bd); };
    head.appendChild(close);
    wbox.appendChild(head);

    var row1=document.createElement("div");
    row1.style.cssText="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px;opacity:.95";
    row1.appendChild(document.createTextNode("本次 Session 階級："));
    row1.appendChild(badgeTier(state.sessionTier, true));
    var nxt=nextTierChance(state.sessionTier);
    var tip=document.createElement("span");
    tip.textContent=(nxt.p>0)?("下一階 "+nxt.to+" 機率 "+(nxt.p*100).toFixed(2)+"%"):"已達天花板";
    row1.appendChild(tip);
    var rule=document.createElement("div");
    rule.style.cssText="opacity:.9;line-height:1.6;margin:6px 0";
    rule.innerHTML="行階級：第 <b>1</b> 條固定為 Session；第 <b>2~4</b> 條 98/2（SLR 97/3）。<br>升級鏈（一次檢定）：N→R 10%、R→SR 5%、SR→SSR 3%、SSR→UR 1%、UR→LR 0.5%、LR→SLR 0.08%。";
    wbox.appendChild(row1);
    wbox.appendChild(rule);

    var tbl=document.createElement("table");
    tbl.style.cssText="width:100%;border-collapse:collapse;font-size:12px;color:#e5e7eb";
    var headRow=document.createElement("tr");
    ["詞條","基礎範圍（N）","當前階級可能值","機率%"].forEach(function(h){
      var th=document.createElement("th");
      th.textContent=h;
      th.style.cssText="border:1px solid #263247;padding:5px;text-align:center;background:#0f172a";
      headRow.appendChild(th);
    });
    tbl.appendChild(headRow);
    var mult=TIER_MULT[state.sessionTier]||1;
    for (var i=0;i<UPPER_DEFINED.length;i++){
      var d=UPPER_DEFINED[i], tr=document.createElement("tr");
      var minCur=Math.floor(d.min*mult), maxCur=Math.floor(d.max*mult);
      [ d.label,
        (d.type==="pct"?(d.min+"% ~ "+d.max+"%"):(d.min+" ~ "+d.max)),
        (d.type==="pct"?(minCur+"% ~ "+maxCur+"%"):(minCur+" ~ "+maxCur)),
        (Number(d.prob).toFixed(2))
      ].forEach(function(txt){
        var td=document.createElement("td");
        td.textContent=txt;
        td.style.cssText="border:1px solid #263247;padding:5px;text-align:center";
        tr.appendChild(td);
      });
      tbl.appendChild(tr);
    }
    wbox.appendChild(tbl);

    bd.appendChild(wbox);
    bd.addEventListener("click", function(e){ if(e.target===bd) document.body.removeChild(bd); });
    document.body.appendChild(bd);
  }

  // ====== 選擇方塊彈窗 ======
  function openSelectModal(rolled){
    var bd=document.createElement("div");
    bd.style.cssText="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);z-index:10000;padding:12px;";
    var wbox=document.createElement("div");
    wbox.style.cssText="width:min(560px,96vw);max-height:92vh;overflow:auto;background:#111827;color:#e5e7eb;border:1px solid #334155;border-radius:12px;padding:12px;box-shadow:0 12px 36px rgba(0,0,0,.5)";

    var head=document.createElement("div");
    head.style.cssText="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:900";
    head.innerHTML="<div>✨ 本次洗出結果（已消耗「選擇能力方塊」×1）</div>";
    var close=document.createElement("button");
    close.textContent="關閉";
    close.style.cssText="background:#334155;color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer";
    close.onclick=function(){ document.body.removeChild(bd); };
    head.appendChild(close);
    wbox.appendChild(head);

    var tip=document.createElement("div");
    tip.style.cssText="opacity:.85;margin-bottom:6px";
    tip.textContent="你可以選擇「確認套用」或「放棄本次」。不論是否套用，道具都已消耗。";
    wbox.appendChild(tip);

    var list=document.createElement("div");
    list.style.cssText="display:flex;flex-direction:column;gap:6px;margin-bottom:10px";
    for (var i=0;i<rolled.length;i++) list.appendChild(fmtLineNode(rolled[i]));
    wbox.appendChild(list);

    var ops=document.createElement("div");
    ops.style.cssText="display:flex;gap:8px;justify-content:flex-end";
    var confirm=document.createElement("button");
    confirm.textContent="確認套用";
    confirm.style.cssText="background:#2563eb;color:#fff;border:0;padding:8px 12px;border-radius:10px;cursor:pointer;font-weight:800";
    confirm.onclick=function(){
      applyLines(rolled);
      document.body.removeChild(bd);
      if (w.GrowthHub) w.GrowthHub.requestRerender();
      if (w.logPrepend) w.logPrepend("✨ 已套用選擇方塊結果");
    };
    var giveup=document.createElement("button");
    giveup.textContent="放棄本次";
    giveup.style.cssText="background:#374151;color:#fff;border:0;padding:8px 12px;border-radius:10px;cursor:pointer;font-weight:800";
    giveup.onclick=function(){
      document.body.removeChild(bd);
      if (w.GrowthHub) w.GrowthHub.requestRerender();
      if (w.logPrepend) w.logPrepend("🗑️ 放棄本次結果（道具已消耗）");
    };
    ops.appendChild(giveup); ops.appendChild(confirm);
    wbox.appendChild(ops);

    bd.appendChild(wbox);
    bd.addEventListener("click", function(e){ if(e.target===bd) document.body.removeChild(bd); });
    document.body.appendChild(bd);
  }

  // ====== 主 UI ======
  function renderHeader(container){
    var card=document.createElement("div");
    card.style.cssText="background:#0b1220;border:1px solid #263247;border-radius:12px;padding:10px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap";
    var left=document.createElement("div");
    left.style.cssText="display:flex;align-items:center;gap:8px";
    left.appendChild(document.createTextNode("Session 階級："));
    left.appendChild(badgeTier(state.sessionTier, true));
    card.appendChild(left);

    var right=document.createElement("div");
    var info=document.createElement("button");
    info.textContent="查看詳細資訊（機率與規則）";
    info.style.cssText="background:#1f2937;color:#e5e7eb;border:1px solid #334155;padding:8px 12px;border-radius:10px;cursor:pointer;font-weight:800";
    info.onclick=openInfoModal;
    right.appendChild(info);
    card.appendChild(right);

    container.appendChild(card);
  }
  function renderApplyPanel(container){
    var wrapper=document.createElement("div");
    wrapper.style.cssText="background:#0b1220;border:1px solid #334155;border-radius:12px;padding:10px";
    var right=document.createElement("div"); right.appendChild(badgeTier(state.sessionTier, true));
    wrapper.appendChild(sectionHeader("上潛能（4條；N 起；只升不降）", right));

    var grid=document.createElement("div");
    grid.style.cssText="display:grid;grid-template-columns:1fr;gap:10px;align-items:start";
    grid.appendChild(listBlock("已套用", state.appliedLines));
    wrapper.appendChild(grid);

    var ops=document.createElement("div");
    ops.style.cssText="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px";
    function mkBtn(txt,bg,fg,on){ var btn=document.createElement("button"); btn.textContent=txt; btn.onclick=on; btn.style.cssText="background:"+bg+";color:"+fg+";border:1px solid #1f2937;padding:8px 12px;border-radius:10px;font-weight:800;cursor:pointer;box-shadow:0 2px 0 rgba(0,0,0,.25)"; return btn; }

    var btnApply=mkBtn("能力方塊（立即套用）","linear-gradient(180deg,#16a34a,#15803d)","#fff", function(){
      if (invQty(ITEM_CUBE_APPLY) < 1){ alert("缺少「"+ITEM_CUBE_APPLY+"」"); return; }
      removeItem(ITEM_CUBE_APPLY, 1);
      var rolled=rollWithPromotion();
      applyLines(rolled);
      state.used.cube=(state.used.cube|0)+1; safePersist(state);
      if (w.GrowthHub) w.GrowthHub.requestRerender();
      if (w.logPrepend) w.logPrepend("✨ 能力方塊：已消耗並立即套用");
    });

    var btnSelect=mkBtn("選擇能力方塊（彈窗）","linear-gradient(180deg,#f59e0b,#d97706)","#0b1220", function(){
      if (invQty(ITEM_CUBE_SELECT) < 1){ alert("缺少「"+ITEM_CUBE_SELECT+"」"); return; }
      removeItem(ITEM_CUBE_SELECT, 1);
      var rolled=rollWithPromotion();
      state.used.select=(state.used.select|0)+1; safePersist(state);
      openSelectModal(rolled);
    });

    var note=document.createElement("div");
    note.style.cssText="opacity:.85;font-size:12px;margin-top:6px;line-height:1.6";
    note.innerHTML="說明：<b>能力方塊</b>會在點擊後立即消耗並套用；<b>選擇能力方塊</b>會在點擊後立即消耗並彈出結果，你可選擇套用或放棄。";

    ops.appendChild(btnApply);
    ops.appendChild(btnSelect);
    wrapper.appendChild(ops);
    wrapper.appendChild(note);

    container.appendChild(wrapper);
  }
  function render(container){
    container.innerHTML="";
    renderHeader(container);
    renderApplyPanel(container);
  }

  // ====== 註冊到 GrowthHub ======
  w.GrowthHub.registerTab({ id:TAB_ID, title:TAB_TITLE, render:render });

  // ====== 匯出 / 套用（供你的裝備式整合器手動使用；預設不參與中央存檔）======
  w.PP_exportState = function(){ return JSON.parse(JSON.stringify(state)); };
  w.PP_applyState = function(s){
    if (!s || typeof s!=="object") return;
    var n = defaultState();
    n.sessionTier = String(s.sessionTier||n.sessionTier).toUpperCase();
    n.appliedLines = Array.isArray(s.appliedLines) ? s.appliedLines : n.appliedLines;
    if (s.used && typeof s.used==="object"){
      n.used.cube = s.used.cube|0; n.used.select = s.used.select|0;
    }
    state = n; safePersist(state);
    if (w.GrowthHub) w.GrowthHub.requestRerender();
  };

})(window);