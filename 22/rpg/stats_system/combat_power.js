// ==========================
// combat_power.js — 戰鬥力評分（CP）ES5
// 依賴：window.player 與 player.totalStats
// ==========================
(function(){
  if (typeof window === "undefined") return;

  // 安全取數工具
  function nz(x, d){ return (typeof x === "number" && !isNaN(x)) ? x : (d || 0); }
  function clamp(x, a, b){ return x < a ? a : (x > b ? b : x); }

  // 期望爆擊倍率：1 + (爆率 * 爆傷加成)
  function expectedCritMultiplier(r, m){
    r = clamp(nz(r, 0), 0, 1);
    m = Math.max(0, nz(m, 0));
    return 1 + r * m;
  }

  // 近似輸出（不帶單位）：Atk × 爆擊期望 × (1+技能/法術) × 攻速 × 多段打擊
  function computeDPSLike(total, playerRef){
    var atk = Math.max(0, nz(total.atk, 0));
    var critMul = expectedCritMultiplier(nz(total.critRate,0), nz(total.critMultiplier,0));
    var skillSpell = 1 + Math.max(0, nz(total.skillDamage,0)) + Math.max(0, nz(total.spellDamage,0));

    // 攻速：你的 totalStats.attackSpeedPct 是倍率（1=100%），防呆在 [0.2, 3.0]
    var atkSpd = clamp(nz(total.attackSpeedPct, 1), 0.2, 3.0);

    // 多段打擊：雙擊 + 連擊（皆為機率），視作期望段數放大
    // 例如 雙擊20% + 連擊15% => 1 + 0.20 + 0.15 = 1.35
    var multiHit = 1 + clamp(nz(total.doubleHitChance,0), 0, 1) + clamp(nz(total.comboRate,0), 0, 1);
    // 避免過度極端，最多加到 +100%（=2倍）
    multiHit = clamp(multiHit, 1, 2);

    var dps = atk * critMul * skillSpell * atkSpd * multiHit;

    // 小心虛弱狀態在 UI 上已處理，這裡不重複
    return dps;
  }

  // 近似有效生命 EHP： (HP + 護盾) / (1-減傷) × 閃避放大 × 持續生存
  function computeEHPLike(total, playerRef){
    var hp = Math.max(1, nz(total.hp, 1));
    var shield = Math.max(0, nz(total.shield, 0));

    // 減傷：total.damageReduce 已做過上限，轉為承傷倍率
    var dmgReduce = clamp(nz(total.damageReduce, 0), 0, 0.9); // 防呆最多90%
    var dmgTakenMul = 1 - dmgReduce;
    dmgTakenMul = clamp(dmgTakenMul, 0.1, 1); // 不讓除數過小

    // 閃避：視為 EHP 放大因子 ~ 1 / (1 - dodge)
    // 為避免高閃過度膨脹，放大上限約 2 倍
    var dodge = clamp(nz(total.dodgePercent, 0), 0, 0.8);
    var dodgeAmp = 1 / Math.max(0.5, 1 - dodge); // 上限 2 倍

    // 持續生存：回血/吸血視為等效續戰，適度放大
    var recover = Math.max(0, nz(total.recoverPercent, 0));              // 例：0.02 = 2%
    var lifesteal = Math.max(0, nz(playerRef.lifestealPercent, 0));      // 例：0.05 = 5%
    // 經驗法則係數：回血權重1.5、吸血權重1.0，上限 +50%
    var sustainAmp = 1 + Math.min(0.5, recover*1.5 + lifesteal*1.0);

    var ehp = (hp + shield) / dmgTakenMul * dodgeAmp * sustainAmp;
    return ehp;
  }

  // 綜合戰鬥力：幾何平均 √(DPS×EHP)，同時重視打得快與活得久
  function computeCombatPower(playerRef){
    try {
      var total = playerRef.totalStats || {};
      var dps = computeDPSLike(total, playerRef);
      var ehp = computeEHPLike(total, playerRef);

      // 幾何平均＆輕微平滑，避免 0
      var cp = Math.sqrt(Math.max(1, dps) * Math.max(1, ehp));

      // 取整易讀
      return Math.round(cp);
    } catch (e){
      console.error("[CP] compute error:", e);
      return 0;
    }
  }

  // 便於 UI 顯示：回傳拆解明細
  function getCombatPowerSummary(){
    var p = window.player;
    var t = p.totalStats || {};
    var dps = computeDPSLike(t, p);
    var ehp = computeEHPLike(t, p);
    var cp  = Math.sqrt(Math.max(1,dps) * Math.max(1,ehp));
    return {
      cp: Math.round(cp),
      dpsLike: dps,
      ehpLike: ehp,
      parts: {
        atk: nz(t.atk,0),
        critRate: clamp(nz(t.critRate,0),0,1),
        critMultiplier: Math.max(0, nz(t.critMultiplier,0)),
        skillDamage: Math.max(0, nz(t.skillDamage,0)),
        spellDamage: Math.max(0, nz(t.spellDamage,0)),
        attackSpeedPct: nz(t.attackSpeedPct,1),
        doubleHitChance: clamp(nz(t.doubleHitChance,0),0,1),
        comboRate: clamp(nz(t.comboRate,0),0,1),
        hp: nz(t.hp,0),
        shield: nz(t.shield,0),
        damageReduce: clamp(nz(t.damageReduce,0),0,0.9),
        dodgePercent: clamp(nz(t.dodgePercent,0),0,0.8),
        recoverPercent: Math.max(0, nz(t.recoverPercent,0)),
        lifestealPercent: Math.max(0, nz(p.lifestealPercent,0))
      }
    };
  }

  // 導出
  window.computeCombatPower = function(){ return computeCombatPower(window.player); };
  window.getCombatPowerSummary = getCombatPowerSummary;

})();