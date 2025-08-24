// logic/rpg_multi.js
// 多體戰鬥（2~3 隻同場）完整版

// 依賴外部（若存在就會使用）：
// getMonster(area, range), getDrop(mon), gainExp(exp),
// logPrepend(text), logDrop(mon, drop), updateResourceUI(),
// buildMonsterInfoHTML(mon, hp), updateMonstersUI(),
// processPlayerStatusEffects(), applyMonsterStatusEffects(mon),
// processMonsterBuffs(mon), checkExpiredSkillBuffs(),
// reduceSkillCooldowns(), updateSkillStatusUI(), applyStatusFromMonster(mon),
// applyMonsterBuffEffects(mon), autoUseSkills(target)

// 提供給切換器識別目前模式
window.__isMultiMode = true;

// -------------------------------
// 全域狀態（多體）
// -------------------------------
let monsters = [];        // 場上怪物
let multiCount = 2;       // 2 或 3
let targetIndex = 0;      // 鎖定的怪索引
let multiRound = 1;       // ⚠️ 用不同名稱避免和單體 rpg.js 的 round 衝突
let multiIsDead = false;

// 多體平衡旋鈕（可調）
const MULTI_BALANCE = {
  perMonsterAtkScale: 0.75,   // 每隻怪輸出下修比
  totalDamageCapPct: 0.60,    // 單回合怪群總傷 ≤ 玩家最大HP的 60%
  maxMonstersActPerRound: 3,  // 每回合最多幾隻怪行動（3=全出手）
  actChance: 0.90,            // 每隻怪本回合的出手機率
  aoeSkillMultiplier: 0.65,   // 若有 AOE 技，可用這倍率對每隻怪下修
};

// -------------------------------
// 工具
// -------------------------------
function safeNumber(v, d=0){ v = Number(v); return Number.isFinite(v) ? v : d; }
function readBattleSelections(){
  const area  = document.getElementById("mapSelect")?.value || "all";
  const range = document.getElementById("levelRange")?.value || "1-10";
  return { area, range };
}
function getAliveMonsters(){ return monsters.filter(m => (m.hp || 0) > 0); }

// -------------------------------
// 生怪 / 控制
// -------------------------------
function spawnNewWave(){
  const { area, range } = readBattleSelections();
  monsters = [];
  for (let i=0; i<multiCount; i++){
    // 依你的 getMonster(area, range) 生成
    const mon = (typeof getMonster === "function") ? getMonster(area, range) : {
      name: `未知怪物`,
      level: 1, hp: 10, maxHp: 10, atk: 2, def: 1, baseExp: 5,
      dropRates: { gold:{min:1,max:3}, stone:{chance:0.05,min:1,max:1} }
    };
    // 兼容：確保 maxHp / hp / 名稱格式
    mon.maxHp = safeNumber(mon.maxHp ?? mon.hp, 1);
    mon.hp    = safeNumber(mon.hp, mon.maxHp);
    monsters.push(mon);
  }
  targetIndex = 0;

  // UI 同步
  if (typeof updateMonstersUI === "function") updateMonstersUI();
  if (typeof logPrepend === "function") {
    const names = monsters.map(m => `${m.name}`).join("、");
    logPrepend(`⚔️ 遭遇 ${names}`);
  }
}

function setMultiCount(n){
  multiCount = Math.min(Math.max(2, n), 3);
  spawnNewWave();
}

// 地圖 / 等級變更時，自動重抽（只在多體模式）
(function bindSelectAutoRespawn(){
  ["mapSelect","levelRange"].forEach(id=>{
    const el = document.getElementById(id);
    el?.addEventListener("change", () => {
      if (window.__isMultiMode) spawnNewWave();
    });
  });
})();

// -------------------------------
// 回合主流程（玩家 → 怪群）
// -------------------------------
function battleRoundMulti(){
  if (multiIsDead) return;

  const aliveNow = getAliveMonsters();
  if (aliveNow.length === 0){ spawnNewWave(); return; }

  // 回合開始：狀態/Buff
  if (typeof processPlayerStatusEffects === "function") processPlayerStatusEffects();
  for (const m of aliveNow){
    if (typeof applyMonsterStatusEffects === "function") applyMonsterStatusEffects(m);
    if (typeof processMonsterBuffs === "function")    processMonsterBuffs(m);
  }
  if (typeof checkExpiredSkillBuffs === "function") checkExpiredSkillBuffs();

  let actionText  = `第 ${multiRound} 回合：`;
  let playerLine  = "";
  let monsterLine = "";

  // 行動限制
  const frozen   = safeNumber(player?.statusEffects?.freeze, 0)   > 0;
  const paralyze = safeNumber(player?.statusEffects?.paralyze, 0) > 0;
  const cannotAct = frozen || paralyze;

  // 目標
  const alive = getAliveMonsters();
  const target = alive[Math.min(targetIndex, alive.length - 1)];

  // 玩家行動
  if (!cannotAct){
    const hpBefore = target.hp;
    const sr = (typeof autoUseSkills === "function") ? (autoUseSkills(target) || {used:false}) : {used:false};
    const dealt = sr.used ? safeNumber(sr.damage, Math.max(0, hpBefore - target.hp)) : 0;

    if (sr.used && dealt > 0){
      playerLine = `${sr.name || "技能"} 對 ${target.name} 造成 ${dealt} 傷害`;
    }else{
      // 普攻（鎖定目標）
      const buffed = (typeof applyMonsterBuffEffects === "function") ? (applyMonsterBuffEffects(target) || target) : target;
      const isCrit = Math.random() < safeNumber(player?.totalStats?.critRate, 0);
      const base   = Math.max(safeNumber(player?.totalStats?.atk,1) - safeNumber(buffed?.def,0), 1);
      let dmg      = isCrit ? Math.floor(base * (1 + safeNumber(player?.totalStats?.critMultiplier,0))) : base;

      // 盾
      if (safeNumber(target.shield, 0) > 0){
        const absorb = Math.min(dmg, target.shield);
        target.shield -= absorb;
        dmg -= absorb;
      }
      if (dmg > 0) target.hp -= dmg;
      playerLine = `${isCrit ? "爆擊" : "普通攻擊"} 對 ${target.name} 造成 ${dmg} 傷害`;
    }
  }else{
    playerLine = `你因${frozen ? "凍傷" : "麻痺"}無法行動`;
  }

  // 怪死亡 → 掉落/經驗
  for (let i=monsters.length-1; i>=0; i--){
    const m = monsters[i];
    if (m.hp <= 0){
      const drop = (typeof getDrop === "function") ? (getDrop(m) || {}) : {};
      player.gold  = safeNumber(player.gold,0)  + safeNumber(drop.gold,0);
      player.stone = safeNumber(player.stone,0) + safeNumber(drop.stone,0);
      if (typeof gainExp === "function") gainExp(safeNumber(drop.exp,0));
      if (typeof logDrop === "function") logDrop(m, drop);
      monsters.splice(i, 1);
    }
  }
  if (typeof updateResourceUI === "function") updateResourceUI();
  if (typeof updateMonstersUI === "function") updateMonstersUI();

  // 清場 → 結束本回合
  if (getAliveMonsters().length === 0){
    if (typeof logPrepend === "function") logPrepend(`${actionText}${playerLine}`);
    multiRound++;
    return;
  }

  // 怪群行動
  let totalDamageThisRound = 0;
  const dmgCap = Math.floor(safeNumber(player?.totalStats?.hp, 1) * MULTI_BALANCE.totalDamageCapPct);
  let acted = 0;
  const logs = [];

  for (const m of getAliveMonsters()){
    if (acted >= MULTI_BALANCE.maxMonstersActPerRound) break;

    if (m.paralyzed){ m.paralyzed = false; logs.push(`${m.name} 因麻痺跳過`); continue; }
    if (Math.random() > MULTI_BALANCE.actChance){ logs.push(`${m.name} 觀望中`); continue; }

    // 閃避
    const evaded = Math.random() * 100 < safeNumber(player?.dodgePercent, 0);
    if (evaded){ logs.push(`你成功閃避了 ${m.name}`); continue; }

    // 怪物技能
    if (m.extra?.skill){ try{ m.extra.skill(m); }catch(e){} }

    const buffed = (typeof applyMonsterBuffEffects === "function") ? (applyMonsterBuffEffects(m) || m) : m;
    let dmg = Math.max(safeNumber(buffed?.atk,1) - safeNumber(player?.totalStats?.def,0), 1);
    dmg = Math.floor(dmg * MULTI_BALANCE.perMonsterAtkScale);

    // 盾 → 減傷
    if (safeNumber(player?.shield, 0) > 0){
      const absorb = Math.min(player.shield, dmg);
      player.shield -= absorb;
      dmg -= absorb;
    }
    if (dmg > 0 && safeNumber(player?.damageReduce, 0) > 0){
      dmg -= Math.floor(dmg * (player.damageReduce / 100));
    }

    // 單回合總傷上限
    const room  = Math.max(0, dmgCap - totalDamageThisRound);
    const dealt = Math.min(dmg, room);
    totalDamageThisRound += dealt;
    player.currentHP = safeNumber(player.currentHP, 0) - dealt;

    logs.push(`${m.name} 造成 ${dealt} 傷害`);
    acted++;

    if (totalDamageThisRound >= dmgCap){ logs.push(`怪群總傷已達上限 ${dmgCap}`); break; }
    if (player.currentHP <= 0) break;

    // 施加狀態
    if (typeof applyStatusFromMonster === "function") applyStatusFromMonster(m);
  }
  monsterLine = logs.join("，");

  // 自然回復
  if (player.currentHP > 0){
    const recover = Math.floor(safeNumber(player?.totalStats?.hp, 0) * (safeNumber(player?.recoverPercent, 0) / 100));
    if (recover > 0){
      player.currentHP = Math.min(player.currentHP + recover, safeNumber(player?.totalStats?.hp, 0));
      monsterLine += `，你回復 ${recover}`;
    }
  }
  if (player.currentHP < 0) player.currentHP = 0;

  if (typeof updateResourceUI === "function") updateResourceUI();
  if (typeof updateMonstersUI === "function") updateMonstersUI();

  if (typeof logPrepend === "function"){
    logPrepend(`${actionText}${playerLine}，${monsterLine}`);
  }

  // 死亡與復活
  if (player.currentHP <= 0){
    multiIsDead = true;
    if (typeof logPrepend === "function") logPrepend(`💀 你被擊倒了！30 秒後復活`);

    let sec = 30;
    const timer = setInterval(() => {
      sec--;
      if (typeof logPrepend === "function") logPrepend(`⏳ 復活倒數：${sec} 秒`);
      if (sec <= 0){
        clearInterval(timer);
        player.currentHP = safeNumber(player?.totalStats?.hp, 1);
        multiIsDead = false;
        if (typeof logPrepend === "function") logPrepend(`❤️ 你已復活！`);
        if (typeof updateResourceUI === "function") updateResourceUI();
      }
    }, 1000);
    return;
  }

  // 收尾
  if (typeof reduceSkillCooldowns === "function") reduceSkillCooldowns();
  if (typeof updateSkillStatusUI === "function") updateSkillStatusUI();
  multiRound++;
}

// -------------------------------
// 啟動 / 停止多體戰鬥迴圈
// -------------------------------
function startMultiBattle(){
  window.__isMultiMode = true;
  if (window.__battleLoopId) clearInterval(window.__battleLoopId);
  if (!monsters.length) spawnNewWave();
  window.__battleLoopId = setInterval(battleRoundMulti, 1000); // 每秒一回合
}

function stopMultiBattle(){
  window.__isMultiMode = false;
  if (window.__battleLoopId){
    clearInterval(window.__battleLoopId);
    window.__battleLoopId = null;
  }
}

// 自動啟動（載入此檔時）
startMultiBattle();

// 讓切換器可呼叫
window.setMultiCount     = setMultiCount;
window.spawnNewWave      = spawnNewWave;
window.startMultiBattle  = startMultiBattle;
window.stopMultiBattle   = stopMultiBattle;
window.getAliveMonsters  = getAliveMonsters;