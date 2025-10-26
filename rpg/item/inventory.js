// === inventory.js — 分頁分類 + 自動分類版 ===
//
// 1) 分頁：藥水、票券、強化類、素材
// 2) 自動依名稱分類（掉落自動進背包就會顯示在對應分頁）
// 3) 兼容舊 API：addItem / removeItem / getItemQuantity / createInventoryDropdown
// 4) 可用 setItemCategory 覆寫分類
// 5) UI 一次初始化，之後只刷新清單；數量變更自動 saveGame?.()

// 初始背包資料（可依需求調整；不填也行）
const inventory = {

  "能力方塊": 0,
  "裝備解放石": 0
};

// 類別定義（鍵：代號；值：顯示）
const CATEGORIES = {
  potion:  "藥水",
  ticket:  "消耗券",
  enhance: "強化類",
  2: "潛能類",
  material:"素材",
};
const CATEGORY_ORDER = ["potion", "ticket", "enhance","2", "material"];

// —— 自動分類規則（優先順序由上到下） ——
// 符合任一 regex 即套用該類別；沒命中則歸「素材」
const AUTO_RULES = [
  // 藥水 / 回復品
  { cat: "potion",  re: /(藥|藥水|藥劑|回復|恢復|治療|HP|MP|補血|補魔)/i },

  // 票券
  { cat: "ticket",  re: /(券|票|憑證|卷|ticket)/i },


 { cat: "2",  re: /(方塊|潛能)/i },

  // 強化類
  { cat: "enhance", re: /(強化|突破|星力|衝星|升級|精鍊|精煉|鍛造|強化石|升級石|寶珠|符文|附魔)/i },

  // 素材
  { cat: "material", re: /(素材|材料|碎片|結晶|精華|礦|石|木|皮|骨|毛)/i },
];

// 道具 → 類別對照表（手動覆寫／快取結果用）
const ITEM_META = {
  // 先放已知（可省略，靠自動分類即可）
  "sp點數券": { cat: "ticket" },
  "技能強化券": { cat: "ticket" },
  "衝星石": { cat: "enhance" },
  "飾品突破石": { cat: "enhance" },
  "飾品星力強化石": { cat: "enhance" },
  "飾品強化石": { cat: "enhance" },
  "元素碎片": { cat: "material" },
  "精華":     { cat: "material" },
  "任務獎牌": { cat: "material" },
};

// 分頁中即使為 0 也強制顯示的項目（避免玩家誤以為沒有此類）
const ALWAYS_SHOW = {
  potion:   [],
  ticket:   ["sp點數券", "技能強化券"],
  enhance:  ["飾品強化石", "飾品突破石", "飾品星力強化石", "衝星石"],
  material: ["任務獎牌", "元素碎片", "精華"],
};

// —— 工具：分類 ——

// 自動依名稱判斷類別；沒命中則 material
function autoCategoryByName(name) {
  for (const rule of AUTO_RULES) {
    if (rule.re.test(String(name))) return rule.cat;
  }
  return "material";
}

// 取得道具類別：有手動→用手動；沒有→計算後快取
function getItemCategory(name) {
  const cfg = ITEM_META[name];
  if (cfg && CATEGORIES[cfg.cat]) return cfg.cat;
  const cat = autoCategoryByName(name);
  ITEM_META[name] = { cat }; // 快取結果，之後更快
  return cat;
}

// 手動覆寫類別
function setItemCategory(name, cat) {
  if (!CATEGORIES[cat]) cat = "material";
  ITEM_META[name] = ITEM_META[name] || {};
  ITEM_META[name].cat = cat;
  refreshInventoryUI();
}

// —— UI：背包彈窗 —— //

function openInventoryModal() {
  if (document.getElementById("inventoryModal")) return;

  const backdrop = document.createElement("div");
  backdrop.id = "inventoryBackdrop";
  Object.assign(backdrop.style, {
    position: "fixed", inset: "0",
    background: "rgba(0,0,0,0.5)", zIndex: "999"
  });

  const modal = document.createElement("div");
  modal.id = "inventoryModal";
  Object.assign(modal.style, {
    position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
    backgroundColor: "#111827", padding: "0", border: "1px solid #334155",
    borderRadius: "12px", zIndex: "1000", minWidth: "320px", color: "#e5e7eb",
    maxHeight: "75vh", overflow: "hidden", boxShadow: "0 12px 36px rgba(0,0,0,.5)"
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    position: "sticky", top: "0", background: "#0f172a", borderBottom: "1px solid #334155",
    padding: "10px 12px", display: "flex", alignItems: "center",
    justifyContent: "space-between", zIndex: "2"
  });
  const title = document.createElement("div");
  title.textContent = "背包";
  Object.assign(title.style, { fontSize: "14px", fontWeight: "800", letterSpacing: ".5px" });
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✖";
  Object.assign(closeBtn.style, {
    border: "none", background: "#334155", color: "#fff",
    padding: "6px 10px", borderRadius: "8px", cursor: "pointer"
  });
  closeBtn.onclick = () => { modal.remove(); backdrop.remove(); };
  header.appendChild(title); header.appendChild(closeBtn);
  modal.appendChild(header);

  const tabs = document.createElement("div");
  Object.assign(tabs.style, {
    display: "flex", gap: "8px", padding: "8px 12px",
    background: "#0b1220", borderBottom: "1px solid #1f2937", flexWrap: "wrap"
  });
  modal.appendChild(tabs);

  const listWrap = document.createElement("div");
  Object.assign(listWrap.style, {
    padding: "10px 12px 12px 12px",
    maxHeight: "58vh", overflow: "auto"
  });
  modal.appendChild(listWrap);

  const footer = document.createElement("div");
  Object.assign(footer.style, {
    background: "#0f172a", borderTop: "1px solid #334155",
    padding: "8px 12px", display: "flex", justifyContent: "flex-end", gap: "8px"
  });
  const okBtn = document.createElement("button");
  okBtn.textContent = "關閉";
  Object.assign(okBtn.style, {
    border: "none", borderRadius: "8px", padding: "6px 10px",
    background: "#475569", color: "#fff", cursor: "pointer"
  });
  okBtn.onclick = closeBtn.onclick;
  footer.appendChild(okBtn);
  modal.appendChild(footer);

  let activeCat = CATEGORY_ORDER[0];

  function renderTabs() {
    tabs.innerHTML = "";
    CATEGORY_ORDER.forEach(cat => {
      const b = document.createElement("button");
      b.textContent = CATEGORIES[cat];
      Object.assign(b.style, {
        background: (cat === activeCat ? "#1d4ed8" : "#1f2937"),
        color: "#fff", border: "0", padding: "6px 10px",
        borderRadius: "8px", cursor: "pointer", fontWeight: "600"
      });
      b.onclick = () => { activeCat = cat; renderTabs(); renderList(); };
      tabs.appendChild(b);
    });
  }

  function makeRow(name, count) {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "grid", gridTemplateColumns: "1fr auto", gap: "6px",
      padding: "8px 0", borderBottom: "1px dashed #263043", alignItems: "center"
    });
    const left = document.createElement("div"); left.textContent = name;
    const right = document.createElement("div"); right.textContent = "× " + Number(count||0).toLocaleString();
    Object.assign(right.style, { opacity: ".9" });
    row.appendChild(left); row.appendChild(right);
    return row;
  }

  function renderList() {
    listWrap.innerHTML = "";

    const mustSet = new Set(ALWAYS_SHOW[activeCat] || []);
    const items = [];
    for (const name in inventory) {
      if (getItemCategory(name) !== activeCat) continue;
      const n = inventory[name] || 0;
      if (n > 0 || mustSet.has(name)) items.push([name, n]);
    }

    items.sort((a, b) => {
      const da = (b[1] > 0) - (a[1] > 0); // 有數量優先
      if (da !== 0) return da;
      return String(a[0]).localeCompare(String(b[0]), "zh-Hant");
    });

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "（此分頁尚無道具）";
      Object.assign(empty.style, { opacity: ".7", padding: "8px 2px" });
      listWrap.appendChild(empty);
      return;
    }

    for (const [name, n] of items) listWrap.appendChild(makeRow(name, n));
  }

  modal._inv = { refresh: renderList };
  backdrop.onclick = (e) => { if (e.target === backdrop) closeBtn.onclick(); };

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  renderTabs(); renderList();
}

function refreshInventoryUI() {
  const modal = document.getElementById("inventoryModal");
  modal?._inv?.refresh?.();
}

// —— 公用 API ——

// 新增道具（自動分類）
function addItem(name, amount) {
  if (amount === void 0) amount = 1;
  if (!inventory[name]) inventory[name] = 0;

  // 若未有手動設定則自動判斷分類並快取
  if (!ITEM_META[name]) {
    ITEM_META[name] = { cat: autoCategoryByName(name) };
  }

  inventory[name] += amount;
  refreshInventoryUI();
  saveGame?.();
}

// 取得數量
function getItemQuantity(name) { return inventory[name] || 0; }

// 扣除道具
function removeItem(name, amount) {
  if (amount === void 0) amount = 1;
  if (!inventory[name]) inventory[name] = 0;
  inventory[name] = Math.max(inventory[name] - amount, 0);
  refreshInventoryUI();
  saveGame?.();
}

// 產生下拉選單（可指定分類）
function createInventoryDropdown(selectId, includeZeroItems, categoryFilter) {
  if (includeZeroItems === void 0) includeZeroItems = false;
  const select = typeof selectId === "string" ? document.getElementById(selectId) : selectId;
  if (!select) return;

  // 允許顯示名/代號
  let catKey = null;
  if (categoryFilter) {
    if (CATEGORIES[categoryFilter]) catKey = categoryFilter;
    else for (const k in CATEGORIES) if (CATEGORIES[k] === categoryFilter) { catKey = k; break; }
  }

  // 強制包含（所有分類）
  const alwaysInclude = new Set();
  for (const c in ALWAYS_SHOW) for (const n of ALWAYS_SHOW[c]) alwaysInclude.add(n);

  select.innerHTML = "";
  const entries = [];
  for (const name in inventory) {
    const cat = getItemCategory(name);
    if (catKey && cat !== catKey) continue;
    const count = inventory[name] || 0;
    if (count <= 0 && !includeZeroItems && !alwaysInclude.has(name)) continue;
    entries.push([name, count]);
  }

  entries.sort((a, b) => {
    const da = (b[1] > 0) - (a[1] > 0);
    if (da !== 0) return da;
    return String(a[0]).localeCompare(String(b[0]), "zh-Hant");
  });

  for (const [name, count] of entries) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = `${name} (${Number(count).toLocaleString()})`;
    select.appendChild(opt);
  }
}

// 對外暴露
window.inventory = inventory;
window.addItem = addItem;
window.getItemQuantity = getItemQuantity;
window.removeItem = removeItem;
window.createInventoryDropdown = createInventoryDropdown;
window.openInventoryModal = openInventoryModal;

// 類別相關（可選覆寫）
window.getItemCategory = getItemCategory;
window.setItemCategory = setItemCategory;