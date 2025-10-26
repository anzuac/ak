/*
 * equip_system_v4_1_es5.js — 裝備系統 v4.1（ES5 / 外掛模組 / 潛能等級累積只升不降 / SLR 動態外框）
 * 依賴：StarforceTableV1, ScrollForgeV2, EquipStatsV2, PotentialCoreV21
 * 儲存：localStorage('EQUIP_SYS_STANDALONE_V2')
 */

(function (global) {
  'use strict';

  // ==== 依賴警告 ====
  (function(){
    if (!global.StarforceTableV1) console.warn('[equip_v4.1] Missing StarforceTableV1');
    if (!global.ScrollForgeV2)     console.warn('[equip_v4.1] Missing ScrollForgeV2');
    if (!global.EquipStatsV2)      console.warn('[equip_v4.1] Missing EquipStatsV2');
    if (!global.PotentialCoreV21)  console.warn('[equip_v4.1] Missing PotentialCoreV21');
  })();

  // === 潛能徽章樣式（含 SLR 動態） ===
  (function injectPotentialBadgeCSS(){
    if (document.getElementById('potential-badge-style')) return;
    var css = "\n  .tier-badge{display:inline-flex;align-items:center;justify-content:center;\n    padding:2px 8px;border-radius:999px;font:700 12px/1 ui-monospace,monospace;\n    border:1px solid #2d3a4d;background:#0f172a;color:#e5e7eb}\n  .tier-R   {color:#d1d5db;border-color:#374151;background:#1f2937}\n  .tier-SR  {color:#60a5fa;border-color:#1e40af;background:#0b2555}\n  .tier-SSR {color:#a78bfa;border-color:#4c1d95;background:#25104a}\n  .tier-UR  {color:#34d399;border-color:#065f46;background:#062b23}\n  .tier-LR  {color:#fbbf24;border-color:#92400e;background:#2b1803}\n  /* SLR：彩色外框＋動態發光 */\n  .tier-SLR{\n    color:#fff;border:2px solid transparent;background:#0b1220;\n    background-image:linear-gradient(#0b1220,#0b1220),\n      linear-gradient(90deg,#ff5,#f0f,#6ff);\n    background-origin:border-box;background-clip:padding-box,border-box;\n    box-shadow:0 0 0 rgba(255,255,255,.6); animation:slrGlow 1.2s linear infinite;\n  }\n  @keyframes slrGlow{\n    0%{ box-shadow:0 0 0px rgba(255,255,255,.6); }\n    50%{ box-shadow:0 0 16px rgba(255,255,255,.95); }\n    100%{ box-shadow:0 0 0px rgba(255,255,255,.6); }\n  }";
    var s=document.createElement('style'); s.id='potential-badge-style'; s.textContent=css;
    document.head.appendChild(s);
  })();

  // ==== 工具 ====
  function isNum(n){ return typeof n==='number' && isFinite(n); }
  function toInt(n){ n=Number(n); return isFinite(n)?Math.floor(n):0; }
  function clone(o){ try{return JSON.parse(JSON.stringify(o||{}));}catch(_){return {}; } }
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function nz(n){ return (typeof n==='number' && isFinite(n)) ? n : 0; }

  // ==== 顏色 ====
  var THEME = {
    cardBg:"#0b1220", cardBorder:"#203048", cardShadow:"0 6px 20px rgba(0,0,0,.35)",
    text:"#e5e7eb", pillBg:"#0f172a", pillBorder:"#2a364b", pillActiveBg:"#1d4ed8", pillActiveBorder:"#2b3f8f",
    success:"#22c55e", warn:"#f59e0b", blue:"#3b82f6", neg:"#ef4444", zero:"#94a3b8"
  };
  var TIER_COLOR = {
    R:{ border:"#334155", badge:"#93a3b8", text:"#e5e7eb", glow:"0 0 0 0 rgba(0,0,0,0)" },
    SR:{ border:"#2563eb", badge:"#60a5fa", text:"#eaf2ff", glow:"0 0 0 2px rgba(37,99,235,.25)" },
    SSR:{ border:"#7c3aed", badge:"#a78bfa", text:"#f3e8ff", glow:"0 0 0 2px rgba(124,58,237,.25)" },
    UR:{ border:"#f59e0b", badge:"#fbbf24", text:"#fff7e6", glow:"0 0 0 2px rgba(245,158,11,.25)" },
    LR:{ border:"#f43f5e", badge:"#fb7185", text:"#fff1f3", glow:"0 0 0 2px rgba(244,63,94,.25)" },
    SLR:{ border:"#ffffff", badge:"#ffffff", text:"#ffffff", glow:"0 0 16px rgba(255,255,255,.65)" }
  };
  var TIER_ORDER = { R:0, SR:1, SSR:2, UR:3, LR:4, SLR:5 };
  function tierMax(lines){
    if (!lines || !lines.length) return 'R';
    var best='R', i; for(i=0;i<lines.length;i++){ var t=lines[i]&&lines[i].tier; if(t && (TIER_ORDER[t]||0)>(TIER_ORDER[best]||0)) best=t; }
    return best;
  }

  // ==== 基底（10 部位）====
  var DEF_BASE = {
    hat:{str:10,dex:10,int:10,luk:10,atk:0,def:20,hp:100},
    suit:{str:12,dex:12,int:12,luk:12,atk:0,def:30,hp:180},
    glove:{str:7,dex:7,int:7,luk:7,atk:12,def:0,hp:0},
    weapon:{str:0,dex:0,int:0,luk:0,atk:60,def:0,hp:0},
    cape:{str:7,dex:7,int:7,luk:7,atk:0,def:0,hp:0},
    shoes:{str:6,dex:6,int:6,luk:6,atk:0,def:0,hp:120},
    shoulder:{str:4,dex:4,int:4,luk:4,atk:0,def:0,hp:0},
    subweapon:{str:5,dex:5,int:5,luk:5,atk:10,def:30,hp:500}, // 不可卷
    badge:{str:2,dex:2,int:2,luk:2,atk:5,def:0,hp:0},          // 不可卷
    ornament:{str:3,dex:3,int:3,luk:3,atk:0,def:0,hp:0}
  };
  var DEF_SLOTS = { hat:12, suit:12, glove:8, shoes:8, weapon:9, cape:7, shoulder:3, subweapon:0, badge:0, ornament:6 };
  function unlockCostByType(type){ return (type==='subweapon'||type==='badge'||type==='ornament') ? 10 : 1; }

  function freshEquipNode(type){
    return {
      type:type,
      name:({hat:'帽子',suit:'套服',glove:'手套',weapon:'武器',cape:'披風',shoes:'鞋子',shoulder:'肩膀',subweapon:'輔助武器',badge:'徽章',ornament:'裝飾'})[type]||type,
      locked:true,
      base:clone(DEF_BASE[type]||{}),
      slotsMax:toInt(DEF_SLOTS[type]||0),
      slotsUsed:0,
      enhance:{str:0,dex:0,int:0,luk:0,atk:0,def:0,hp:0},
      star:0,
      enhanceSuccess:0,
      _lastChaosEff:null,
      _bestChaosEff:null
    };
  }
  function normEquipNode(raw, type){
    var d=freshEquipNode(type); raw=raw||{};
    d.locked=(typeof raw.locked==='boolean')?raw.locked:d.locked;
    d.name=String(raw.name||d.name);
    d.slotsMax=isNum(raw.slotsMax)? raw.slotsMax : d.slotsMax;
    d.slotsUsed=Math.max(0, isNum(raw.slotsUsed)? raw.slotsUsed : 0);
    d.star=Math.max(0, isNum(raw.star)? raw.star : 0);
    if (isNum(raw._pendingStar)) d._pendingStar=raw._pendingStar;
    d._lastChaosEff=raw._lastChaosEff||null;
    d._bestChaosEff=raw._bestChaosEff||null;
    var b=clone(raw.base||{}), e=clone(raw.enhance||{}); var keys=['str','dex','int','luk','atk','def','hp'], i,k;
    for(i=0;i<keys.length;i++){ k=keys[i]; d.base[k]=isNum(b[k])?b[k]:d.base[k]; d.enhance[k]=isNum(e[k])?e[k]:0; }
    d.enhanceSuccess=Math.max(0, toInt(raw.enhanceSuccess||raw.successCount||0));
    return d;
  }

  // ==== 存檔 ====
  var Storage=(function(){
    var LOCAL_KEY='EQUIP_SYS_STANDALONE_V2';
    function normalizeSummary(x){
      x=x||{};
      return {str:nz(x.str),dex:nz(x.dex),int:nz(x.int),luk:nz(x.luk),atk:nz(x.atk),def:nz(x.def),hp:nz(x.hp),
        strPct:nz(x.strPct),dexPct:nz(x.dexPct),intPct:nz(x.intPct),lukPct:nz(x.lukPct),atkPct:nz(x.atkPct),hpPct:nz(x.hpPct),allStatPct:nz(x.allStatPct)};
    }
    function normalizePotential(p){
      p=p&&typeof p==='object'?clone(p):{};
      // tier 預設 'R'
      return { lines:Array.isArray(p.lines)?p.lines:[], summary:normalizeSummary(p.summary), tier:(p.tier?String(p.tier):'R') };
    }
    function normalizeState(s){
      s=s&&typeof s==='object'?clone(s):{};
      var out={_ver:41, equips:{}, globalPotential:normalizePotential(s.globalPotential)};
      var ALL=['hat','suit','glove','weapon','cape','shoes','shoulder','subweapon','badge','ornament']; var i; for(i=0;i<ALL.length;i++){ var t=ALL[i]; out.equips[t]=normEquipNode(s.equips&&s.equips[t], t); }
      return out;
    }
    function read(){
      try{
        var raw=localStorage.getItem(LOCAL_KEY);
        if(!raw){
          var old=localStorage.getItem('EQUIP_SYS_STANDALONE_V1');
          if(old){ localStorage.setItem(LOCAL_KEY,old); localStorage.removeItem('EQUIP_SYS_STANDALONE_V1'); raw=old; }
        }
        return raw?normalizeState(JSON.parse(raw)):normalizeState({});
      }catch(_){ return normalizeState({}); }
    }
    function write(next){
      try{
        var cur=read();
        if(next&&next.equips){ var k; for(k in next.equips) if(next.equips.hasOwnProperty(k)) cur.equips[k]=normEquipNode(next.equips[k], k); }
        if(next&&next.globalPotential){
          cur.globalPotential={
            lines:Array.isArray(next.globalPotential.lines)?next.globalPotential.lines:(cur.globalPotential.lines||[]),
            summary:normalizeSummary(next.globalPotential.summary||cur.globalPotential.summary),
            tier: next.globalPotential.tier ? String(next.globalPotential.tier) : (cur.globalPotential.tier||'R')
          };
        }
        localStorage.setItem(LOCAL_KEY, JSON.stringify(cur)); return cur;
      }catch(_){ return null; }
    }
    return { read:read, write:write };
  })();

  // ==== 物品 ====
  var ITEM={
    解放石:'裝備解放石', 衝星石:'衝星石', 恢復卷:'恢復卷軸', 完美卷:'完美重置卷軸',
    防60:'防具強化卷60%', 防10:'防具強化卷10%', 手60:'手套強化卷60%', 手10:'手套強化卷10%', 武60:'武器強化卷60%', 武10:'武器強化卷10%',
    混60標準:'混沌卷軸60%', 混60高級:'高級混沌卷軸60%', 混選:'混沌選擇券',
    潛能方塊:'潛能方塊', 高級潛能方塊:'高級潛能方塊'
  };

  // ==== 背包橋接 ====
  function invCount(name){ try{ if (typeof global.getItemQuantity==='function') return global.getItemQuantity(name)|0; return (global.inventory&&global.inventory[name])|0; }catch(_){return 0;} }
  function invUse(name,n){ n=n||1; if(invCount(name)<n) return false; try{ if(typeof global.removeItem==='function'){ global.removeItem(name,n); return true; } global.inventory=global.inventory||{}; global.inventory[name]=(global.inventory[name]|0)-n; if(global.inventory[name]<=0) delete global.inventory[name]; return true; }catch(_){ return false; } }

  // ==== 套裝 ====
  var SET_TYPES=['hat','suit','glove','weapon','cape','shoes','shoulder','subweapon','badge','ornament'];
  function countUnlocked(st){ var i,c=0; for(i=0;i<SET_TYPES.length;i++){ var n=st.equips[SET_TYPES[i]]; if(n && n.locked===false) c++; } return c; }
  function computeSetBonus(cnt){
    var b={str:0,dex:0,int:0,luk:0,atk:0,def:0,hp:0,mp:0,ignoreDefPct:0,totalDamage:0,skillDamage:0};
    if(cnt>=3){b.hp+=1500;b.mp+=100;}
    if(cnt>=4){b.ignoreDefPct+=0.15;}
    if(cnt>=5){b.str+=50;b.dex+=50;b.int+=50;b.luk+=50;b.atk+=50;}
    if(cnt>=6){b.ignoreDefPct+=0.15;}
    if(cnt>=7){b.totalDamage+=0.15;}
    if(cnt>=8){b.skillDamage+=0.10;}
    if(cnt>=9){b.atk+=30;b.str+=40;b.dex+=40;b.int+=40;b.luk+=40;}
    if(cnt>=10){b.totalDamage+=0.15;}
    return b;
  }

  // ==== 能力計算與同步 ====
  function calcFinalStats(node){
    if (global.EquipStatsV2 && global.EquipStatsV2.calcEquipFinal) return global.EquipStatsV2.calcEquipFinal(node);
    return { str:0,dex:0,int:0,luk:0,atk:0,def:0,hp:0, starAtkPctSum:0, atkFromStar:0, atkFlat:0 };
  }
function computeEquipAggregate(){
  var st = Storage.read();
  var keys = SET_TYPES.slice();

  // 先把每件裝備 → 最終(基礎+卷軸+星力) 做平砍合計
  var sum = {str:0,dex:0,int:0,luk:0,atk:0,def:0,hp:0};
  for (var i=0;i<keys.length;i++){
    var s = calcFinalStats(st.equips[keys[i]]);
    sum.str+=s.str; sum.dex+=s.dex; sum.int+=s.int; sum.luk+=s.luk;
    sum.atk+=s.atk; sum.def+=s.def; sum.hp+=s.hp;
  }

  // 套裝平砍（% 類獨立）
  var cnt  = countUnlocked(st);
  var setB = computeSetBonus(cnt);
  var equipSetFlat = {
    str:setB.str|0, dex:setB.dex|0, int:setB.int|0, luk:setB.luk|0,
    atk:setB.atk|0, def:setB.def|0, hp:setB.hp|0, mp:setB.mp|0,
    ignoreDefPct:+setB.ignoreDefPct||0, totalDamage:+setB.totalDamage||0, skillDamage:+setB.skillDamage||0
  };

  // 讀取全域潛能（R→LR→SLR 的合計），注意：DEX 潛能要「當作 AGI 匯入」
  var gp = (st.globalPotential && st.globalPotential.summary) ? st.globalPotential.summary : {
    str:0,dex:0,int:0,luk:0,atk:0,def:0,hp:0,
    strPct:0,dexPct:0,intPct:0,lukPct:0,atkPct:0,hpPct:0,allStatPct:0
  };

  // === 只把潛能加在「裝備合計 sum」上；不影響套裝 ===
  // 這裡做 DEX→AGI 的映射：gp.dex / gp.dexPct 變成 agi / agiPct
  var gpMapped = {
    str: gp.str|0,  int: gp.int|0,  luk: gp.luk|0,  atk: gp.atk|0,  def: gp.def|0,  hp: gp.hp|0,
    strPct:+gp.strPct||0, intPct:+gp.intPct||0, lukPct:+gp.lukPct||0, atkPct:+gp.atkPct||0, hpPct:+gp.hpPct||0,
    allStatPct:+gp.allStatPct||0,
    agi: gp.dex|0, agiPct:+gp.dexPct||0
  };

  // 小工具：把 % 與平砍套用到某個 base 值上
  function apStat(baseVal, pct1, pctAll, flat){
    var m = 1 + (Number(pct1)||0)/100 + (Number(pctAll)||0)/100;
    return Math.floor((baseVal|0) * m) + (flat|0);
  }
  function apOnlyPct(baseVal, pct){
    var m = 1 + (Number(pct)||0)/100;
    return Math.floor((baseVal|0) * m);
  }

  // 潛能套用到「裝備合計」：DEX 的潛能當 AGI 吃
  var afterPotential = {
    str: apStat(sum.str, gpMapped.strPct, gpMapped.allStatPct, gpMapped.str),
    agi: apStat(sum.dex, gpMapped.agiPct, gpMapped.allStatPct, gpMapped.agi), // 注意：用 sum.dex 當基底
    int: apStat(sum.int, gpMapped.intPct, gpMapped.allStatPct, gpMapped.int),
    luk: apStat(sum.luk, gpMapped.lukPct, gpMapped.allStatPct, gpMapped.luk),
    atk: apOnlyPct(sum.atk, gpMapped.atkPct) + (gpMapped.atk|0),
    def: (sum.def|0) + (gpMapped.def|0),
    hp : apOnlyPct(sum.hp,  gpMapped.hpPct) + (gpMapped.hp|0)
  };

  // 最終面板值＝（裝備合計+潛能）＋ 套裝平砍；套裝的 % 類保留獨立欄位
  var final = {
    str: afterPotential.str + (equipSetFlat.str|0),
    agi: afterPotential.agi + (equipSetFlat.dex|0), // 套裝的敏捷原本是 dex，這裡也加到 agi
    int: afterPotential.int + (equipSetFlat.int|0),
    luk: afterPotential.luk + (equipSetFlat.luk|0),
    atk: afterPotential.atk + (equipSetFlat.atk|0),
    def: afterPotential.def + (equipSetFlat.def|0),
    hp : afterPotential.hp  + (equipSetFlat.hp|0),
    mp : equipSetFlat.mp|0,
    ignoreDefPct: equipSetFlat.ignoreDefPct||0,
    totalDamage : equipSetFlat.totalDamage||0,
    skillDamage : equipSetFlat.skillDamage||0
  };

  // 寫回 coreBonus（只提供兩塊：equip=已含潛能；equipSet=套裝。不要再寫 potential/final 以免重複）
  try{
    if (global.player && global.player.coreBonus && global.player.coreBonus.bonusData){
      var bd = global.player.coreBonus.bonusData;

      // 裝備（已含潛能；敏捷用 agi）
      bd.equip = {
        str: afterPotential.str, agi: afterPotential.agi, int: afterPotential.int,
        luk: afterPotential.luk, atk: afterPotential.atk, def: afterPotential.def, hp: afterPotential.hp
      };

      // 套裝（平砍；% 類獨立）
      bd.equipSet = {
        str:equipSetFlat.str, agi:equipSetFlat.dex, int:equipSetFlat.int, luk:equipSetFlat.luk,
        atk:equipSetFlat.atk, def:equipSetFlat.def, hp:equipSetFlat.hp, mp:equipSetFlat.mp,
        ignoreDefPct:equipSetFlat.ignoreDefPct, totalDamage:equipSetFlat.totalDamage, skillDamage:equipSetFlat.skillDamage
      };

      // 若你只拿 bd.equip + bd.equipSet，面板/戰鬥就自然吃到潛能（且不會重複加）
    }
    global.updateResourceUI && global.updateResourceUI();
  }catch(_){}

  // 回傳：sum=原裝備合計(未套潛能)、set=套裝、gp=潛能、final=面板值
  return { sum:sum, set:setB, unlocked:cnt, gp:gp, final:final };
}
  function syncAndPing(){
    computeEquipAggregate();
    try{
      var evt; try{ evt=new CustomEvent('coreBonus:changed',{detail:{source:'equip'}}); }catch(__){ evt=document.createEvent('Event'); evt.initEvent('coreBonus:changed',true,true); }
      global.dispatchEvent && global.dispatchEvent(evt);
    }catch(_){}
  }

  // ==== 操作 ====
  function unlockEquip(type){
    var st=Storage.read(), n=st.equips[type]; if(!n) return {ok:false,msg:'裝備不存在'};
    if(!n.locked) return {ok:false,msg:'已解鎖'};
    var need=unlockCostByType(type); if(!invUse(ITEM.解放石,need)) return {ok:false,msg:'缺少 裝備解放石 ×'+need};
    n.locked=false; if(isNum(n._pendingStar)){ n.star=n._pendingStar|0; delete n._pendingStar; }
    var o={}; o[type]=n; Storage.write({equips:o}); syncAndPing();
    return {ok:true,msg:'已解鎖 '+n.name + (n.star? ('（從 '+n.star+'★ 開始）') : '') };
  }
  function canUseScroll(type){ return !(type==='subweapon'||type==='badge') && ((DEF_SLOTS[type]|0)>0); }

  function updateBestChaosEff(node, eff){
    if (!eff) return node._bestChaosEff||null;
    var keys=['str','dex','int','luk','atk','hp','def'], best=clone(node._bestChaosEff||{}), i,k,v;
    for(i=0;i<keys.length;i++){ k=keys[i]; v=Number(eff[k]||0); if(v>0){ var cur=Number(best[k]||0); if(v>cur) best[k]=v; } }
    return best;
  }

  function useScroll(type, name){
    if (!global.ScrollForgeV2) return {ok:false,msg:'未載入 ScrollForgeV2'};
    var st=Storage.read(), n=st.equips[type];
    if (!canUseScroll(type)) return {ok:false,msg:'此部位不可使用卷軸'};
    var chk=ScrollForgeV2.canUse(n,name);
    if(!chk.ok){
      var msg = chk.reason==='not_found' ? '沒有這種卷軸' : chk.reason==='locked' ? '裝備未解鎖' : chk.reason==='wrong_type' ? '卷軸不符合裝備' : '已無卷軸次數';
      return {ok:false,msg:msg};
    }
    var isChaos=(name===ITEM.混60標準||name===ITEM.混60高級);
    if(!isChaos){
      if(!invUse(name,1)) return {ok:false,msg:'背包沒有：'+name};
      var res=ScrollForgeV2.apply(n,name); var next=res.nextNode;
      var o={}; o[type]=next; Storage.write({equips:o}); syncAndPing();
      return {ok:true,success:res.success,msg:(res.success?'強化成功':'強化失敗')+'（成功率 '+res.rate+'%｜已用 '+next.slotsUsed+'/'+next.slotsMax+'）'};
    }
    if(!invUse(name,1)) return {ok:false,msg:'背包沒有：'+name};
    var pv=ScrollForgeV2.chaosPreview(n,name);
    if(!pv.ok){ return {ok:false,msg:'混沌檢定失敗（狀態不符）'}; }
    if(!pv.success){
      var nf=clone(n); nf.slotsUsed=(nf.slotsUsed|0)+1; var o1={}; o1[type]=nf; Storage.write({equips:o1}); syncAndPing();
      return {ok:true,success:false,msg:name+' 失敗（卷軸次數 +1）｜已用 '+nf.slotsUsed+'/'+nf.slotsMax};
    }
    var hasTicket=invCount(ITEM.混選)>0, doApply=true;
    if(hasTicket){ try{ doApply=confirm('混沌成功！是否套用？\n\n結果：'+JSON.stringify(pv.effPreview)+'\n\n是：套用並扣 1 次\n否：不套用、不扣次（混沌選擇券消耗）'); }catch(_){ doApply=true; } invUse(ITEM.混選,1); }
    var cm=ScrollForgeV2.chaosCommit(n,name,pv.effPreview,doApply); var next=cm.nextNode;
    if(doApply){ next._lastChaosEff=pv.effPreview||null; next._bestChaosEff=updateBestChaosEff(next,pv.effPreview); }
    var o2={}; o2[type]=next; Storage.write({equips:o2}); syncAndPing();
    var tip=doApply?'混沌成功並套用（+1 次）':'混沌成功但未套用（不扣次）';
    return {ok:true,success:true,msg:tip+'｜已用 '+next.slotsUsed+'/'+next.slotsMax};
  }

  function restoreFailed(type){
    if (!global.ScrollForgeV2) return {ok:false,msg:'未載入 ScrollForgeV2'};
    var st=Storage.read(), n=st.equips[type];
    if (!canUseScroll(type)) return {ok:false,msg:'此部位不可使用卷軸（無法恢復）'};
    if (!invUse(ITEM.恢復卷,1)) return {ok:false,msg:'缺少 恢復卷軸 ×1'};
    var r=ScrollForgeV2.recoverFailedOnce(n);
    if(!r.ok) return {ok:false,msg:(r.reason==='locked'?'裝備未解鎖':'沒有可恢復的失敗次數')};
    var o={}; o[type]=r.nextNode; Storage.write({equips:o}); syncAndPing();
    return {ok:true,msg:(r.success?'恢復成功（-1 失敗次數）':'恢復失敗（機率 50%）')};
  }
  function perfectReset(type){
    if (!global.ScrollForgeV2) return {ok:false,msg:'未載入 ScrollForgeV2'};
    var st=Storage.read(), n=st.equips[type];
    if (!invUse(ITEM.完美卷,1)) return {ok:false,msg:'缺少 完美重置卷軸 ×1'};
    var r=ScrollForgeV2.perfectReset(n); r.nextNode._lastChaosEff=null; r.nextNode._bestChaosEff=null;
    var o={}; o[type]=r.nextNode; Storage.write({equips:o}); syncAndPing();
    return {ok:true,msg:'裝備已完美重置（卷軸與星力歸零）'};
  }
  function starAttempt(type){
    if (!global.StarforceTableV1) return {ok:false,msg:'未載入 StarforceTableV1'};
    var st=Storage.read(), n=st.equips[type]; if(!n) return {ok:false,msg:'裝備不存在'}; if(n.locked) return {ok:false,msg:'裝備未解鎖'};
    if ((n.slotsMax|0)>0 && n.slotsUsed<n.slotsMax) return {ok:false,msg:'請先用完卷軸次數後再進行升星'};
    if (!invUse(ITEM.衝星石,1)) return {ok:false,msg:'缺少 衝星石 ×1'};
    var r=StarforceTableV1.attempt(n.star|0,{maxStar:30,boomReset:{locked:true,pendingStar:12}});
    if(r.boom){ n.locked=true; n._pendingStar=12; } else if(r.success){ n.star=r.next|0; }
    var o={}; o[type]=n; Storage.write({equips:o}); syncAndPing();
    return {ok:r.success, msg: r.boom?'★失敗並爆炸！需重新解鎖；重新解鎖後從 12★ 開始（卷軸能力保留）':(r.success?'星力成功 → '+n.star+'★':'星力失敗'), success:r.success, boom:r.boom};
  }

  // ==== 潛能（只升不降；強制套用）====
  function emptySummary(){ return {str:0,dex:0,int:0,luk:0,atk:0,def:0,hp:0,strPct:0,dexPct:0,intPct:0,lukPct:0,atkPct:0,hpPct:0,allStatPct:0}; }
  function getGlobalPotential(){ var st=Storage.read(); return st.globalPotential || {lines:[],summary:emptySummary(),tier:'R'}; }

  function applyGlobalPotentialWithTier(lines, tier){
    var bonus=PotentialCoreV21.linesToBonus(lines||[]);
    Storage.write({ globalPotential:{ lines:clone(lines||[]), summary:bonus, tier: tier||'R' } });
    syncAndPing(); return {ok:true,msg:'已套用全域潛能'};
  }

  function rollPotentialAndApply(kind){ // 'normal' | 'plus'
    if (!global.PotentialCoreV21){ alert('未載入 PotentialCoreV21'); return; }
    var item=(kind==='plus')?ITEM.高級潛能方塊:ITEM.潛能方塊;
    if(!invUse(item,1)){ alert('缺少 '+item+' ×1'); return; }

    var st=Storage.read(); var curTier=(st.globalPotential&&st.globalPotential.tier)?st.globalPotential.tier:'R';
    var cubeType=(kind==='plus')?'cube_plus':'cube';
    var res=PotentialCoreV21.rollThreeSessionFrom(curTier, cubeType); // {sessionTier, lines}
    applyGlobalPotentialWithTier(res.lines, res.sessionTier);

    alert('潛能已套用（本次等級：'+res.sessionTier+'；原：'+curTier+'）');
    global.EquipHub&&global.EquipHub.requestRerender&&global.EquipHub.requestRerender();
  }

  // ==== UI 小件 ====
  function makeCard(p){ var d=document.createElement('div'); d.style.cssText="border:1px solid "+THEME.cardBorder+";background:"+THEME.cardBg+";border-radius:16px;padding:"+(p||"14px")+";color:"+THEME.text+";box-shadow:"+THEME.cardShadow+";font-size:14px;line-height:1.6;"; return d; }
  function section(title){ var card=makeCard("12px"); var h=document.createElement('div'); h.style.cssText='font-weight:900;letter-spacing:.3px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center'; h.textContent=title; card.appendChild(h); return {card:card, head:h}; }
  function chip(label,val){ var el=document.createElement('div'); el.style.cssText="background:"+THEME.pillBg+";border:1px solid "+THEME.pillBorder+";border-radius:999px;padding:8px 12px;font:800 13px ui-monospace,monospace;display:flex;gap:8px;align-items:center"; el.innerHTML='<span style="opacity:.85">'+label+'</span><span>'+val+'</span>'; return el; }
  function pill(text,active,onclick){ var b=document.createElement('button'); b.textContent=text; b.style.cssText="border:1px solid "+(active?THEME.pillActiveBorder:THEME.pillBorder)+";background:"+(active?THEME.pillActiveBg:THEME.pillBg)+";color:#fff;border-radius:999px;padding:8px 14px;cursor:pointer;font-weight:900;font-size:14px"; if(onclick) b.onclick=onclick; return b; }
  function btn(txt,fn,primary,disabled){ var b=document.createElement('button'); b.textContent=txt; b.style.cssText='padding:10px 14px;border:1px solid '+(primary?THEME.pillActiveBorder:THEME.pillBorder)+';border-radius:12px;background:'+(primary?THEME.pillActiveBg:THEME.pillBg)+';color:#fff;cursor:pointer;font-weight:900;font-size:14px'; if(disabled){ b.style.opacity='.5'; b.style.cursor='not-allowed'; } else if(fn){ b.onclick=fn; } return b; }
  function line(){ var hr=document.createElement('div'); hr.style.cssText='height:1px;background:'+THEME.cardBorder+';margin:12px 0'; return hr; }
  function badgeForTier(t){ var span=document.createElement('span'); span.className='tier-badge tier-'+t; span.textContent=t; span.title='潛能等級：'+t; return span; }

  // ==== 機率視窗（顯示目前等級的升級機率＋本等級詞條池）====
  function showRatesModal(){
    var old = document.getElementById('equipRateModal');
    if (old){ old.style.display='flex'; return; }

    var st = Storage.read();
    var curTier = (st.globalPotential && st.globalPotential.tier) ? st.globalPotential.tier : 'R';

    var backdrop = document.createElement('div');
    backdrop.id='equipRateModal';
    backdrop.style.cssText='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);z-index:10000;padding:12px;';

    var wrap = (function(){ var c=makeCard("14px"); c.style.cssText += ";width:min(920px,96vw);max-height:92vh;overflow:auto;"; return c; })();

    // header
    var head = document.createElement('div');
    head.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:8px';
    var title = document.createElement('div');
    title.style.cssText='font-weight:900;letter-spacing:.4px';
    title.textContent = '📊 機率資訊';
    var tierBadge = badgeForTier(curTier);
    tierBadge.style.marginLeft='8px';
    tierBadge.title='目前潛能等級（從此等級檢定升級）';
    var left = document.createElement('div'); left.style.cssText='display:flex;align-items:center';
    left.appendChild(title); left.appendChild(tierBadge);
    var closeBtn = document.createElement('button');
    closeBtn.textContent='✕';
    closeBtn.style.cssText='border:1px solid '+THEME.pillBorder+';background:'+THEME.pillBg+';color:#fff;border-radius:10px;padding:6px 10px;cursor:pointer;font-weight:900';
    closeBtn.onclick=function(){ backdrop.remove(); };
    head.appendChild(left); head.appendChild(closeBtn);
    wrap.appendChild(head);

    function section2(t){ var s=section(t); return s; }
    function tableFrom(rows){
      var t=document.createElement('table');
      t.style.cssText='width:100%;border-collapse:collapse;font-size:13px;margin-top:8px';
      for(var i=0;i<rows.length;i++){
        var tr=document.createElement('tr'); if(i===0) tr.style.cssText='background:#0f172a';
        for(var j=0;j<rows[i].length;j++){
          var td=document.createElement(i?'td':'th');
          td.textContent=rows[i][j];
          td.style.cssText='border:1px solid '+THEME.cardBorder+';padding:6px;text-align:center';
          tr.appendChild(td);
        }
        t.appendChild(tr);
      }
      return t;
    }
    function pct(n){ return (Number(n||0)*100).toFixed(2)+'%'; }

    // ① 目前等級 → 下一階升級機率
    if (global.PotentialCoreV21 && PotentialCoreV21.upgradeChanceFrom){
      var r1 = PotentialCoreV21.upgradeChanceFrom(curTier,'cube');
      var r2 = PotentialCoreV21.upgradeChanceFrom(curTier,'cube_plus');
      var sec = section2('目前等級 → 下一階（升級機率）');
      var rows = [['目前等級','一般方塊','高級方塊'],
                  [curTier, pct(r1), pct(r2)]];
      sec.card.appendChild(tableFrom(rows));
      wrap.appendChild(sec.card);
    }

    // ② 本次等級的詞條池（已套倍率）
    if (global.PotentialCoreV21 && PotentialCoreV21.effectTableForSession){
      var list = PotentialCoreV21.effectTableForSession(curTier);
      var sec2 = section2('本次等級詞條池（數值已套 '+curTier+' 倍率）');
      var rows2 = [['詞條','數值','機率']];
      for (var k=0;k<list.length;k++){
        var e=list[k]; rows2.push([e.label, (e.value + (e.unit||'')), e.prob.toFixed(2)+'%']);
      }
      sec2.card.appendChild(tableFrom(rows2));
      wrap.appendChild(sec2.card);
    }

    backdrop.appendChild(wrap);
    backdrop.addEventListener('click', function(e){ if(e.target===backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);
  }
  global.Equip_showRatesModal = showRatesModal;

 function renderSummaryCard(root){
  var r = computeEquipAggregate();
  var s = r.final || r.sum; // 有 final 就用 final（含潛能），沒有就退回 sum
  var cnt = r.unlocked;

  var sec = section('整體裝備能力（v4.1）');
  var chips = document.createElement('div');
  chips.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:6px';

  // 注意：面板顯示 DEX＝取 s.agi（因為內部用 agi 作為敏捷欄位）
  chips.appendChild(chip('STR', fmt(s.str)));
  chips.appendChild(chip('DEX', fmt(s.agi || s.dex || 0)));
  chips.appendChild(chip('INT', fmt(s.int)));
  chips.appendChild(chip('LUK', fmt(s.luk)));
  chips.appendChild(chip('ATK', fmt(s.atk)));
  chips.appendChild(chip('DEF', fmt(s.def)));
  chips.appendChild(chip('HP',  fmt(s.hp)));
  sec.card.appendChild(chips);
  root.appendChild(sec.card);

  var sec2 = section('套裝效果（累積）');
  var rowTxt = ['3件：HP+1500、MP+100','4件：無視防禦+15%','5件：全屬+50、攻擊+50','6件：無視防禦再+15%','7件：總傷害+15%','8件：技能傷害+10%','9件：攻擊+30、全屬+40','10件：總傷害+15%'];
  var wrap = document.createElement('div'); wrap.style.cssText='opacity:.9'; wrap.innerHTML='已解鎖件數：<b>'+cnt+' / 10</b>'; sec2.card.appendChild(wrap);
  for (var i=0;i<rowTxt.length;i++){
    var d=document.createElement('div');
    d.style.cssText='margin-top:6px;opacity:'+(cnt>=i+3?1:.6);
    d.textContent=(cnt>=i+3?'✅ ':'□ ')+rowTxt[i];
    sec2.card.appendChild(d);
  }
  root.appendChild(sec2.card);
}

  // ==== 分頁 ====
  var innerState={ current:'hat', gpOpen:false };
  function renderSwitcher(container){
    var tabs=[['hat','帽子'],['suit','套服'],['glove','手套'],['weapon','武器'],['cape','披風'],['shoes','鞋子'],['shoulder','肩膀'],['subweapon','輔助武器'],['badge','徽章'],['ornament','裝飾']];
    var row=document.createElement('div'); row.style.cssText='display:flex;gap:10px;margin:10px 0;flex-wrap:wrap';
    var i; for(i=0;i<tabs.length;i++){ (function(t){ row.appendChild( pill(t[1], innerState.current===t[0], function(){ innerState.current=t[0]; global.EquipHub&&global.EquipHub.requestRerender&&global.EquipHub.requestRerender(); }) ); })(tabs[i]); }
    container.appendChild(row);
  }

  // ==== 潛能卡 ====
  function summaryChips(sum){
    var wrap=document.createElement('div'); wrap.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:6px';
    function add(label,v,isPct){ var n=Number(v||0); if(!n) return; wrap.appendChild(chip(label, isPct?(n.toFixed(0)+'%'):fmt(n))); }
    add('STR',sum.str); add('DEX',sum.dex); add('INT',sum.int); add('LUK',sum.luk);
    add('ATK',sum.atk); add('DEF',sum.def); add('HP',sum.hp);
    add('STR%',sum.strPct,true); add('DEX%',sum.dexPct,true); add('INT%',sum.intPct,true); add('LUK%',sum.lukPct,true);
    add('ATK%',sum.atkPct,true); add('HP%',sum.hpPct,true); add('All%',sum.allStatPct,true);
    if (!wrap.childNodes.length){ var none=document.createElement('div'); none.style.cssText='opacity:.75'; none.textContent='（尚未設定）'; wrap.appendChild(none); }
    return wrap;
  }

  function renderGlobalPotentialCard(root){
    var st=Storage.read(); var gp=st.globalPotential||{lines:[],summary:emptySummary(),tier:'R'};
    var topTier=tierMax(gp.lines); var tc=TIER_COLOR[topTier]||TIER_COLOR.R;
    var sec=section('全域潛能（可用：一般 x'+invCount(ITEM.潛能方塊)+'｜高級 x'+invCount(ITEM.高級潛能方塊)+'）');
    sec.card.style.borderColor=tc.border; sec.card.style.boxShadow=(topTier==='SLR'? (TIER_COLOR.SLR.glow+', ') : (tc.glow+', '))+THEME.cardShadow;

    // 目前等級徽章
    var badge=badgeForTier(gp.tier); badge.title='目前潛能等級（下次洗從此等級檢定升階）'; sec.head.appendChild(badge);

    var toggle=btn(innerState.gpOpen?'收合':'展開', function(){ innerState.gpOpen=!innerState.gpOpen; global.EquipHub&&global.EquipHub.requestRerender&&global.EquipHub.requestRerender(); }, false);
    sec.head.appendChild(toggle);

    if(!innerState.gpOpen){
      var brief=document.createElement('div'); brief.style.cssText='opacity:.9';
      if(!gp.lines||gp.lines.length===0){ brief.textContent='尚未設定（使用方塊抽取三條潛能）'; }
      else{
        var list=[], i, ln, unit;
        for(i=0;i<gp.lines.length;i++){ ln=gp.lines[i]; unit=(ln.unit==='pct'||ln.unit==='allpct')?'%':''; list.push('['+ln.tier+'] '+ln.label+' +'+ln.value+unit); }
        brief.textContent=list.join(' ｜ ');
      }
      sec.card.appendChild(brief); root.appendChild(sec.card); return;
    }

    var curBox=makeCard("10px"); curBox.style.marginTop='6px';
    var head=document.createElement('div'); head.style.cssText='font-weight:900;margin-bottom:6px;display:flex;align-items:center;gap:8px'; head.textContent='目前三條 '; head.appendChild(badgeForTier(gp.tier)); curBox.appendChild(head);
    if(!gp.lines||gp.lines.length===0){ var none=document.createElement('div'); none.style.cssText='opacity:.8'; none.textContent='尚未設定'; curBox.appendChild(none); }
    else{
      var i, row, ln, unit;
      for(i=0;i<gp.lines.length;i++){
        row=document.createElement('div'); row.style.cssText='display:flex;gap:6px;align-items:center';
        ln=gp.lines[i]; unit=(ln.unit==='pct'||ln.unit==='allpct')?'%':'';
        var b=document.createElement('span'); b.className='tier-badge tier-'+ln.tier; b.textContent=ln.tier;
        row.appendChild(b); var t=document.createElement('span'); t.textContent=ln.label+' +'+ln.value+unit; row.appendChild(t);
        curBox.appendChild(row);
      }
    }
    curBox.appendChild(line());
    var h2=document.createElement('div'); h2.style.cssText='font-weight:900;margin-bottom:6px'; h2.textContent='合計（套用到最終面板）'; curBox.appendChild(h2);
    curBox.appendChild(summaryChips(gp.summary||emptySummary()));
    sec.card.appendChild(curBox);

    var row=document.createElement('div'); row.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin-top:10px';
    row.appendChild(btn('洗一次（一般）', function(){ rollPotentialAndApply('normal'); }, true, invCount(ITEM.潛能方塊)<=0));
    row.appendChild(btn('洗一次（高級）', function(){ rollPotentialAndApply('plus'); }, false, invCount(ITEM.高級潛能方塊)<=0));
    row.appendChild(btn('機率資訊', global.Equip_showRatesModal || showRatesModal, false));
    sec.card.appendChild(row);

    root.appendChild(sec.card);
  }

  // ==== 單件卡 ====
  function renderEquipCard(type){
    var st=Storage.read(), node=st.equips[type];
    var box=makeCard("16px"); box.style.marginBottom="14px";
    var titleRow=document.createElement('div'); titleRow.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:8px';
    var title=document.createElement('div'); title.style.cssText='font-weight:900;font-size:16px'; title.textContent='【'+node.name+'】 '+(node.locked?'🔒 未解鎖':'🔓 已解鎖');
    var badge=document.createElement('div'); badge.style.cssText='background:'+THEME.pillActiveBg+';border:1px solid '+THEME.pillActiveBorder+';color:#fff;border-radius:999px;padding:6px 10px;font:900 12px/1 ui-monospace,monospace;'; badge.textContent='強化成功 +'+(toInt(node.enhanceSuccess)||0);
    titleRow.appendChild(title); titleRow.appendChild(badge); box.appendChild(titleRow);

    var meta=document.createElement('div'); meta.style.cssText='font-size:13px;opacity:.9;margin-top:4px'; meta.textContent='星：'+node.star+'★ ｜ 卷軸：'+node.slotsUsed+'/'+node.slotsMax; box.appendChild(meta);
    var p=(node.slotsMax|0)>0 ? Math.min(1,node.slotsUsed/Math.max(1,node.slotsMax)) : 1;
    var bar=document.createElement('div'); bar.style.cssText='height:10px;background:#0a1220;border:1px solid '+THEME.cardBorder+';border-radius:999px;overflow:hidden;margin-top:8px'; var inr=document.createElement('div'); inr.style.cssText='height:100%;background:'+THEME.success+';width:'+(p*100).toFixed(1)+'%'; bar.appendChild(inr); box.appendChild(bar);

    if(!node.locked){
      var s=calcFinalStats(node);
      var sec=section('能力總覽'); sec.card.style.marginTop="12px";
      var big=document.createElement('div'); big.style.cssText='font:900 18px ui-monospace,monospace;letter-spacing:.3px;margin-bottom:8px';
      big.innerHTML='<span style="color:'+THEME.blue+'">ATK +'+fmt(s.atk)+'</span>　'+'<span style="color:'+THEME.success+'">DEF +'+fmt(s.def)+'</span>　'+'<span style="color:'+THEME.warn+'">HP +'+fmt(s.hp)+'</span>';
      sec.card.appendChild(big);
      var wrap=document.createElement('div'); wrap.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
      wrap.appendChild(chip('STR',fmt(s.str))); wrap.appendChild(chip('DEX',fmt(s.dex))); wrap.appendChild(chip('INT',fmt(s.int))); wrap.appendChild(chip('LUK',fmt(s.luk)));
      wrap.appendChild(chip('星力%累積',(s.starAtkPctSum||0)+'%')); wrap.appendChild(chip('星力加攻',fmt(s.atkFromStar||0)));
      sec.card.appendChild(wrap); box.appendChild(sec.card);
    }else{
      var hint=document.createElement('div'); hint.style.cssText='opacity:.85;margin-top:10px'; hint.textContent='（未解鎖，無能力）'; box.appendChild(hint);
    }

    var row=document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:12px';
    if(node.locked){
      var need=unlockCostByType(type);
      row.appendChild( btn('解鎖（-裝備解放石×'+need+'｜持有 '+invCount(ITEM.解放石)+'）', function(){ var r=unlockEquip(type); alert(r.msg); global.EquipHub&&global.EquipHub.requestRerender&&global.EquipHub.requestRerender(); }, true) );
    }else{
      if (canUseScroll(type)){
        var list=[];
        if(type==='hat'||type==='suit'||type==='cape'||type==='shoes'||type==='shoulder'||type==='ornament'){ list.push(ITEM.防60,ITEM.防10,ITEM.混60標準,ITEM.混60高級); }
        else if(type==='glove'){ list.push(ITEM.手60,ITEM.手10,ITEM.混60標準,ITEM.混60高級); }
        else if(type==='weapon'){ list.push(ITEM.武60,ITEM.武10,ITEM.混60標準,ITEM.混60高級); }
        var i; for(i=0;i<list.length;i++){ (function(name){ var have=invCount(name), blocked=(node.slotsMax>0&&node.slotsUsed>=node.slotsMax);
          row.appendChild( btn('強化：'+name+'（持有 '+have+'）', function(){ var r=useScroll(type,name); alert(r.msg); global.EquipHub&&global.EquipHub.requestRerender&&global.EquipHub.requestRerender(); }, false, blocked||have<=0 ) );
        })(list[i]); }
        row.appendChild( btn('恢復失敗次數（50%）', function(){ var r=restoreFailed(type); alert(r.msg); global.EquipHub&&global.EquipHub.requestRerender&&global.EquipHub.requestRerender(); }, false, invCount(ITEM.恢復卷)<=0) );
        row.appendChild( btn('完美重置', function(){ var r=perfectReset(type); alert(r.msg); global.EquipHub&&global.EquipHub.requestRerender&&global.EquipHub.requestRerender(); }, false, invCount(ITEM.完美卷)<=0) );
      }
      row.appendChild( btn('升星（-衝星石×1｜持有 '+invCount(ITEM.衝星石)+'）', function(){ var r=starAttempt(type); alert(r.msg); global.EquipHub&&global.EquipHub.requestRerender&&global.EquipHub.requestRerender(); }, true ) );
    }
    box.appendChild(row);

    // 混沌展示
    var chaosSec=section('最近一次混沌卷結果'); chaosSec.card.style.marginTop='6px';
    (function(){
      var eff=node._lastChaosEff||null; var keys=['str','dex','int','luk','atk','hp','def'];
      var wrap=document.createElement('div'); wrap.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:6px';
      if(!eff){ var none=document.createElement('div'); none.style.cssText='opacity:.75;font-size:12px'; none.textContent='尚無混沌卷紀錄'; wrap.appendChild(none); }
      else{
        function small(label,val){ var n=Number(val||0); var col=n>0?THEME.success:(n<0?THEME.neg:THEME.zero); var b=document.createElement('div'); b.style.cssText='border:1px solid '+THEME.cardBorder+';background:'+THEME.pillBg+';border-radius:8px;padding:4px 8px;font:800 12px ui-monospace,monospace;color:'+col; b.textContent=label+(n>=0?'+':'')+n; return b; }
        var i; for(i=0;i<keys.length;i++) if(eff.hasOwnProperty(keys[i])) wrap.appendChild(small(keys[i].toUpperCase(), eff[keys[i]]));
      }
      chaosSec.card.appendChild(wrap);
    })();
    box.appendChild(chaosSec.card);

    var bestSec=section('歷史最高混沌加成（僅顯示正向）');
    (function(){
      var eff=node._bestChaosEff||null; var keys=['str','dex','int','luk','atk','hp','def'];
      var wrap=document.createElement('div'); wrap.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:6px'; var any=false,i;
      function small(label,val){ var n=Number(val||0); if(n<=0) return null; var b=document.createElement('div'); b.style.cssText='border:1px solid '+THEME.cardBorder+';background:'+THEME.pillBg+';border-radius:8px;padding:4px 8px;font:800 12px ui-monospace,monospace;color:'+THEME.success; b.textContent=label+'+'+n; return b; }
      if(eff){ for(i=0;i<keys.length;i++){ var el=small(keys[i].toUpperCase(), eff[keys[i]]); if(el){ wrap.appendChild(el); any=true; } } }
      if(!any){ var none=document.createElement('div'); none.style.cssText='opacity:.75;font-size:12px'; none.textContent='尚無正向加成記錄'; wrap.appendChild(none); }
      bestSec.card.appendChild(wrap);
    })();
    box.appendChild(bestSec.card);

    return box;
  }

  // ==== 規則摘要 ====
  function renderRuleCard(root){
    var sec=section('規則摘要（v4.1）'); var b=document.createElement('div');
    b.innerHTML='• 潛能：每次從「目前等級」出發檢定升階（只升不降），一次抽三條並直接套用。<br>'
               +'• 混沌卷成功時，若持有「混沌選擇券」可選擇是否套用：套用扣 1 次；不套用不扣次；兩者皆消耗 1 張券。<br>'
               +'• 可卷部位需卷軸用盡才可升星；不可卷部位可直接升星。';
    var row=document.createElement('div'); row.style.cssText='display:flex;gap:10px;margin-top:8px';
    var btnR=document.createElement('button'); btnR.textContent='機率資訊'; btnR.onclick=(global.Equip_showRatesModal||showRatesModal); btnR.style.cssText='padding:8px 12px;border-radius:10px;border:1px solid '+THEME.pillBorder+';background:'+THEME.pillBg+';color:#fff;font-weight:900;cursor:pointer';
    row.appendChild(btnR); sec.card.appendChild(b); sec.card.appendChild(row); root.appendChild(sec.card);
  }

  // ==== Tab ====
  function renderTab(root){
    var wrap=document.createElement('div');
    renderRuleCard(wrap);
    renderSummaryCard(wrap);
    renderGlobalPotentialCard(wrap);                // 潛能卡在整體能力下方
    var sw=document.createElement('div'); renderSwitcher(sw); wrap.appendChild(sw);
    wrap.appendChild(line());
    wrap.appendChild(renderEquipCard(innerState.current));
    root.appendChild(wrap);
  }

  if (global.EquipHub && typeof global.EquipHub.registerTab==='function'){
    global.EquipHub.registerTab({ id:'equip_core_v4_1', title:'裝備系統 v4.1', render:function(root){ renderTab(root); }, tick:function(){}, onOpen:function(){ syncAndPing(); } });
  }
  (function ensureReady(){ var tries=0, t=setInterval(function(){ if(global.player && global.player.coreBonus && global.player.coreBonus.bonusData){ clearInterval(t); syncAndPing(); } else if(++tries>200){ clearInterval(t); } }, 50); })();
  
})(this);
