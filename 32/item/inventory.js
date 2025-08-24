// === inventory.js ===

// 初始化背包資料
const inventory = {
  "任務獎牌": 0,
  "衝星石": 0,
  "進階石": 0,
  "星之碎片": 0,
  "洗鍊石": 0,
  "低階潛能解放鑰匙":0,
  "元素碎片": 0,
  "元素精華": 0,
  "森林精華": 0,
  "沼澤精華": 0,
  "熔岩精華": 0,
  "天水精華": 0,
  "風靈精華": 0,
  "雷光精華": 0,
  "冰霜精華": 0,
  "黯影精華": 0,
  "煉獄精華": 0,
  "聖光精華": 0,
  "核心精華": 0
};

// 顯示背包彈窗
function openInventoryModal() {
  // 若已存在則不重複建立
  if (document.getElementById("inventoryModal")) return;

  // 背景
  var backdrop = document.createElement("div");
  backdrop.id = "inventoryBackdrop";
  Object.assign(backdrop.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.5)",
    zIndex: "999"
  });

  // 外殼
  var modal = document.createElement("div");
  modal.id = "inventoryModal";
  Object.assign(modal.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    backgroundColor: "#222",
    padding: "0",                      // 由內層控制 padding
    border: "1px solid #888",
    borderRadius: "8px",
    zIndex: "1000",
    minWidth: "240px",
    color: "#fff",
    maxHeight: "70vh",                 // 限制整個彈窗高度
    overflow: "hidden",                // 捲動交給內層清單
    boxShadow: "0 8px 24px rgba(0,0,0,.4)"
  });

  // 頂部列（sticky）
  var header = document.createElement("div");
  Object.assign(header.style, {
    position: "sticky",
    top: "0",
    background: "#1a1a1a",
    borderBottom: "1px solid #444",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: "2"
  });

  var title = document.createElement("div");
  title.textContent = "背包道具";
  Object.assign(title.style, {
    margin: "0",
    fontSize: "14px",
    fontWeight: "700"
  });

  var closeIcon = document.createElement("button");
  closeIcon.textContent = "✖";
  Object.assign(closeIcon.style, {
    border: "none",
    background: "transparent",
    color: "#fff",
    fontSize: "16px",
    cursor: "pointer"
  });
  closeIcon.onclick = function () {
    if (modal.parentNode) document.body.removeChild(modal);
    if (backdrop.parentNode) document.body.removeChild(backdrop);
  };

  header.appendChild(title);
  header.appendChild(closeIcon);
  modal.appendChild(header);

  // 清單（可滑動）
  var list = document.createElement("div");
  list.id = "inventoryList";
  Object.assign(list.style, {
    maxHeight: "55vh",                  // 清單自身高度
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",   // 行動裝置慣性滑動
    padding: "10px 12px 12px 12px",
    gap: "6px"
  });

  updateInventoryList(list);
  modal.appendChild(list);

  // 底部操作列（可選）
  var footer = document.createElement("div");
  Object.assign(footer.style, {
    position: "sticky",
    bottom: "0",
    background: "#1a1a1a",
    borderTop: "1px solid #444",
    padding: "8px 12px",
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px"
  });

  var closeBtn = document.createElement("button");
  closeBtn.textContent = "關閉";
  Object.assign(closeBtn.style, {
    border: "none",
    borderRadius: "6px",
    padding: "6px 10px",
    background: "#555",
    color: "#fff",
    cursor: "pointer"
  });
  closeBtn.onclick = closeIcon.onclick;

  footer.appendChild(closeBtn);
  modal.appendChild(footer);

  // 點背板關閉
  backdrop.onclick = function (e) {
    if (e.target === backdrop) closeIcon.onclick();
  };

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
}

// 更新背包顯示內容
function updateInventoryList(container) {
  container.innerHTML = "";

  // 永遠顯示的道具（即使數量為 0）
  var alwaysShow = [
    "任務獎牌",
    "衝星石", "進階石", "洗鍊石", "星之碎片",
    "元素碎片", "元素精華",
    "森林精華", "沼澤精華", "熔岩精華", "天水精華",
    "風靈精華", "雷光精華", "冰霜精華", "黯影精華",
    "煉獄精華", "聖光精華",
    "核心精華"
  ];

  // 整合所有道具名稱
  var set = {};
  var k;
  for (k in inventory) set[k] = true;
  for (var i = 0; i < alwaysShow.length; i++) set[alwaysShow[i]] = true;

  for (k in set) {
    var count = inventory[k] || 0;

    // 跳過非 alwaysShow 且數量 0 的
    var must = false;
    for (var j = 0; j < alwaysShow.length; j++) {
      if (alwaysShow[j] === k) { must = true; break; }
    }
    if (count <= 0 && !must) continue;

    var row = document.createElement("div");
    row.textContent = k + " × " + count;
    row.style.padding = "6px 0";
    row.style.borderBottom = "1px dashed #333";
    container.appendChild(row);
  }
}

// 增加道具數量
function addItem(name, amount) {
  if (amount === void 0) amount = 1;
  if (!inventory[name]) inventory[name] = 0;
  inventory[name] += amount;
  var list = document.getElementById("inventoryList");
  if (list) updateInventoryList(list);
}

// 取得指定道具數量
function getItemQuantity(name) {
  return inventory[name] || 0;
}

// 扣除道具數量
function removeItem(name, amount) {
  if (amount === void 0) amount = 1;
  if (!inventory[name]) inventory[name] = 0;
  inventory[name] = Math.max(inventory[name] - amount, 0);
  var list = document.getElementById("inventoryList");
  if (list) updateInventoryList(list);
}

// 產生背包道具的下拉式選單（支援強制顯示）
function createInventoryDropdown(selectId, includeZeroItems) {
  if (includeZeroItems === void 0) includeZeroItems = false;
  var select = document.getElementById(selectId);
  if (!select) return;

  var alwaysInclude = ["森林精華", "沼澤精華", "熔岩精華", "核心精華"];
  var set = {};
  var k;
  for (k in inventory) set[k] = true;
  for (var i = 0; i < alwaysInclude.length; i++) set[alwaysInclude[i]] = true;

  select.innerHTML = ""; // 清空原選項

  for (k in set) {
    var count = inventory[k] || 0;
    var must = false;
    for (var j = 0; j < alwaysInclude.length; j++) {
      if (alwaysInclude[j] === k) { must = true; break; }
    }
    if (count <= 0 && !includeZeroItems && !must) continue;

    var option = document.createElement("option");
    option.value = k;
    option.textContent = k + " (" + count + ")";
    select.appendChild(option);
  }
}