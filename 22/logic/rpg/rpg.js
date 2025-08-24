// 📦 rpg.js（核心戰鬥邏輯：修正：回合開始HP同步、回合收尾單一路徑；不破壞顯示）

// === 安全墊片：避免未定義報錯（王技可直接呼叫）=''
if (typeof window.applyPlayerStatus === 'undefined') {
  window.applyPlayerStatus = function(type, turns) {
    if (!type || !Number.isFinite(turns)) return;
    player.statusEffects = player.statusEffects || {};
    const cur = player.statusEffects[type] || 0;
    player.statusEffects[type] = Math.max(cur, Math.max(0, Math.floor(turns)));
  };
}

// ===== 全域狀態 =====
let selectedRange = "1-10";
let selectedMap   = "all";
let currentMonster = null;
let monsterHP = 0;
let isDead = false;
let round = 1;
// autoEnabled = 是否啟動自動戰鬥（預設 false）
let autoEnabled = false;
let stopAfterEncounter = false;
// 計時器
let respawnTimer = null;  // 擊殺後遇敵倒數（顯示在怪物面板）
let deathTimer   = null;  // 死亡復活倒數（顯示在能力值 HP 行）

// ===== 小工具：戰鬥日誌 =====
function logPrepend(text) {
  const log = document.getElementById("battleLog");
  if (!log) return;
  const entry = document.createElement("div");
  entry.textContent = text;
  log.insertBefore(entry, log.firstChild);
}
// 命中/閃避共用：把 entity 上的 dodgePercent 與 BossCore.evasion 統一成百分比
function getEvasionPercent(entity) {
  let eva = 0;
  // 既有：玩家或怪物原本就可能有 dodgePercent（0~100）
  if (Number.isFinite(Number(entity?.dodgePercent))) {
    eva = Math.max(eva, Number(entity.dodgePercent));
  }
  // Boss 的迴避 buff 走 BossCore（我們用 0~100 的百分比語意）
  if (typeof BossCore?.getStat === "function") {
    const statEva = Number(BossCore.getStat(entity, "evasion") || 0);
    if (Number.isFinite(statEva)) eva = Math.max(eva, statEva);
  }
  // 限制一下上限，避免 100% 永久無敵（真要無敵可改成 100）
  return Math.max(0, Math.min(100, eva));
}
// ===== UI：遇敵倒數（不刷日誌）=====
function showRespawnCountdownUI(sec) {
  const box = document.getElementById("monsterInfo");
  if (!box) return;
  box.innerHTML = `
    <div style="padding:10px 8px; border:1px dashed #666; border-radius:8px; text-align:center;">
      <div style="font-size:14px; margin-bottom:6px;">🧭 即將遭遇新怪</div>
      <div style="font-size:24px; font-weight:bold;">${sec}</div>
      <div style="font-size:12px; opacity:.8; margin-top:6px;">請稍候…</div>
    </div>
  `;
}
function clearMonsterInfo() {
  const box = document.getElementById("monsterInfo");
  if (box) box.textContent = "尚未遭遇怪物";
}
function startRespawnCountdown(delaySec = 3) {
  if (respawnTimer) clearInterval(respawnTimer);
  let t = Math.max(0, Number(delaySec) || 0);
  showRespawnCountdownUI(t);
  respawnTimer = setInterval(() => {
    t--;
    if (t <= 0) {
      clearInterval(respawnTimer);
      respawnTimer = null;
      if (typeof spawnNewMonster === "function") spawnNewMonster();
    } else {
      showRespawnCountdownUI(t);
    }
  }, 1000);
}

// ===== UI：死亡倒數（顯示在 HP 行）=====
function showDeathCountdownUI(sec) {
  const hpEl = document.getElementById("hp");
  if (!hpEl) return;
  const maxHp = player?.totalStats?.hp ?? 0;
  hpEl.textContent = `0 / ${maxHp}（復活倒數 ${sec}s）`;
  const abilitySection = hpEl.closest(".section");
  if (abilitySection) abilitySection.style.opacity = 0.6;
}
function restoreAbilityUI() {
  const hpEl = document.getElementById("hp");
  if (hpEl) {
    const maxHp = player?.totalStats?.hp ?? 0;
    const curHp = player?.currentHP ?? 0;
    hpEl.textContent = `${curHp} / ${maxHp}`;
    const abilitySection = hpEl.closest(".section");
    if (abilitySection) abilitySection.style.opacity = "";
  }
}

// ===== 生怪（單體版）=====
function spawnNewMonster() {
  const mapSel = document.getElementById("mapSelect");
  const lvlSel = document.getElementById("levelRange");
  selectedMap   = mapSel?.value   || selectedMap || "all";
  selectedRange = lvlSel?.value   || selectedRange || "1-10";

  if (typeof getMonster !== "function") {
    console.warn("getMonster 未載入；無法生怪");
    return;
  }
  const m = getMonster(selectedMap, selectedRange);
  m.maxHp = m.maxHp ?? m.hp;

  currentMonster = m;
  monsterHP = m.hp;
  
  // ★ 狀態系統：初始化怪物的狀態和抗性物件
  currentMonster.statusEffects = {};
  currentMonster.statusResistance = {};

  // 進入戰鬥：鎖難度（需要 map/difficulty.js 有 setDifficultySelectDisabled）
  window.setDifficultySelectDisabled?.(true);

  if (typeof updateMonsterInfo === "function") updateMonsterInfo(currentMonster, monsterHP);
  logPrepend?.(`👾 遭遇 ${m.name}`);
}

// ===== 回合流程（單體） =====
function battleRound() {
  if (isDead) return;
  if (!autoEnabled) return;

  // 沒怪就生一隻
  if (!currentMonster) {
    if (!respawnTimer) spawnNewMonster();
    return;
  }

  const actionText = `第 ${round} 回合：`;
  let skippedPlayerAction = false;
  let skillText = "";
  let damageText = "";

  // ===== 回合開始：先處理玩家狀態 =====
  if (typeof processPlayerStatusEffects === "function") processPlayerStatusEffects();

  // ★ 狀態系統：處理怪物的持續性異常狀態
  if (typeof processMonsterStatusEffects === 'function') {
      // 這裡需要傳遞當前回合數 'round'
      processMonsterStatusEffects(currentMonster, player, round);
  }

  // ===== 回合開始：處理怪物自我 Buff（例如 healBuff）並「同步 monsterHP」=====
  // 你的 processMonsterBuffs 會直接改 currentMonster.hp/shield 等，不回傳值。
  // 這裡在回合開始階段呼叫，然後把 monsterHP 對齊（避免 UI/邏輯不同步）。
  if (typeof processMonsterBuffs === "function") {
    const before = Number(currentMonster.hp) || 0;
    processMonsterBuffs(currentMonster);
    const after = Number(currentMonster.hp) || 0;
    if (after !== before) {
      const cap = currentMonster.maxHp || after;
      monsterHP = Math.max(0, Math.min(cap, after));
    }
  }

  // ========= 玩家行動 =========
  if (player.statusEffects?.freeze > 0 || player.statusEffects?.paralyze > 0) {
    skippedPlayerAction = true;
    skillText = `你因狀態異常無法行動`;
  } else {
    // 玩家攻擊邏輯
    const hpBefore = monsterHP;
    const sr = (typeof autoUseSkills === "function" ? autoUseSkills(currentMonster) : null) || { used: false };
    const hpAfter = monsterHP;
    const innerDelta = Math.max(0, hpBefore - hpAfter);
    const retDamage = Math.max(0, Number(sr.damage || 0));
    const didSkill = !!sr.used || innerDelta > 0 || retDamage > 0;

    if (didSkill) {
      const shownName = sr.name || "技能";

      // 閃避照舊
      const evadedByBoss = Math.random() * 100 < getEvasionPercent(currentMonster);
      if (evadedByBoss) {
        monsterHP = hpBefore;
        skillText = `${shownName}被 ${currentMonster.name} 閃避了`;
      } else {
        // ★ 新增：若 sr 有 mul/flat/ignoreDefPct，就用外掛求值
        const ig = (window.IgnoreDef?.calcSkillDamageForPlayer?.(sr, currentMonster)) || { usedFormula:false };
        
        let dmg;
        let isCrit = false;
        let critText = '';

        if (ig.usedFormula) {
          dmg = ig.damage;
        } else {
          dmg = Math.max(0, Number(sr.damage || 0), innerDelta);
        }

        // 判斷技能是否爆擊
        if (Math.random() < (player.totalStats?.critRate || 0)) {
          isCrit = true;
          dmg = Math.floor(dmg * (1 + (player.totalStats?.critMultiplier || 0)));
          critText = `（爆擊！）`;
        }

        // 護盾吸收（沿用你普攻的做法）
        if ((currentMonster.shield || 0) > 0 && dmg > 0) {
          const absorbed = Math.min(dmg, currentMonster.shield);
          currentMonster.shield -= absorbed;
          dmg -= absorbed;
        }
        
        dmg = Math.max(0, Math.floor(dmg));
        if (dmg > 0) monsterHP -= dmg;
        
        skillText = `${shownName}造成 ${dmg} 傷害${critText}${ig.suffix || ""}`;
      }
      
      // ★ 狀態系統：應用技能附帶的異常狀態
      if (sr.abnormalEffect) {
          const effect = sr.abnormalEffect;
          window.applyStatusToMonster(currentMonster, effect.type, effect.duration, effect.multiplier, round);
      }

    } else {
     // 普攻（原本就有閃避，保留）
const monsterEvaded = Math.random() * 100 < getEvasionPercent(currentMonster);
if (monsterEvaded) {
  skillText = `普通攻擊被 ${currentMonster.name} 閃避了`;
} else {
  // 第一次命中傷害
  let isCrit1 = false;
  let isCrit2 = false;

  const rollHit = () => {
    isCrit1 = Math.random() < (player.totalStats?.critRate || 0);
    const base = Math.max((player.totalStats?.atk || 1) - (currentMonster?.def || 0), 1);
    return isCrit1 ? Math.floor(base * (1 + (player.totalStats?.critMultiplier || 0))) : base;
  };
  
  // 第1擊
  let dmg1 = rollHit();
  const critText1 = isCrit1 ? `（爆擊！）` : '';

  // 先吃護盾
  if ((currentMonster.shield || 0) > 0 && dmg1 > 0) {
    const absorbed = Math.min(dmg1, currentMonster.shield);
    currentMonster.shield -= absorbed;
    dmg1 -= absorbed;
    if (dmg1 <= 0) {
      skillText = `普通攻擊被護盾完全抵銷`;
    } else {
      skillText = `普通攻擊造成 ${dmg1} 傷害${critText1}（部分被護盾吸收）`;
    }
  } else {
    skillText = `普通攻擊造成 ${dmg1} 傷害${critText1}`;
  }

  if (dmg1 > 0) monsterHP -= dmg1;

  // 🔥 只有「普攻」才會檢查連擊（技能分支沒有這段）
  const comboChance = Number(player.totalStats?.doubleHitChance || 0); // 0~1
  if (dmg1 > 0 && comboChance > 0 && Math.random() < comboChance) {
    // 第2擊（再滾一次，與第1擊同規則，可再次吃護盾）
    const rollHit2 = () => {
        isCrit2 = Math.random() < (player.totalStats?.critRate || 0);
        const base = Math.max((player.totalStats?.atk || 1) - (currentMonster?.def || 0), 1);
        return isCrit2 ? Math.floor(base * (1 + (player.totalStats?.critMultiplier || 0))) : base;
    };
    let dmg2 = rollHit2();
    const critText2 = isCrit2 ? `（爆擊！）` : '';

    if ((currentMonster.shield || 0) > 0 && dmg2 > 0) {
      const absorbed2 = Math.min(dmg2, currentMonster.shield);
      currentMonster.shield -= absorbed2;
      dmg2 -= absorbed2;
      if (dmg2 <= 0) {
        skillText += `（觸發連擊，但被護盾抵銷）`;
      } else {
        skillText += `（觸發連擊，再造成 ${dmg2} 傷害${critText2}，部分被護盾吸收）`;
      }
    } else {
      skillText += `（觸發連擊，再造成 ${dmg2} 傷害${critText2}）`;
    }

    if (dmg2 > 0) monsterHP -= dmg2;
  }
}
    }
  }
  // ========= 怪物死亡（先於怪物動作結算）=========
  if (monsterHP <= 0) {
    const drop = (typeof getDrop === "function") ? getDrop(currentMonster) : { gold: 0, stone: 0, exp: 0, items: [] };
    if (drop.gold) addGoldFromKill(drop.gold, 1);
    if (drop.stone) addStone(drop.stone);
    if (typeof gainExp === "function") gainExp(drop.exp || 0);
    logPrepend?.(`${actionText}${skippedPlayerAction ? skillText : skillText}`);
    const dropItemsText = (Array.isArray(drop.items) && drop.items.length > 0) ? `，並獲得 ${drop.items.join("、")}` : "";
    logPrepend?.(`🎉 擊敗 ${currentMonster.name}，獲得 楓幣 ${drop.gold}${drop.stone > 0 ? `、強化石 ${drop.stone} 顆` : ""}、EXP ${drop.exp}${dropItemsText}`);
    clearMonsterInfo();
    currentMonster = null;
    if (respawnTimer) { clearInterval(respawnTimer); respawnTimer = null; }
    if (stopAfterEncounter) {
      autoEnabled = false;
      stopAfterEncounter = false;
      window.setDifficultySelectDisabled?.(false);
    } else if (autoEnabled) {
      startRespawnCountdown(3);
    } else {
      window.setDifficultySelectDisabled?.(false);
    }
    round++;
    if (typeof updateResourceUI === "function") updateResourceUI();
    return;
  }
  
  // ★ 狀態系統：處理怪物行動

  // ★★★ 新增：虛弱保底倍率（避免有路徑繞過被改過的 monster.atk）
  let weakenExtraMul = 1;
  {
    const wk = currentMonster?.statusEffects?.weaken;
    if (wk?.duration > 0) {
      const hasBase = Number.isFinite(currentMonster?.atk_base) && currentMonster.atk_base > 0;
      if (hasBase) {
        const ratio = (currentMonster.atk || 0) / currentMonster.atk_base; // 已降：~0.6；被覆蓋：~1
        weakenExtraMul = (ratio > 0.95) ? 0.6 : 1;
      } else {
        weakenExtraMul = 0.6;
      }
    }
  }

  const monsterActionBlocked = 
    (currentMonster.statusEffects?.paralyze?.duration > 0) || 
    (currentMonster.statusEffects?.frostbite?.duration > 0);

  // ========= 怪物行動 =========
  if (monsterActionBlocked) {
    // 怪物因麻痺或凍傷無法行動
    damageText = `${currentMonster.name} 因狀態異常無法行動`;
  } else if (currentMonster.statusEffects?.chaos?.duration > 0 && Math.random() < 0.5) {
      // 混亂：50% 機率打自己（也吃虛弱保底倍率）
      const selfDamage = Math.max(1, Math.floor(Math.floor((currentMonster.atk || 1) * weakenExtraMul) * 0.5));
      monsterHP -= selfDamage;
      damageText = `${currentMonster.name} 陷入混亂，攻擊自己造成 ${selfDamage} 傷害！`;
  } else if (!currentMonster.paralyzed) {
    // 玩家閃避
    const evaded = Math.random() * 100 < getEvasionPercent(player);
    if (evaded) {
      damageText = `你成功閃避（HP：${player.currentHP}）`;
    } else {
      // 1) 先讓 Boss 控制器決定下一招
      if (typeof currentMonster.controller === 'function') {
        currentMonster.controller(currentMonster, monsterHP);
      }

      // 2) 依控制器結果/隨機選招
      const skill = (currentMonster.nextSkill) || ((typeof chooseMonsterSkill === "function") ? chooseMonsterSkill(currentMonster) : null);

      if (skill) {
        // 施放技能
        const r = (typeof executeMonsterSkill === "function") ? executeMonsterSkill(currentMonster, skill) : { name: "技能", rawDamage: 0 };
        const skillNameText = `【${r.name}】`;
        let finalDamage = r.rawDamage;

        // ★ 虛弱保底倍率（在護盾/減傷前套用，確保技能 rawDamage 也吃到 -40%）
        finalDamage = Math.floor(finalDamage * weakenExtraMul);

        let absorb = 0, reduced = 0, msAbsorbByMP = 0;

        if ((player.shield || 0) > 0 && finalDamage > 0) {
          absorb = Math.min(player.shield, finalDamage);
          player.shield -= absorb;
          finalDamage -= absorb;
        }
        if (finalDamage > 0) {
          const msPct = (typeof getMagicShieldPercent === "function") ? getMagicShieldPercent() : 0;
          if (msPct > 0) {
            const want = Math.floor(finalDamage * msPct);
            msAbsorbByMP = Math.min(want, player.currentMP || 0);
            player.currentMP -= msAbsorbByMP;
            finalDamage -= msAbsorbByMP;
          }
        }
        
        // 減傷：現在直接讀取 totalStats 的值
        const totalDR = player.totalStats?.damageReduce || 0;
        if (finalDamage > 0 && totalDR > 0) {
            const dr = Math.max(0, Math.min(1, totalDR));
            reduced = Math.floor(finalDamage * dr);
            finalDamage -= reduced;
        }
        
        finalDamage = Math.max(0, Math.round(finalDamage));

        if (finalDamage >= player.currentHP) {
          player.currentHP = 0;
          damageText = `怪物施放${skillNameText}造成 ${finalDamage} 傷害（致命）`;
        } else {
          player.currentHP -= finalDamage;
          player.currentHP = Math.max(0, Math.round(player.currentHP));
          const parts = [];
          if (absorb > 0) parts.push(`護盾吸收 ${absorb}`);
          if (msAbsorbByMP > 0) parts.push(`MP 吸收 ${msAbsorbByMP}`);
          if (reduced > 0) parts.push(`減傷 ${reduced}`);
          const extra = `（${parts.join("，")}${parts.length ? "，" : ""}HP：${player.currentHP}）`;
          damageText = `怪物施放${skillNameText}造成 ${finalDamage} 傷害 ${extra}`;
        }
        if (typeof applyStatusFromMonster === "function") applyStatusFromMonster(currentMonster);
      } else {
        // 沒有技能可用 → 普攻
        const buffed = (typeof applyMonsterBuffEffects === "function") ? applyMonsterBuffEffects(currentMonster) : currentMonster;
        // ★ 也在普攻上套用虛弱保底倍率
        const effAtk = Math.floor((buffed?.atk || 1) * weakenExtraMul);
        let finalDamage = Math.max(effAtk - (player.totalStats?.def || 0), 1);
        let absorb = 0, reduced = 0, msAbsorbByMP = 0;
        if ((player.shield || 0) > 0 && finalDamage > 0) {
          absorb = Math.min(player.shield, finalDamage);
          player.shield -= absorb;
          finalDamage -= absorb;
        }
        if (finalDamage > 0) {
          const msPct = (typeof getMagicShieldPercent === "function") ? getMagicShieldPercent() : 0;
          if (msPct > 0) {
            const want = Math.floor(finalDamage * msPct);
            msAbsorbByMP = Math.min(want, player.currentMP || 0);
            player.currentMP -= msAbsorbByMP;
            finalDamage -= msAbsorbByMP;
          }
        }
        
        // 減傷：現在直接讀取 totalStats 的值
        const totalDR = player.totalStats?.damageReduce || 0;
        if (finalDamage > 0 && totalDR > 0) {
            const dr = Math.max(0, Math.min(1, totalDR));
            reduced = Math.floor(finalDamage * dr);
            finalDamage -= reduced;
        }
        
        finalDamage = Math.max(0, Math.round(finalDamage));
        player.currentHP -= finalDamage;
        player.currentHP = Math.max(0, Math.round(player.currentHP));
        const parts = [];
        if (absorb > 0) parts.push(`護盾吸收 ${absorb}`);
        if (msAbsorbByMP > 0) parts.push(`MP 吸收 ${msAbsorbByMP}`);
        if (reduced > 0) parts.push(`減傷 ${reduced}`);
        const extra = `（${parts.join("，")}${parts.length ? "，" : ""}HP：${player.currentHP}）`;
        damageText = `怪物造成 ${finalDamage} 傷害 ${extra}`;
        if (typeof applyStatusFromMonster === "function") applyStatusFromMonster(currentMonster);
      }
    }
  } else {
    damageText = `${currentMonster.name} 因麻痺無法攻擊（HP：${player.currentHP}）`;
    currentMonster.paralyzed = false;
  }

  // UI 更新（保留你的顯示層，不動）
  if (typeof updateResourceUI === "function") updateResourceUI();
  if (typeof updateMonsterInfo === "function") {
    updateMonsterInfo(currentMonster, Math.max(monsterHP, 0));
  }
  if (typeof logPrepend === "function") {
    if (skippedPlayerAction) {
      logPrepend(`${actionText}${skillText}，${damageText}`);
    } else {
      logPrepend(`${actionText}${skillText}，${damageText}`);
    }
  }

// ========= 玩家死亡 =========
if (player.currentHP <= 0 && !isDead) {
  startDeathCountdown();
  return;
}

  // ===== 回合收尾：只走一條遞減路徑，避免重複 =====
  if (typeof reduceSkillCooldowns === "function") reduceSkillCooldowns(); // 玩家技能

  const hasBossTick = currentMonster && typeof currentMonster._tickEndTurn === "function";
  if (hasBossTick) {
    currentMonster._tickEndTurn(currentMonster); // BossCore 內部自理 buff 回合/技能CD
  } else if (typeof reduceMonsterSkillCooldowns === "function") {
    reduceMonsterSkillCooldowns(currentMonster); // 一般怪統一遞減
  }

//  if (typeof updateSkillStatusUI === "function") updateSkillStatusUI();
  round++;
}
