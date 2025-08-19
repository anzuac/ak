// save_inventory.js
// 專管「背包系統」的存檔/載入（不改動原本 inventory.js）
// 請在 inventory.js 之後載入

// 匯出存檔資料（完整複製，包含動態新增的道具）
function dumpInventory() {
  // 深拷貝，避免引用同一物件
  const data = {};
  if (typeof inventory === 'object' && inventory) {
    for (const k in inventory) {
      if (Object.prototype.hasOwnProperty.call(inventory, k)) {
        data[k] = Number(inventory[k]) || 0;
      }
    }
  }
  return { __v: 1, items: data };
}

// 匯入存檔資料（把數量寫回 inventory，沒有的保留現有；有新的就加入）
function loadInventory(saved) {
  if (!saved || typeof saved !== 'object') return;
  if (!saved.items || typeof saved.items !== 'object') return;

  // 確保 inventory 存在
  if (typeof window.inventory !== 'object' || !window.inventory) window.inventory = {};

  // 將存檔的道具數量覆蓋（新增或更新）
  for (const k in saved.items) {
    if (Object.prototype.hasOwnProperty.call(saved.items, k)) {
      window.inventory[k] = Number(saved.items[k]) || 0;
    }
  }

  // 刷新 UI（若有開啟）
  const list = document.getElementById("inventoryList");
  if (list && typeof window.updateInventoryList === 'function') {
    try { window.updateInventoryList(list); } catch {}
  }
}