// gacha_diamond.js
// 鑽石抽獎：使用 1 張「鑽石抽獎券」隨機抽取鑽石
// 依賴：getItemQuantity / removeItem / player.gem / updateResourceUI / saveGame / (可選)logPrepend

(function () {
  const TICKET = "鑽石抽獎券";

  function closeDiamondGacha() {
    document.getElementById("diamond-gacha-modal")?.remove();
    document.getElementById("diamond-gacha-backdrop")?.remove();
  }

  // 小工具：把一行結果寫到彈窗歷史框（含時間戳）
  function writeResultLine(html) {
    const box = document.getElementById("diamondGachaResult");
    if (!box) return;
    if (box.firstElementChild && box.firstElementChild.classList?.contains("empty")) {
      box.firstElementChild.remove();
    }
    const t = new Date();
    const hh = String(t.getHours()).padStart(2, "0");
    const mm = String(t.getMinutes()).padStart(2, "0");
    const ss = String(t.getSeconds()).padStart(2, "0");
    const row = document.createElement("div");
    row.className = "diamond-row";
    row.innerHTML = `<span class="ts">[${hh}:${mm}:${ss}]</span> ${html}`;
    box.prepend(row);
  }

  function clearResults() {
    const box = document.getElementById("diamondGachaResult");
    if (!box) return;
    box.innerHTML = `<div class="empty" style="opacity:.6;">結果會顯示在這裡</div>`;
  }

  function openDiamondGachaModal() {
    // 關舊視窗
    closeDiamondGacha();

    // 背景
    const backdrop = document.createElement("div");
    backdrop.id = "diamond-gacha-backdrop";
    backdrop.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:998;
    `;
    backdrop.onclick = closeDiamondGacha;

    // 視窗
    const modal = document.createElement("div");
    modal.id = "diamond-gacha-modal";
    modal.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%, -50%);
      width:min(90vw, 320px);
      background:#1f1f1f; color:#fff; padding:16px;
      border-radius:12px; border:1px solid #666; z-index:999;
    `;
    modal.addEventListener("click", (e) => e.stopPropagation());

    modal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
        <h3 style="margin:0;font-size:18px;">💎 鑽石抽獎</h3>
        <button id="diamond-close-btn"
                style="background:#3a3a3a;color:#fff;border:1px solid #555;border-radius:6px;padding:6px 10px;cursor:pointer;">
          關閉
        </button>
      </div>

      <div style="font-size:13px;opacity:.85;margin-bottom:10px;line-height:1.5;">
        需要 <b>1 張「${TICKET}」</b> 才能抽獎。
      </div>

      <div style="display:flex;gap:8px;">
        <button id="diamond-draw-btn"
                style="flex:1;padding:10px;border-radius:8px;border:1px solid #5a6cb6;background:#2d3463;color:#fff;cursor:pointer;">
          抽一次
        </button>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;margin-bottom:6px;">
        <div style="font-weight:700;">抽獎結果</div>
        <button id="diamond-clear-btn"
                style="background:#3a3a3a;color:#fff;border:1px solid #555;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;">
          清空結果
        </button>
      </div>

      <!-- 歷史（可滾動） -->
      <div id="diamondGachaResult"
           style="margin-top:4px;background:#111;padding:8px;border-radius:8px;min-height:40px;font-size:13px;opacity:.95;
                  max-height:180px;overflow-y:auto;border:1px solid #2b2b3b;">
        <div class="empty" style="opacity:.6;">結果會顯示在這裡</div>
      </div>

      <style>
        /* 只影響本彈窗內結果列 */
        #diamond-gacha-modal .diamond-row { padding:4px 0; border-bottom:1px dashed #2e2e2e; }
        #diamond-gacha-modal .diamond-row:last-child { border-bottom:none; }
        #diamond-gacha-modal .diamond-row .ts { color:#aab; font-size:12px; margin-right:6px; }
        #diamond-gacha-modal b { color:#fff; }
      </style>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    // 綁定
    document.getElementById("diamond-close-btn").onclick = closeDiamondGacha;
    document.getElementById("diamond-clear-btn").onclick = clearResults;

    document.getElementById("diamond-draw-btn").onclick = () => {
      if ((getItemQuantity?.(TICKET) || 0) < 1) {
        alert(`需要 1 張『${TICKET}』！`);
        return;
      }
      removeItem?.(TICKET, 1);

      // 機率表（與你原版相同）
      const x = Math.random() * 100;
      let reward = 1;
      if (x < 1) {          // 1%
        reward = 100;
      } else if (x < 4) {   // +3% => 3%
        reward = 50;
      } else if (x < 20) {  // +16%
        reward = 10;
      } else if (x < 50) {  // +30%
        reward = 5;
      } // else 50% -> 1

      player.gem = (player.gem || 0) + reward;

      // 寫到彈窗歷史 + 戰鬥日誌
      writeResultLine(`🎉 獲得 <b>${reward}</b> 顆鑽石`);
      logPrepend?.(`💎 鑽石抽獎：獲得 鑽石 × ${reward}`);

      updateResourceUI?.();
      saveGame?.();
    };
  }

  // 只把開啟函數掛到全域就好
  window.openDiamondGachaModal = openDiamondGachaModal;
})();