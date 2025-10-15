// =======================
// equip_core_tab.js — 核心系統分頁（攻擊/生命/傷害）ES5（獨立存檔版）
// 依賴：equipment_hub.js（EquipHub）、window.player
// 背包：getItemQuantity(name) / removeItem(name, count)
// =======================
(function (w) {
  "use strict";
  if (!w.EquipHub || typeof w.EquipHub.registerTab !== "function") return;

  // ---- 可調參與道具名稱 ----
  var ITEM_CORE_STONE    = "核心強化石";   // ✅ 改回核心強化石
  var ITEM_AWAKEN_STONE  = "核心覺醒石";
  var ITEM_STAR_STONE    = "核心星力石";

  // 解鎖需求（如需調整可改這裡）
  var UNLOCK_COST_CORE_STONE = 30;
  var UNLOCK_COST_AWAKEN     = 15;

  // 強化
  var ENHANCE_BASE_REQ = 5;     // +0 等所需核心強化石
  var ENHANCE_SUCC_PCT = 0.35;  // 35% 成功率（固定）
  function enhanceCostForLevel(curLv){ return ENHANCE_BASE_REQ + Math.floor(curLv/10)*5; }

  // 星力（成功率維持不變；UI 簡化只顯示「目前總加成」）
  var STAR_SUCC_BY_OFFER = { 1:0.05, 5:0.12, 10:0.28 };
  var STAR_FAIL_DOWN_PCT = 0.35;
  var STAR_PER_SUCCESS   = 1;

  // ★ 每★倍率：基礎 +2%，每 +5 強化 → 每★ +1%（規則沿用，但 UI 只顯示總加成）
  function starPerStarByEnh(enhLv){ return 0.02 + Math.floor(Math.max(0, enhLv||0)/5) * 0.01; }
  function starTotalBonusPct(starLv, enhLv){ return Math.max(0, starLv||0) * starPerStarByEnh(enhLv||0); } // 小數
  function starMul(starLv, enhLv){ return 1 + starTotalBonusPct(starLv, enhLv); }
  function starIsProtected(starLv){ return starLv % 5 === 0; }

  // 品階與上限
  var GRADES = ["R","SR","SSR","UR","UR+","LR","LR+"];
  var GRADE_FEED_REQ = [150, 300, 600, 1200, 2400, 4800]; // R->SR 起 150，之後倍增
  var BASE_ENH_CAP  = 10;  // R 強化上限 10，之後每階 +5
  var BASE_STAR_CAP = 15;  // R 星力上限 15，之後每階 +5

  // 套裝倍率（以三顆核心之「最低品階」為基準；顯示「目前」與「下一階段」）
  // 需求：SSR=1x, UR=1.5x, UR+=2x, LR=2.5x, LR+=4x
  function setMultiplierByMinGrade(minGradeIdx){
    if (minGradeIdx >= 6) return 4.0;  // LR+
    if (minGradeIdx >= 5) return 2.5;  // LR
    if (minGradeIdx >= 4) return 2.0;  // UR+
    if (minGradeIdx >= 3) return 1.5;  // UR
    if (minGradeIdx >= 2) return 1.0;  // SSR
    return 0;                           // 未達 SSR，無套裝
  }
  function nextSetStageInfo(minGradeIdx){
    // 回傳 {needIdx, needLabel, mul} 或 null（已最高）
    var targets = [2,3,4,5,6]; // SSR, UR, UR+, LR, LR+
    for (var i=0;i<targets.length;i++){
      if (minGradeIdx < targets[i]){
        return { needIdx: targets[i], needLabel: GRADES[targets[i]], mul: setMultiplierByMinGrade(targets[i]) };
      }
    }
    return null;
  }

  // SR 以上階級的「獨立能力」（累積）
  function gradeIndependentBonus(coreKind, gradeIdx){
    var out = {};
    if (gradeIdx <= 0) return out; // R 無
    var tierCount = gradeIdx; // SR=1, SSR=2, UR=3, UR+=4, LR=5, LR+=6
    if (coreKind === "atk") {
      out.atk  = 100 * tierCount;
      out.def  = 50  * tierCount;
      out.attackSpeedPct = 0.10 * tierCount;
    } else if (coreKind === "life") {
      out.hp   = 1500 * tierCount;
      out.mp   = 30   * tierCount;
      out.recoverPercent = 0.05 * tierCount;
    } else if (coreKind === "dmg") {
      out.totalDamage = 0.10 * tierCount;
      out.skillDamage = 0.10 * tierCount;
      out.ignoreDefPct = Math.min(0.05 * tierCount, 0.40); // 穿透上限 40%
    }
    return out;
  }

  // 三核心：初始能力＆強化每級能力
  var CORE_DEF = {
    atk:  { title: "攻擊核心", base: { atk:20, def:3, attackSpeedPct:0.05 },             perEnh: { atk:10, def:5, attackSpeedPct:0.003 } },
    life: { title: "生命核心", base: { hp:200, recoverPercent:0.01 },                     perEnh: { hp:100, recoverPercent:0.003 } },
    dmg:  { title: "傷害核心", base: { totalDamage:0.05, skillDamage:0.05 },              perEnh: { totalDamage:0.003, skillDamage:0.003 } }
  };

  // ===== 存檔（獨立狀態）=====
  var LS_KEY = "CORE_SYS_INDEPENDENT_V1";
  var state = (function load(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return fresh();
      var s = JSON.parse(raw);
      sanitize(s);
      return s;
    }catch(_){ return fresh(); }

    function fresh(){
      return { 
        current: "atk",
        cores: {
          atk:  freshCore(),
          life: freshCore(),
          dmg:  freshCore()
        }
      };
    }
    function freshCore(){
      return { unlocked:false, gradeIdx:0, feed:0, enhanceLv:0, starLv:0 };
    }
    function ensureCore(s, key){
      s.cores = s.cores || {};
      if (!s.cores[key]) s.cores[key] = freshCore();
      var c = s.cores[key];
      c.unlocked  = !!c.unlocked;
      c.gradeIdx  = toInt(c.gradeIdx || 0);
      c.feed      = toInt(c.feed || 0);
      c.enhanceLv = toInt(c.enhanceLv || 0);
      c.starLv    = toInt(c.starLv || 0);
      s.cores[key]= c;
    }
    function sanitize(s){
      s = s && typeof s==="object" ? s : fresh();
      s.current = (s.current==="atk"||s.current==="life"||s.current==="dmg") ? s.current : "atk";
      ensureCore(s, "atk"); ensureCore(s, "life"); ensureCore(s, "dmg");
      state = s;
    }
  })();

  function saveLocal(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(_){ } }
  function toInt(n){ n = Number(n); return isFinite(n) ? Math.floor(n) : 0; }
  function nz(x){ return (typeof x==="number" && !isNaN(x)) ? x : 0; }
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function fmtPct(n){ return (Number(n||0)*100).toFixed(2) + "%"; }

  // 對外匯出/套用（可選）
  w.Core_exportState = function(){ return JSON.parse(JSON.stringify(state)); };
  w.Core_applyState = function(s){
    if (!s || typeof s!=="object") return;
    try{ localStorage.setItem(LS_KEY, JSON.stringify(s)); }catch(_){}
    (function reload(){
      try{
        var raw = localStorage.getItem(LS_KEY);
        var obj = raw ? JSON.parse(raw) : null;
        if (obj) state = obj;
      }catch(_){}
    })();
    saveLocal(); applyToPlayer(); w.EquipHub?.requestRerender?.();
  };

  // ===== 小工具（顯示用）=====
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function fmtPct(n){ return (Number(n||0)*100).toFixed(2) + "%"; }

  // 彩色標籤輸出（深色底）
  function prettyStatLines(obj){
    if (!obj) return "";
    var parts = [];
    function chip(label, valHtml, color){
      return '<span style="display:inline-block;background:'+color.bg+';color:'+color.fg+';padding:2px 6px;border-radius:999px;margin:2px 6px 2px 0;font-size:12px;white-space:nowrap;">'
            + label + ' ' + valHtml + '</span>';
    }
    var C = {
      atk:  {bg:"#3f1d1d", fg:"#fca5a5"},
      def:  {bg:"#16233a", fg:"#93c5fd"},
      hp:   {bg:"#123524", fg:"#86efac"},
      mp:   {bg:"#2b1e3f", fg:"#d8b4fe"},
      aspd: {bg:"#0b2f36", fg:"#67e8f9"},
      rec:  {bg:"#16302b", fg:"#6ee7b7"},
      tdam: {bg:"#3a2809", fg:"#fcd34d"},
      sdam: {bg:"#3a1028", fg:"#f9a8d4"},
      ign:  {bg:"#24310b", fg:"#bef264"}
    };
    if (obj.atk            != null) parts.push(chip("攻擊力", "<b>+"+fmt(obj.atk)+"</b>", C.atk));
    if (obj.def            != null) parts.push(chip("防禦力", "<b>+"+fmt(obj.def)+"</b>", C.def));
    if (obj.hp             != null) parts.push(chip("生命",   "<b>+"+fmt(obj.hp)+"</b>", C.hp));
    if (obj.mp             != null) parts.push(chip("魔力",   "<b>+"+fmt(obj.mp)+"</b>", C.mp));
    if (obj.attackSpeedPct != null) parts.push(chip("攻速",   "<b>+"+fmtPct(obj.attackSpeedPct)+"</b>", C.aspd));
    if (obj.recoverPercent != null) parts.push(chip("回復",   "<b>+"+fmtPct(obj.recoverPercent)+"</b>", C.rec));
    if (obj.totalDamage    != null) parts.push(chip("總傷",   "<b>+"+fmtPct(obj.totalDamage)+"</b>", C.tdam));
    if (obj.skillDamage    != null) parts.push(chip("技能傷", "<b>+"+fmtPct(obj.skillDamage)+"</b>", C.sdam));
    if (obj.ignoreDefPct   != null) parts.push(chip("穿透防", "<b>+"+fmtPct(obj.ignoreDefPct)+"</b>", C.ign));
    return parts.join("");
  }

  // ===== 背包 =====
  function q(name){ try{ return Math.max(0, w.getItemQuantity ? (w.getItemQuantity(name)||0) : (w.inventory?.[name]||0)); }catch(_){return 0;} }
  function rm(name, n){
    n = toInt(n||0); if (!n) return true;
    if (q(name) < n) return false;
    try{
      if (typeof w.removeItem==="function"){ w.removeItem(name, n); return true; }
      w.inventory = w.inventory || {};
      w.inventory[name] = Math.max(0, (w.inventory[name]||0) - n);
      w.saveGame?.();
      return true;
    }catch(_){ return false; }
  }

  // ===== 工具：單顆核心的最終能力（含強化＋獨立加成＋星力乘）=====
  function capsFor(core){ var g=core.gradeIdx||0; return { enhCap: BASE_ENH_CAP + g*5, starCap: BASE_STAR_CAP + g*5 }; }
  function feedNeedForNext(core){ var g=core.gradeIdx||0; if (g>=GRADES.length-1) return null; return GRADE_FEED_REQ[Math.max(0,g)]; }

  function computeCoreFinalBonus(kind, core){
    var def = CORE_DEF[kind];
    var base = {};
    // 基礎
    for (var k in def.base) base[k] = nz(def.base[k]);
    // 強化
    var enh = core.enhanceLv||0;
    for (var k2 in def.perEnh) base[k2] = nz(base[k2]) + nz(def.perEnh[k2]) * enh;
    // 階級獨立
    var ind = gradeIndependentBonus(kind, core.gradeIdx);
    for (var k3 in ind) base[k3] = nz(base[k3]) + nz(ind[k3]);
    // 星力乘
    var mul = starMul(core.starLv||0, enh);
    for (var k4 in base) base[k4] = nz(base[k4]) * mul;
    return base; // {atk,def,hp,mp,attackSpeedPct, ...}
  }

  function sumStats(a, b){
    var out = {}; a=a||{}; b=b||{};
    var keys = {};
    for (var k in a) keys[k]=1;
    for (var k in b) keys[k]=1;
    for (var k2 in keys) out[k2] = nz(a[k2]) + nz(b[k2]);
    return out;
  }

  // ===== 寫入 player =====
  function applyToPlayer(){
    if (!w.player || !player.coreBonus) return;

    var B = {};
    ["atk","life","dmg"].forEach(function(kind){
      var c = state.cores[kind];
      if (!c || !c.unlocked) return;
      var fin = computeCoreFinalBonus(kind, c);
      var bucketName = (kind==="atk") ? "coreAttack" : (kind==="life" ? "coreLife" : "coreDamage");
      B[bucketName] = fin;
    });

    player.coreBonus.bonusData = player.coreBonus.bonusData || {};
    delete player.coreBonus.bonusData.coreAttack;
    delete player.coreBonus.bonusData.coreLife;
    delete player.coreBonus.bonusData.coreDamage;
    delete player.coreBonus.bonusData.coreSet;
    Object.assign(player.coreBonus.bonusData, B);

    // 套裝
    var minIdx = Math.min(state.cores.atk.gradeIdx, state.cores.life.gradeIdx, state.cores.dmg.gradeIdx);
    var setMul = setMultiplierByMinGrade(minIdx);
    if (setMul > 0){
      var baseSet = { atk:200, def:100, hp:4000, totalDamage:0.05, ignoreDefPct:0.05 };
      var finalSet = {};
      for (var k in baseSet) finalSet[k] = baseSet[k] * setMul;
      player.coreBonus.bonusData.coreSet = finalSet;
    }

    w.updateResourceUI?.();
    w.saveGame?.();
  }

  // ===== 互動 =====
  function doUnlock(cur){
    if (cur.unlocked) return;
    if (q(ITEM_CORE_STONE) < UNLOCK_COST_CORE_STONE || q(ITEM_AWAKEN_STONE) < UNLOCK_COST_AWAKEN) {
      alert("道具不足：需要 "+ITEM_CORE_STONE+" x"+UNLOCK_COST_CORE_STONE+" ＋ "+ITEM_AWAKEN_STONE+" x"+UNLOCK_COST_AWAKEN);
      return;
    }
    if (!rm(ITEM_CORE_STONE, UNLOCK_COST_CORE_STONE)) return;
    if (!rm(ITEM_AWAKEN_STONE, UNLOCK_COST_AWAKEN)) return;
    cur.unlocked = true; saveLocal(); applyToPlayer();
    w.logPrepend?.("🔓 核心已解鎖！"); alert("✅ 解鎖成功！"); EquipHub.requestRerender();
  }

  function doEnhance(cur){
    var caps = capsFor(cur);
    if (!cur.unlocked) return alert("尚未解鎖");
    if (cur.enhanceLv >= caps.enhCap) return alert("已達強化上限！");
    var need = enhanceCostForLevel(cur.enhanceLv);
    if (q(ITEM_CORE_STONE) < need) return alert(ITEM_CORE_STONE+" 不足，需 "+need+" 顆");
    if (!rm(ITEM_CORE_STONE, need)) return;

    var ok = Math.random() < ENHANCE_SUCC_PCT;
    if (ok){ cur.enhanceLv += 1; w.logPrepend?.("✨ 強化成功（+"+cur.enhanceLv+"）"); alert("✅ 強化成功！"); }
    else { w.logPrepend?.("❌ 強化失敗（等級不變）"); alert("❌ 強化失敗（等級不變）"); }
    saveLocal(); applyToPlayer(); EquipHub.requestRerender();
  }

  function doStarforce(cur, offer){
    var caps = capsFor(cur);
    if (!cur.unlocked) return alert("尚未解鎖");
    if (cur.starLv >= caps.starCap) return alert("已達星力上限！");
    offer = (offer===5||offer===10) ? offer : 1;
    if (q(ITEM_STAR_STONE) < offer) return alert(ITEM_STAR_STONE+" 不足，需 "+offer+" 顆");
    if (!rm(ITEM_STAR_STONE, offer)) return;

    var succ = Math.random() < (STAR_SUCC_BY_OFFER[offer]||0.05);
    if (succ){
      cur.starLv = Math.min(cur.starLv + STAR_PER_SUCCESS, caps.starCap);
      w.logPrepend?.("🌟 星力成功（目前 "+cur.starLv+"★）"); alert("✅ 星力成功！（目前 "+cur.starLv+"★）");
    } else {
      var down = (!starIsProtected(cur.starLv)) && (Math.random() < STAR_FAIL_DOWN_PCT);
      if (down && cur.starLv>0) { cur.starLv -= 1; w.logPrepend?.("💥 星力失敗並降星 → "+cur.starLv+"★"); alert("❌ 星力失敗（降為 "+cur.starLv+"★）"); }
      else { w.logPrepend?.("❌ 星力失敗（等級不變）"); alert("❌ 星力失敗（等級不變）"); }
    }
    saveLocal(); applyToPlayer(); EquipHub.requestRerender();
  }

  function doFeed(cur, amount){
    if (!cur.unlocked) return alert("尚未解鎖");
    var need = feedNeedForNext(cur);
    if (need == null) return alert("已達最高品階（"+GRADES[cur.gradeIdx]+")");
    var have = q(ITEM_AWAKEN_STONE);
    if (have<=0) return alert(ITEM_AWAKEN_STONE+" 不足");
    var take = Math.min(toInt(amount||0), have);
    if (!take) return;
    if (!rm(ITEM_AWAKEN_STONE, take)) return;

    cur.feed += take;
    var up = 0;
    while (true){
      var req = feedNeedForNext(cur);
      if (req == null) break;
      if (cur.feed >= req){
        cur.feed -= req;
        cur.gradeIdx += 1;
        up++;
      } else break;
    }
    saveLocal(); applyToPlayer();
    alert("餵養完成！"+(up>0 ? (" 品階提升 "+up+" 階 → "+GRADES[cur.gradeIdx]) : (" 進度："+cur.feed+" / "+(feedNeedForNext(cur)||"-"))));
    EquipHub.requestRerender();
  }

  // ===== UI =====
  function el(tag, css, html){ var d=document.createElement(tag); if(css) d.style.cssText=css; if(html!=null) d.innerHTML=html; return d; }
  function bar(pct){ pct=Math.max(0,Math.min(1,pct||0)); var w1=el("div","height:10px;background:#1f2937;border-radius:9999px;overflow:hidden;border:1px solid #334155;"); var inr=el("div","height:100%;background:#22c55e;width:"+(pct*100).toFixed(1)+"%;transition:width .2s;"); w1.appendChild(inr); return w1; }

  // 顯示：套裝（目前 + 下一階段）與 整體裝備能力（合計）
  function renderTopSummary(container){
    // 目前三顆核心的最終能力（各自）
    var atkFin  = state.cores.atk.unlocked  ? computeCoreFinalBonus("atk",  state.cores.atk)  : {};
    var lifeFin = state.cores.life.unlocked ? computeCoreFinalBonus("life", state.cores.life) : {};
    var dmgFin  = state.cores.dmg.unlocked  ? computeCoreFinalBonus("dmg",  state.cores.dmg)  : {};
    var totalFin = sumStats(sumStats(atkFin, lifeFin), dmgFin); // 不含套裝

    function statLines(obj){
      var parts = [];
      if (obj.atk != null) parts.push("攻擊力：<b>"+fmt(obj.atk)+"</b>");
      if (obj.def != null) parts.push("防禦力：<b>"+fmt(obj.def)+"</b>");
      if (obj.hp  != null) parts.push("生命：<b>"+fmt(obj.hp)+"</b>");
      if (obj.mp  != null) parts.push("魔力：<b>"+fmt(obj.mp)+"</b>");
      if (obj.attackSpeedPct != null) parts.push("攻速：<b>"+fmtPct(obj.attackSpeedPct)+"</b>");
      if (obj.recoverPercent != null) parts.push("回復：<b>"+fmtPct(obj.recoverPercent)+"</b>");
      if (obj.totalDamage != null) parts.push("總傷：<b>"+fmtPct(obj.totalDamage)+"</b>");
      if (obj.skillDamage != null) parts.push("技能傷：<b>"+fmtPct(obj.skillDamage)+"</b>");
      if (obj.ignoreDefPct != null) parts.push("穿透防：<b>"+fmtPct(obj.ignoreDefPct)+"</b>");
      return parts.join("　");
    }
// 友善顯示數值/百分比
function prettyStatLines(obj){
  if (!obj) return "";
  var parts = [];
  if (obj.atk            != null) parts.push("攻擊力 <b>+"+fmt(obj.atk)+"</b>");
  if (obj.def            != null) parts.push("防禦力 <b>+"+fmt(obj.def)+"</b>");
  if (obj.hp             != null) parts.push("生命 <b>+"+fmt(obj.hp)+"</b>");
  if (obj.mp             != null) parts.push("魔力 <b>+"+fmt(obj.mp)+"</b>");
  if (obj.attackSpeedPct != null) parts.push("攻速 <b>+"+fmtPct(obj.attackSpeedPct)+"</b>");
  if (obj.recoverPercent != null) parts.push("回復 <b>+"+fmtPct(obj.recoverPercent)+"</b>");
  if (obj.totalDamage    != null) parts.push("總傷 <b>+"+fmtPct(obj.totalDamage)+"</b>");
  if (obj.skillDamage    != null) parts.push("技能傷 <b>+"+fmtPct(obj.skillDamage)+"</b>");
  if (obj.ignoreDefPct   != null) parts.push("穿透防 <b>+"+fmtPct(obj.ignoreDefPct)+"</b>");
  return parts.join("　");
}
    // 套裝：目前與下一階段
    var minIdx = Math.min(state.cores.atk.gradeIdx, state.cores.life.gradeIdx, state.cores.dmg.gradeIdx);
    var curMul = setMultiplierByMinGrade(minIdx);
    var setBase = { atk:200, def:100, hp:4000, totalDamage:0.05, ignoreDefPct:0.05 };
    var curSet = {};
    if (curMul>0){ for (var k in setBase) curSet[k] = setBase[k]*curMul; }

    var nextInfo = nextSetStageInfo(minIdx);
    var nextSet = null;
    if (nextInfo){
      nextSet = {};
      for (var k2 in setBase) nextSet[k2] = setBase[k2] * nextInfo.mul;
    }

    // 卡片：套裝
    var cardSet = el("div","padding:10px;border:1px solid #334155;border-radius:10px;background:#0b1220;margin-bottom:10px;");
    var title = "<b>套裝效果</b>（以三件最低品階計）";
    var curLine = (curMul>0)
      ? "<div style='margin-top:4px'>目前階段：<b>"+GRADES[minIdx]+"</b>　倍率 x"+curMul+"<br>"+statLines(curSet)+"</div>"
      : "<div style='margin-top:4px'>目前未達 <b>SSR</b>，無套裝加成</div>";
    var nextLine = nextInfo
      ? "<div style='margin-top:6px;opacity:.9'>下一階段目標：三件達到 <b>"+nextInfo.needLabel+"</b>　倍率 x"+nextInfo.mul+"<br>"+statLines(nextSet)+"</div>"
      : "<div style='margin-top:6px;opacity:.9'>已達最高階段</div>";
    cardSet.innerHTML = title + curLine + nextLine;
    container.appendChild(cardSet);

    // 卡片：整體裝備能力（合計，不含套裝）
    var cardTotal = el("div","padding:10px;border:1px solid #334155;border-radius:10px;background:#0b1220;margin-bottom:10px;");
    cardTotal.innerHTML = "<b>整體裝備能力</b>（三核心合計，不含套裝）<br>"+statLines(totalFin);
    container.appendChild(cardTotal);
  }

  function renderCorePanel(container, kind){
    var cur = state.cores[kind];
    var def = CORE_DEF[kind];
    var caps = capsFor(cur);
    var grade = GRADES[cur.gradeIdx];
    var nextNeed = feedNeedForNext(cur);

    container.appendChild(el("div","font-weight:800;font-size:18px;margin-bottom:8px;",
      "核心類型：<span style='color:#93c5fd'>"+def.title+"</span>　品階：<span style='color:#fbbf24'>"+grade+"</span>"));

    var invLine = el("div","margin-bottom:8px;opacity:.9;font-size:12px;",
      "背包｜"+ITEM_CORE_STONE+"："+q(ITEM_CORE_STONE)+"　"+ITEM_AWAKEN_STONE+"："+q(ITEM_AWAKEN_STONE)+"　"+ITEM_STAR_STONE+"："+q(ITEM_STAR_STONE));
    container.appendChild(invLine);

    if (!cur.unlocked){
      var box = el("div","padding:12px;border:1px solid #334155;border-radius:10px;background:#0b1220;margin-bottom:10px;",
        "<b>尚未解鎖</b><br>需要："
        + ITEM_CORE_STONE+" x "+UNLOCK_COST_CORE_STONE+" ＋ "
        + ITEM_AWAKEN_STONE+" x "+UNLOCK_COST_AWAKEN);
      var btn = el("button","margin-top:8px;background:#1d4ed8;color:#fff;border:0;padding:8px 12px;border-radius:10px;cursor:pointer;","解鎖");
      btn.onclick = function(){ doUnlock(cur); };
      box.appendChild(btn);
      container.appendChild(box);
      return;
    }

    var info = el("div","display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;");
    info.appendChild(el("div","","強化等級：<b>+"+cur.enhanceLv+"</b> / "+caps.enhCap));
    info.appendChild(el("div","","星力等級：<b>"+cur.starLv+"★</b> / "+caps.starCap));
    container.appendChild(info);

    // 🔹 目前累計能力（這顆核心自身）
    var fin = computeCoreFinalBonus(kind, cur);
    var accBox = el("div","padding:10px;border:1px dashed #374151;border-radius:10px;background:#0b1220;margin-bottom:10px;opacity:.95;");
    var lines = [];
    if (fin.atk != null) lines.push("攻擊力 <b>"+fmt(fin.atk)+"</b>");
    if (fin.def != null) lines.push("防禦力 <b>"+fmt(fin.def)+"</b>");
    if (fin.hp  != null) lines.push("生命 <b>"+fmt(fin.hp)+"</b>");
    if (fin.mp  != null) lines.push("魔力 <b>"+fmt(fin.mp)+"</b>");
    if (fin.attackSpeedPct != null) lines.push("攻速 <b>"+fmtPct(fin.attackSpeedPct)+"</b>");
    if (fin.recoverPercent != null) lines.push("回復 <b>"+fmtPct(fin.recoverPercent)+"</b>");
    if (fin.totalDamage != null) lines.push("總傷 <b>"+fmtPct(fin.totalDamage)+"</b>");
    if (fin.skillDamage != null) lines.push("技能傷 <b>"+fmtPct(fin.skillDamage)+"</b>");
    if (fin.ignoreDefPct != null) lines.push("穿透防 <b>"+fmtPct(fin.ignoreDefPct)+"</b>");
    accBox.innerHTML = "<b>目前累計能力</b>（已含強化與階級獨立、乘上星力）<br>"+(lines.length?lines.join("　"):"—");
    container.appendChild(accBox);

    // 強化
    var need = enhanceCostForLevel(cur.enhanceLv);
    var enhBox = el("div","padding:10px;border:1px solid #334155;border-radius:10px;background:#0b1220;margin-bottom:10px;");
    enhBox.innerHTML = "<b>強化</b>（成功率 <b>35%</b>）<br>下一次需要 "+ITEM_CORE_STONE+"：<b>"+need+"</b>";
    var eBtn = el("button","margin-top:6px;background:#22c55e;color:#111;border:0;padding:6px 10px;border-radius:8px;cursor:pointer;","執行強化");
    eBtn.onclick = function(){ doEnhance(cur); };
    enhBox.appendChild(eBtn);
    container.appendChild(enhBox);

    // 星力（UI 簡化：僅顯示目前總加成）
    var totalStarPct = starTotalBonusPct(cur.starLv, cur.enhanceLv); // 小數
    var starBox = el("div","padding:10px;border:1px solid #334155;border-radius:10px;background:#0b1220;margin-bottom:10px;");
    starBox.innerHTML =
      "<b>星力</b>（目前星力總加成：<b>+"+fmtPct(totalStarPct)+"</b>）<br>"
      + "成功率：<span style='opacity:.9'>1顆→5%｜5顆→12%｜10顆→28%（失敗 35% 機率降星；5/10/15…保底不降）</span>";
    var sRow = el("div","display:flex;gap:8px;margin-top:6px;");
    [1,5,10].forEach(function(n){
      var b = el("button","background:#6366f1;color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer;","嘗試（"+n+"顆）");
      b.onclick = function(){ doStarforce(cur, n); };
      sRow.appendChild(b);
    });
    starBox.appendChild(sRow);
    container.appendChild(starBox);

  // 餵養 / 覺醒
    var feedBox = el("div","padding:10px;border:1px solid #334155;border-radius:10px;background:#0b1220;margin-bottom:10px;");
    if (nextNeed == null){
      feedBox.innerHTML = "<b>餵養 / 覺醒</b><br>已達最高品階 <b>"+grade+"</b>";
    } else {
      var pct = (cur.feed || 0) / nextNeed;
      feedBox.innerHTML =
        "<b>餵養 / 覺醒</b>（使用 "+ITEM_AWAKEN_STONE+"）<br>"
        + "下一階需求：<b>"+nextNeed+"</b>　目前：<b>"+(cur.feed||0)+"</b>";
      feedBox.appendChild(bar(pct));
      var fRow = el("div","display:flex;gap:8px;margin-top:6px;");
      var b1 = el("button","background:#334155;color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer;","餵 1 顆");
      b1.onclick = function(){ doFeed(cur, 1); };
      var b10= el("button","background:#334155;color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer;","餵 10 顆");
      b10.onclick= function(){ doFeed(cur, 10); };
      var bAll= el("button","background:#334155;color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer;","全部餵入");
      bAll.onclick = function() {
  var need = feedNeedForNext(cur); // 當前階段需要的總量
  if (need == null) return; // 已最高階
  var remain = Math.max(0, need - (cur.feed || 0)); // 尚需
  var have = q(ITEM_AWAKEN_STONE); // 背包量
  var offer = Math.min(remain, have); // 只餵到剛好升階
  if (offer <= 0) return;
  doFeed(cur, offer);
};
      fRow.appendChild(b1); fRow.appendChild(b10); fRow.appendChild(bAll);
      feedBox.appendChild(fRow);
      feedBox.appendChild(el("div","margin-top:6px;opacity:.8;font-size:12px;","升階後：<b>"+GRADES[cur.gradeIdx+1]+"</b>（強化/星力上限 +5）"));
    }
    container.appendChild(feedBox);

    // 階級獨立能力（說明）
// 階級獨立能力（彩色籤條呈現）
var ind = gradeIndependentBonus(kind, cur.gradeIdx);
var indHtml = Object.keys(ind).length ? prettyStatLines(ind) : "目前無（R 階段）";
var desc = el("div","padding:10px;border:1px dashed #374151;border-radius:10px;background:#0b1220;opacity:.95;",
  "<b>階級獨立能力（SR 起始，每階累積；不受星力/強化影響）</b><br>" + indHtml);
container.appendChild(desc);
  }

  // ===== 註冊分頁 =====
  w.EquipHub.registerTab({
    id: "coreTab",
    title: "核心",
    render: function(container){
      // 先放「套裝＋整體裝備能力」摘要
      renderTopSummary(container);

      // 切換三核心
      var switcher = (function(){
        var d = el("div","display:flex;gap:8px;margin-bottom:8px;");
        [["atk","攻擊核心"],["life","生命核心"],["dmg","傷害核心"]].forEach(function(kv){
          var btn = el("button",
            "background:"+(state.current===kv[0]?"#1d4ed8":"#1f2937")+";color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer;",
            kv[1]);
          btn.onclick = function(){ state.current=kv[0]; saveLocal(); w.EquipHub.requestRerender(); };
          d.appendChild(btn);
        });
        return d;
      })();
      container.appendChild(switcher);

      // 單顆核心面板
      renderCorePanel(container, state.current);
    },
    tick: function(){},
    onOpen: function(){ applyToPlayer(); }
  });

  // 初次套用（避免載入順序踩空）
  (function ensureReady(){
    var tries = 0, t = setInterval(function(){
      if (w.player && w.player.coreBonus && w.player.coreBonus.bonusData){
        clearInterval(t); applyToPlayer();
      } else if (++tries > 200){ clearInterval(t); }
    }, 50);
  })();

})(window);