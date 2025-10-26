// =======================
// equip_core_tab.js — 核心系統分頁（攻擊/生命/傷害）ES5（整合存檔：SaveHub 優先；localStorage 後備＆自動遷移）
// 依賴：equipment_hub.js（EquipHub）、window.player
// 背包：getItemQuantity(name) / removeItem(name, count)
// =======================
(function (w) {
  "use strict";
  if (!w.EquipHub || typeof w.EquipHub.registerTab !== "function") return;

  // ====== SaveHub（統一存檔）======
  var SAVEHUB_NS = "core_sys_v1";
  var SH = w.SaveHub || null;
  var LS_KEY = "CORE_SYS_INDEPENDENT_V1"; // 舊 localStorage key（做遷移之用）

  function freshCore(){ return { unlocked:false, gradeIdx:0, feed:0, enhanceLv:0, starLv:0 }; }
  function freshState(){
    return {
      current: "atk",
      cores: { atk: freshCore(), life: freshCore(), dmg: freshCore() }
    };
  }
  function toInt(n){ n = Number(n); return isFinite(n) ? Math.floor(n) : 0; }
  function nz(x){ return (typeof x==="number" && !isNaN(x)) ? x : 0; }

  function normalizeState(s){
    var out = freshState();
    try{
      if (!s || typeof s!=="object") return out;
      out.current = (s.current==="atk"||s.current==="life"||s.current==="dmg") ? s.current : "atk";
      out.cores = out.cores || {};
      var keys = ["atk","life","dmg"];
      for (var i=0;i<keys.length;i++){
        var k = keys[i];
        var c = (s.cores && s.cores[k]) ? s.cores[k] : freshCore();
        out.cores[k] = {
          unlocked: !!c.unlocked,
          gradeIdx: toInt(c.gradeIdx||0),
          feed:     toInt(c.feed||0),
          enhanceLv:toInt(c.enhanceLv||0),
          starLv:   toInt(c.starLv||0)
        };
      }
    }catch(_){}
    return out;
  }

  (function registerSaveHub(){
    if (!SH) return;
    try{
      var schema = { version: 1, migrate: function(old){ return normalizeState(old||{}); } };
      if (typeof SH.registerNamespaces === "function"){ var pack={}; pack[SAVEHUB_NS]=schema; SH.registerNamespaces(pack); }
      else if (typeof SH.registerNamespace === "function"){ SH.registerNamespace(SAVEHUB_NS, schema); }
    }catch(e){ console && console.warn && console.warn("[core_tab] SaveHub register failed:", e); }
  })();

  function shRead(defVal){
    if (!SH) return defVal;
    try{
      if (typeof SH.get === "function") return SH.get(SAVEHUB_NS, defVal);
      if (typeof SH.read === "function") return SH.read(SAVEHUB_NS, defVal);
    }catch(e){ console && console.warn && console.warn("[core_tab] SaveHub read failed:", e); }
    return defVal;
  }
  function shWrite(val){
    if (!SH) return;
    try{
      if (typeof SH.set === "function"){ SH.set(SAVEHUB_NS, val); return; }
      if (typeof SH.write === "function"){ SH.write(SAVEHUB_NS, val); return; }
    }catch(e){ console && console.warn && console.warn("[core_tab] SaveHub write failed:", e); }
  }

  // ===== 載入（SaveHub 優先；無則遷移 localStorage）=====
  var state = (function load(){
    try{
      var data = shRead(null);
      if (!data){
        var raw = localStorage.getItem(LS_KEY);
        if (raw){
          try{
            data = normalizeState(JSON.parse(raw));
            shWrite(data);               // 遷移到 SaveHub
            localStorage.removeItem(LS_KEY); // 刪除舊檔，避免雙端不同步
          }catch(_){ data = null; }
        }
      }
      return normalizeState(data||freshState());
    }catch(_){ return freshState(); }
  })();

  function saveLocal(next){
    if (next) state = normalizeState(next);
    try{
      if (SH) shWrite(state);
      else localStorage.setItem(LS_KEY, JSON.stringify(state)); // 沒有 SaveHub 時後備
    }catch(_){}
  }

  // ---- 可調參與道具名稱 ----
  var ITEM_CORE_STONE    = "核心強化石";
  var ITEM_AWAKEN_STONE  = "核心覺醒石";
  var ITEM_STAR_STONE    = "核心星力石";

  // 解鎖需求
  var UNLOCK_COST_CORE_STONE = 30;
  var UNLOCK_COST_AWAKEN     = 15;

  // 強化
  var ENHANCE_BASE_REQ = 5;
  var ENHANCE_SUCC_PCT = 0.35;
  function enhanceCostForLevel(curLv){ return ENHANCE_BASE_REQ + Math.floor(curLv/10)*5; }

  // 星力
  var STAR_SUCC_BY_OFFER = { 1:0.05, 5:0.12, 10:0.28 };
  var STAR_FAIL_DOWN_PCT = 0.35;
  var STAR_PER_SUCCESS   = 1;
  function starPerStarByEnh(enhLv){ return 0.02 + Math.floor(Math.max(0, enhLv||0)/5) * 0.01; }
  function starTotalBonusPct(starLv, enhLv){ return Math.max(0, starLv||0) * starPerStarByEnh(enhLv||0); }
  function starMul(starLv, enhLv){ return 1 + starTotalBonusPct(starLv, enhLv); }
  function starIsProtected(starLv){ return starLv % 5 === 0; }

  // 品階與上限
  var GRADES = ["R","SR","SSR","UR","UR+","LR","LR+"];
  var GRADE_FEED_REQ = [150, 300, 600, 1200, 2400, 4800];
  var BASE_ENH_CAP  = 10;
  var BASE_STAR_CAP = 15;

  // 套裝倍率（最低品階）
  function setMultiplierByMinGrade(minGradeIdx){
    if (minGradeIdx >= 6) return 4.0;
    if (minGradeIdx >= 5) return 2.5;
    if (minGradeIdx >= 4) return 2.0;
    if (minGradeIdx >= 3) return 1.5;
    if (minGradeIdx >= 2) return 1.0;
    return 0;
  }
  function nextSetStageInfo(minGradeIdx){
    var targets = [2,3,4,5,6]; // SSR..LR+
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
    var tierCount = gradeIdx; // SR=1, SSR=2, ...
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
      out.ignoreDefPct = Math.min(0.05 * tierCount, 0.40);
    }
    return out;
  }

  // 三核心：初始能力＆強化每級能力
  var CORE_DEF = {
    atk:  { title: "攻擊核心", base: { atk:20, def:3, attackSpeedPct:0.05 },             perEnh: { atk:10, def:5, attackSpeedPct:0.003 } },
    life: { title: "生命核心", base: { hp:200, recoverPercent:0.01 },                     perEnh: { hp:100, recoverPercent:0.003 } },
    dmg:  { title: "傷害核心", base: { totalDamage:0.05, skillDamage:0.05 },              perEnh: { totalDamage:0.003, skillDamage:0.003 } }
  };

  // ===== 工具 =====
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function fmtPct(n){ return (Number(n||0)*100).toFixed(2) + "%"; }

  // ===== 背包 =====
  function q(name){ try{ return Math.max(0, w.getItemQuantity ? (w.getItemQuantity(name)||0) : (w.inventory&&w.inventory[name]||0)); }catch(_){return 0;} }
  function rm(name, n){
    n = toInt(n||0); if (!n) return true;
    if (q(name) < n) return false;
    try{
      if (typeof w.removeItem==="function"){ w.removeItem(name, n); return true; }
      w.inventory = w.inventory || {};
      w.inventory[name] = Math.max(0, (w.inventory[name]||0) - n);
      w.saveGame && w.saveGame();
      return true;
    }catch(_){ return false; }
  }

  // ===== 參數工具 =====
  function capsFor(core){ var g=core.gradeIdx||0; return { enhCap: BASE_ENH_CAP + g*5, starCap: BASE_STAR_CAP + g*5 }; }
  function feedNeedForNext(core){ var g=core.gradeIdx||0; if (g>=GRADES.length-1) return null; return GRADE_FEED_REQ[Math.max(0,g)]; }

  // 單顆核心的最終能力
  function computeCoreFinalBonus(kind, core){
    var def = CORE_DEF[kind];
    var base = {};
    var k;
    for (k in def.base) base[k] = nz(def.base[k]);
    var enh = core.enhanceLv||0;
    for (k in def.perEnh) base[k] = nz(base[k]) + nz(def.perEnh[k]) * enh;
    var ind = gradeIndependentBonus(kind, core.gradeIdx);
    for (k in ind) base[k] = nz(base[k]) + nz(ind[k]);
    var mul = starMul(core.starLv||0, enh);
    for (k in base) base[k] = nz(base[k]) * mul;
    return base;
  }

  function sumStats(a, b){
    var out = {}; a=a||{}; b=b||{};
    var keys = {}; var k;
    for (k in a) keys[k]=1;
    for (k in b) keys[k]=1;
    for (k in keys) out[k] = nz(a[k]) + nz(b[k]);
    return out;
  }

  // ===== 寫入 player =====
  function applyToPlayer(){
    if (!w.player || !player.coreBonus) return;

    var B = {};
    var kinds = ["atk","life","dmg"];
    for (var i=0;i<kinds.length;i++){
      var kind = kinds[i];
      var c = state.cores[kind];
      if (!c || !c.unlocked) continue;
      var fin = computeCoreFinalBonus(kind, c);
      var bucketName = (kind==="atk") ? "coreAttack" : (kind==="life" ? "coreLife" : "coreDamage");
      B[bucketName] = fin;
    }

    player.coreBonus.bonusData = player.coreBonus.bonusData || {};
    delete player.coreBonus.bonusData.coreAttack;
    delete player.coreBonus.bonusData.coreLife;
    delete player.coreBonus.bonusData.coreDamage;
    delete player.coreBonus.bonusData.coreSet;
    for (var k in B) player.coreBonus.bonusData[k] = B[k];

    // 套裝
    var minIdx = Math.min(state.cores.atk.gradeIdx, state.cores.life.gradeIdx, state.cores.dmg.gradeIdx);
    var setMul = setMultiplierByMinGrade(minIdx);
    if (setMul > 0){
      var baseSet = { atk:200, def:100, hp:4000, totalDamage:0.05, ignoreDefPct:0.05 };
      var finalSet = {};
      for (var k2 in baseSet) finalSet[k2] = baseSet[k2] * setMul;
      player.coreBonus.bonusData.coreSet = finalSet;
    }

    w.updateResourceUI && w.updateResourceUI();
    w.saveGame && w.saveGame();
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
    w.logPrepend && w.logPrepend("🔓 核心已解鎖！"); alert("✅ 解鎖成功！"); EquipHub.requestRerender();
  }

  function doEnhance(cur){
    var caps = capsFor(cur);
    if (!cur.unlocked) return alert("尚未解鎖");
    if (cur.enhanceLv >= caps.enhCap) return alert("已達強化上限！");
    var need = enhanceCostForLevel(cur.enhanceLv);
    if (q(ITEM_CORE_STONE) < need) return alert(ITEM_CORE_STONE+" 不足，需 "+need+" 顆");
    if (!rm(ITEM_CORE_STONE, need)) return;

    var ok = Math.random() < ENHANCE_SUCC_PCT;
    if (ok){ cur.enhanceLv += 1; w.logPrepend && w.logPrepend("✨ 強化成功（+"+cur.enhanceLv+"）"); alert("✅ 強化成功！"); }
    else { w.logPrepend && w.logPrepend("❌ 強化失敗（等級不變）"); alert("❌ 強化失敗（等級不變）"); }
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
      w.logPrepend && w.logPrepend("🌟 星力成功（目前 "+cur.starLv+"★）"); alert("✅ 星力成功！（目前 "+cur.starLv+"★）");
    } else {
      var down = (!starIsProtected(cur.starLv)) && (Math.random() < STAR_FAIL_DOWN_PCT);
      if (down && cur.starLv>0) { cur.starLv -= 1; w.logPrepend && w.logPrepend("💥 星力失敗並降星 → "+cur.starLv+"★"); alert("❌ 星力失敗（降為 "+cur.starLv+"★）"); }
      else { w.logPrepend && w.logPrepend("❌ 星力失敗（等級不變）"); alert("❌ 星力失敗（等級不變）"); }
    }
    saveLocal(); applyToPlayer(); EquipHub.requestRerender();
  }

  function feedNeedForNext(core){ var g=core.gradeIdx||0; if (g>=GRADES.length-1) return null; return GRADE_FEED_REQ[Math.max(0,g)]; }
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

  function renderTopSummary(container){
    var atkFin  = state.cores.atk.unlocked  ? computeCoreFinalBonus("atk",  state.cores.atk)  : {};
    var lifeFin = state.cores.life.unlocked ? computeCoreFinalBonus("life", state.cores.life) : {};
    var dmgFin  = state.cores.dmg.unlocked  ? computeCoreFinalBonus("dmg",  state.cores.dmg)  : {};
    var totalFin = sumStats(sumStats(atkFin, lifeFin), dmgFin);

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
        + ITEM_CORE_STONE+" x "+(UNLOCK_COST_CORE_STONE)+" ＋ "
        + ITEM_AWAKEN_STONE+" x "+(UNLOCK_COST_AWAKEN));
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

    var need = enhanceCostForLevel(cur.enhanceLv);
    var enhBox = el("div","padding:10px;border:1px solid #334155;border-radius:10px;background:#0b1220;margin-bottom:10px;");
    enhBox.innerHTML = "<b>強化</b>（成功率 <b>35%</b>）<br>下一次需要 "+ITEM_CORE_STONE+"：<b>"+need+"</b>";
    var eBtn = el("button","margin-top:6px;background:#22c55e;color:#111;border:0;padding:6px 10px;border-radius:8px;cursor:pointer;","執行強化");
    eBtn.onclick = function(){ doEnhance(cur); };
    enhBox.appendChild(eBtn);
    container.appendChild(enhBox);

    var totalStarPct = starTotalBonusPct(cur.starLv, cur.enhanceLv);
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
        var need = feedNeedForNext(cur);
        if (need == null) return;
        var remain = Math.max(0, need - (cur.feed || 0));
        var have = q(ITEM_AWAKEN_STONE);
        var offer = Math.min(remain, have);
        if (offer <= 0) return;
        doFeed(cur, offer);
      };
      fRow.appendChild(b1); fRow.appendChild(b10); fRow.appendChild(bAll);
      feedBox.appendChild(fRow);
      feedBox.appendChild(el("div","margin-top:6px;opacity:.8;font-size:12px;","升階後：<b>"+GRADES[cur.gradeIdx+1]+"</b>（強化/星力上限 +5）"));
    }
    container.appendChild(feedBox);

    var ind = gradeIndependentBonus(kind, cur.gradeIdx);
    var indHtml = (function(obj){
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
    })(ind);
    var desc = el("div","padding:10px;border:1px dashed #374151;border-radius:10px;background:#0b1220;opacity:.95;",
      "<b>階級獨立能力（SR 起始，每階累積；不受星力/強化影響）</b><br>"+(indHtml||"目前無（R 階段）"));
    container.appendChild(desc);
  }

  // ===== 對外匯出/套用 =====
  w.Core_exportState = function(){ return JSON.parse(JSON.stringify(state)); };
  w.Core_applyState = function(s){
    if (!s || typeof s!=="object") return;
    saveLocal(s);
    applyToPlayer();
    w.EquipHub && w.EquipHub.requestRerender && w.EquipHub.requestRerender();
  };

  // ===== 註冊分頁 =====
  w.EquipHub.registerTab({
    id: "coreTab",
    title: "核心",
    render: function(container){
      renderTopSummary(container);
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
      renderCorePanel(container, state.current);
    },
    tick: function(){},
    onOpen: function(){ applyToPlayer(); }
  });

  // 初次套用
  (function ensureReady(){
    var tries = 0, t = setInterval(function(){
      if (w.player && w.player.coreBonus && w.player.coreBonus.bonusData){
        clearInterval(t); applyToPlayer();
      } else if (++tries > 200){ clearInterval(t); }
    }, 50);
  })();

})(window);