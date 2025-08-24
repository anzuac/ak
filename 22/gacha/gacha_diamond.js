// gacha_diamond.js
// 鑽石抽獎：使用 1 張「鑽石抽獎券」隨機抽取鑽石

(function () {
  function closeDiamondGacha() {
    document.getElementById("diamond-gacha-modal")?.remove();
    document.getElementById("diamond-gacha-backdrop")?.remove();
  }

  function openDiamondGachaModal() {
    const backdrop = document.createElement("div");
    backdrop.id = "diamond-gacha-backdrop";
    backdrop.style = `
      position:fixed; inset:0; background:rgba(0,0,0,0.55);
      z-index:998;
    `;
    backdrop.onclick = closeDiamondGacha;

    const modal = document.createElement("div");
    modal.id = "diamond-gacha-modal";
    modal.style = `
      position:fixed; top:50%; left:50%;
      transform:translate(-50%, -50%);
      width:min(90vw,300px);
      background:#1f1f1f; color:#fff; padding:20px;
      border-radius:12px; border:2px solid #666;
      z-index:999; text-align:center;
    `;
    // 防止點擊內容氣泡到 backdrop 而關閉
    modal.addEventListener("click", (e) => e.stopPropagation());

    modal.innerHTML = `
      <h3>💎 鑽石抽獎</h3>
      <p>需要 <b>1 張鑽石抽獎券</b> 才能抽獎</p>
      <button id="diamond-draw-btn">抽一次</button>
      <button id="diamond-close-btn" style="margin-left:8px;">關閉</button>
      <div id="diamond-gacha-result" style="margin-top:12px; font-size:14px; min-height:20px;"></div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    // 🔧 這裡改用事件綁定，不用 inline
    document.getElementById("diamond-close-btn").onclick = closeDiamondGacha;

    document.getElementById("diamond-draw-btn").onclick = () => {
      if ((getItemQuantity?.("鑽石抽獎券") || 0) < 1) {
        alert("需要 1 張『鑽石抽獎券』！");
        return;
      }
      removeItem("鑽石抽獎券", 1);

      const roll = Math.random() * 100; // 0~100
      let reward = 1;
      if (roll < 1) {            // 1%
        reward = 100;
      } else if (roll < 4) {     // +3% => 3%
        reward = 50;
      } else if (roll < 20) {    // +16%
        reward = 10;
      } else if (roll < 50) {    // +30%
        reward = 5;
      } // else 50% -> 1

      player.gem = (player.gem || 0) + reward;

      const resultBox = document.getElementById("diamond-gacha-result");
      resultBox.textContent = `🎉 恭喜獲得 ${reward} 顆鑽石！`;

      updateResourceUI?.();
      saveGame?.();
    };
  }

  // 只把開啟函數掛到全域就好
  window.openDiamondGachaModal = openDiamondGachaModal;
})();