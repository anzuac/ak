// 📦 rpg.js —— 即時制核心（中控）
// 需求：Rpg_玩家.js、Rpg_怪物.js、statusEffects.js、(可選) battleUtils.js 已先載入

// ===== 安全墊片（避免未定義報錯）=====
if (typeof window.applyPlayerStatus === 'undefined') {
  window.applyPlayerStatus = function(type, turns) {
    if (!type || !isFinite(turns) || !window.player) return;
    player.statusEffects = player.statusEffects || {};
    var cur = player.statusEffects[type] || 0;
    player.statusEffects[type] = Math.max(cur, Math.max(0, Math.floor(turns)));
  };
}

// ===== 小工具：取目前「整秒」=====
function _nowSec() {
  return Math.floor((typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000);
}
function _clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

// ===== 全域狀態（單純全域變數）=====
var selectedRange = "1-10";
var selectedMap   = "all";
var currentMonster = null;
var monsterHP = 0;
var isDead = false;

var autoEnabled = false;         // 是否啟動自動戰鬥（按鈕或外部控制）
var stopAfterEncounter = false;  // 優雅停止：打完本隻就停

// 以下兩者由 battleUtils.js 管：這裡只參照，不新建/清理
var respawnTimer = null;
var deathTimer   = null;

// ===== 戰鬥日誌（單框） + 左右雙框代理 =====
function logPrepend(text) {
  var log = document.getElementById("battleLog");
  if (!log) return;

  var now = new Date();
  var hh = String(now.getHours()).padStart(2, "0");
  var mm = String(now.getMinutes()).padStart(2, "0");
  var ss = String(now.getSeconds()).padStart(2, "0");
  var timeStr = "[" + hh + ":" + mm + ":" + ss + "]";

  var entry = document.createElement("div");
  entry.textContent = timeStr + " " + text;
  log.insertBefore(entry, log.firstChild);
}
function postPlayer(msg){
  if (!msg) return;
  if (window.LogDual && LogDual.player) LogDual.player(String(msg));
  else logPrepend(String(msg));
}
function postMonster(msg){
  if (!msg) return;
  if (window.LogDual && LogDual.monster) LogDual.monster(String(msg));
  else logPrepend(String(msg));
}
function postReward(msg){
  if (!msg) return;
  if (window.LogDual && LogDual.player) LogDual.player(String(msg));
  else logPrepend(String(msg));
}

// ===== 閃避百分比（玩家/怪物共用）=====
function getEvasionPercent(entity) {
  var eva = 0;
  if (entity && isFinite(Number(entity.dodgePercent))) {
    eva = Math.max(eva, Number(entity.dodgePercent));
  }
  if (typeof BossCore !== "undefined" && BossCore && typeof BossCore.getStat === "function") {
    var statEva = Number(BossCore.getStat(entity, "evasion") || 0);
    if (isFinite(statEva)) eva = Math.max(eva, statEva);
  }
  return _clamp(eva, 0, 100);
}

// ===== 生怪（維持你的切入點）=====
function spawnNewMonster() {
  var mapSel = document.getElementById("mapSelect");
  var lvlSel = document.getElementById("levelRange");

  selectedMap   = (mapSel && mapSel.value) ? mapSel.value : (selectedMap || "all");
  selectedRange = (lvlSel && lvlSel.value) ? lvlSel.value : (selectedRange || "1-10");

  if (typeof getMonster !== "function") {
    console.warn("getMonster 未載入；無法生怪");
    return;
  }
  var m = getMonster(selectedMap, selectedRange);
  m.maxHp = (typeof m.maxHp === "number") ? m.maxHp : m.hp;

  currentMonster = m;
  monsterHP = m.hp;

  // 狀態容器
  currentMonster.statusEffects = currentMonster.statusEffects || {};
  currentMonster.statusResistance = currentMonster.statusResistance || {};

  // 只有在自動戰鬥時鎖下拉（沿用舊行為）
  if (autoEnabled && typeof window.setDifficultySelectDisabled === "function") {
    window.setDifficultySelectDisabled(true);
  }

  postPlayer("👾 遭遇 " + m.name);

  var nowSec = _nowSec();
  if (typeof updateMonsterInfo === "function") updateMonsterInfo(currentMonster, monsterHP, nowSec);
}

// ===== 共用：DoT 擊殺/一般擊殺後的掉落/重生處理 =====
function _onMonsterDead(nowSec) {
  if (!currentMonster) return;

  var drop = (typeof getDrop === "function") ? getDrop(currentMonster) : { gold: 0, stone: 0, exp: 0, items: [] };
  if (drop.gold && typeof addGoldFromKill === "function") addGoldFromKill(drop.gold, 1);
  if (drop.stone && typeof addStone === "function") addStone(drop.stone);
  if (typeof gainExp === "function") gainExp(drop.exp || 0);

  if (window.RewardTracker && window.RewardTracker.record) {
    window.RewardTracker.record(
      { exp: drop.exp || 0, gold: drop.gold || 0, stone: drop.stone || 0 },
      { monster: currentMonster ? currentMonster.name : "", map: selectedMap },
      (drop.items && drop.items.slice) ? drop.items : []
    );
  }
  var dropItemsText = (drop.items && drop.items.length > 0) ? "，並獲得 " + drop.items.join("、") : "";
  postPlayer("🎉 擊敗 " + currentMonster.name + "，獲得 楓幣 " + drop.gold + (drop.stone > 0 ? "、強化石 " + drop.stone + " 顆" : "") + "、EXP " + drop.exp + dropItemsText);

  if (typeof clearMonsterInfo === "function") clearMonsterInfo();
  currentMonster = null;

  if (stopAfterEncounter) {
    autoEnabled = false;
    stopAfterEncounter = false;
    if (typeof window.setDifficultySelectDisabled === "function") window.setDifficultySelectDisabled(false);
  } else if (autoEnabled) {
    if (typeof startRespawnCountdown === "function") startRespawnCountdown();
  } else {
    if (typeof window.setDifficultySelectDisabled === "function") window.setDifficultySelectDisabled(false);
  }

  if (typeof updateResourceUI === "function") updateResourceUI();
}

// ===== 每秒滴答（狀態/自 Buff/CD/HP 同步 + 輕量 UI）=====
// ===== 每秒滴答（狀態/自 Buff/CD/HP 同步 + 輕量 UI）=====
function rtTickSec() {
  if (isDead || !autoEnabled) return;
  if (window.BattleGate && window.BattleGate.isLocked && window.BattleGate.isLocked()) return;

  // 取得當前整秒（給抗性顯示與狀態計算）
  var nowSec = Math.floor((typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000);
  window._NOW_SEC = nowSec;  // 舊檔相容
  window.round    = nowSec;

  // 1) 玩家持續狀態
  if (typeof processPlayerStatusEffects === "function") processPlayerStatusEffects();

  // 2) 怪物持續狀態：拿事件 → 扣血 → 寫日誌 → 更新 UI
  if (currentMonster && typeof processMonsterStatusEffects === "function") {
    var out = processMonsterStatusEffects(currentMonster, player, nowSec);
    if (out && out.events && out.events.length) {
      for (var i = 0; i < out.events.length; i++) {
        var ev = out.events[i];
        if (ev.damage > 0) {
          // 唯一真實來源：扣 currentMonster.hp，並同步 monsterHP
          currentMonster.hp = Math.max(0, Number(currentMonster.hp || 0) - ev.damage);
          monsterHP = currentMonster.hp;

          // 寫到怪物框（或單框）
          if (window.LogDual && LogDual.monster) LogDual.monster(ev.text + "（HP：" + monsterHP + "）");
          else logPrepend(ev.text + "（HP：" + monsterHP + "）");

          if (monsterHP <= 0) break; // 被 DoT 擊殺就不用繼續列事件了
        }
      }
    }
  }

  // 3) 怪物自我 Buff（可能會改 currentMonster.hp）
  if (currentMonster && typeof processMonsterBuffs === "function") {
    processMonsterBuffs(currentMonster);
    monsterHP = Math.max(0, Number(currentMonster.hp || 0));
  }

  // 4) DoT 也可能擊殺：在滴答階段處理掉落/重生
  if (currentMonster && monsterHP <= 0) {
    if (typeof _onMonsterDead === "function") _onMonsterDead(nowSec);
    return;
  }

  // 5) 技能冷卻
  if (typeof reduceSkillCooldowns === "function") reduceSkillCooldowns();
  if (currentMonster) {
    var hasBossTick = typeof currentMonster._tickEndTurn === "function";
    if (hasBossTick) currentMonster._tickEndTurn(currentMonster);
    else if (typeof reduceMonsterSkillCooldowns === "function") reduceMonsterSkillCooldowns(currentMonster);
  }

  // 6) 輕量 UI（多帶 nowSec，讓抗性倒數顯示）
  if (typeof updateResourceUI === "function") updateResourceUI();
  if (currentMonster && typeof updateMonsterInfo === "function") {
    updateMonsterInfo(currentMonster, monsterHP, nowSec);
  }
}

// ===== 玩家出手（委派 Rpg_玩家；中控只做後續/掉落）=====
function rtPlayerAct() {
  if (isDead || !autoEnabled) return;
  if (window.BattleGate && window.BattleGate.isLocked && window.BattleGate.isLocked()) return;

  if (!currentMonster) {
    if (window.BattleGate && window.BattleGate.requestAutoSpawn) window.BattleGate.requestAutoSpawn();
    else if (typeof spawnNewMonster === "function") spawnNewMonster();
    return;
  }

  var r = (window.Rpg_玩家 && typeof Rpg_玩家.actOnce === "function") ? Rpg_玩家.actOnce() : { did:false };
  if (r && r.text) {
    // 技能 → 藍色
    if (r.text.includes("技能") || (r.text.includes("造成") && !r.text.includes("普通攻擊"))) {
      postPlayer(r.text); // LogDual.player(r.text, "skill") 也可；統一經 postPlayer
    } else {
      postPlayer(r.text);
    }
  }

  // 兼容舊檔：若玩家行動只改了 monsterHP，這裡同步回 currentMonster.hp
  if (currentMonster) {
    var cap = currentMonster.maxHp || Infinity;
    var hpFromLogic = Math.max(0, Math.min(cap, monsterHP));
    // 若外部已把 currentMonster.hp 改小，就採用較小者
    var hpFromSource = isFinite(currentMonster.hp) ? Math.max(0, Math.min(cap, Number(currentMonster.hp))) : hpFromLogic;
    var merged = Math.min(hpFromLogic, hpFromSource);
    currentMonster.hp = merged;
    monsterHP = merged;
  }
// 擊殺（普攻/技能）
if (currentMonster && monsterHP <= 0) {
  // 先把本次被打死的怪物旗標與名稱記起來（避免 _onMonsterDead() 重置）
  const wasElite = !!currentMonster.isElite;
  const wasBoss = !!currentMonster.isBoss;
  
  // 一般擊殺（全部怪都算）
  window.Achievements?.onKill?.(1);
  
  // 精英 / Boss 擊殺
  if (wasElite) window.Achievements?.onEliteKill?.(1);
  if (wasBoss) window.Achievements?.onBossKill?.(1);
  
  // 最後才做掉落/重生等流程
  _onMonsterDead(_nowSec());
  
  return;
}

  // 玩家死亡
  if (player.currentHP <= 0 && !isDead) {
    if (typeof startDeathCountdown === "function") startDeathCountdown();
    return;
  }

  // UI
  var nowSec = _nowSec();
  if (typeof updateResourceUI === "function") updateResourceUI();
  if (currentMonster && typeof updateMonsterInfo === "function") updateMonsterInfo(currentMonster, Math.max(monsterHP, 0), nowSec);
}

// ===== 怪物出手（委派 Rpg_怪物；中控只做後續）=====
function rtMonsterAct() {
  if (isDead || !autoEnabled) return;
  if (window.BattleGate && window.BattleGate.isLocked && window.BattleGate.isLocked()) return;
  if (!currentMonster) return;

  var r = (window.Rpg_怪物 && typeof Rpg_怪物.actOnce === "function") ? Rpg_怪物.actOnce() : { did:false };
  if (r && r.text) {
    if (r.text.includes("施放【")) postMonster(r.text); // 技能
    else postMonster(r.text);                            // 普攻
  }

  if (player.currentHP <= 0 && !isDead) {
    if (typeof startDeathCountdown === "function") startDeathCountdown();
    return;
  }

  var nowSec = _nowSec();
  if (typeof updateResourceUI === "function") updateResourceUI();
  if (currentMonster && typeof updateMonsterInfo === "function") updateMonsterInfo(currentMonster, Math.max(monsterHP, 0), nowSec);
}

// ===== 對外（供 game_init.js 呼叫）=====
window.spawnNewMonster = spawnNewMonster;
window.rtTickSec      = rtTickSec;
window.rtPlayerAct    = rtPlayerAct;
window.rtMonsterAct   = rtMonsterAct;

// 舊介面（回合制）保留空函式，避免外部誤呼叫報錯
window.battleRound = function(){ /* 即時制已取代回合制 */ };