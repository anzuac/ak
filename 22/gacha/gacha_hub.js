// gacha/gacha_hub.js
// 抽獎總入口（轉盤 Hub）：集中所有抽獎按鈕

(function () {
  function ensureStyle() {
    if (document.getElementById("gacha-hub-style")) return;
    const style = document.createElement("style");
    style.id = "gacha-hub-style";
    style.textContent = `
      .gacha-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.55);
        z-index: 998;
      }
      .gacha-modal {
        position: fixed;
        z-index: 999;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(90vw, 320px);
        background: #1f1f1f;
        color: #fff;
        border: 1px solid #555;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,.4);
      }
      .gacha-modal h3 {
        margin: 0 0 12px;
        font-size: 18px;
        text-align: center;
      }
      .gacha-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 10px 0 12px;
      }
      .gacha-btn {
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid #444;
        background: #2b2b2b;
        color: #fff;
        cursor: pointer;
        text-align: left;
      }
      .gacha-btn:hover { background: #353535; }
      .gacha-desc {
        font-size: 12px;
        opacity: .8;
        margin-top: 2px;
      }
      .gacha-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;
      }
      .gacha-actions button {
        padding: 8px 14px;
        border-radius: 10px;
        border: 1px solid #444;
        cursor: pointer;
      }
      .gacha-close {
        background: #3a3a3a;
        color: #fff;
      }
      .gacha-close:hover { background: #454545; }
    `;
    document.head.appendChild(style);
  }

  function closeGachaHub() {
    document.getElementById("gacha-hub-modal")?.remove();
    document.getElementById("gacha-hub-backdrop")?.remove();
  }

  function openGachaHub() {
    ensureStyle();

    // 背景
    const backdrop = document.createElement("div");
    backdrop.id = "gacha-hub-backdrop";
    backdrop.className = "gacha-modal-backdrop";
    backdrop.addEventListener("click", closeGachaHub);

    // 視窗
    const modal = document.createElement("div");
    modal.id = "gacha-hub-modal";
    modal.className = "gacha-modal";
    modal.addEventListener("click", (e) => e.stopPropagation()); // 阻止事件穿透

    modal.innerHTML = `
      <h3>🎰 抽獎轉盤</h3>
      <div class="gacha-list" id="gacha-hub-list"></div>
      <div class="gacha-actions">
        <button class="gacha-close" onclick="window.closeGachaHub()">關閉</button>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    // 動態建立抽獎入口
    const list = modal.querySelector("#gacha-hub-list");

    // 1) 怪物獎牌抽獎
    const medalBtn = document.createElement("button");
    medalBtn.className = "gacha-btn";
    medalBtn.innerHTML = `
      <div>🎖️ 怪物獎牌抽獎</div>
      <div class="gacha-desc">消耗 10x「怪物獎牌」進行抽獎</div>
    `;
    medalBtn.onclick = () => {
      closeGachaHub();
      window.openMedalGachaModal?.();
    };
    list.appendChild(medalBtn);

    // 2) 鑽石抽獎
    const diamondBtn = document.createElement("button");
    diamondBtn.className = "gacha-btn";
    diamondBtn.innerHTML = `
      <div>💎 鑽石抽獎</div>
      <div class="gacha-desc">消耗 1 張「鑽石抽獎券」，有機率獲得大量鑽石！</div>
    `;
    diamondBtn.onclick = () => {
      closeGachaHub();
      window.openDiamondGachaModal?.();
    };
    list.appendChild(diamondBtn);
  }

  // 導出
  window.openGachaHub = openGachaHub;
  window.closeGachaHub = closeGachaHub;
})();