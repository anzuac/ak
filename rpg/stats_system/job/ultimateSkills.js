// ===============================
// ultimateSkills.js — 五轉技能（四職大招 + 神之覺醒）
// 依賴：save_hub_es5.js, player.js, skills_hub.js
// ===============================
(function (w) {
  "use strict";
  if (!w.SaveHub || !w.SkillsHub || !w.player) { console.error("ultimateSkills.js: 缺少核心模組"); return; }

  // ====== 通用設定 ======
  var TAB_ID = "ultimateSkills";
  var TAB_TITLE = "五轉技能";

  var PASSIVE_TICKET = "被動能力券"; // 大招升級用
  var SHARD_ITEM     = "神之碎片";   // 覺醒升級用（遞增成本）

  // 基礎冷卻/延遲
  var BASE_COOLDOWN = 600; // 秒
  var BASE_DELAY    = 5.0; // 秒（覺醒可縮短，保底 1s）

  // 解鎖條件：五轉或等級 >= 220
  var LEVEL_GATE = 220;

  // 圖示與配色（戰/法/弓/盜）
  var CLASS_STYLE = {
    warrior: { color:"#ef4444", icon:"⚔️", name:"審判之刃", ns:"ultimate:warrior5" },
    mage:    { color:"#3b82f6", icon:"🔮", name:"星辰滅界", ns:"ultimate:mage5" },
    archer:  { color:"#22c55e", icon:"🏹", name:"終焉箭雨", ns:"ultimate:archer5" },
    thief:   { color:"#a855f7", icon:"🗡️", name:"幻影殲界", ns:"ultimate:thief5" }
  };

  // 大招成長（Lv1→Lv30）
  var ULT_SCALE = {
    warrior: function(lv){ return 15 + (30-15) * ((lv-1)/29); },  // 15x → 30x
    mage:    function(lv){ return 18 + (35-18) * ((lv-1)/29); },  // 18x → 35x
    archer:  function(lv){ return 17 + (33-17) * ((lv-1)/29); },  // 17x → 33x (5Hit)
    thief:   function(lv){ return 16 + (32-16) * ((lv-1)/29); },  // 16x → 32x (3~7Hit)
  };

  // 耗能倍率
  var COST = {
    warrior: { hpPct:0.75, mpPct:0.00 },
    mage:    { hpPct:0.00, mpPct:0.80 },
    archer:  { hpPct:0.50, mpPct:0.70 },
    thief:   { hpPct:0.50, mpPct:0.70 },
  };

  // 覺醒（神之覺醒）Lv1→Lv30（線性）
  function getAwakeningEffects(lv){
    lv = Math.max(0, Math.min(30, Number(lv)||0));
    if (lv <= 0) return { mul:1.00, hpReduce:0, mpReduce:0, delayReduce:0 };
    var mul = 1.02 + ( (1.50 - 1.02) * ((lv-1)/29) );      // x1.02 → x1.50
    var red = 0.02 + ( (0.20 - 0.02) * ((lv-1)/29) );      // 2% → 20%
    var del = 0.2  + ( (5.0  - 0.2 ) * ((lv-1)/29) );      // 0.2s → 5.0s
    return { mul:mul, hpReduce:red, mpReduce:red, delayReduce:del };
  }

  // 覺醒升級成本（神之碎片）：比大招更難
  function getAwakeningCostForNextLevel(nextLv){
    if (nextLv <= 0) return 0;
    if (nextLv <= 10) return 3;  // 30
    if (nextLv <= 20) return 7;  // 70（累計 100）
    return 16;                    // 160（累計 260）
  }

  // ====== 工具 ======
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function fmt(sec){ sec=Math.max(0,Math.floor(sec)); var m=Math.floor(sec/60), s=sec%60; return (m<10?"0":"")+m+":"+(s<10?"0":"")+s; }
  function jobKeyRaw(){ return String(w.player?.job||"").toLowerCase(); }
  function baseJob(){ // warrior5 -> warrior
    var j = jobKeyRaw();
    return (typeof w.getBaseJob === "function") ? w.getBaseJob(j) : j.replace(/\d+$/,"");
  }
  function jobTier(){
    var m = jobKeyRaw().match(/(\d+)$/); return m ? parseInt(m[1],10) : 0;
  }
  function isFifthJob(){ return jobTier() === 5; }
  function passedGate(){ return isFifthJob() || (Number(w.player?.level)||0) >= LEVEL_GATE; }

  // —— 戰鬥狀態偵測（容錯）——
  function inCombat(){
    try{
      if (typeof w.isInCombat === "function") return !!w.isInCombat();
      if (typeof w.isInBattle === "function") return !!w.isInBattle();
      if (w.combat && typeof w.combat.isFighting === "boolean") return !!w.combat.isFighting;
    }catch(_){}
    try{
      var m = w.currentMonster || w.global?.currentMonster;
      var hp = (typeof w.monsterHP === "number") ? w.monsterHP : w.global?.monsterHP;
      return !!(m && !m.isDead && (hp||0) > 0);
    }catch(_){ return false; }
  }

  // —— 施放鎖（暫停我方動作）——
  function startUltimateLock(seconds, blocks){
    var now = Math.floor(Date.now()/1000);
    var until = now + Math.max(0, Math.ceil(seconds||0));
    blocks = blocks || {};
    window.__ULT_LOCK__ = {
      until: until,
      block: {
        basic:  blocks.basic  !== false, // 預設封鎖普攻
        skills: blocks.skills !== false, // 預設封鎖其他技能
        move:   !!blocks.move,           // 預設不封鎖移動
        pet:    !!blocks.pet
      }
    };
  }
  function isUltimateLockActive(){
    var L = window.__ULT_LOCK__;
    if (!L) return false;
    var now = Math.floor(Date.now()/1000);
    if (now >= L.until){ window.__ULT_LOCK__ = null; return false; }
    return true;
  }
  function isActionBlocked(kind){
    if (!isUltimateLockActive()) return false;
    var L = window.__ULT_LOCK__;
    return !!(L && L.block && L.block[kind]);
  }
  w.isUltimateLockActive = isUltimateLockActive;
  w.isActionBlocked = isActionBlocked;

  // ====== 狀態（SaveHub）======
  var states = {}; // 每職大招：{ level, cool, charging }
  var awake  = null; // { level, unlocked }

  function loadUlt(ns){
    var s = w.SaveHub.get(ns, { _ver:1, level:1, cool:0, charging:0 }) || {};
    s.level    = clamp(Number(s.level||1), 1, 30);
    s.cool     = Math.max(0, Number(s.cool||0));
    s.charging = Math.max(0, Number(s.charging||0));
    return s;
  }
  function saveUlt(ns){
    var s = states[ns];
    w.SaveHub.set(ns, { _ver:1, level:s.level, cool:Math.max(0,Math.floor(s.cool||0)), charging:Math.max(0,Math.floor(s.charging||0)) });
  }

  function loadAwakening(){
    var a = w.SaveHub.get("ultimate:awakening", { _ver:1, level:0, unlocked:false }) || {};
    a.level    = clamp(Number(a.level||0), 0, 30);
    a.unlocked = !!a.unlocked;
    return a;
  }
  function saveAwakening(){
    w.SaveHub.set("ultimate:awakening", { _ver:1, level:awake.level, unlocked:!!awake.unlocked });
  }

  // 初始化
  (function init(){
    Object.keys(CLASS_STYLE).forEach(function(k){
      var ns = CLASS_STYLE[k].ns;
      states[ns] = loadUlt(ns);
    });
    awake = loadAwakening();
    // 若當前職業大招滿級 → 解鎖覺醒
    var bj = baseJob(); var ns = CLASS_STYLE[bj]?.ns;
    if (ns && states[ns].level >= 30) { awake.unlocked = true; saveAwakening(); }
  })();

  // ====== 覺醒被動：寫入 skillBonus 通道 ======
  function applyAwakeningPassive(){
    var SB = w.skillBonus || w.player?.skillBonus;
    if (!SB || !SB.bonusData) return;
    delete SB.bonusData["buff:UltimateAwakening"];
    if (!awake.unlocked || awake.level <= 0) return;
    var eff = getAwakeningEffects(awake.level);
    SB.bonusData["buff:UltimateAwakening"] = {
      ultimateMulView: eff.mul,     // UI 觀測值
      hpCostReduce: eff.hpReduce,
      mpCostReduce: eff.mpReduce,
      castDelayReduce: eff.delayReduce
    };
  }
  applyAwakeningPassive();

  function getAwakeningEffectSnapshot(){
    var eff = getAwakeningEffects(awake.level);
    var SB = w.skillBonus || w.player?.skillBonus;
    var b = SB?.bonusData?.["buff:UltimateAwakening"] || {};
    return {
      mul: eff.mul || 1,
      hpReduce: Number(b.hpCostReduce||0),
      mpReduce: Number(b.mpCostReduce||0),
      delayReduce: Number(b.castDelayReduce||0)
    };
  }

  // ====== 升級 ======
  function tryUpgradeUltimate(jobKey){
    var ns = CLASS_STYLE[jobKey]?.ns; if (!ns) return;
    var st = states[ns];

    // 解鎖判定：五轉或等級達門檻
    if (!passedGate()){
      alert("尚未解放：需五轉或等級達 " + LEVEL_GATE);
      return;
    }

    if (st.level >= 30) { alert("已達等級上限 (30)"); return; }
    if (typeof w.getItemQuantity !== "function" || typeof w.removeItem !== "function") { alert("找不到道具介面"); return; }
    var owned = Number(w.getItemQuantity(PASSIVE_TICKET)||0);
    if (owned < 1) { alert("需要『"+PASSIVE_TICKET+"』x1"); return; }
    w.removeItem(PASSIVE_TICKET, 1);
    st.level = clamp(st.level + 1, 1, 30);
    saveUlt(ns);
    w.CombatLog?.log?.("⬆️ " + CLASS_STYLE[jobKey].name + " 等級提升至 Lv." + st.level);
    // 滿級後解鎖覺醒
    var bj = baseJob();
    if (jobKey === bj && st.level >= 30) { awake.unlocked = true; saveAwakening(); applyAwakeningPassive(); }
    w.SkillsHub.requestRerender();
  }

  function tryUpgradeAwakening(){
    if (!passedGate()){ alert("尚未解放：需五轉或等級達 " + LEVEL_GATE); return; }
    if (!awake.unlocked) { alert("尚未解鎖（需對應五轉大招 Lv30）"); return; }
    if (awake.level >= 30) { alert("覺醒已達上限 (30)"); return; }
    if (typeof w.getItemQuantity !== "function" || typeof w.removeItem !== "function") { alert("找不到道具介面"); return; }
    var nextLv = awake.level + 1;
    var need = getAwakeningCostForNextLevel(nextLv);
    var owned = Number(w.getItemQuantity(SHARD_ITEM)||0);
    if (owned < need) { alert("需要『"+SHARD_ITEM+"』x"+need+"；持有："+owned); return; }
    w.removeItem(SHARD_ITEM, need);
    awake.level = clamp(awake.level+1, 0, 30);
    saveAwakening(); applyAwakeningPassive();
    w.CombatLog?.log?.("✨ 神之覺醒 等級提升至 Lv."+awake.level);
    w.SkillsHub.requestRerender();
  }

  // ====== 計算傷害（回傳總傷害；不直接改怪物血）======
  function resolveDamage(jobKey, target){
    var atk = Number(w.player.totalStats.atk||1);
    var intStat = Number((w.player.baseStats?.int||0) + (w.player.coreBonus?.int||0)); // 預留若需
    var ignoreDef = Number(w.player.totalStats.ignoreDefPct||0);
    var totalDmgAdd = Number(w.player.totalStats.totalDamage||0); // 加法層
    var spellDmg = Number(w.player.totalStats.spellDamage||0);

    var lv = states[CLASS_STYLE[jobKey].ns].level;
    var mul = ULT_SCALE[jobKey](lv);
    var effMul = getAwakeningEffectSnapshot().mul || 1;

    var def = Math.max(0, Number(target?.def||0));
    var effDef = def * (1 - Math.max(0, Math.min(ignoreDef, 0.9999)));

    function hitOnce(basePower){
      var base = Math.max(1, basePower - effDef);
      var dmg = base * (1 + totalDmgAdd);
      dmg = Math.floor(dmg * effMul);
      return Math.max(0, dmg);
    }

    var total = 0;
    if (jobKey === "mage") {
      var magicPower = Math.floor(atk * (1 + spellDmg));
      total += hitOnce(magicPower * mul);
    } else if (jobKey === "archer") {
      var per = Math.max(1, Math.floor(atk * (mul/5)));
      for (var i=0;i<5;i++) total += hitOnce(per);
    } else if (jobKey === "thief") {
      var hits = 3 + Math.floor(Math.random()*5);
      var per  = Math.max(1, Math.floor(atk * (mul/hits)));
      for (var j=0;j<hits;j++) total += hitOnce(per);
    } else {
      total += hitOnce(atk * mul);
    }
    return total;
  }

  // ====== 施放（延遲 → 結算 → 冷卻）======
  function canCast(jobKey){
    var ns = CLASS_STYLE[jobKey]?.ns; if (!ns) return false;
    var st = states[ns];
    if (!inCombat()) return false;
    if (!passedGate()) return false;
    return (st.cool<=0) && (st.charging<=0);
  }

  function getDelaySeconds(){ // 覺醒縮短，保底 1s
    var eff = getAwakeningEffectSnapshot();
    return Math.max(1, BASE_DELAY - (eff.delayReduce||0));
  }

  function checkAndSpendCost(jobKey){
    var cost = COST[jobKey] || {};
    var eff = getAwakeningEffectSnapshot();
    var hpNeed = Math.ceil((w.player.totalStats.hp || 0) * Math.max(0, (cost.hpPct||0) * (1 - (eff.hpReduce||0))));
    var mpNeed = Math.ceil((w.player.totalStats.mp || 0) * Math.max(0, (cost.mpPct||0) * (1 - (eff.mpReduce||0))));
    if (hpNeed>0 && (w.player.currentHP||0) <= Math.max(1,hpNeed)) { alert("HP 不足，需要：" + hpNeed); return false; }
    if (mpNeed>0 && (w.player.currentMP||0) < mpNeed) { alert("MP 不足，需要：" + mpNeed); return false; }
    if (hpNeed>0) w.player.currentHP = Math.max(1, (w.player.currentHP||0) - hpNeed);
    if (mpNeed>0) w.player.currentMP = Math.max(0, (w.player.currentMP||0) - mpNeed);
    if (typeof w.updateResourceUI === "function") w.updateResourceUI();
    return true;
  }

  function castUltimate(jobKey){
    var meta = CLASS_STYLE[jobKey]; if (!meta) return;
    var ns = meta.ns;
    var st = states[ns];

    if (!inCombat()) {
      (w.CombatLog?.log||w.logPrepend||console.log)("⚠️ 非戰鬥狀態，無法施放「" + meta.name + "」");
      return;
    }
    if (!passedGate()) {
      (w.CombatLog?.log||w.logPrepend||console.log)("⚠️ 尚未解放：需五轉或等級達 " + LEVEL_GATE);
      return;
    }
    if (!canCast(jobKey)) return;

    // 進入蓄力
    var delay = getDelaySeconds();
    startUltimateLock(delay + 0.5, { basic: true, skills: true, move: false, pet: true });

    st.charging = Math.ceil(delay);
    saveUlt(ns);
    w.SkillsHub.requestRerender();

    // 戰鬥日誌
    (w.CombatLog?.log||w.logPrepend||console.log)("⏳ " + meta.name + " 蓄力中… " + st.charging + " 秒後釋放");

    // 到點結算
    setTimeout(function(){
      if (!checkAndSpendCost(jobKey)) {
        st.charging = 0; saveUlt(ns); w.SkillsHub.requestRerender(); return;
      }

      var m  = w.currentMonster || w.global?.currentMonster || { name:"目標", def:0, shield:0 };
      var hp0 = (typeof w.monsterHP === "number") ? w.monsterHP : (w.global?.monsterHP||0);

      var total = resolveDamage(jobKey, m);

      var hp1 = Math.max(0, hp0 - total);
      if (typeof w.monsterHP === "number") w.monsterHP = hp1;
      else if (w.global) w.global.monsterHP = hp1;

      st.charging = 0;
      st.cool = BASE_COOLDOWN;
      saveUlt(ns);

      var line = "💥 " + meta.name + " 造成總傷害 " + total + "！";
      (w.CombatLog?.log||w.logPrepend||console.log)(line);

      if (typeof w.__ultimateShake === "function") w.__ultimateShake();

      w.SkillsHub.requestRerender();
    }, Math.floor(getDelaySeconds()*1000));
  }
  w.castUltimateSkill = castUltimate;

  // ====== 分頁 UI ======
  function renderUltimateCard(jobKey, container){
    var bj = baseJob();
    var meta = CLASS_STYLE[jobKey];
    if (!meta) return;
    // 只渲染當前職業那張卡
    if (bj !== jobKey) return;

    var st = states[meta.ns];
    var wrap = document.createElement("div");
    wrap.style.cssText = "background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:12px;margin-bottom:12px";

    var head = "<div style='display:flex;align-items:center;gap:8px;font-weight:800;color:"+meta.color+"'>"
      + meta.icon + " " + meta.name + "（Lv."+st.level+"/30）</div>";

    var gateTxt = passedGate() ? "<span style='color:#22c55e'>已解放</span>" : "<span style='color:#fca5a5'>未解放（需五轉或等級≥"+LEVEL_GATE+"）</span>";

    var scale = ULT_SCALE[jobKey](st.level).toFixed(1);
    var desc  = "<div style='opacity:.9;margin-top:6px'>冷卻 <b>"+BASE_COOLDOWN+"秒</b>｜延遲 <b>"+getDelaySeconds().toFixed(1)+"s</b>｜倍率 <b>"+scale+"×</b>｜狀態："+gateTxt+"</div>";

    var status = "<div style='display:flex;gap:14px;flex-wrap:wrap;margin:8px 0'>"
      + "<div>施放狀態："+ (st.charging>0 ? "<span style='color:#f97316'>蓄力 "+fmt(st.charging)+"</span>" :
                            (st.cool>0 ? "<span style='color:#f59e0b'>冷卻 "+fmt(st.cool)+"</span>" :
                                           "<span style='color:#22c55e'>可施放</span>")) +"</div>"
      + "</div>";

    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:6px";

    var btnCast = document.createElement("button");
    var castable = canCast(jobKey);
    btnCast.textContent = castable ? "發動大招" : (st.charging>0 ? "蓄力中…" : "冷卻/未解放");
    btnCast.disabled = !castable;
    btnCast.style.cssText = "background:"+(castable?meta.color:"#374151")+";color:#fff;border:0;padding:8px 12px;border-radius:10px;cursor:"+(castable?"pointer":"not-allowed")+";font-weight:800";
    btnCast.onclick = function(){ castUltimate(jobKey); };
    row.appendChild(btnCast);

    var btnUp = document.createElement("button");
    btnUp.textContent = "升級（"+PASSIVE_TICKET+"×1）";
    btnUp.disabled = (st.level>=30) || !passedGate();
    btnUp.style.cssText = "background:#16a34a;color:#fff;border:0;padding:6px 10px;border-radius:10px;cursor:"+(btnUp.disabled?"not-allowed":"pointer")+";font-weight:700";
    btnUp.onclick = function(){ tryUpgradeUltimate(jobKey); };
    row.appendChild(btnUp);

    wrap.innerHTML = head + desc + status;
    wrap.appendChild(row);

    // 消耗預覽
    var cost = COST[jobKey];
    var eff2 = getAwakeningEffectSnapshot();
    var hpPct = Math.max(0, (cost.hpPct||0) * (1 - (eff2.hpReduce||0)));
    var mpPct = Math.max(0, (cost.mpPct||0) * (1 - (eff2.mpReduce||0)));
    var preview = document.createElement("div");
    preview.style.cssText = "opacity:.85;font-size:12px;margin-top:6px";
    preview.textContent = "當前消耗 → HP "+Math.round(hpPct*100)+"% / MP "+Math.round(mpPct*100)+"%（覺醒影響後）";
    wrap.appendChild(preview);

    container.appendChild(wrap);
  }

  function renderAwakeningCard(container){
    var bj = baseJob();
    var wrap = document.createElement("div");
    wrap.style.cssText = "background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:12px;margin-bottom:12px";

    var head = "<div style='display:flex;align-items:center;gap:8px;font-weight:800;color:#f59e0b'>✨ 神之覺醒（Lv."+awake.level+"/30）</div>";

    var eff = getAwakeningEffects(awake.level);
    var unlockedText = awake.unlocked ? "<span style='color:#22c55e'>已解鎖</span>" : "<span style='color:#9ca3af'>未解鎖（需 "+ (CLASS_STYLE[bj]?.name || "大招") +" Lv30）</span>";
    var gateTxt = passedGate() ? "<span style='color:#22c55e'>已解放</span>" : "<span style='color:#fca5a5'>未解放（需五轉或等級≥"+LEVEL_GATE+"）</span>";

    var desc = "<div style='opacity:.9;margin-top:6px'>"
      + "最終傷害乘算：<b>x"+eff.mul.toFixed(2)+"</b>｜消耗減少：<b>"+Math.round(eff.mpReduce*100)+"%</b>｜延遲縮短：<b>"+eff.delayReduce.toFixed(1)+"s</b><br>"
      + "狀態："+gateTxt+"；覺醒解鎖："+unlockedText+"</div>";

    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:6px";

    var nextCost = awake.level>=30 ? 0 : getAwakeningCostForNextLevel(awake.level+1);
    var btnUp = document.createElement("button");
    btnUp.textContent = awake.level>=30 ? "已滿級" : ("升級（"+SHARD_ITEM+"×"+nextCost+"）");
    btnUp.disabled = !passedGate() || !awake.unlocked || awake.level>=30;
    btnUp.style.cssText = "background:#f59e0b;color:#0b1220;border:0;padding:6px 10px;border-radius:10px;cursor:"+(btnUp.disabled?"not-allowed":"pointer")+";font-weight:800";
    btnUp.onclick = tryUpgradeAwakening;

    row.appendChild(btnUp);

    wrap.innerHTML = head + desc;
    wrap.appendChild(row);
    container.appendChild(wrap);
  }

  function render(container){
    var bj = baseJob();
    renderUltimateCard(bj, container);
    renderAwakeningCard(container);
  }

  function tick(steps){
    Object.keys(CLASS_STYLE).forEach(function(k){
      var s = states[CLASS_STYLE[k].ns];
      if (!s) return;
      if (s.cool > 0) s.cool = Math.max(0, s.cool - steps);
      if (s.charging > 0) s.charging = Math.max(0, s.charging - steps);
      saveUlt(CLASS_STYLE[k].ns);
    });
  }

  // 註冊新分頁
  w.SkillsHub.registerTab({ id:TAB_ID, title:TAB_TITLE, render:render, tick:tick });

  // 對外提供：查詢狀態（給快捷按鈕用）
  w.getUltimateStateForJob = function(jobKey){
    var meta = CLASS_STYLE[jobKey]; if (!meta) return null;
    var s = states[meta.ns]; if (!s) return null;
    return { level:s.level, cool:s.cool, charging:s.charging, name:meta.name, color:meta.color, icon:meta.icon };
  };
  w.getAwakeningLevel = function(){ return awake.level; };
  w.getUltimateDelaySeconds = function(){ return Math.max(1, BASE_DELAY - (getAwakeningEffectSnapshot().delayReduce||0)); };
  w.passedUltimateGate = passedGate;

})(window);