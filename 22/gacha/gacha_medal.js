// gacha_medal.js —— 怪物獎牌抽獎（10牌/抽，純記憶體，不存檔）
// 依賴：getItemQuantity/removeItem/addItem、player.gold、player.stone、player.gem、logPrepend、updateResourceUI

(function () {
  const MEDAL_NAME = "怪物獎牌";
  const COST_PER_PULL = 10;

  // 工具
  const roll = (p) => Math.random() < p;
  const randint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  // 權重池（總和=1）。可自行微調。
  // 低機率：鑽石、技能強化券
  // 其餘平均分布但稍微偏向強化石/楓幣為主掉
  const POOL = [
    // name                  type       range        prob
    { name: "強化石",       type: "stone",  min: 100, max: 1000, prob: 0.38 },
    { name: "楓幣",         type: "gold",   min: 1000, max: 10000, prob: 0.38 },
    { name: "鑽石",         type: "gem",    min: 5,    max: 100,   prob: 0.04 }, // 低機率
    { name: "技能強化券",   type: "item",   key: "技能強化券", min: 1, max: 1, prob: 0.03 }, // 低機率 (1張)
    { name: "低階潛能解放鑰匙", type: "item", key: "低階潛能解放鑰匙", min: 3, max: 15, prob: 0.09 },
    { name: "中階潛能解放鑰匙", type: "item", key: "中階潛能解放鑰匙", min: 2, max: 8,  prob: 0.06 },
    { name: "高階潛能解放鑰匙", type: "item", key: "高階潛能解放鑰匙", min: 1, max: 4,  prob: 0.02 },
  ];
  // 把機率正規化（保險）
  const totalProb = POOL.reduce((s, x) => s + x.prob, 0);
  POOL.forEach(x => x._prob = x.prob / totalProb);

  function rollOne() {
    const x = Math.random();
    let acc = 0;
    for (const it of POOL) {
      acc += it._prob;
      if (x <= acc) {
        const qty = randint(it.min, it.max);
        return { ...it, qty };
      }
    }
    // 萬一浮點邊界，回傳最後一個
    const it = POOL[POOL.length - 1];
    return { ...it, qty: randint(it.min, it.max) };
  }

  function grant(r) {
    if (!r) return;
    switch (r.type) {
      case "gold":
        player.gold = (player.gold || 0) + r.qty;
        break;
      case "stone":
        player.stone = (player.stone || 0) + r.qty;
        break;
      case "gem":
        player.gem = (player.gem || 0) + r.qty;
        break;
      case "item":
        if (typeof addItem === "function") addItem(r.key, r.qty);
        else {
          // 簡易背包備援
          player._bag = player._bag || {};
          player._bag[r.key] = (player._bag[r.key] || 0) + r.qty;
        }
        break;
    }
  }

  function canSpend(times = 1) {
    const need = COST_PER_PULL * times;
    const have = (typeof getItemQuantity === "function") ? getItemQuantity(MEDAL_NAME) : 0;
    return have >= need;
  }

  function spend(times = 1) {
    const need = COST_PER_PULL * times;
    if (typeof removeItem === "function") removeItem(MEDAL_NAME, need);
  }

  // ===== 對外 API =====
  function medalGachaOnce() {
    if (!canSpend(1)) { alert(`需要 ${COST_PER_PULL} 個「${MEDAL_NAME}」`); return; }
    spend(1);
    const r = rollOne();
    grant(r);
    updateResourceUI?.();
    logPrepend?.(`🎖️ 使用 ${MEDAL_NAME} 抽獎：獲得「${r.name} × ${r.qty}」`);
    return r;
  }

  function medalGachaTen() {
    if (!canSpend(10)) { alert(`需要 ${COST_PER_PULL * 10} 個「${MEDAL_NAME}」`); return; }
    spend(10);
    const results = [];
    for (let i = 0; i < 10; i++) {
      const r = rollOne();
      grant(r);
      results.push(`${r.name} × ${r.qty}`);
    }
    updateResourceUI?.();
    logPrepend?.(`🌟 十連結果：${results.join("、")}`);
    return results;
  }

  function openMedalGachaModal() {
    const id = "medalGachaModal";
    document.getElementById(id)?.remove();
    const bg = document.createElement("div");
    bg.id = id;
    bg.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9998;display:flex;align-items:center;justify-content:center;`;
    bg.innerHTML = `
      <div style="background:#222;color:#fff;padding:16px;border-radius:10px;width:320px;">
        <div style="font-size:18px;margin-bottom:8px;">🎰 怪物獎牌抽獎</div>
        <div style="font-size:13px;opacity:.85;margin-bottom:8px;">
          消耗：每抽「${COST_PER_PULL}」個〈${MEDAL_NAME}〉。<br>
          可能獎勵：強化石(100~1000)、楓幣(1000~10000)、鑽石(5~100, 低機率)、
          技能強化券(低機率)、低/中/高階潛能解放鑰匙。
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button id="btnMedalOne" style="flex:1;padding:8px;">單抽</button>
          <button id="btnMedalTen" style="flex:1;padding:8px;">十連</button>
        </div>
        <div style="text-align:right;margin-top:8px;">
          <button onclick="document.getElementById('${id}').remove()">關閉</button>
        </div>
      </div>
    `;
    document.body.appendChild(bg);
    document.getElementById("btnMedalOne").onclick = medalGachaOnce;
    document.getElementById("btnMedalTen").onclick = medalGachaTen;
  }

  // 暴露到全域
  window.openMedalGachaModal = openMedalGachaModal;
  window.medalGachaOnce = medalGachaOnce;
  window.medalGachaTen  = medalGachaTen;
})();