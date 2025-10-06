// quest_achievements_es5.js — 成就系統（進度條＋美化 ES5 完整版）
//
// 規則：
// - 等級：每 10 等為一階；每階獎勵 = 5 × 階數（第 1 階給 5 張、第 2 階給 10 張...累進制）
// - 主屬性（STR/AGI/INT/LUK）：100,200,...,1000；>1000 後每 1000 為一階；每階 +5 張
// - 攻擊力/防禦力：只讀「裝備貢獻（含四圍轉攻防）」的 ATK/DEF，不含技能乘算；門檻同主屬性；每階 +5 張
// - 技能傷害、攻擊速度（增益量）：每 +20% 一階；每階 +5 張
// - 經驗值、掉寶率、金幣掉落率：每 +30% 一階；每階 +5 張
// - 擊殺：每 1000 隻一階；每階 +5 張
// - 精英擊殺：每 100 隻一階；每階 +10 張
// - Boss 擊殺：每 10 隻一階；每階 +20 張
// - 累積傷害：每 5,000,000 一階；每階 +20 張
//
// 對外 API：
//   Achievements.onKill(n), Achievements.onEliteKill(n), Achievements.onBossKill(n), Achievements.onDamageDealt(amount)
//   Achievements.checkAll()  → 重算並發獎（建議在能力更新/換裝/配點後呼叫）
//   與 QuestCore 整合：切到「成就任務」分頁時自動渲染
//
// 儲存：localStorage("ACHIEVEMENTS_V1")
// ------------------------------------------------------------------------------

(function(){
  var STORAGE_KEY = "ACHIEVEMENTS_V1";

  var REWARD_ITEM = "sp點數券";
  var REWARD_PER_STAGE_DEFAULT = 2;
  var REWARD_PER_STAGE_DAMAGE  = 20;
  var REWARD_PER_STAGE_ELITE   = 10;
  var REWARD_PER_STAGE_BOSS    = 20;

  var LV_UNIT     = 10;        // 每 10 等一階
  var KILL_UNIT   = 1000;
  var ELITE_UNIT  = 100;
  var BOSS_UNIT   = 10;
  var DAMAGE_UNIT = 5000000;

  // 數學工具
  function floor(n){ return Math.floor(Number(n)||0); }
  function clamp01(x){ return Math.max(0, Math.min(1, x)); }

  function loadState(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return {
        stages: {
          level:0,
          str:0, agi:0, int:0, luk:0,
          atk:0, def:0,
          skill:0, aspd:0,
          exp:0, drop:0, gold:0,
          kill:0, elite:0, boss:0, dmg:0
        },
        counters: { kills:0, eliteKills:0, bossKills:0, totalDamage:0 }
      };
      var obj = JSON.parse(raw);
      obj.stages   = obj.stages   || {};
      obj.counters = obj.counters || {};

      // 補齊鍵
      var s = obj.stages, c = obj.counters;
      if (s.level==null) s.level=0;
      if (s.str==null){ s.str=0; s.agi=0; s.int=0; s.luk=0; }
      if (s.atk==null){ s.atk=0; s.def=0; }
      if (s.skill==null){ s.skill=0; s.aspd=0; }
      if (s.exp==null){ s.exp=0; s.drop=0; s.gold=0; }
      if (s.kill==null) s.kill=0;
      if (s.elite==null) s.elite=0;
      if (s.boss==null) s.boss=0;
      if (s.dmg==null) s.dmg=0;

      if (c.kills==null) c.kills=0;
      if (c.eliteKills==null) c.eliteKills=0;
      if (c.bossKills==null) c.bossKills=0;
      if (c.totalDamage==null) c.totalDamage=0;

      return obj;
    }catch(_){
      return {
        stages: {
          level:0,
          str:0, agi:0, int:0, luk:0,
          atk:0, def:0,
          skill:0, aspd:0,
          exp:0, drop:0, gold:0,
          kill:0, elite:0, boss:0, dmg:0
        },
        counters: { kills:0, eliteKills:0, bossKills:0, totalDamage:0 }
      };
    }
  }
  function saveState(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(_){}
  }

  var state = loadState();

  // —— 小訊息（淡入淡出）——
  function popMessage(text){
    var box = document.getElementById('achievementMessageBox');
    if(!box){
      box = document.createElement('div');
      box.id = 'achievementMessageBox';
      box.style.position='fixed';
      box.style.top='10%';
      box.style.left='50%';
      box.style.transform='translateX(-50%)';
      box.style.zIndex='9999';
      box.style.padding='12px 20px';
      box.style.background='#111';
      box.style.color='#fff';
      box.style.border='1px solid #444';
      box.style.borderRadius='10px';
      box.style.boxShadow='0 8px 24px rgba(0,0,0,.35)';
      box.style.opacity='0';
      box.style.transition='opacity .35s ease, transform .35s ease';
      box.style.pointerEvents='none';
      document.body.appendChild(box);
    }
    box.innerHTML = '<span style="color:#ffe28a;font-weight:700;">'+ text +'</span>';
    box.style.opacity='1';
    clearTimeout(box._timer);
    box._timer = setTimeout(function(){
      box.style.opacity='0';
    }, 2200);
  }

  // —— 階段計算 —— //
  function primaryStage(val){
    val = floor(val);
    if (val <= 0) return 0;
    if (val <= 1000) return floor(val/100); // 1..10
    return 10 + floor((val - 1000)/1000);
  }
  function adStage(val){ return primaryStage(val); }
  function per20Stage(val){ return floor((Number(val)||0) / 0.20); }
  function per30Stage(val){ return floor((Number(val)||0) / 0.30); }
  function killStage(c){ return floor((c||0)/KILL_UNIT); }
  function eliteStage(c){ return floor((c||0)/ELITE_UNIT); }
  function bossStage(c){ return floor((c||0)/BOSS_UNIT); }
  function dmgStage(d){ return floor((d||0)/DAMAGE_UNIT); }
  function levelStage(lv){ return floor((lv||0)/LV_UNIT); }

  // —— 讀玩家（只讀：基礎 + core；攻防不吃技能乘算）—— //
  function readSnapshot(){
    var p = window.player || {};
    var base = p.baseStats || {};
    var core = p.coreBonus || {};
    var jobs = window.jobs || {};
    var jobKey = (p.job||"").toLowerCase();
    var jm = (jobs[jobKey] && jobs[jobKey].statMultipliers) || {str:1,agi:1,int:1,luck:1};

    // 四圍（基礎 + core）
    var totalStr = Number(base.str||0) + Number(core.str||0);
    var totalAgi = Number(base.agi||0) + Number(core.agi||0);
    var totalInt = Number(base.int||0) + Number(core.int||0);
    var totalLuk = Number(base.luk||0) + Number(core.luk||0);

    // 四圍轉攻防（不吃技能）
    var atkByStats = totalStr*(5*jm.str) + totalAgi*(5*jm.agi) + totalInt*(5*jm.int) + totalLuk*(5*jm.luck);
    var defByStats = totalStr*(3*jm.str) + totalAgi*(1.5*jm.agi) + totalInt*(1*jm.int) + totalLuk*(1.5*jm.luck);

    // 最終裝備攻防（不含技能乘）
    var finalAtk = Math.floor(Number(base.atk||0) + Number(core.atk||0) + atkByStats);
    var finalDef = Math.floor(Number(base.def||0) + Number(core.def||0) + defByStats);

    // 技能傷害（僅讀基礎+core）
    var skillDmg = Number(p.baseSkillDamage||0) + Number(core.skillDamage||0);

    // 攻速增益（(base+core)-1）→ 顯示加成量
    var aspdGain = Math.max(0, (Number(p.attackSpeedPctBase||1) + Number(core.attackSpeedPct||0)) - 1);

    // 三率（僅 core）
    var exp = Number(core.expBonus||0);
    var drop = Number(core.dropBonus||0);
    var gold = Number(core.goldBonus||0);

    return {
      level: Number(p.level||1),
      prim: { str:totalStr, agi:totalAgi, int:totalInt, luk:totalLuk },
      atkEquip: finalAtk,
      defEquip: finalDef,
      skill: skillDmg,
      aspdGain: aspdGain,
      exp: exp,
      drop: drop,
      gold: gold,
      kills: Number(state.counters.kills||0),
      eliteKills: Number(state.counters.eliteKills||0),
      bossKills: Number(state.counters.bossKills||0),
      totalDamage: Number(state.counters.totalDamage||0)
    };
  }

  // —— 發獎 —— //
  function giveRewardFixed(perStage, stageDiff){
    if (stageDiff <= 0) return 0;
    var qty = perStage * stageDiff;
    if (typeof window.addItem === "function"){ window.addItem(REWARD_ITEM, qty); }
    return qty;
  }
  // 等級是遞增獎勵：從 prev(含) → next(不含)
  function giveRewardLevel(prevStage, nextStage){
    var sum = 0; // 每階 (s+1)*5
    for (var s = prevStage; s < nextStage; s++){
      sum += 5 * (s + 1);
    }
    if (sum > 0 && typeof window.addItem === "function"){ window.addItem(REWARD_ITEM, sum); }
    return sum;
  }

  // —— 核心檢查 —— //
  function checkAllInternal(){
    var snap = readSnapshot();
    var awardSum = 0;

    // 等級
    var stLv = levelStage(snap.level);
    if (stLv > state.stages.level){
      awardSum += giveRewardLevel(state.stages.level, stLv);
      state.stages.level = stLv;
    }

    // 主屬性
    var sStr = primaryStage(snap.prim.str);
    var sAgi = primaryStage(snap.prim.agi);
    var sInt = primaryStage(snap.prim.int);
    var sLuk = primaryStage(snap.prim.luk);
    if (sStr > state.stages.str){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sStr - state.stages.str); state.stages.str = sStr; }
    if (sAgi > state.stages.agi){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sAgi - state.stages.agi); state.stages.agi = sAgi; }
    if (sInt > state.stages.int){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sInt - state.stages.int); state.stages.int = sInt; }
    if (sLuk > state.stages.luk){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sLuk - state.stages.luk); state.stages.luk = sLuk; }

    // 攻防（裝備）
    var sAtk = adStage(snap.atkEquip);
    var sDef = adStage(snap.defEquip);
    if (sAtk > state.stages.atk){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sAtk - state.stages.atk); state.stages.atk = sAtk; }
    if (sDef > state.stages.def){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sDef - state.stages.def); state.stages.def = sDef; }

    // 技能傷害 / 攻速
    var sSkill = per20Stage(snap.skill);
    var sAspd  = per20Stage(snap.aspdGain);
    if (sSkill > state.stages.skill){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sSkill - state.stages.skill); state.stages.skill = sSkill; }
    if (sAspd  > state.stages.aspd ){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sAspd  - state.stages.aspd ); state.stages.aspd  = sAspd;  }

    // 三率
    var sExp  = per30Stage(snap.exp);
    var sDrop = per30Stage(snap.drop);
    var sGold = per30Stage(snap.gold);
    if (sExp  > state.stages.exp ){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sExp  - state.stages.exp ); state.stages.exp  = sExp;  }
    if (sDrop > state.stages.drop){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sDrop - state.stages.drop); state.stages.drop = sDrop; }
    if (sGold > state.stages.gold){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sGold - state.stages.gold); state.stages.gold = sGold; }

    // 擊殺 / 精英 / Boss / 累傷
    var sKill  = killStage(snap.kills);
    var sElite = eliteStage(snap.eliteKills);
    var sBoss  = bossStage(snap.bossKills);
    var sDmg   = dmgStage(snap.totalDamage);

    if (sKill  > state.stages.kill ){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sKill  - state.stages.kill ); state.stages.kill  = sKill;  }
    if (sElite > state.stages.elite){ awardSum += giveRewardFixed(REWARD_PER_STAGE_ELITE,   sElite - state.stages.elite); state.stages.elite = sElite; }
    if (sBoss  > state.stages.boss ){ awardSum += giveRewardFixed(REWARD_PER_STAGE_BOSS,    sBoss  - state.stages.boss ); state.stages.boss  = sBoss;  }
    if (sDmg   > state.stages.dmg  ){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DAMAGE,  sDmg   - state.stages.dmg  ); state.stages.dmg   = sDmg;   }

    if (awardSum > 0){
      saveState();
      popMessage("🎉 成就完成！獲得「"+REWARD_ITEM+"」×"+awardSum);
      if (typeof window.logPrepend === "function"){ try{ window.logPrepend("🏆 成就完成：獲得「"+REWARD_ITEM+"」×"+awardSum); }catch(_){ } }
      if (typeof window.saveGame === "function"){ try{ window.saveGame(); }catch(_){ } }
    }
    return awardSum;
  }

  // —— UI：進度條渲染 —— //
  function segPrimaryBounds(val){
    var s = primaryStage(val);
    if (s < 10) return { base: s*100, next: (s+1)*100, stage: s };
    var base = 1000 + (s-10)*1000;
    return { base: base, next: base+1000, stage: s };
  }
  function linearBoundsByUnit(val, unit, stageFn){
    var s = stageFn(val);
    return { base: s*unit, next: (s+1)*unit, stage: s };
  }

  function fmtPct(v){ return Math.round((Number(v)||0)*100)+'%'; }
  function fmtInt(v){ return String(Math.floor(Number(v)||0)); }
  function fmtNum(v){ return String(Number(v)||0); }
  function fmtDmg(v){ return Number(v||0).toLocaleString(); }

  function bar(pct, note){
    var w = Math.floor(clamp01(pct)*100);
    return ''+
    '<div style="background:#2a2a2a;border-radius:8px;overflow:hidden;height:10px;margin-top:6px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)">'+
      '<div style="height:100%;width:'+w+'%;background:linear-gradient(90deg,#41d1ff,#6f86ff);box-shadow:0 0 10px rgba(111,134,255,.35) inset;"></div>'+
    '</div>'+
    (note ? '<div style="font-size:12px;opacity:.75;margin-top:4px;text-align:right">'+note+'</div>' : '');
  }

  function rowProgress(label, current, bounds, formatter){
    var base = bounds.base, next = bounds.next, stg = bounds.stage;
    var progress = (next>base) ? (current - base) / (next - base) : 1;
    var pctText = Math.round(clamp01(progress)*100)+'%';
    var curText = formatter ? formatter(current) : String(current);
    var nextText = formatter ? formatter(next) : String(next);
    return ''+
    '<div style="padding:10px 0;border-bottom:1px dashed #3a3a3a;">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">'+
        '<div style="font-weight:600;color:#e9f0ff">'+label+' <span style="opacity:.6;font-size:12px;">（第 '+stg+' 階）</span></div>'+
        '<div style="font-weight:700;text-align:right;color:#fff">'+curText+'</div>'+
      '</div>'+
      bar(progress, '下一階：'+ nextText +'　|　進度：'+pctText)+
    '</div>';
  }

  // 對外 API
  window.Achievements = {
    onKill: function(n){
      n = floor(n||1); if (n<=0) return;
      state.counters.kills = floor(state.counters.kills) + n;
      saveState(); checkAllInternal(); this.renderIfActive();
    },
    onEliteKill: function(n){
      n = floor(n||1); if (n<=0) return;
      state.counters.eliteKills = floor(state.counters.eliteKills) + n;
      saveState(); checkAllInternal(); this.renderIfActive();
    },
    onBossKill: function(n){
      n = floor(n||1); if (n<=0) return;
      state.counters.bossKills = floor(state.counters.bossKills) + n;
      saveState(); checkAllInternal(); this.renderIfActive();
    },
    onDamageDealt: function(amount){
      amount = Math.max(0, Number(amount)||0); if (!amount) return;
      state.counters.totalDamage = (Number(state.counters.totalDamage)||0) + amount;
      saveState(); checkAllInternal(); this.renderIfActive();
    },
    checkAll: function(){
      var got = checkAllInternal();
      this.renderIfActive();
      return got;
    },
    getCounters: function(){ return JSON.parse(JSON.stringify(state.counters)); },
    setCounters: function(partial){
      state.counters = Object.assign(state.counters, partial||{});
      saveState(); this.checkAll();
    },
    _resetAll: function(){
      state = {
        stages: {
          level:0,
          str:0, agi:0, int:0, luk:0,
          atk:0, def:0, skill:0, aspd:0,
          exp:0, drop:0, gold:0,
          kill:0, elite:0, boss:0, dmg:0
        },
        counters: { kills:0, eliteKills:0, bossKills:0, totalDamage:0 }
      };
      saveState(); this.renderIfActive();
    },

    renderIfActive: function(){
      if (typeof window.QuestCore !== "object") return;
      if (window.QuestCore.getActiveTab && window.QuestCore.getActiveTab()==='achievements'){
        this.renderInto(document.getElementById('questContent'));
      }
    },

    renderInto: function(container){
      if (!container) return;

      var snap = readSnapshot();

      function levelRow(){
        var s = levelStage(snap.level);
        var b = { base: s*LV_UNIT, next: (s+1)*LV_UNIT, stage: s };
        var progress = (snap.level - b.base) / (b.next - b.base);
        var nextReward = 5 * (s+1);
        return ''+
        '<div style="padding:10px 0;border-bottom:1px dashed #3a3a3a;">'+
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">'+
            '<div style="font-weight:700;color:#ffd78a">等級 <span style="opacity:.6;font-size:12px;">（第 '+s+' 階）</span></div>'+
            '<div style="font-weight:800;color:#fff">Lv.'+snap.level+'</div>'+
          '</div>'+
          bar(progress, '下一階：Lv.'+(b.next)+'　|　獎勵：'+nextReward+' 張　|　進度：'+Math.round(clamp01(progress)*100)+'%')+
        '</div>';
      }

      var html = '';
      html += '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,\'Noto Sans TC\',sans-serif;color:#dfe7ff;">';

      html += '<h3 style="margin:6px 0 10px;color:#9fc5ff;">等級（每 10 等；獎勵逐階提高）</h3>';
      html += levelRow();

      html += '<h3 style="margin:12px 0 8px;color:#9fc5ff;">主屬性（每階 +2 張）</h3>';
      html += rowProgress('力量 STR', snap.prim.str, segPrimaryBounds(snap.prim.str), fmtInt);
      html += rowProgress('敏捷 AGI', snap.prim.agi, segPrimaryBounds(snap.prim.agi), fmtInt);
      html += rowProgress('智力 INT', snap.prim.int, segPrimaryBounds(snap.prim.int), fmtInt);
      html += rowProgress('幸運 LUK', snap.prim.luk, segPrimaryBounds(snap.prim.luk), fmtInt);

      html += '<h3 style="margin:12px 0 8px;color:#9fc5ff;">攻防（每階 +2 張）</h3>';
      html += rowProgress('攻擊力 ATK', snap.atkEquip, segPrimaryBounds(snap.atkEquip), fmtInt);
      html += rowProgress('防禦力 DEF', snap.defEquip, segPrimaryBounds(snap.defEquip), fmtInt);

      html += '<h3 style="margin:12px 0 8px;color:#9fc5ff;">戰鬥加成（每階 +5 張）</h3>';
      html += rowProgress('技能傷害', Math.round(snap.skill*100)/100, linearBoundsByUnit(snap.skill, 0.20, per20Stage), fmtPct);
      html += rowProgress('攻擊速度(+%)', Math.round(snap.aspdGain*100)/100, linearBoundsByUnit(snap.aspdGain, 0.20, per20Stage), fmtPct);

      html += '<h3 style="margin:12px 0 8px;color:#9fc5ff;">探索加成（每階 +5 張）</h3>';
      html += rowProgress('經驗值率', Math.round(snap.exp*100)/100,  linearBoundsByUnit(snap.exp, 0.30, per30Stage), fmtPct);
      html += rowProgress('掉寶率',   Math.round(snap.drop*100)/100, linearBoundsByUnit(snap.drop, 0.30, per30Stage), fmtPct);
      html += rowProgress('金幣率',   Math.round(snap.gold*100)/100, linearBoundsByUnit(snap.gold, 0.30, per30Stage), fmtPct);

      html += '<h3 style="margin:12px 0 8px;color:#9fc5ff;">累積（擊殺/傷害）</h3>';
      html += rowProgress('擊殺數（每 1000 / +5 張）', snap.kills,       linearBoundsByUnit(snap.kills, 1000, KILL_UNIT ? function(v){return floor(v/KILL_UNIT);} : function(){return 0;}), fmtInt);
      html += rowProgress('精英擊殺（每 100 / +10 張）', snap.eliteKills, linearBoundsByUnit(snap.eliteKills, 100, ELITE_UNIT ? function(v){return floor(v/ELITE_UNIT);} : function(){return 0;}), fmtInt);
      html += rowProgress('Boss 擊殺（每 10 / +20 張）', snap.bossKills,  linearBoundsByUnit(snap.bossKills, 10, BOSS_UNIT ? function(v){return floor(v/BOSS_UNIT);} : function(){return 0;}), fmtInt);
      html += rowProgress('累積傷害（每 5,000,000 / +20 張）', snap.totalDamage, linearBoundsByUnit(snap.totalDamage, 5000000, DAMAGE_UNIT ? function(v){return floor(v/DAMAGE_UNIT);} : function(){return 0;}), fmtDmg);

      html += '</div>';
      container.innerHTML = html;
    }
  };

  // —— 與 QuestCore 整合：切分頁時渲染 —— //
  document.addEventListener('quest:tabchange', function(){
    if (typeof window.QuestCore !== "object") return;
    if (window.QuestCore.getActiveTab && window.QuestCore.getActiveTab()==='achievements'){
      // 先檢查一次避免漏發
      if (window.Achievements) window.Achievements.checkAll();
      var c = document.getElementById('questContent');
      window.Achievements.renderInto(c);
    }
  });

  // —— 啟動時檢查一次 —— //
  function boot(){ window.Achievements.checkAll(); }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();