// ==========================
// combat_power.js — 戰鬥力評分（CP）ES5（可直接貼上）
// 依賴：window.player 與 player.totalStats
// 可選依賴：window.getBaseJob / window.getMagicShieldPercent
// ==========================
(function(){
  if (typeof window === "undefined") return;

  // ---------- 小工具 ----------
  function nz(x, d){ return (typeof x === "number" && !isNaN(x)) ? x : (d || 0); }
  function clamp(x, a, b){ return x < a ? a : (x > b ? b : x); }

  // 取得父系職業（warrior/mage/archer/thief）
  function getBaseJobSafeLocal(job){
    var j = String(job || "").toLowerCase();
    if (typeof window.getBaseJob === "function") return window.getBaseJob(j);
    return j.replace(/\d+$/, "");
  }

// ---------- 可調參數（職業中和版） ----------
var DEF_TO_HP         = 4;     // 降低防禦→等效HP 的膨脹（原 8/5 → 4）
var ASPD_MIN          = 0.60;
var ASPD_MAX          = 3.00;
var DODGE_CAP         = 0.50;  // 閃避最多計 50%
var DODGE_MIN_REMAIN  = 0.25;  // 1-閃避 的最小剩餘承傷
var MS_MAX            = 0.70;
var MS_MIN_REMAIN     = 0.30;
var SUSTAIN_MAX_BONUS = 0.35;  // 回復/吸血最多 +35% EHP 增益
  // 四職權重/微係數
  // 不做職業權重偏置，差異交給上面的 EHP 校正處理
var JOB_WEIGHTS = {
  warrior:{ wDps:0.60, wEhp:0.40, dpsAdj:1.00, ehpAdj:1.00, mpToCp:0.00 },
  mage:   { wDps:0.60, wEhp:0.40, dpsAdj:1.00, ehpAdj:1.00, mpToCp:0.010 },
  archer: { wDps:0.60, wEhp:0.40, dpsAdj:1.00, ehpAdj:1.00, mpToCp:0.00 },
  thief:  { wDps:0.60, wEhp:0.40, dpsAdj:1.00, ehpAdj:1.00, mpToCp:0.00 },
  "":     { wDps:0.60, wEhp:0.40, dpsAdj:1.00, ehpAdj:1.00, mpToCp:0.00 }
};
// 只中和「生存向」，不動輸出向：用來抵銷各職在防禦/HP/MP 係數上的先天差
// 只中和「生存向」，不動輸出向：用來抵銷各職在防禦/HP/MP 係數上的先天差
var JOB_EHP_NORMALIZER = {
  warrior: 0.75,
  mage:    1.35,
  archer:  1.00,
  thief:   1.00,
  "":      1.00
};
  // 期望爆擊倍率：1 + (爆率 * 爆傷加成)
  function expectedCritMultiplier(r, m){
    r = clamp(nz(r, 0), 0, 1);
    m = Math.max(0, nz(m, 0));
    return 1 + r * m;
  }

  // ---------- 輸出向（DPS Like） ----------
  // Atk × 爆擊期望 × (1+技能/法術) × 攻速 × 多段打擊
  function computeDPSLike(total, playerRef){
    var atk        = Math.max(0, nz(total.atk, 0));
    var critMul    = expectedCritMultiplier(nz(total.critRate,0), nz(total.critMultiplier,0));
    var skillSpell = 1 + Math.max(0, nz(total.skillDamage,0)) + Math.max(0, nz(total.spellDamage,0));

    // 攻速倍率（1=100%），防呆夾限
    var atkSpd = clamp(nz(total.attackSpeedPct, 1), ASPD_MIN, ASPD_MAX);

    // 多段打擊期望：雙擊 + 連擊（皆為機率），簡化為 1 + P1 + P2
    var multiHit = 1 + clamp(nz(total.doubleHitChance,0), 0, 1) + clamp(nz(total.comboRate,0), 0, 1);
    // 避免過度極端，最多 +100%（=2倍）
    multiHit = clamp(multiHit, 1, 2);

    var dps = atk * critMul * skillSpell * atkSpd * multiHit;
    return dps;
  }

  // ---------- 生存向（EHP Like） ----------
  // (HP + DEF×係數 + 盾) × (1+減傷) ÷ (1-有效閃避) ÷ (1-魔盾) × 續戰放大
  function computeEHPLike(total, playerRef){
    var hp      = Math.max(1, nz(total.hp, 1));
    var def     = Math.max(0, nz(total.def, 0));
    var shield  = Math.max(0, nz(total.shield, 0));
    var dr      = clamp(nz(total.damageReduce, 0), 0, 0.70); // 你系統中本就上限 70%
    var dodge   = clamp(nz(total.dodgePercent, 0), 0, DODGE_CAP);
    var ms      = 0;
    if (typeof window.getMagicShieldPercent === "function") {
      ms = clamp(nz(window.getMagicShieldPercent(), 0), 0, MS_MAX);
    }

    // 續戰：回血/吸血
    var recover    = Math.max(0, nz(total.recoverPercent, 0));         // 例：0.02 = 2%
    var lifesteal  = Math.max(0, nz(playerRef.lifestealPercent, 0));   // 例：0.05 = 5%
    // 經驗法則：回血權重1.5、吸血權重1.0，上限 +50%
    var sustainAmp = 1 + Math.min(SUSTAIN_MAX_BONUS, recover*1.5 + lifesteal*1.0);

    // —— 組合 —— 
var dmgTakenMul = 1 - dr;
dmgTakenMul = clamp(dmgTakenMul, 0.1, 1);

var dodgeRemain = Math.max(DODGE_MIN_REMAIN, (1 - dodge));
var msRemain    = Math.max(MS_MIN_REMAIN,   (1 - ms));

var ehpRaw = (hp + DEF_TO_HP * def + shield) * (1 + dr);
ehpRaw = ehpRaw / dodgeRemain / msRemain * sustainAmp;

// 職業 EHP 校正（只動 EHP，不動 DPS）
var baseJob = getBaseJobSafeLocal(playerRef && playerRef.job);
var ehpAdj  = JOB_EHP_NORMALIZER.hasOwnProperty(baseJob) ? JOB_EHP_NORMALIZER[baseJob] : JOB_EHP_NORMALIZER[""];
var ehp     = ehpRaw * nz(ehpAdj, 1);

return ehp;
  }

  // ---------- 綜合戰鬥力（加入職業權重/微調） ----------
  function computeCombatPower(playerRef){
    try {
      var total   = playerRef.totalStats || {};
      var baseJob = getBaseJobSafeLocal(playerRef.job);
      var jw      = JOB_WEIGHTS[baseJob] || JOB_WEIGHTS[""];

      var dps = computeDPSLike(total, playerRef);
      var ehp = computeEHPLike(total, playerRef);

      // 權重線性組合 + 微調 + （法師）MP 轉少量 CP
      var mp    = Math.max(0, nz(total.mp, 0));
      var extra = mp * nz(jw.mpToCp, 0);

      var cp = jw.wDps * dps * nz(jw.dpsAdj,1) + jw.wEhp * ehp * nz(jw.ehpAdj,1) + extra;

      // 取整易讀
      return Math.round(Math.max(0, cp));
    } catch (e){
      console.error("[CP] compute error:", e);
      return 0;
    }
  }

  // ---------- 明細（給除錯或 UI 展示） ----------
  function getCombatPowerSummary(){
    var p = window.player || {};
    var t = (p.totalStats || {});
    var dps = computeDPSLike(t, p);
    var ehp = computeEHPLike(t, p);
    var cp  = computeCombatPower(p);
    var baseJob = getBaseJobSafeLocal(p.job);

    return {
      cp: cp,
      dpsLike: dps,
      ehpLike: ehp,
      job: baseJob,
      parts: {
        atk: nz(t.atk,0),
        def: nz(t.def,0),
        hp: nz(t.hp,0),
        mp: nz(t.mp,0),
        shield: nz(t.shield,0),
        attackSpeedPct: nz(t.attackSpeedPct,1),
        critRate: clamp(nz(t.critRate,0),0,1),
        critMultiplier: Math.max(0, nz(t.critMultiplier,0)),
        skillDamage: Math.max(0, nz(t.skillDamage,0)),
        spellDamage: Math.max(0, nz(t.spellDamage,0)),
        doubleHitChance: clamp(nz(t.doubleHitChance,0),0,1),
        comboRate: clamp(nz(t.comboRate,0),0,1),
        damageReduce: clamp(nz(t.damageReduce,0),0,0.70),
        dodgePercent: clamp(nz(t.dodgePercent,0),0, DODGE_CAP),
        recoverPercent: Math.max(0, nz(t.recoverPercent,0)),
        lifestealPercent: Math.max(0, nz(p.lifestealPercent,0)),
        magicShieldPercent: (typeof window.getMagicShieldPercent==="function") ? clamp(nz(window.getMagicShieldPercent(),0),0,MS_MAX) : 0
      }
    };
  }

  // ---------- 導出 ----------
  window.computeCombatPower = function(){ return computeCombatPower(window.player); };
  window.getCombatPowerSummary = getCombatPowerSummary;

})();