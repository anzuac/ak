// shop_system.js
// 整合了元素碎片與進階石的兌換功能
// 修正了購買後不自動關閉彈窗的問題

function openShopModal() {
  const backdrop = document.createElement("div");
  backdrop.id = "shopBackdrop";
  backdrop.style = `
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    z-index: 998;
  `;
  backdrop.onclick = () => {
    document.body.removeChild(document.getElementById("shopModal"));
    document.body.removeChild(backdrop);
  };
  
  const modal = document.createElement("div");
  modal.id = "shopModal";
  modal.style = `
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: #fff;
    color: #000;
    padding: 20px;
    border-radius: 6px;
    z-index: 999;
    width: 200px;
    max-height: 80vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  `;
  
  modal.innerHTML = `
    <h3>商店</h3>
    <div id="shopItems"></div>
    <button onclick="closeShop()">關閉</button>
  `;
  
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  
  renderShopItems();
}

function closeShop() {
  const modal = document.getElementById("shopModal");
  const backdrop = document.getElementById("shopBackdrop");
  if (modal) document.body.removeChild(modal);
  if (backdrop) document.body.removeChild(backdrop);
}

function renderShopItems() {
  const container = document.getElementById("shopItems");
  container.innerHTML = "";

  container.style.maxHeight = "50vh";
  container.style.overflowY = "auto";
  container.style.webkitOverflowScrolling = "touch";

  // --- 強化石商店 ---
  const stoneShopTitle = document.createElement("h4");
  stoneShopTitle.textContent = "💎 強化石商店";
  container.appendChild(stoneShopTitle);

  const quantities = [1, 10, 100, 1000, 10000, 50000];
  const unitPrice = 5;
  quantities.forEach(qty => {
    let price = qty * unitPrice;
    if (qty === 1000) price = Math.floor(price * 0.95);
    if (qty === 10000) price = Math.floor(price * 0.9);

    const btn = document.createElement("button");
    btn.textContent = `購買 ${qty} 顆強化石（${price} 楓幣）`;
    btn.style.display = "block";
    btn.style.margin = "6px auto";
    btn.onclick = () => {
      if (player.gold >= price) {
        player.gold -= price;
        player.stone += qty;
        logPrepend(`🪨 成功購買 ${qty} 顆強化石！`);
        updateResourceUI();
        // 移除 closeShop()，讓視窗保持開啟
      } else {
        alert("楓幣不足！");
      }
    };
    container.appendChild(btn);
  });

  // --- 元素碎片與進階石兌換 ---
  const exchangeTitle = document.createElement("h4");
  exchangeTitle.textContent = "✨ 元素兌換";
  exchangeTitle.style.marginTop = "20px";
  container.appendChild(exchangeTitle);

  // 1個元素碎片 -> 3個進階石
  const fragmentToAdvanceBtn = document.createElement("button");
  fragmentToAdvanceBtn.textContent = "1 元素碎片 → 3 進階石";
  fragmentToAdvanceBtn.style.display = "block";
  fragmentToAdvanceBtn.style.margin = "6px auto";
  fragmentToAdvanceBtn.onclick = () => {
    if (getItemQuantity("元素碎片") >= 1) {
      removeItem("元素碎片", 1);
      addItem("進階石", 3);
      logPrepend("💎 成功兌換 3 顆進階石！");
      updateResourceUI();
      // 移除 closeShop()，讓視窗保持開啟
    } else {
      alert("元素碎片不足！");
    }
  };
  container.appendChild(fragmentToAdvanceBtn);

  // 3個進階石 -> 1個元素碎片
  const advanceToFragmentBtn = document.createElement("button");
  advanceToFragmentBtn.textContent = "3 進階石 → 1 元素碎片";
  advanceToFragmentBtn.style.display = "block";
  advanceToFragmentBtn.style.margin = "6px auto";
  advanceToFragmentBtn.onclick = () => {
    if (getItemQuantity("進階石") >= 3) {
      removeItem("進階石", 3);
      addItem("元素碎片", 1);
      logPrepend("✨ 成功兌換 1 個元素碎片！");
      updateResourceUI();
      // 移除 closeShop()，讓視窗保持開啟
    } else {
      alert("進階石不足！");
    }
  };
  container.appendChild(advanceToFragmentBtn);
// --- 元素碎片 → 元素精華 ---
  const shardToEssenceBtn = document.createElement("button");
  shardToEssenceBtn.textContent = "10 元素碎片 → 1 元素精華";
  shardToEssenceBtn.style.display = "block";
  shardToEssenceBtn.style.margin = "6px auto";
  shardToEssenceBtn.onclick = () => {
    if (getItemQuantity("元素碎片") >= 10) {
      removeItem("元素碎片", 10);
      addItem("元素精華", 1);
      logPrepend("🔷 成功兌換 1 個元素精華！");
      updateResourceUI();
    } else {
      alert("元素碎片不足！");
    }
  };
  container.appendChild(shardToEssenceBtn);

  // --- 楓幣兌換鑽石 ---
  const goldToDiamondBtn = document.createElement("button");
  goldToDiamondBtn.textContent = "200,000 楓幣 → 1 鑽石";
  goldToDiamondBtn.style.display = "block";
  goldToDiamondBtn.style.margin = "6px auto";
  goldToDiamondBtn.onclick = () => {
    if (player.gold >= 200000) {
      player.gold -= 200000;
      addItem("鑽石", 1);
      logPrepend("💎 成功購買 1 顆鑽石！");
      updateResourceUI();
    } else {
      alert("楓幣不足！");
    }
  };
  container.appendChild(goldToDiamondBtn);

  // --- 尚未開放的按鈕 ---
  const disabledBtn = document.createElement("button");
  disabledBtn.textContent = "尚未開放購買其他道具";
  disabledBtn.disabled = true;
  disabledBtn.style.marginTop = "8px";
  container.appendChild(disabledBtn);
}

window.openShopModal = openShopModal;
window.closeShop = closeShop;
