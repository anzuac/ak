// shop_system.js
// 只重做 UI（深色卡片樣式、分區標題、行距/間距優化）
// 功能與邏輯（價格、折扣、兌換比例、購買後不關窗）完全不變

function openShopModal() {
  const backdrop = document.createElement("div");
  backdrop.id = "shopBackdrop";
  backdrop.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,.65);
    z-index: 998;
  `;
  backdrop.onclick = (e) => {
    // 點擊黑幕才關閉；點內容不關
    if (e.target === backdrop) {
      closeShop();
    }
  };

  const modal = document.createElement("div");
  modal.id = "shopModal";
  modal.style.cssText = `
    position: fixed; inset: 0;
    display: flex; align-items: center; justify-content: center;
    z-index: 999;
  `;

  const wrap = document.createElement("div");
  wrap.style.cssText = `
    width: min(680px, 96vw);
    max-height: 92vh; overflow: auto;
    background: #121319; color: #eaf0ff;
    border: 1px solid #3b3f5c;
    border-radius: 12px;
    box-shadow: 0 12px 36px rgba(0,0,0,.5);
    font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif;
  `;

  const head = document.createElement("div");
  head.style.cssText = `
    position: sticky; top: 0;
    background: #0f1016;
    padding: 10px 12px;
    border-bottom: 1px solid #2b2f4a;
    border-radius: 12px 12px 0 0;
    display: flex; align-items: center; justify-content: space-between;
  `;
  head.innerHTML = `
    <div style="font-weight:800;letter-spacing:.5px">🛒 商店</div>
    <button id="shopCloseBtn" style="
      background:#333;border:0;color:#fff;border-radius:8px;
      padding:6px 10px;cursor:pointer">✖</button>
  `;

  const body = document.createElement("div");
  body.id = "shopItems";
  body.style.cssText = `
    padding: 12px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  `;

  wrap.appendChild(head);
  wrap.appendChild(body);
  modal.appendChild(wrap);
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  const btn = document.getElementById("shopCloseBtn");
  if (btn) btn.onclick = closeShop;

  renderShopItems();
}

function closeShop() {
  const modal = document.getElementById("shopModal");
  const backdrop = document.getElementById("shopBackdrop");
  if (modal) document.body.removeChild(modal);
  if (backdrop) document.body.removeChild(backdrop);
}

function sectionCard(titleHTML, innerNode) {
  const card = document.createElement("div");
  card.style.cssText = "background:#191b25;border:1px solid #2f3555;border-radius:10px;padding:10px;";
  const title = document.createElement("div");
  title.style.cssText = "font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:6px;";
  title.innerHTML = titleHTML;
  card.appendChild(title);
  card.appendChild(innerNode);
  return card;
}

function p(text, small) {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = small ? "opacity:.85;font-size:12px" : "";
  return el;
}

function niceBtn(text, color) {
  const btn = document.createElement("button");
  btn.textContent = text;
  btn.style.cssText = `
    display:block;margin:8px 0 0 auto;
    padding:8px 12px;border:none;border-radius:8px;
    background:${color || "#5b8cff"};color:#fff;cursor:pointer;
  `;
  return btn;
}

function renderShopItems() {
  const container = document.getElementById("shopItems");
  container.innerHTML = "";

  // ==== 強化石商店（數量輸入 + 折扣）====
  (function renderStoneShop(){
    const unitPrice = 5; // 5 楓幣/顆

    const wrap = document.createElement("div");

    // 內容區
    const box = document.createElement("div");
    box.style.cssText = "border:1px solid #2f3555;border-radius:8px;padding:10px;background:#161a24;color:#eaf0ff;";

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;";
    row.innerHTML = `
      <label>購買數量：</label>
      <input id="stoneQtyInput" type="number" min="1" step="1" value="1"
            style="width:140px;padding:6px;border-radius:6px;border:1px solid #3b426b;background:#0f1320;color:#eaf0ff;">
      <span id="stonePriceText" style="margin-left:6px;opacity:.9"></span>
    `;
    box.appendChild(row);

    const tip = p("定價：5 楓幣/顆；滿 1,000 顆 95 折，滿 10,000 顆 9 折。", true);
    tip.style.marginTop = "6px";
    box.appendChild(tip);

    const buyBtn = niceBtn("購買", "#5b8cff");
    box.appendChild(buyBtn);

    wrap.appendChild(box);

    // 計價函式（維持你的折扣邏輯）
    function calcStonePrice(qty) {
      let price = qty * unitPrice;
      if (qty >= 10000) price = Math.floor(price * 0.9);
      else if (qty >= 1000) price = Math.floor(price * 0.95);
      else price = Math.floor(price);
      return price;
    }

    const qtyInput = box.querySelector("#stoneQtyInput");
    const priceText = box.querySelector("#stonePriceText");
    function refreshPrice() {
      let qty = parseInt(qtyInput.value, 10);
      if (!Number.isFinite(qty) || qty < 1) qty = 1;
      const price = calcStonePrice(qty);
      priceText.innerHTML = `應付：<b>${price.toLocaleString()}</b> 楓幣（${qty.toLocaleString()} 顆）`;
    }
    qtyInput.addEventListener("input", refreshPrice);
    refreshPrice();

    buyBtn.onclick = () => {
      let qty = parseInt(qtyInput.value, 10);
      if (!Number.isFinite(qty) || qty < 1) qty = 1;
      const price = calcStonePrice(qty);
      if (player.gold >= price) {
        player.gold -= price;
        player.stone = (player.stone || 0) + qty;
        logPrepend(`🪨 成功購買 ${qty.toLocaleString()} 顆強化石！花費 ${price.toLocaleString()} 楓幣`);
        updateResourceUI();
      } else {
        alert("楓幣不足！");
      }
    };

    container.appendChild(sectionCard("💎 強化石商店", wrap));
  })();

  // ==== 元素碎片／進階石／元素精華 兌換 ====
  (function renderExchanges(){
    const wrap = document.createElement("div");

    // 1 元素碎片 → 3 進階石
    const a = document.createElement("div");
    a.style.cssText = "border:1px solid #2f3555;border-radius:8px;padding:10px;background:#161a24;margin:6px 0;";
    a.appendChild(p("1 元素碎片 → 3 進階石"));
    const btnA = niceBtn("兌換", "#6ab06a");
    btnA.onclick = () => {
      if (getItemQuantity("元素碎片") >= 1) {
        removeItem("元素碎片", 1);
        addItem("進階石", 3);
        logPrepend("💎 成功兌換 3 顆進階石！");
        updateResourceUI();
      } else {
        alert("元素碎片不足！");
      }
    };
    a.appendChild(btnA);
    wrap.appendChild(a);

    // 3 進階石 → 1 元素碎片
    const b = document.createElement("div");
    b.style.cssText = "border:1px solid #2f3555;border-radius:8px;padding:10px;background:#161a24;margin:6px 0;";
    b.appendChild(p("3 進階石 → 1 元素碎片"));
    const btnB = niceBtn("兌換", "#6ab06a");
    btnB.onclick = () => {
      if (getItemQuantity("進階石") >= 3) {
        removeItem("進階石", 3);
        addItem("元素碎片", 1);
        logPrepend("✨ 成功兌換 1 個元素碎片！");
        updateResourceUI();
      } else {
        alert("進階石不足！");
      }
    };
    b.appendChild(btnB);
    wrap.appendChild(b);

    // 10 元素碎片 → 1 元素精華
    const c = document.createElement("div");
    c.style.cssText = "border:1px solid #2f3555;border-radius:8px;padding:10px;background:#161a24;margin:6px 0;";
    c.appendChild(p("10 元素碎片 → 1 元素精華"));
    const btnC = niceBtn("兌換", "#6ab06a");
    btnC.onclick = () => {
      if (getItemQuantity("元素碎片") >= 10) {
        removeItem("元素碎片", 10);
        addItem("元素精華", 1);
        logPrepend("🔷 成功兌換 1 個元素精華！");
        updateResourceUI();
      } else {
        alert("元素碎片不足！");
      }
    };
    c.appendChild(btnC);
    wrap.appendChild(c);

    container.appendChild(sectionCard("✨ 元素兌換", wrap));
  })();

  // ==== 潛能解放鑰匙互換 ====
  (function renderKeys(){
    const wrap = document.createElement("div");

    // 3 低階 → 1 中階
    const k1 = document.createElement("div");
    k1.style.cssText = "border:1px solid #2f3555;border-radius:8px;padding:10px;background:#161a24;margin:6px 0;";
    k1.appendChild(p("3 低階潛能解放鑰匙 → 1 中階潛能解放鑰匙"));
    const k1b = niceBtn("兌換", "#9b7bff");
    k1b.onclick = () => {
      const src = "低階潛能解放鑰匙";
      const dst = "中階潛能解放鑰匙";
      if (getItemQuantity(src) >= 3) {
        removeItem(src, 3);
        addItem(dst, 1);
        logPrepend("🗝 成功兌換 1 把「中階潛能解放鑰匙」！");
        updateResourceUI();
      } else {
        alert("低階潛能解放鑰匙不足！");
      }
    };
    k1.appendChild(k1b);
    wrap.appendChild(k1);

    // 1 中階 → 3 低階
    const k2 = document.createElement("div");
    k2.style.cssText = "border:1px solid #2f3555;border-radius:8px;padding:10px;background:#161a24;margin:6px 0;";
    k2.appendChild(p("1 中階潛能解放鑰匙 → 2 低階潛能解放鑰匙"));
    const k2b = niceBtn("兌換", "#9b7bff");
    k2b.onclick = () => {
      const src = "中階潛能解放鑰匙";
      const dst = "低階潛能解放鑰匙";
      if (getItemQuantity(src) >= 1) {
        removeItem(src, 1);
        addItem(dst, 2);
        logPrepend("🗝 成功兌換 2 把「低階潛能解放鑰匙」！");
        updateResourceUI();
      } else {
        alert("中階潛能解放鑰匙不足！");
      }
    };
    k2.appendChild(k2b);
    wrap.appendChild(k2);

    // 2 中階 → 1 高階
    const k3 = document.createElement("div");
    k3.style.cssText = "border:1px solid #2f3555;border-radius:8px;padding:10px;background:#161a24;margin:6px 0;";
    k3.appendChild(p("2 中階潛能解放鑰匙 → 1 高階潛能解放鑰匙"));
    const k3b = niceBtn("兌換", "#9b7bff");
    k3b.onclick = () => {
      const src = "中階潛能解放鑰匙";
      const dst = "高階潛能解放鑰匙";
      if (getItemQuantity(src) >= 2) {
        removeItem(src, 2);
        addItem(dst, 1);
        logPrepend("🗝 成功兌換 1 把「高階潛能解放鑰匙」！");
        updateResourceUI();
      } else {
        alert("中階潛能解放鑰匙不足！");
      }
    };
    k3.appendChild(k3b);
    wrap.appendChild(k3);

    // 1 高階 → 2 中階
    const k4 = document.createElement("div");
    k4.style.cssText = "border:1px solid #2f3555;border-radius:8px;padding:10px;background:#161a24;margin:6px 0;";
    k4.appendChild(p("1 高階潛能解放鑰匙 → 1 中階潛能解放鑰匙"));
    const k4b = niceBtn("兌換", "#9b7bff");
    k4b.onclick = () => {
      const src = "高階潛能解放鑰匙";
      const dst = "中階潛能解放鑰匙";
      if (getItemQuantity(src) >= 1) {
        removeItem(src, 1);
        addItem(dst, 1);
        logPrepend("🗝 成功兌 1 把「中階潛能解放鑰匙」！");
        updateResourceUI();
      } else {
        alert("高階潛能解放鑰匙不足！");
      }
    };
    k4.appendChild(k4b);
    wrap.appendChild(k4);

    container.appendChild(sectionCard("🗝 潛能解放鑰匙 互換", wrap));
  })();

  // 底部灰按鈕（保留）
  const disabledBtn = document.createElement("button");
  disabledBtn.textContent = "尚未開放購買其他道具";
  disabledBtn.disabled = true;
  disabledBtn.style.cssText = "margin: 4px auto 8px auto; display:block; opacity:.6;";
  container.appendChild(disabledBtn);
}

window.openShopModal = openShopModal;
window.closeShop = closeShop;