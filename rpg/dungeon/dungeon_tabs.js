// dungeon_tabs.js — 註冊「挑戰列表」分頁（挑戰券/擴充/即時制 + 勝利顯示並發獎）
(function(){
  if (!window.DungeonHub) return; // 容器未載入就不註冊

  // ====== 副本挑戰券（獨立系統）======
  var STORE_KEY = "dungeon_ticket_v1";
  var PERIOD_MS = 30 * 60 * 1000; // 30 分
  var DEFAULT_CAP = 20;
  var EXPAND_COST_GEM = 100;      // ★ 每次 100 鑽
  var EXPAND_DELTA = 5;           // ★ 上限 +5
  var TICKET_NAME = "副本挑戰券";

  var ticket = { count: 0, cap: DEFAULT_CAP, lastTs: Date.now() };

  function loadTicket(){
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var obj = JSON.parse(raw);
        ticket.count = Math.max(0, Number(obj.count)||0);
        ticket.cap   = Math.max(1, Number(obj.cap)||DEFAULT_CAP);
        ticket.lastTs= Number(obj.lastTs)||Date.now();
      }
    } catch(_) {}
    refillTicket(); // 進場先補
  }
  function saveTicket(){
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(ticket));
    } catch(_) {}
  }
  function refillTicket(now){
    now = now || Date.now();
    if (ticket.count >= ticket.cap) { ticket.lastTs = now; saveTicket(); return; }
    var elapsed = Math.max(0, now - ticket.lastTs);
    var add = Math.floor(elapsed / PERIOD_MS);
    if (add > 0) {
      var room = ticket.cap - ticket.count;
      var gain = Math.min(add, room);
      ticket.count += gain;
      ticket.lastTs += gain * PERIOD_MS; // 推進 lastTs
      saveTicket();
    }
  }
  function timeToNext(now){
    now = now || Date.now();
    if (ticket.count >= ticket.cap) return 0;
    var elapsed = Math.max(0, now - ticket.lastTs);
    var left = PERIOD_MS - (elapsed % PERIOD_MS);
    return left;
  }
  function fmtClock(ms){
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return m + ":" + String(ss).padStart(2, "0");
  }

  function tryExpandCap(){
    var need = EXPAND_COST_GEM;
    var have = Number(window.player?.gem || 0);
    if (have < need) { alert(`需要 ${need} 鑽石`); return; }
    if (!confirm(`花費 ${need} 鑽石將上限 +${EXPAND_DELTA}，並贈送 1 張「${TICKET_NAME}」\n是否確認？`)) return;
    // 扣鑽 + 擴充 + 贈 1
    player.gem = Math.max(0, have - need);
    ticket.cap += EXPAND_DELTA;
    ticket.count = Math.min(ticket.cap, ticket.count + 1);
    saveTicket();
    window.updateResourceUI?.();
    window.logPrepend?.(`🧾 已擴充「${TICKET_NAME}」上限至 ${ticket.cap}，並獲得 1 張`);
    DungeonHub.requestRerender();
  }

  // ====== 關卡資料（★ 怪物速度可用 ms / aps / speedPct 三擇一）======
  // rewardView：展示範圍；rewardRoll：實際擲定範圍（入場前擲定，但勝利時才入庫）
  var DUNGEONS = [
    {
      id: 'trial1',
      name: '🔥 試煉之間 I',
      desc: '入門 Boss，無限時',
      // ★ 怪物攻速：這裡示範每秒 1.25 次（~800ms/次）
      monster: { name:'炎之魔像', atk: 0, def: 0, hp: 100, aps: 1.25 },
      rewardView: { gold:[12000,18000], stone:[180,360], shard:[1,2] },
      rewardRoll: { gold:[12000,18000], stone:[180,360], shard:[1,2] }
    },
    {
      id: 'trial2',
      name: '❄️ 試煉之間 II',
      desc: '稍強，限時 90 秒',
      timeLimitSec: 90,
      // ★ 這裡示範固定毫秒（ms）1000ms/次
      monster: { name:'冰霜巨像', atk: 680, def: 180, hp: 30000, ms: 1000 },
      rewardView: { gold:[22000,36000], stone:[320,640], shard:[2,3] },
      rewardRoll: { gold:[22000,36000], stone:[320,640], shard:[2,3] }
    }
  ];

  // ====== 獎勵工具 ======
  function randInt(a,b){ a=Math.floor(a); b=Math.floor(b); return Math.floor(Math.random()*(b-a+1))+a; }
  // 入場前擲定一組實際獎勵，回傳 {gold, stone, shard}
  function rollDungeonRewards(rng){
    return {
      gold:  randInt(rng.gold[0],  rng.gold[1]),
      stone: randInt(rng.stone[0], rng.stone[1]),
      shard: randInt(rng.shard[0], rng.shard[1])
    };
  }
  // 真正派發入庫（勝利時呼叫）
  function grantDungeonRewards(rolled, name){
    var g = rolled.gold, s = rolled.stone, p = rolled.shard;
    // 入庫
    window.player.gold  = (window.player.gold||0)  + g;
    window.player.stone = (window.player.stone||0) + s;
    if (typeof window.addItem === "function") window.addItem("元素碎片", p);
    else {
      window.player._bag = window.player._bag || {};
      window.player._bag["元素碎片"] = (window.player._bag["元素碎片"]||0) + p;
    }
    window.updateResourceUI?.();
    window.logPrepend?.(`🏆 通關 ${name}：獲得 金幣×${g.toLocaleString()}、強化石×${s.toLocaleString()}、元素碎片×${p}`);
    return { gold:g, stone:s, shard:p };
  }
  function rewardsText(v){
    return `金幣 ${v.gold[0].toLocaleString()}~${v.gold[1].toLocaleString()}、`+
           `強化石 ${v.stone[0].toLocaleString()}~${v.stone[1].toLocaleString()}、`+
           `元素碎片 ${v.shard[0]}~${v.shard[1]}`;
  }

  // ====== UI ======
  function cardHTML(d){
    var vtxt = rewardsText(d.rewardView);
    return `
      <div style="border:1px solid #2b344a;background:#0b1220;border-radius:10px;padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div style="font-weight:700">${d.name}</div>
          ${d.timeLimitSec ? `<div style="font-size:12px;opacity:.85">限時 ${d.timeLimitSec}s</div>` : ``}
        </div>
        <div style="opacity:.9;font-size:12px;margin:4px 0 6px">${d.desc || ''}</div>
        <div style="font-size:12px;opacity:.9">敵方：ATK ${d.monster.atk} / DEF ${d.monster.def} / HP ${d.monster.hp.toLocaleString()}</div>
        <div style="font-size:12px;opacity:.95;margin-top:4px">
          獎勵：${vtxt}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button data-id="${d.id}" class="btn-enter"
                  style="padding:6px 10px;border:0;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer">
            進入（消耗：${TICKET_NAME} ×1）
          </button>
        </div>
      </div>
    `;
  }

  function headerHTML(){
    // 先做一次補充（每次重繪都會嘗試）
    refillTicket();

    var now = Date.now();
    var left = timeToNext(now);
    var leftTxt = (ticket.count >= ticket.cap) ? "已滿" : ("+" + fmtClock(left));
    return `
      <div style="border:1px solid #243247;background:#0b1220;border-radius:10px;padding:10px;display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div style="font-size:14px">
          <b>${TICKET_NAME}</b>：<span style="font-weight:800">${ticket.count}</span> / ${ticket.cap}
          <span style="font-size:12px;opacity:.8;margin-left:6px">（每 30 分復原 1）</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:12px;opacity:.9">下次回復：${leftTxt}</div>
          <button id="btnExpandTicket" style="padding:6px 10px;border:0;border-radius:8px;background:#6b21a8;color:#fff;cursor:pointer">
            擴充上限（-${EXPAND_COST_GEM}💎 / +${EXPAND_DELTA}）+ 贈1
          </button>
        </div>
      </div>
    `;
  }

  DungeonHub.registerTab({
    id: 'trial',
    title: '挑戰',
    render: function(container){
      // 每次重繪先做補充/載入
      loadTicket();
      container.innerHTML = `
        ${headerHTML()}
        <div style="display:grid;gap:10px;margin-top:10px">
          ${DUNGEONS.map(cardHTML).join('')}
        </div>
      `;

      // 擴充按鈕
      var btnEx = container.querySelector('#btnExpandTicket');
      if (btnEx) btnEx.onclick = tryExpandCap;

      // 綁定進入
      var btns = container.querySelectorAll('.btn-enter');
      for (var i=0;i<btns.length;i++){
        btns[i].onclick = function(){
          var id = this.getAttribute('data-id');
          var d = DUNGEONS.find(x=>x.id===id);
          if (!d) return;

          // 先補一次 & 檢查券
          refillTicket();
          if (ticket.count <= 0) { alert(`需要 ${TICKET_NAME} ×1`); return; }

          // ★ 入場前擲定「本局實際獎勵」
          var rolled = rollDungeonRewards(d.rewardRoll);
          // 給戰鬥 UI 顯示的獎勵（勝利畫面會列出）
          var rewardListForUI = [
            { type:'item', key:'金幣',     qty: rolled.gold  },
            { type:'item', key:'強化石',   qty: rolled.stone },
            { type:'item', key:'元素碎片', qty: rolled.shard }
          ];

          // 開戰（勝利才扣券 + 真正入庫）
          DungeonHub.close();
          window.DungeonBattle?.start({
            title: d.name,
            monster: d.monster,            // ★ 會被 dungeon_battle_core.js 讀到 ms/aps/speedPct
            timeLimitSec: d.timeLimitSec || 0,
            rewards: rewardListForUI,      // 只用於勝利畫面顯示
            onFinish: function(res){
              if (res.state === 'win') {
                // 勝利：扣 1 張 + 將 rolled 入庫
                ticket.count = Math.max(0, ticket.count - 1);
                saveTicket();
                grantDungeonRewards(rolled, d.name);
                window.saveGame?.();
              } else {
                // 失敗/退出：不扣券、不發獎
              }
            }
          });
        };
      }
    }
  });
})();