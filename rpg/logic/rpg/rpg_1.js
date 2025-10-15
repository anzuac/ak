// Rpg_玩家.js —— 玩家一次出手（含技能/普攻/連擊；末端傷害浮動）
// 可直接覆蓋原檔；已整合：
// 1) 總傷害 totalDamage：放於「爆擊 → 最終乘區 → 浮動」之後
// 2) ✅ 修正流程：先完成所有乘區與浮動，再【扣防禦】，最後才護盾吸收
// 3) ✅ 純百分比穿防：effectiveDef = def * (1 - player.totalStats.ignoreDefPct)
// 4) 預留 TODO 擴充點：易傷/屬性相剋/PVP 調整/吸血（lifesteal）

(function (global) {
  // ===== 工具 =====
  function _evadePct(entity) {
    if (typeof getEvasionPercent === "function") return getEvasionPercent(entity);
    var eva = Number(entity && entity.dodgePercent) || 0;
    if (eva < 0) eva = 0; if (eva > 100) eva = 100;
    return eva;
  }

  // 末端傷害浮動（中控）—— 在所有乘區完成後再套（預設 ±10%，可用 window.DAMAGE_JITTER_PCT 覆寫 0~1）
  function _applyDamageVariance(dmg) {
    var pct = Number(window.DAMAGE_JITTER_PCT);
    if (!(pct >= 0 && pct <= 1)) pct = 0.10; // 預設 ±10%
    if (!(dmg > 0)) return 0;
    var minMul = 1 - pct, maxMul = 1 + pct;
    var mul = minMul + Math.random() * (maxMul - minMul);
    return Math.max(0, Math.floor(dmg * mul));
  }

  // 成就：回報實際入傷
  function _recordDamage(dmg) {
    if (dmg > 0 && global.Achievements && typeof Achievements.onDamageDealt === "function") {
      Achievements.onDamageDealt(dmg);
    }
  }

  // —— 穿防（純百分比）：有效防禦 = 原始防禦 × (1 - ignoreDefPct) —— 
  function _effectiveDefense(rawDef) {
    var def = Math.max(0, Number(rawDef) || 0);
    var pct = Math.max(0, Math.min(Number(global.player?.totalStats?.ignoreDefPct) || 0, 1));
    // 只按比例減防
    def = Math.floor(def * (1 - pct));
    return Math.max(0, def);
  }

  // —— 乘數集：總傷害與未來擴充點 ——
  function _totalDamageMul() {
    var td = (global.player && player.totalStats && player.totalStats.totalDamage) || 0; // 小數：0.12 = +12%
    return 1 + td;
  }
  // TODO: 易傷（例：怪物受易傷狀態時 1.15）
  function _vulnerabilityMul(target, ctx) {
    // e.g., if (target.statusEffects?.vulnerable > 0) return 1.15;
    return 1;
  }
  // TODO: 屬性相剋（例：火打草 1.25、火打水 0.75）
  function _elementMul(attacker, target, ctx) {
    // e.g., return calcElementMul(attacker.element, target.element);
    return 1;
  }
  // TODO: PVP 或模式調整（例：PVP 總傷乘數 0.85）
  function _modeMul(ctx) {
    // e.g., if (ctx?.mode === 'pvp') return 0.85;
    return 1;
  }
  // 彙整：爆擊後、浮動前的「最終乘區」乘數（防禦與護盾在之後）
  function _finalStageMul(target, ctx) {
    var mul = 1;
    mul *= _totalDamageMul();
    mul *= _vulnerabilityMul(target, ctx);
    mul *= _elementMul(player, target, ctx);
    mul *= _modeMul(ctx);
    return mul;
  }

  // TODO: 吸血（lifesteal）—— 以實際入傷為基準回血
  function _applyLifesteal(actualDamage) {
    // e.g., var ls = Number(player.totalStats && player.totalStats.lifestealPercent) || 0;
    // var heal = Math.floor(actualDamage * ls);
    // if (heal > 0) player.currentHP = Math.min(player.currentHP + heal, player.totalStats.hp);
  }

  // —— 共用：完成乘區與浮動後，扣防禦與護盾並入傷 ——
  function _applyDefenseAndShield(dmg, target) {
    if (!(dmg > 0)) return 0;

    // 扣防禦（吃穿防）
    var defEff = _effectiveDefense(target && target.def);
    dmg = Math.max(Math.floor(dmg - defEff), 1);

    // 護盾吸收
    if ((target.shield || 0) > 0 && dmg > 0) {
      var absorbed = Math.min(dmg, target.shield);
      target.shield -= absorbed;
      dmg -= absorbed;
    }

    return Math.max(0, Math.floor(dmg));
  }

  // 對外：執行一次玩家行動
  function actOnce() {
    if (!global.player || !global.currentMonster) return { did: false };

    // 狀態禁錮
    if (player.statusEffects && ((player.statusEffects.freeze > 0) || (player.statusEffects.paralyze > 0))) {
      return { did: false, text: "你因狀態異常無法行動" };
    }

    var m = global.currentMonster;
    var hpBefore = global.monsterHP;
    var text = "";

    // === 先嘗試技能（沿用既有自動技能）===
    var sr = (typeof global.autoUseSkills === "function" ? global.autoUseSkills(m) : null) || { used: false };
    var hpAfter = global.monsterHP;
    var innerDelta = Math.max(0, hpBefore - hpAfter); // 技能內部已造成的扣血
    var retDamage = Math.max(0, Number(sr.damage || 0)); // 技能回傳傷害欄位
    var didSkill = !!sr.used || innerDelta > 0 || retDamage > 0;

    if (didSkill) {
      var shownName = sr.name || "技能";

      // 閃避（技能仍可被怪物閃避）
      if (Math.random() * 100 < _evadePct(m)) {
        global.monsterHP = hpBefore;
        text = shownName + "被 " + m.name + " 閃避了";
        return { did: true, text: text };
      }

      // IgnoreDef 公式或單純傷害（擇一）
      var ig = (global.IgnoreDef && global.IgnoreDef.calcSkillDamageForPlayer
                ? global.IgnoreDef.calcSkillDamageForPlayer(sr, m)
                : { usedFormula: false, includesDefense: false });

      // 基礎技能傷害（若使用 IgnoreDef 公式，取其結果；否則取回傳或內部差額）
      var dmg = ig.usedFormula ? ig.damage : Math.max(0, Number(sr.damage || 0), innerDelta);

      // —— Step 1. 爆擊 ——
      if (Math.random() < (player.totalStats && player.totalStats.critRate || 0)) {
        dmg = Math.floor(dmg * (1 + (player.totalStats && player.totalStats.critMultiplier || 0)));
        text = "（爆擊！）";
      } else {
        text = "";
      }

      // —— Step 2. 最終乘區（總傷害/易傷/相剋/模式）——
      dmg = Math.floor(dmg * _finalStageMul(m, { type: 'skill' }));

      // —— Step 3. 浮動 ——
      dmg = _applyDamageVariance(dmg);

      // —— Step 4. 扣防禦（若 IgnoreDef 公式已包含防禦，則跳過）——
      if (!(ig && ig.usedFormula && ig.includesDefense === true)) {
        dmg = _applyDefenseAndShield(dmg, m);
      } else {
        // 公式已含防禦，仍需處理護盾
        if ((m.shield || 0) > 0 && dmg > 0) {
          var absorbedS = Math.min(dmg, m.shield);
          m.shield -= absorbedS; dmg -= absorbedS;
        }
        dmg = Math.max(0, Math.floor(dmg));
      }

      // 入傷與後續
      if (dmg > 0) {
        global.monsterHP -= dmg;
        _recordDamage(dmg);
        _applyLifesteal(dmg); // TODO: 吸血（若未實裝，無作用）
      }

      // 附加異常
      if (sr.abnormalEffect && typeof global.applyStatusToMonster === "function") {
        var effect = sr.abnormalEffect;
        var nowSec = Math.floor((typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000);
        global.applyStatusToMonster(m, effect.type, effect.duration, effect.multiplier, nowSec);
      }

      return { did: true, text: (shownName + "造成 " + dmg + " 傷害" + text + (ig.suffix || "")) };
    }

    // === 普攻 ===
    if (Math.random() * 100 < _evadePct(m)) {
      return { did: true, text: "普通攻擊被 " + m.name + " 閃避了" };
    }

    // 重新設計 _roll：先乘滿 → 浮動 → 扣防（吃穿防）
    function _roll(baseCritOut) {
      var atk = (player.totalStats && player.totalStats.atk || 1);
      var dmg = atk;

      // Step 1. 爆擊
      var isC = Math.random() < (player.totalStats && player.totalStats.critRate || 0);
      baseCritOut.isCrit = isC;
      if (isC) dmg = Math.floor(dmg * (1 + (player.totalStats && player.totalStats.critMultiplier || 0)));

      // Step 2. 最終乘區
      dmg = Math.floor(dmg * _finalStageMul(m, { type: 'attack' }));

      // Step 3. 浮動
      dmg = _applyDamageVariance(dmg);

      // Step 4. 扣防禦（護盾稍後統一處理）
      var defEff = _effectiveDefense(m && m.def);
      dmg = Math.max(Math.floor(dmg - defEff), 1);

      return Math.floor(dmg);
    }

    var critRef1 = { isCrit: false };
    var dmg1 = _roll(critRef1);
    var critText1 = critRef1.isCrit ? "（爆擊！）" : "";

    // 護盾吸收（普攻第一段）
    if ((m.shield || 0) > 0 && dmg1 > 0) {
      var absorbed1 = Math.min(dmg1, m.shield);
      m.shield -= absorbed1;
      dmg1 -= absorbed1;
      text = (dmg1 <= 0)
        ? "普通攻擊被護盾完全抵銷"
        : "普通攻擊造成 " + dmg1 + " 傷害" + critText1 + "（部分被護盾吸收）";
    } else {
      text = "普通攻擊造成 " + dmg1 + " 傷害" + critText1;
    }

    if (dmg1 > 0) {
      global.monsterHP -= dmg1;
      _recordDamage(dmg1);
      _applyLifesteal(dmg1); // TODO: 吸血
    }

    // 連擊
    var comboChance = Number(player.totalStats && player.totalStats.doubleHitChance || 0);
    if (dmg1 > 0 && comboChance > 0 && Math.random() < comboChance) {
      var critRef2 = { isCrit: false };
      var dmg2 = (function(){
        var atk = (player.totalStats && player.totalStats.atk || 1);
        var d = atk;
        var isC2 = Math.random() < (player.totalStats && player.totalStats.critRate || 0);
        critRef2.isCrit = isC2;
        if (isC2) d = Math.floor(d * (1 + (player.totalStats && player.totalStats.critMultiplier || 0)));
        d = Math.floor(d * _finalStageMul(m, { type: 'attack-combo' }));
        d = _applyDamageVariance(d);
        var defEff2 = _effectiveDefense(m && m.def);
        d = Math.max(Math.floor(d - defEff2), 1);
        return Math.floor(d);
      })();

      var critText2 = critRef2.isCrit ? "（爆擊！）" : "";

      if ((m.shield || 0) > 0 && dmg2 > 0) {
        var absorbed2 = Math.min(dmg2, m.shield);
        m.shield -= absorbed2; dmg2 -= absorbed2;
        text += (dmg2 <= 0)
          ? "（觸發連擊，但被護盾抵銷）"
          : "（觸發連擊，再造成 " + dmg2 + " 傷害" + critText2 + "，部分被護盾吸收）";
      } else {
        text += "（觸發連擊，再造成 " + dmg2 + " 傷害" + critText2 + "）";
      }
      if (dmg2 > 0) {
        global.monsterHP -= dmg2;
        _recordDamage(dmg2);
        _applyLifesteal(dmg2); // TODO: 吸血
      }
    }

    return { did: true, text: text };
  }

  // 輸出
  global.Rpg_玩家 = { actOnce: actOnce };

})(window);