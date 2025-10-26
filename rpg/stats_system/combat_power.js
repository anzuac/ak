// ==========================
// combat_power.js — 戰鬥力（CP）+ 段位（F- → SSS+）整合
// 依賴：window.player, player.totalStats
// 可選依賴：window.getBaseJob, window.getMagicShieldPercent
// 已整合：totalDamage（總傷）與 ignoreDefPct（穿防）
// ==========================
(function(){
  if (typeof window === "undefined") return;

  // ---------- 小工具 ----------
  function nz(x, d){ return (typeof x === "number" && !isNaN(x)) ? x : (d || 0); }
  function clamp(x, a, b){ return x < a ? a : (x > b ? b : x); }
  function fmt(n){ return (Number(n)||0).toLocaleString(); }

  function getBaseJobSafeLocal(job){
    var j = String(job || "").toLowerCase();
    if (typeof window.getBaseJob === "function") return window.getBaseJob(j);
    return j.replace(/\d+$/, "");
  }

  // ==========================
  // 可調參數（平衡旋鈕）
  // ==========================

  // —— 輸出向：基準怪物防禦（估算用，讓CP更貼近實戰）
  var DEF_BENCH_BASE    = 20;   // 起始基準 DEF
  var DEF_BENCH_PER_LVL = 1.5;  // 每級增加多少 DEF

  // —— EHP 估算參數
  var DEF_TO_HP           = 4;     // DEF 換算等效 HP 的係數
  var ASPD_MIN            = 0.60;
  var ASPD_MAX            = 3.00;
  var DODGE_CAP           = 0.50;  // 閃避最多計 50%
  var DODGE_MIN_REMAIN    = 0.25;  // 1-閃避 的最小剩餘承傷
  var MS_MAX              = 0.70;  // 魔力護盾最大 70%
  var MS_MIN_REMAIN       = 0.30;  // 1-魔盾 的最小剩餘承傷
  var SUSTAIN_MAX_BONUS   = 0.35;  // 回復/吸血最多 +35% EHP 增益

  // —— CP 權重（輸出：生存＝6：4）
  var JOB_WEIGHTS = {
    warrior:{ wDps:0.60, wEhp:0.40, dpsAdj:1.00, ehpAdj:1.00, mpToCp:0.00 },
    mage:   { wDps:0.60, wEhp:0.40, dpsAdj:1.00, ehpAdj:1.00, mpToCp:0.010 },
    archer: { wDps:0.60, wEhp:0.40, dpsAdj:1.00, ehpAdj:1.00, mpToCp:0.00 },
    thief:  { wDps:0.60, wEhp:0.40, dpsAdj:1.00, ehpAdj:1.00, mpToCp:0.00 },
    "":     { wDps:0.60, wEhp:0.40, dpsAdj:1.00, ehpAdj:1.00, mpToCp:0.00 }
  };

  // —— 只中和「生存向」，不動輸出向（抵銷各職 HP/DEF/MP 先天差）
  var JOB_EHP_NORMALIZER = {
    warrior: 0.75,
    mage:    1.35,
    archer:  1.00,
    thief:   1.00,
    "":      1.00
  };

  // ==========================
  // CP 計算（DPS/EHP）
  // ==========================

  // 期望爆擊倍率：1 + (爆率 * 爆傷)
  function expectedCritMultiplier(r, m){
    r = clamp(nz(r, 0), 0, 1);
    m = Math.max(0, nz(m, 0));
    return 1 + r * m;
  }

  // 輸出向（DPS-like）：
  // 每擊基礎 = max( floor( ATK × (1+總傷) × (1+技能+法術) ) − 有效怪防, 1 )
  // 有效怪防 = 基準DEF × (1 − 穿防)
  // 期望輸出 = 每擊基礎 × 爆擊期望 × 攻速 × 多段（雙擊/連擊）
  function computeDPSLike(total, playerRef){
    var atk         = Math.max(0, nz(total.atk, 0));
    var tdMul       = 1 + Math.max(0, nz(total.totalDamage, 0));
    var skillSpell  = 1 + Math.max(0, nz(total.skillDamage,0)) + Math.max(0, nz(total.spellDamage,0));
    var critMul     = expectedCritMultiplier(nz(total.critRate,0), nz(total.critMultiplier,0));

    var atkSpd = clamp(nz(total.attackSpeedPct, 1), ASPD_MIN, ASPD_MAX);

    var multiHit = 1 + clamp(nz(total.doubleHitChance,0), 0, 1) + clamp(nz(total.comboRate,0), 0, 1);
    multiHit = clamp(multiHit, 1, 2); // 上限+100%

    var lvl      = Math.max(1, nz(playerRef.level, 1));
    var defBench = Math.max(0, Math.round(DEF_BENCH_BASE + DEF_BENCH_PER_LVL * lvl));

    var pen   = clamp(nz(total.ignoreDefPct, 0), 0, 0.9999); // 你已在 player.js 封頂 0.9999
    var effDef = Math.floor(defBench * (1 - pen));

    var basePerHit = Math.max(Math.floor(atk * tdMul * skillSpell) - effDef, 1);

    var dps = basePerHit * critMul * atkSpd * multiHit;
    return dps;
  }

  // 生存向（EHP-like）：
  // (HP + DEF×係數 + 盾) × (1+減傷) ÷ (1-有效閃避) ÷ (1-魔盾) × 續戰放大
  function computeEHPLike(total, playerRef){
    var hp      = Math.max(1, nz(total.hp, 1));
    var def     = Math.max(0, nz(total.def, 0));
    var shield  = Math.max(0, nz(total.shield, 0));
    var dr      = clamp(nz(total.damageReduce, 0), 0, 0.70); // 你系統中的上限
    var dodge   = clamp(nz(total.dodgePercent, 0), 0, DODGE_CAP);
    var ms      = 0;
    if (typeof window.getMagicShieldPercent === "function") {
      ms = clamp(nz(window.getMagicShieldPercent(), 0), 0, MS_MAX);
    }

    var recover    = Math.max(0, nz(total.recoverPercent, 0));
    var lifesteal  = Math.max(0, nz(playerRef.lifestealPercent, 0));
    var sustainAmp = 1 + Math.min(SUSTAIN_MAX_BONUS, recover*1.5 + lifesteal*1.0);

    var dmgTakenMul = 1 - dr;
    dmgTakenMul = clamp(dmgTakenMul, 0.1, 1);

    var dodgeRemain = Math.max(DODGE_MIN_REMAIN, (1 - dodge));
    var msRemain    = Math.max(MS_MIN_REMAIN,   (1 - ms));

    var ehpRaw = (hp + DEF_TO_HP * def + shield) * (1 + dr);
    ehpRaw = ehpRaw / dodgeRemain / msRemain * sustainAmp;

    var baseJob = getBaseJobSafeLocal(playerRef && playerRef.job);
    var ehpAdj  = JOB_EHP_NORMALIZER.hasOwnProperty(baseJob) ? JOB_EHP_NORMALIZER[baseJob] : JOB_EHP_NORMALIZER[""];
    var ehp     = ehpRaw * nz(ehpAdj, 1);

    return ehp;
  }

  // 綜合戰鬥力 CP（6:4）
  function computeCombatPower(playerRef){
    try {
      var total   = playerRef.totalStats || {};
      var baseJob = getBaseJobSafeLocal(playerRef.job);
      var jw      = JOB_WEIGHTS[baseJob] || JOB_WEIGHTS[""];

      var dps = computeDPSLike(total, playerRef);
      var ehp = computeEHPLike(total, playerRef);

      var mp    = Math.max(0, nz(total.mp, 0));
      var extra = mp * nz(jw.mpToCp, 0);

      var cp = jw.wDps * dps * nz(jw.dpsAdj,1) + jw.wEhp * ehp * nz(jw.ehpAdj,1) + extra;
      return Math.round(Math.max(0, cp));
    } catch (e){
      console.error("[CP] compute error:", e);
      return 0;
    }
  }

  // 明細（除錯 / UI）
  function getCombatPowerSummary(){
    var p = window.player || {};
    var t = (p.totalStats || {});
    var dps = computeDPSLike(t, p);
    var ehp = computeEHPLike(t, p);
    var cp  = computeCombatPower(p);
    var baseJob = getBaseJobSafeLocal(p.job);

    var lvl      = Math.max(1, nz(p.level, 1));
    var defBench = Math.max(0, Math.round(DEF_BENCH_BASE + DEF_BENCH_PER_LVL * lvl));
    var pen      = clamp(nz(t.ignoreDefPct, 0), 0, 0.9999);
    var effDef   = Math.floor(defBench * (1 - pen));
    var tdMul    = 1 + Math.max(0, nz(t.totalDamage, 0));
    var skillSpell = 1 + Math.max(0, nz(t.skillDamage,0)) + Math.max(0, nz(t.spellDamage,0));
    var basePerHit = Math.max(Math.floor(nz(t.atk,0) * tdMul * skillSpell) - effDef, 1);

    return {
      cp: cp,
      dpsLike: dps,
      ehpLike: ehp,
      job: baseJob,
      defBenchmarkUsed: defBench,
      effectiveDefUsed: effDef,
      basePerHitNoCrit: basePerHit,
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
        totalDamage: Math.max(0, nz(t.totalDamage,0)),
        ignoreDefPct: clamp(nz(t.ignoreDefPct,0), 0, 0.9999),
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

  // 導出（供外部呼叫）
  window.computeCombatPower = function(){ return computeCombatPower(window.player); };
  window.getCombatPowerSummary = getCombatPowerSummary;

  // ==========================
  // 段位系統（F- → SSS+）從 F- 起算，高階加速放大
  // ==========================

  var RANKS = [
    "F-", "F", "F+",
    "E-", "E", "E+",
    "D-", "D", "D+",
    "C-", "C", "C+",
    "B-", "B", "B+",
    "A-", "A", "A+",
    "S-", "S", "S+",
    "SS-", "SS", "SS+",
    "SSS-", "SSS", "SSS+"
  ];

  var RANK_COLOR = {
    "F":   "#ef4444", // red
    "E":   "#f97316", // orange
    "D":   "#f59e0b", // amber
    "C":   "#84cc16", // lime
    "B":   "#14b8a6", // teal
    "A":   "#3b82f6", // blue
    "S":   "#8b5cf6", // violet
    "SS":  "#a855f7", // purple
    "SSS": "#eab308"  // gold
  };
  function colorForRankLabel(label){
    var key = label.replace(/[+\-]/g, "");
    return RANK_COLOR[key] || "#9ca3af";
  }

  // 從 F- 起算
  var START_LABEL = "F-";
  var START_CP    = 800;  // 你可調：新手起始 CP

  // 主群步進（半級倍率）：越高越陡，SSS+ 會到數百萬
  function stepFor(label){
    var base = label.replace(/[+\-]/g, "");
    if (base === "SSS") return 17.00;
    if (base === "SS")  return 12.86;
    if (base === "S")   return 8.48;
    if (base === "A")   return 6.36;
    if (base === "B")   return 5.95;
    if (base === "C")   return 4.58;
    if (base === "D")   return 3.27;
    if (base === "E")   return 2.20;
    return 1.62; // F
  }

  // 建門檻：從 F- 開始一路往上乘
  var _thresholds = (function buildThresholdsFromF(){
    var th = [];
    var startIdx = RANKS.indexOf(START_LABEL);
    if (startIdx < 0) startIdx = 0;
    var cp = Math.max(1, Math.round(START_CP));
    th[startIdx] = cp;

    // 往上
    for (var i = startIdx + 1; i < RANKS.length; i++){
      var s = stepFor(RANKS[i]);
      cp = Math.max(1, Math.round(cp * s));
      th[i] = cp;
    }

    // 往下（通常不會觸發，保險）
    for (var j = startIdx - 1; j >= 0; j--){
      var sDown = stepFor(RANKS[j+1]);
      cp = Math.max(1, Math.round(cp / sDown));
      th[j] = cp;
    }

    // 遞增保底
    for (var k = 1; k < th.length; k++){
      if (th[k] <= th[k-1]) th[k] = th[k-1] + 1;
    }
    return th;
  })();

  function getRankByCP(cp){
    cp = Math.max(0, Math.floor(Number(cp) || 0));
    var i, rankIdx = 0;
    for (i = 0; i < RANKS.length; i++){
      if (cp >= _thresholds[i]) rankIdx = i;
      else break;
    }

    var label = RANKS[rankIdx];
    var lower = _thresholds[rankIdx] || 1;
    var next  = _thresholds[Math.min(rankIdx+1, _thresholds.length-1)] || lower;
    if (next <= lower) next = lower + 1;

    var progress = Math.max(0, Math.min(1, (cp - lower) / (next - lower)));
    var color = colorForRankLabel(label);

    return {
      label: label,
      index: rankIdx,
      lower: lower,
      next: next,
      progress01: progress,
      color: color,
      thresholds: _thresholds.slice(),
      config: { start: START_LABEL, startCP: START_CP }
    };
  }

  // 導出段位 API
  window.getRankByCP = getRankByCP;

  // ==========================
  // 段位徽章（右下角，CP + 段位）
  // ==========================
  function ensureBadgeStyle(){
    if (document.getElementById("cpRankBadgeStyle")) return;
    var s = document.createElement("style");
    s.id = "cpRankBadgeStyle";
    s.textContent = "\
      #cpRankBadge{position:fixed; right:14px; bottom:48px; z-index:9998; background:#0b1220; color:#e5e7eb; border:1px solid #1f2937; border-radius:10px; padding:8px 10px; font:13px/1 system-ui,Segoe UI,Roboto,Arial,sans-serif; box-shadow:0 8px 24px rgba(0,0,0,.35);}\
      #cpRankBadge .r{ font-weight:800; margin-left:6px; }\
      #cpRankBadge .p{ opacity:.85; margin-left:6px; font-size:12px; }\
    ";
    document.head.appendChild(s);
  }
  function ensureBadge(){
    var el = document.getElementById("cpRankBadge");
    if (el) return el;
    ensureBadgeStyle();
    el = document.createElement("div");
    el.id = "cpRankBadge";
    el.textContent = "CP —";
    document.body.appendChild(el);
    return el;
  }
  function tickBadge(){
    try{
      if (typeof window.computeCombatPower !== "function") return;
      var cp = computeCombatPower(window.player);
      var rk = getRankByCP(cp);
      var el = ensureBadge();
      el.innerHTML = "CP " + fmt(cp) + ' <span class="r" style="color:'+rk.color+'">'+rk.label+'</span><span class="p">('+(Math.round(rk.progress01*100))+"%)</span>";
    }catch(_){}
  }
  function startBadge(){
    tickBadge();
    setInterval(tickBadge, 1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startBadge);
  else startBadge();

})();