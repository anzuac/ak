// dungeon/tower_core.js — 試煉塔挑戰控制器
(function (w) {
  "use strict";

  if (!w.TowerConfig) return console.error("TowerConfig 未載入");

  const KEY = "tower_progress_v1";

  function load(){
    try { return JSON.parse(localStorage.getItem(KEY)) || {current:1,best:0}; }
    catch(_) { return {current:1,best:0}; }
  }
  function save(p){ try{ localStorage.setItem(KEY, JSON.stringify(p)); }catch(_){ } }

  const TowerCore = {
    prog: load(),

    get current(){ return this.prog.current || 1; },
    get best(){ return this.prog.best || 0; },

    start(stage){
      const s = w.TowerConfig.buildStage(stage);
      const rewardsView = [{ type:"text", key:"預期獎勵", qty:"—" }];

      let rewarded = false;

      const hooks = {
        onResult: ({ctx, state}) => {
          if (state === "win" && !rewarded){
            rewarded = true;
            const got = TowerCore.giveRewards(s.rewards);
            TowerCore.prog.current = stage + 1;
            TowerCore.prog.best = Math.max(TowerCore.prog.best, stage);
            save(TowerCore.prog);
            TowerCore.log(`🏆 通過第 ${stage} 層，獲得 ${got}`);
            TowerCore.askNext(stage + 1);
          }
        }
      };

      w.DungeonBattle?.start({
        title: `${s.name}`,
        monster: s.enemy,
        rewards: rewardsView,
        timeLimitSec: 0,
        hooks,
        onFinish: (res) => { if (res.state!=="win") TowerCore.fail(stage); }
      });
    },

    giveRewards(r){
      const got = [];
      const roll = ([a,b])=>Math.floor(Math.random()*(b-a+1))+a;
      if (r.gold){ const n=roll(r.gold); w.player.gold=(w.player.gold||0)+n; got.push(`金幣×${n}`); }
      if (r.shard){ const n=roll(r.shard);
        if (typeof w.addItem==="function") w.addItem("元素碎片", n);
        else { w.player._bag=w.player._bag||{}; w.player._bag["元素碎片"]=(w.player._bag["元素碎片"]||0)+n; }
        got.push(`元素碎片×${n}`);
      }
      w.updateResourceUI?.();
      return got.join("、");
    },

    askNext(nextStage){
      if (nextStage > w.TowerConfig.LEVEL.MAX_STAGE) {
        alert("🎉 恭喜！已通過試煉塔所有關卡！");
        return;
      }
      if (confirm(`是否繼續挑戰第 ${nextStage} 層？`)){
        this.start(nextStage);
      } else {
        w.DungeonHub.open("tower");
      }
    },

    fail(stage){
      this.log(`💀 在第 ${stage} 層挑戰失敗`);
      w.DungeonHub.open("tower");
    },

    log(msg){ w.logPrepend?.(msg); }
  };

  w.TowerCore = TowerCore;
})(window);