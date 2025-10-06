// Rpg_玩家.js —— 玩家一次出手（不含死亡/掉落/倒數）

(function (global) {
  // 小工具（沿用全域）
  function _evadePct(entity) {
    if (typeof getEvasionPercent === "function") return getEvasionPercent(entity);
    var eva = Number(entity && entity.dodgePercent) || 0;
    if (eva < 0) eva = 0; if (eva > 100) eva = 100;
    return eva;
  }

  // 對外：執行一次玩家行動
  // 放在 IIFE 裡、actOnce 上面都可
function _recordDamage(dmg) {
  if (dmg > 0 && window.Achievements && typeof Achievements.onDamageDealt === "function") {
    Achievements.onDamageDealt(dmg);
  }
}
  function actOnce() {
    // 由 rpg.js / game_init 決定是否可行動、是否有怪物
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
    var innerDelta = Math.max(0, hpBefore - hpAfter);
    var retDamage = Math.max(0, Number(sr.damage || 0));
    var didSkill = !!sr.used || innerDelta > 0 || retDamage > 0;

    if (didSkill) {
      var shownName = sr.name || "技能";

      // 閃避
      if (Math.random() * 100 < _evadePct(m)) {
        global.monsterHP = hpBefore;
        text = shownName + "被 " + m.name + " 閃避了";
        return { did: true, text: text };
      }

      // IgnoreDef 公式或單純傷害
      var ig = (global.IgnoreDef && global.IgnoreDef.calcSkillDamageForPlayer
                ? global.IgnoreDef.calcSkillDamageForPlayer(sr, m)
                : { usedFormula: false });

      var dmg = ig.usedFormula ? ig.damage : Math.max(0, Number(sr.damage || 0), innerDelta);

      // 爆擊
      if (Math.random() < (player.totalStats && player.totalStats.critRate || 0)) {
        dmg = Math.floor(dmg * (1 + (player.totalStats && player.totalStats.critMultiplier || 0)));
        text = "（爆擊！）";
      } else {
        text = "";
      }

      // 護盾吸收
      if ((m.shield || 0) > 0 && dmg > 0) {
        var absorbed = Math.min(dmg, m.shield);
        m.shield -= absorbed;
        dmg -= absorbed;
      }

dmg = Math.max(0, Math.floor(dmg));
if (dmg > 0) {
  global.monsterHP -= dmg;
  _recordDamage(dmg);       // ← 回報本次實打在怪身上的傷害（扣掉護盾後）
}
      // 異常狀態附加（如果技能帶有）
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

    var isCrit1 = false, isCrit2 = false;

    function _roll(baseCritOut) {
      var isC = Math.random() < (player.totalStats && player.totalStats.critRate || 0);
      baseCritOut.isCrit = isC;
      var base = Math.max((player.totalStats && player.totalStats.atk || 1) - (m && m.def || 0), 1);
      return isC ? Math.floor(base * (1 + (player.totalStats && player.totalStats.critMultiplier || 0))) : base;
    }

    var critRef1 = { isCrit: false };
    var dmg1 = _roll(critRef1);
    var critText1 = critRef1.isCrit ? "（爆擊！）" : "";

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
  _recordDamage(dmg1);      // ← 回報
}
    // 連擊
    var comboChance = Number(player.totalStats && player.totalStats.doubleHitChance || 0);
    if (dmg1 > 0 && comboChance > 0 && Math.random() < comboChance) {
      var critRef2 = { isCrit: false };
      var dmg2 = _roll(critRef2);
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
  _recordDamage(dmg2); // ← 回報
}
    }

    return { did: true, text: text };
  }

  // 輸出
  global.Rpg_玩家 = { actOnce: actOnce };

})(window);