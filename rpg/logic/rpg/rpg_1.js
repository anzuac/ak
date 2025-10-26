// Rpg_玩家.js —— 玩家一次出手（含技能/普攻/連擊；末端傷害浮動 + 弓手先手再動）
// 可直接覆蓋原檔；已整合：
// 1) 總傷害 totalDamage：放於「爆擊 → 最終乘區 → 浮動」之後
// 2) ✅ 修正流程：先完成所有乘區與浮動，再【扣防禦】，最後才護盾吸收
// 3) ✅ 純百分比穿防：effectiveDef = def * (1 - player.totalStats.ignoreDefPct)
// 4) ✅ 弓箭手「先手再動」：普攻與連擊結束後，同幀補射 0~N 發；不吃攻速 CD；只對弓手生效
// 5) 預留 TODO 擴充點：易傷/屬性相剋/PVP 調整/吸血（lifesteal）
// 6) ✅ 顯示補射序號與統計（【先手再動 xN】、第一次/第二次/第三次）
// 7) ✅ 與 CombatLog UI 串接：CombatLog.log(text)（若 UI 未載入則忽略）

(function (global) {
  // ===== 工具 =====
  function _evadePct(entity) {
    if (typeof getEvasionPercent === "function") return getEvasionPercent(entity);
    var eva = Number(entity && entity.dodgePercent) || 0;
    if (eva < 0) eva = 0; if (eva > 100) eva = 100;
    return eva;
  }

  // 次序字樣：第1次/第一次（1~10 用中文，其餘用數字）
  function _ordinalCn(n){
    var map = ["零","一","二","三","四","五","六","七","八","九","十"];
    if (n >= 1 && n <= 10) return "第" + map[n] + "次";
    return "第" + n + "次";
  }

  // 末端傷害浮動（中控）
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
    def = Math.floor(def * (1 - pct));
    return Math.max(0, def);
  }

  // —— 乘數集：總傷害與未來擴充點 ——
  function _totalDamageMul() {
    var td = (global.player && player.totalStats && player.totalStats.totalDamage) || 0; // 小數：0.12 = +12%
    return 1 + td;
  }
  function _vulnerabilityMul(target, ctx) { return 1; } // TODO
  function _elementMul(attacker, target, ctx) { return 1; } // TODO
  function _modeMul(ctx) { return 1; } // TODO
  function _finalStageMul(target, ctx) {
    var mul = 1;
    mul *= _totalDamageMul();
    mul *= _vulnerabilityMul(target, ctx);
    mul *= _elementMul(player, target, ctx);
    mul *= _modeMul(ctx);
    return mul;
  }

  function _applyLifesteal(actualDamage) {
    // TODO: 以實際入傷為基準回血
  }

  function _applyDefenseAndShield(dmg, target) {
    if (!(dmg > 0)) return 0;
    var defEff = _effectiveDefense(target && target.def);
    dmg = Math.max(Math.floor(dmg - defEff), 1);
    if ((target.shield || 0) > 0 && dmg > 0) {
      var absorbed = Math.min(dmg, target.shield);
      target.shield -= absorbed;
      dmg -= absorbed;
    }
    return Math.max(0, Math.floor(dmg));
  }

  // ===== 弓箭手：先手再動 =====
  function _isArcher(actor){
    var j = String(actor?.job || "").toLowerCase();
    return (typeof window.getBaseJob === "function")
      ? window.getBaseJob(j) === "archer"
      : j.replace(/\d+$/,'') === "archer";
  }
  function _getPreemptiveParams(actor){
    var t = actor.totalStats || {};
    return {
      enabled: _isArcher(actor),
      chance: Math.max(0, Math.min(1, Number(t.preemptiveChance) || 0)),
      perAttackMax: Math.max(0, (t.preemptivePerAttackMax|0) || 0)
    };
  }

  // 以普攻同公式打一發（回傳實際入傷與文字）— 加入序號 idx
  function _rollPreemptiveHit(target, idx){
    var atk = (player.totalStats && player.totalStats.atk || 1);
    var dmg = atk;

    // Step 1. 爆擊
    var isC = Math.random() < (player.totalStats && player.totalStats.critRate || 0);
    if (isC) dmg = Math.floor(dmg * (1 + (player.totalStats && player.totalStats.critMultiplier || 0)));

    // Step 2. 最終乘區（用 preemptive 作為類型標記）
    dmg = Math.floor(dmg * _finalStageMul(target, { type: 'preemptive' }));

    // Step 3. 浮動
    dmg = _applyDamageVariance(dmg);

    // Step 4. 扣防禦（護盾稍後）
    var defEff = _effectiveDefense(target && target.def);
    dmg = Math.max(Math.floor(dmg - defEff), 1);

    var tag = "（" + _ordinalCn(idx) + "先手：";
    var critTxt = isC ? "爆擊！" : "";

    // 護盾吸收
    if ((target.shield || 0) > 0 && dmg > 0) {
      var absorbed = Math.min(dmg, target.shield);
      target.shield -= absorbed; dmg -= absorbed;
      if (dmg <= 0) return { dealt: 0, text: tag + "被護盾抵銷）" };
      return { dealt: dmg, text: tag + "造成 " + dmg + " 傷害" + (critTxt? "（"+critTxt+"）":"") + "，部分被護盾吸收）" };
    }

    return { dealt: dmg, text: tag + "造成 " + dmg + " 傷害" + (critTxt? "（"+critTxt+"）":"") + "）" };
  }

  // 0~N 發補射（無時間差、同步）— 會顯示第幾次先手 & 總結
  function _runArcherPreemptiveBurst(target, textCollector){
    var p = _getPreemptiveParams(player);
    if (!p.enabled || p.chance <= 0 || p.perAttackMax <= 0) return;

    var shots = 0;
    while (shots < p.perAttackMax) {
      if (!target || target.isDead) break;
      if (Math.random() >= p.chance) break; // 一失敗整段停止
      shots++;

      var r = _rollPreemptiveHit(target, shots);
      if (r.dealt > 0) {
        global.monsterHP -= r.dealt;
        _recordDamage(r.dealt);
        _applyLifesteal(r.dealt);
      }
      if (typeof textCollector.push === "function") textCollector.push(r.text);
    }

    // 前綴總結
    if (shots > 0 && Array.isArray(textCollector)) {
      textCollector.unshift("【先手再動 x" + shots + "】");
    }
  }

  // —— 對外：執行一次玩家行動 —— //
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
        if (global.CombatLog && typeof global.CombatLog.log === "function") global.CombatLog.log(text);
        return { did: true, text: text };
      }

      // IgnoreDef 公式或單純傷害（擇一）
      var ig = (global.IgnoreDef && global.IgnoreDef.calcSkillDamageForPlayer
                ? global.IgnoreDef.calcSkillDamageForPlayer(sr, m)
                : { usedFormula: false, includesDefense: false });

      // 基礎技能傷害
      var dmg = ig.usedFormula ? ig.damage : Math.max(0, Number(sr.damage || 0), innerDelta);

      // Step 1. 爆擊
      if (Math.random() < (player.totalStats && player.totalStats.critRate || 0)) {
        dmg = Math.floor(dmg * (1 + (player.totalStats && player.totalStats.critMultiplier || 0)));
        text = "（爆擊！）";
      } else {
        text = "";
      }

      // Step 2. 最終乘區
      dmg = Math.floor(dmg * _finalStageMul(m, { type: 'skill' }));

      // Step 3. 浮動
      dmg = _applyDamageVariance(dmg);

      // Step 4. 扣防（若 IgnoreDef 公式已含防，則只處理護盾）
      if (!(ig && ig.usedFormula && ig.includesDefense === true)) {
        dmg = _applyDefenseAndShield(dmg, m);
      } else {
        if ((m.shield || 0) > 0 && dmg > 0) {
          var absorbedS = Math.min(dmg, m.shield);
          m.shield -= absorbedS; dmg -= absorbedS;
        }
        dmg = Math.max(0, Math.floor(dmg));
      }

      if (dmg > 0) {
        global.monsterHP -= dmg;
        _recordDamage(dmg);
        _applyLifesteal(dmg);
      }

      if (sr.abnormalEffect && typeof global.applyStatusToMonster === "function") {
        var effect = sr.abnormalEffect;
        var nowSec = Math.floor((typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000);
        global.applyStatusToMonster(m, effect.type, effect.duration, effect.multiplier, nowSec);
      }

      var finalText = (shownName + "造成 " + dmg + " 傷害" + text + (ig.suffix || ""));
      if (global.CombatLog && typeof global.CombatLog.log === "function") global.CombatLog.log(finalText);
      return { did: true, text: finalText };
    }

    // === 普攻 ===
    if (Math.random() * 100 < _evadePct(m)) {
      var evasive = "普通攻擊被 " + m.name + " 閃避了";
      if (global.CombatLog && typeof global.CombatLog.log === "function") global.CombatLog.log(evasive);
      return { did: true, text: evasive };
    }

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

      // Step 4. 扣防
      var defEff = _effectiveDefense(m && m.def);
      dmg = Math.max(Math.floor(dmg - defEff), 1);

      return Math.floor(dmg);
    }

    var critRef1 = { isCrit: false };
    var dmg1 = _roll(critRef1);
    var critText1 = critRef1.isCrit ? "（爆擊！）" : "";

    if ((m.shield || 0) > 0 && dmg1 > 0) {
      var absorbed1 = Math.min(dmg1, m.shield);
      m.shield -= absorbed1; dmg1 -= absorbed1;
      text = (dmg1 <= 0)
        ? "普通攻擊被護盾完全抵銷"
        : "普通攻擊造成 " + dmg1 + " 傷害" + critText1 + "（部分被護盾吸收）";
    } else {
      text = "普通攻擊造成 " + dmg1 + " 傷害" + critText1;
    }

    if (dmg1 > 0) {
      global.monsterHP -= dmg1;
      _recordDamage(dmg1);
      _applyLifesteal(dmg1);
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
        _applyLifesteal(dmg2);
      }
    }

    // 弓箭手：先手再動
    var _burstTexts = [];
    _runArcherPreemptiveBurst(m, _burstTexts);
    if (_burstTexts.length) text += " " + _burstTexts.join(" ");

    if (global.CombatLog && typeof global.CombatLog.log === "function") global.CombatLog.log(text);
    return { did: true, text: text };
  }

  global.Rpg_玩家 = { actOnce: actOnce };
})(window);