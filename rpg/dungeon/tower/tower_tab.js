// dungeon/tower_tab.js — 試煉塔 UI 分頁
(function () {
  if (!window.DungeonHub || !window.TowerConfig || !window.TowerCore) return;

  DungeonHub.registerTab({
    id: "tower",
    title: "試煉塔",
    render: function(container){
      const prog = window.TowerCore.prog;
      const stage = prog.current;
      const s = TowerConfig.buildStage(stage);

      container.innerHTML = `
        <div style="border:1px solid #243247;background:#0b1220;border-radius:10px;padding:12px;">
          <div style="font-weight:800;font-size:16px;margin-bottom:4px">🏰 ${TowerConfig.BASE.name}</div>
          <div style="font-size:12px;opacity:.8">${TowerConfig.BASE.desc}</div>
          <hr style="margin:8px 0;border-color:#334155;">
          <div>目前層數：<b>${prog.current}</b>　最高層：<b>${prog.best}</b></div>
          <div style="margin-top:6px;font-size:13px">下一層敵人：${s.enemy.name}</div>
          <div style="margin-top:6px;font-size:12px;opacity:.9">
            ATK ${s.enemy.atk} / DEF ${s.enemy.def} / HP ${s.enemy.hp}
          </div>
          <div style="margin-top:8px;font-size:12px;opacity:.9">
            預期獎勵：金幣 ${s.rewards.gold[0]}~${s.rewards.gold[1]}、元素碎片 ${s.rewards.shard[0]}~${s.rewards.shard[1]}
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button id="towerStart" style="padding:8px 12px;border:0;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer">開始挑戰</button>
            <button id="towerReset" style="padding:8px 12px;border:0;border-radius:8px;background:#6b21a8;color:#fff;cursor:pointer">重置進度</button>
          </div>
        </div>
      `;

      const startBtn = container.querySelector("#towerStart");
      const resetBtn = container.querySelector("#towerReset");

      if (startBtn) startBtn.onclick = function(){
        if (window.autoEnabled){ alert("請先停止外部戰鬥再進入試煉塔"); return; }
        DungeonHub.close();
        TowerCore.start(stage);
      };

      if (resetBtn) resetBtn.onclick = function(){
        if (confirm("是否重置試煉塔進度？")){
          TowerCore.prog = { current:1, best:0 };
          localStorage.setItem("tower_progress_v1", JSON.stringify(TowerCore.prog));
          DungeonHub.requestRerender();
        }
      };
    }
  });
})();