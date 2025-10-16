// quest_achievements_es5.js — 成就系統（進度條＋美化 ES5 完整版；主屬性/攻防採幾何門檻）
// 變更點（本版更新重點）：
// 1) 主屬性（STR/AGI/INT/LUK）與 攻擊力/防禦力 的階段門檻改為「幾何成長」：每完成一階，下一階門檻 ×1.25
//    - 主屬性起始門檻：100
//    - 攻擊/防禦起始門檻：100（讀裝備貢獻）
//    - 成長倍率：1.25（與擊殺/累傷一致）
// 2) 主屬性與攻防的每階獎勵改為固定 +5 張（其他類別原規則不動）
// 3) UI 進度條同步改用幾何門檻顯示

(function(){
  var STORAGE_KEY = "ACHIEVEMENTS_V1";

  var REWARD_ITEM = "sp點數券";

  // —— 獎勵常數 —— //
  var REWARD_PER_STAGE_PRIMARY = 5;  // 主屬性（每階 +5 張）
  var REWARD_PER_STAGE_AD      = 5;  // 攻擊/防禦（每階 +5 張）

  // 其他類別維持原設定
  var REWARD_PER_STAGE_DEFAULT = 2;  // 探索三率 / 擊殺（若你要依規格調整可另行提高）
  var REWARD_PER_STAGE_COMBAT  = 5;  // 技能傷害 / 攻速 / 總傷害
  var REWARD_PER_STAGE_DAMAGE  = 20; // 累積傷害
  var REWARD_PER_STAGE_ELITE   = 10;
  var REWARD_PER_STAGE_BOSS    = 20;

  // —— 門檻常數 —— //
  var LV_UNIT     = 10;        // 等級：每 10 等一階
  // 幾何（擊殺系）維持原來的：
  var KILL_UNIT   = 1000;
  var ELITE_UNIT  = 100;
  var BOSS_UNIT   = 10;
  var DAMAGE_UNIT = 5000000;
  var GEO_GROWTH  = 1.25;      // +25%

  // — 新：主屬性/攻防 也改幾何門檻 — //
  var PRIMARY_UNIT = 100;      // 第 1 階 100，之後 ×1.25 成長
  var AD_UNIT      = 100;      // ATK/DEF 第 1 階 100，之後 ×1.25 成長
  var ATTR_GROWTH  = 1.25;     // 與 GEO_GROWTH 一致，便於維護

  // 數學工具
  function floor(n){ return Math.floor(Number(n)||0); }
  function clamp01(x){ return Math.max(0, Math.min(1, x)); }

  // 幾何門檻：
  //  - 第 s 階（從 0 起算）的單階門檻 = unit * (G^s)
  //  - s 階累積門檻（達成 s 階所需的總量）= unit * (G^s - 1)/(G - 1)
  //  - 已完成階數 = 最大 s 使得累積 <= total
  function geoStage(total, unit, G){
    total = Number(total)||0; if (total <= 0) return 0;
    var x = (total * (G - 1) / unit) + 1;
    if (x <= 1) return 0;
    return Math.max(0, floor(Math.log(x) / Math.log(G))); // s
  }
  function geoCumForStage(s, unit, G){
    if (s <= 0) return 0;
    return unit * (Math.pow(G, s) - 1) / (G - 1);
  }

  function loadState(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return {
        stages: {
          level:0,
          str:0, agi:0, int:0, luk:0,
          atk:0, def:0,
          skill:0, aspd:0, totalDmgBonus:0,
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
      if (s.skill==null){ s.skill=0; }
      if (s.aspd==null) s.aspd=0;
      if (s.totalDmgBonus==null) s.totalDmgBonus=0; // 新增「總傷害 加成」階數
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
          skill:0, aspd:0, totalDmgBonus:0,
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
    box._timer = setTimeout(function(){ box.style.opacity='0'; }, 2200);
  }

  // —— 階段計算 —— //
  // 等級維持原有 10 等一階
  function levelStage(lv){ return floor((lv||0)/LV_UNIT); }

  // ——— 新：主屬性/攻防改幾何門檻 ———
  function primaryStage(val){ return geoStage(val, PRIMARY_UNIT, ATTR_GROWTH); }
  function adStage(val){ return geoStage(val, AD_UNIT, ATTR_GROWTH); }

  // 20% / 30% 類
  function per20Stage(val){ return floor((Number(val)||0) / 0.20); }
  function per30Stage(val){ return floor((Number(val)||0) / 0.30); }

  // 擊殺系（幾何）
  function killStage(c){ return geoStage(c, KILL_UNIT, GEO_GROWTH); }
  function eliteStage(c){ return geoStage(c, ELITE_UNIT, GEO_GROWTH); }
  function bossStage(c){ return geoStage(c, BOSS_UNIT, GEO_GROWTH); }
  function dmgStage(d){ return geoStage(d, DAMAGE_UNIT, GEO_GROWTH); }
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

  // ——「總傷害 加成」——
  // 1) 優先讀你在 player.js 暴露的聚合值：player.totalStats.totalDamage
  // 2) 若未就緒，後備計算：base + core + skill（相容新舊命名）
  var totalDmgBonus =
    (p.totalStats && typeof p.totalStats.totalDamage === "number")
      ? Number(p.totalStats.totalDamage)
      : (
          Number(p.baseTotalDamage || 0) +
          Number(core.totalDamage || 0) +
          Number((p.skillBonus && p.skillBonus.totalDamage) || 0) +
          // 兼容舊鍵名（若有遺留）
          Number(p.baseFinalDamage || 0) +
          Number(core.finalDamage || 0) +
          Number(core.damageBonus || 0) +
          Number(p.totalDamageBonus || 0)
        );

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
    totalDmgBonus: totalDmgBonus, // ★ 已對準你的來源
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

    // 等級（遞增制）
    var stLv = levelStage(snap.level);
    if (stLv > state.stages.level){
      awardSum += giveRewardLevel(state.stages.level, stLv);
      state.stages.level = stLv;
    }

    // 主屬性（幾何門檻；每階 +5 張）
    var sStr = primaryStage(snap.prim.str);
    var sAgi = primaryStage(snap.prim.agi);
    var sInt = primaryStage(snap.prim.int);
    var sLuk = primaryStage(snap.prim.luk);
    if (sStr > state.stages.str){ awardSum += giveRewardFixed(REWARD_PER_STAGE_PRIMARY, sStr - state.stages.str); state.stages.str = sStr; }
    if (sAgi > state.stages.agi){ awardSum += giveRewardFixed(REWARD_PER_STAGE_PRIMARY, sAgi - state.stages.agi); state.stages.agi = sAgi; }
    if (sInt > state.stages.int){ awardSum += giveRewardFixed(REWARD_PER_STAGE_PRIMARY, sInt - state.stages.int); state.stages.int = sInt; }
    if (sLuk > state.stages.luk){ awardSum += giveRewardFixed(REWARD_PER_STAGE_PRIMARY, sLuk - state.stages.luk); state.stages.luk = sLuk; }

    // 攻防（幾何門檻；每階 +5 張）
    var sAtk = adStage(snap.atkEquip);
    var sDef = adStage(snap.defEquip);
    if (sAtk > state.stages.atk){ awardSum += giveRewardFixed(REWARD_PER_STAGE_AD, sAtk - state.stages.atk); state.stages.atk = sAtk; }
    if (sDef > state.stages.def){ awardSum += giveRewardFixed(REWARD_PER_STAGE_AD, sDef - state.stages.def); state.stages.def = sDef; }

    // 戰鬥加成：技能傷害 / 攻速 / 總傷害（20% 一階；每階 +5 張）
    var sSkill = per20Stage(snap.skill);
    var sAspd  = per20Stage(snap.aspdGain);
    var sTDmg  = per20Stage(snap.totalDmgBonus);
    if (sSkill > state.stages.skill){ awardSum += giveRewardFixed(REWARD_PER_STAGE_COMBAT, sSkill - state.stages.skill); state.stages.skill = sSkill; }
    if (sAspd  > state.stages.aspd ){ awardSum += giveRewardFixed(REWARD_PER_STAGE_COMBAT, sAspd  - state.stages.aspd ); state.stages.aspd  = sAspd;  }
    if (sTDmg  > state.stages.totalDmgBonus){ awardSum += giveRewardFixed(REWARD_PER_STAGE_COMBAT, sTDmg - state.stages.totalDmgBonus); state.stages.totalDmgBonus = sTDmg; }

    // 探索三率（30% 一階；沿用 +2 張）
    var sExp  = per30Stage(snap.exp);
    var sDrop = per30Stage(snap.drop);
    var sGold = per30Stage(snap.gold);
    if (sExp  > state.stages.exp ){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sExp  - state.stages.exp ); state.stages.exp  = sExp;  }
    if (sDrop > state.stages.drop){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sDrop - state.stages.drop); state.stages.drop = sDrop; }
    if (sGold > state.stages.gold){ awardSum += giveRewardFixed(REWARD_PER_STAGE_DEFAULT, sGold - state.stages.gold); state.stages.gold = sGold; }

    // 擊殺 / 精英 / Boss / 累傷（幾何門檻；獎勵沿用）
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
  function geometricBounds(val, unit, G){
    var s = geoStage(val, unit, G);
    return { base: geoCumForStage(s, unit, G), next: geoCumForStage(s+1, unit, G), stage: s };
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
    '<div style="background:#2a2a2a;border-radius:8px;overflow:hidden;height:10px;margin-top:6px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)">' +
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
          atk:0, def:0, skill:0, aspd:0, totalDmgBonus:0,
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

      // 主屬性：幾何門檻 + 固定每階 +5 張
      html += '<h3 style="margin:12px 0 8px;color:#9fc5ff;">主屬性（；每階 +5 張）</h3>';
      html += rowProgress('力量 STR', snap.prim.str, geometricBounds(snap.prim.str, PRIMARY_UNIT, ATTR_GROWTH), fmtInt);
      html += rowProgress('敏捷 AGI', snap.prim.agi, geometricBounds(snap.prim.agi, PRIMARY_UNIT, ATTR_GROWTH), fmtInt);
      html += rowProgress('智力 INT', snap.prim.int, geometricBounds(snap.prim.int, PRIMARY_UNIT, ATTR_GROWTH), fmtInt);
      html += rowProgress('幸運 LUK', snap.prim.luk, geometricBounds(snap.prim.luk, PRIMARY_UNIT, ATTR_GROWTH), fmtInt);

      // 攻防：幾何門檻 + 固定每階 +5 張
      html += '<h3 style="margin:12px 0 8px;color:#9fc5ff;">攻防（；每階 +5 張）</h3>';
      html += rowProgress('攻擊力 ATK', snap.atkEquip, geometricBounds(snap.atkEquip, AD_UNIT, ATTR_GROWTH), fmtInt);
      html += rowProgress('防禦力 DEF', snap.defEquip, geometricBounds(snap.defEquip, AD_UNIT, ATTR_GROWTH), fmtInt);

      html += '<h3 style="margin:12px 0 8px;color:#9fc5ff;">戰鬥加成（每階 +5 張）</h3>';
      html += rowProgress('技能傷害', Math.round(snap.skill*100)/100,  linearBoundsByUnit(snap.skill, 0.20, per20Stage), fmtPct);
      html += rowProgress('攻擊速度(+%)', Math.round(snap.aspdGain*100)/100, linearBoundsByUnit(snap.aspdGain, 0.20, per20Stage), fmtPct);
      html += rowProgress('總傷害(+%)',  Math.round(snap.totalDmgBonus*100)/100, linearBoundsByUnit(snap.totalDmgBonus, 0.20, per20Stage), fmtPct);

      html += '<h3 style="margin:12px 0 8px;color:#9fc5ff;">探索加成（每階 +2 張）</h3>';
      html += rowProgress('經驗值率', Math.round(snap.exp*100)/100,  linearBoundsByUnit(snap.exp, 0.30, per30Stage), fmtPct);
      html += rowProgress('掉寶率',   Math.round(snap.drop*100)/100, linearBoundsByUnit(snap.drop, 0.30, per30Stage), fmtPct);
      html += rowProgress('金幣率',   Math.round(snap.gold*100)/100, linearBoundsByUnit(snap.gold, 0.30, per30Stage), fmtPct);

      html += '<h3 style="margin:12px 0 8px;color:#9fc5ff;">累積（擊殺/傷害）— </h3>';
      html += rowProgress('擊殺數（ / +2 張）',  snap.kills,       geometricBounds(snap.kills,       KILL_UNIT,   GEO_GROWTH), fmtInt);
      html += rowProgress('精英擊殺（ / +10 張）', snap.eliteKills, geometricBounds(snap.eliteKills,   ELITE_UNIT,  GEO_GROWTH), fmtInt);
      html += rowProgress('Boss 擊殺（ / +20 張）', snap.bossKills,  geometricBounds(snap.bossKills,    BOSS_UNIT,   GEO_GROWTH), fmtInt);
      html += rowProgress('累積傷害（ / +20 張）',  snap.totalDamage, geometricBounds(snap.totalDamage, DAMAGE_UNIT, GEO_GROWTH), fmtDmg);

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
