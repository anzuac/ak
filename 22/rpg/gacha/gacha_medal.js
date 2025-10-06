// gacha_medal.js —— 怪物獎牌抽獎（10牌/抽，純記憶體，不存檔）
// 依賴：getItemQuantity/removeItem/addItem、player.gold、player.stone、player.gem、logPrepend、updateResourceUI

(function () {
  const MEDAL_NAME = "怪物獎牌";
  const COST_PER_PULL = 10;

  // 工具
  const roll = (p) => Math.random() < p;
  const randint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  // 權重池（總和=1）。可自行微調。
  const POOL = [
  { name: "強化石", type: "stone", min: 100, max: 1000, prob: 0.32 },
  { name: "楓幣", type: "gold", min: 1000, max: 10000, prob: 0.32 },
  { name: "鑽石", type: "gem", min: 5, max: 100, prob: 0.03 }, // 低機率
  { name: "技能強化券", type: "item", key: "技能強化券", min: 1, max: 1, prob: 0.03 },
  { name: "低階潛能解放鑰匙", type: "item", key: "低階潛能解放鑰匙", min: 3, max: 15, prob: 0.09 },
  { name: "中階潛能解放鑰匙", type: "item", key: "中階潛能解放鑰匙", min: 2, max: 8, prob: 0.06 },
  { name: "高階潛能解放鑰匙", type: "item", key: "高階潛能解放鑰匙", min: 1, max: 4, prob: 0.02 },
  { name: "SP點數券", type: "item", key: "sp點數券", min: 1, max: 2, prob: 0.13 },
];
  // 正規化
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
    // 浮點邊界保險
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

  // === 內部 UI 工具：寫入抽獎結果到彈窗 ===
  function writeResultLine(html) {
    const box = document.getElementById("medalGachaResult");
    if (!box) return;
    // 第一次移除預設提示
    if (box.firstElementChild && box.firstElementChild.classList?.contains("empty")) {
      box.firstElementChild.remove();
    }
    // 時間戳
    const t = new Date();
    const hh = String(t.getHours()).padStart(2, "0");
    const mm = String(t.getMinutes()).padStart(2, "0");
    const ss = String(t.getSeconds()).padStart(2, "0");

    const row = document.createElement("div");
    row.className = "medal-row";
    row.innerHTML = `<span class="ts">[${hh}:${mm}:${ss}]</span> ${html}`;
    box.prepend(row);
  }

  function clearResults() {
    const box = document.getElementById("medalGachaResult");
    if (!box) return;
    box.innerHTML = `<div class="empty" style="opacity:.6;">結果會顯示在這裡</div>`;
  }

  // ===== 對外 API =====
  function medalGachaOnce() {
    if (!canSpend(1)) { alert(`需要 ${COST_PER_PULL} 個「${MEDAL_NAME}」`); return; }
    spend(1);
    const r = rollOne();
    grant(r);
    updateResourceUI?.();

    // 寫戰鬥日誌
    logPrepend?.(`🎖️ 使用 ${MEDAL_NAME} 抽獎：獲得「${r.name} × ${r.qty}」`);

    // 寫入彈窗結果歷史
    writeResultLine(`單抽：<b>${r.name} × ${r.qty}</b>`);
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

    // 寫戰鬥日誌
    logPrepend?.(`🌟 十連結果：${results.join("、")}`);

    // 寫入彈窗結果歷史
    writeResultLine(`十連：${results.map(s => `<b>${s}</b>`).join("、")}`);
    return results;
  }

  function openMedalGachaModal() {
    const id = "medalGachaModal";
    document.getElementById(id)?.remove();

    const bg = document.createElement("div");
    bg.id = id;
    bg.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9998;
      display:flex;align-items:center;justify-content:center;
    `;
    bg.innerHTML = `
      <div style="background:#222;color:#fff;padding:16px;border-radius:12px;width:360px;max-width:90vw;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
          <div style="font-size:18px;">🎰 怪物獎牌抽獎</div>
          <button onclick="document.getElementById('${id}').remove()"
                  style="background:#3a3a3a;color:#fff;border:1px solid #555;border-radius:6px;padding:6px 10px;cursor:pointer;">
            關閉
          </button>
        </div>

        <div style="font-size:13px;opacity:.85;margin-bottom:10px;line-height:1.5;">
          消耗：每抽「${COST_PER_PULL}」個〈${MEDAL_NAME}〉。<br>
          可能獎勵：強化石(100~1000)、楓幣(1000~10000)、鑽石(5~100, )、SP點數券、
          技能強化券(低機率)、低/中/高階潛能解放鑰匙。
        </div>

        <div style="display:flex;gap:8px;margin-top:8px;">
          <button id="btnMedalOne" style="flex:1;padding:10px;border-radius:8px;border:1px solid #5765a0;background:#2d3463;color:#fff;cursor:pointer;">
            單抽
          </button>
          <button id="btnMedalTen" style="flex:1;padding:10px;border-radius:8px;border:1px solid #6b8f5b;background:#2f4f2f;color:#fff;cursor:pointer;">
            十連
          </button>
        </div>

        <!-- 結果歷史（可滾動） -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;margin-bottom:6px;">
          <div style="font-weight:700;">抽獎結果</div>
          <button id="btnClearMedalResult"
                  style="background:#3a3a3a;color:#fff;border:1px solid #555;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;">
            清空結果
          </button>
        </div>

        <div id="medalGachaResult"
             style="margin-top:4px;background:#111;padding:8px;border-radius:8px;min-height:40px;font-size:13px;opacity:.95;
                    max-height:180px;overflow-y:auto;border:1px solid #2b2b3b;">
          <div class="empty" style="opacity:.6;">結果會顯示在這裡</div>
        </div>

        <style>
          /* 只影響本彈窗內結果列的樣式 */
          #${id} .medal-row { padding:4px 0; border-bottom:1px dashed #2e2e2e; }
          #${id} .medal-row:last-child { border-bottom:none; }
          #${id} .medal-row .ts { color:#aab; font-size:12px; margin-right:6px; }
          #${id} b { color:#fff; }
        </style>
      </div>
    `;
    document.body.appendChild(bg);

    // 綁定按鈕
    document.getElementById("btnMedalOne").onclick = medalGachaOnce;
    document.getElementById("btnMedalTen").onclick = medalGachaTen;
    document.getElementById("btnClearMedalResult").onclick = clearResults;
  }

  // 暴露到全域
  window.openMedalGachaModal = openMedalGachaModal;
  window.medalGachaOnce = medalGachaOnce;
  window.medalGachaTen  = medalGachaTen;
})();