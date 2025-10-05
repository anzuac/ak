// modules/ss_stats_modal.js
import { getSSStats } from "./history.js";

let groupMode = "byPool"; // "byPool" | "merged"
let sortMode  = "countDesc"; // "countDesc" | "countAsc" | "nameAsc"

function ensureModal() {
  if (document.getElementById("ssStatsModal")) return;

  const wrap = document.createElement("div");
  wrap.id = "ssStatsModal";
  wrap.className = "modal hidden";
  wrap.innerHTML = `
    <div class="modal-backdrop" data-close="1"></div>
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="ssStatsTitle">
      <div class="modal-header">
        <h3 id="ssStatsTitle">SS 統計</h3>
        <button class="modal-close" aria-label="關閉" data-close="1">✕</button>
      </div>

      <!-- 控制列：分組 / 排序 -->
      <div class="modal-controls" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:8px 0 4px;">
        <div class="seg">
          <button class="seg-btn" id="btnGroupByPool" data-active="1">依池別</button>
          <button class="seg-btn" id="btnGroupMerged">合併全池</button>
        </div>
        <div class="seg">
          <button class="seg-btn" id="btnSortCountDesc" data-active="1">次數↓</button>
          <button class="seg-btn" id="btnSortCountAsc">次數↑</button>
          <button class="seg-btn" id="btnSortNameAsc">名稱A→Z</button>
        </div>
      </div>

      <div class="modal-body">
        <div class="table-wrap">
          <table class="ss-table">
            <thead>
              <tr>
                <th style="text-align:left;">角色</th>
                <th style="text-align:left;" id="thPool">來源池</th>
                <th>次數</th>
                <th>機率（佔全部）</th>
                <th>機率（佔SS）</th>
              </tr>
            </thead>
            <tbody id="ssStatsTbody"></tbody>
          </table>
        </div>
        <div class="meta" id="ssStatsMeta" style="margin-top:8px;"></div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // 關閉事件（背景/✕/Esc）
  wrap.addEventListener("click", (e) => {
    if (e.target.dataset.close) closeSSModal();
  });
  document.addEventListener("keydown", (e) => {
    if (!wrap.classList.contains("hidden") && e.key === "Escape") closeSSModal();
  });

  // 控制列事件
  document.getElementById("btnGroupByPool")?.addEventListener("click", () => {
    groupMode = "byPool";
    setGroupActive("btnGroupByPool", "btnGroupMerged");
    renderSSModal();
  });
  document.getElementById("btnGroupMerged")?.addEventListener("click", () => {
    groupMode = "merged";
    setGroupActive("btnGroupMerged", "btnGroupByPool");
    renderSSModal();
  });

  document.getElementById("btnSortCountDesc")?.addEventListener("click", () => {
    sortMode = "countDesc";
    setSortActive("btnSortCountDesc", "btnSortCountAsc", "btnSortNameAsc");
    renderSSModal();
  });
  document.getElementById("btnSortCountAsc")?.addEventListener("click", () => {
    sortMode = "countAsc";
    setSortActive("btnSortCountAsc", "btnSortCountDesc", "btnSortNameAsc");
    renderSSModal();
  });
  document.getElementById("btnSortNameAsc")?.addEventListener("click", () => {
    sortMode = "nameAsc";
    setSortActive("btnSortNameAsc", "btnSortCountDesc", "btnSortCountAsc");
    renderSSModal();
  });

  // 小小樣式（seg-btn）
  const style = document.createElement("style");
  style.textContent = `
    .seg { display:inline-flex; background:#1b2440; border:1px solid #2b3b64; border-radius:10px; overflow:hidden; }
    .seg-btn { appearance:none; border:0; padding:6px 10px; background:transparent; color:#cfe2ff; cursor:pointer; font-weight:700; }
    .seg-btn[data-active="1"] { background:#2a3c6e; color:#fff; }
    .modal .table-wrap { max-height:min(60vh, 480px); overflow:auto; border:1px solid #2c3c66; border-radius:10px; }
    .ss-table { width:100%; border-collapse:collapse; }
    .ss-table th, .ss-table td { padding:8px; border-bottom:1px solid #2c3c66; text-align:center; }
    .unit-cell { display:flex; align-items:center; gap:8px; }
    .dot.dot-ss { width:8px; height:8px; border-radius:50%; background:#ffd56b; box-shadow:0 0 10px #ffd56b99; display:inline-block; }
    .modal.hidden { display:none; }
    .modal { position:fixed; inset:0; z-index:50; }
    .modal-backdrop { position:absolute; inset:0; background:rgba(0,0,0,.5); }
    .modal-panel { position:relative; width:min(920px, 94vw); margin:6vh auto; background:linear-gradient(180deg,#15203b 0%, #121a2c 100%); border:1px solid #2c3c66; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.5); padding:14px; color:#e6e8ef; }
    .modal-header { display:flex; justify-content:space-between; align-items:center; }
    .modal-close { appearance:none; border:0; background:#24335f; color:#d7e4ff; border-radius:8px; padding:6px 10px; cursor:pointer; }
  `;
  document.head.appendChild(style);
}

function setGroupActive(onId, offId) {
  document.getElementById(onId)?.setAttribute("data-active", "1");
  document.getElementById(offId)?.removeAttribute("data-active");
}
function setSortActive(onId, offId1, offId2) {
  document.getElementById(onId)?.setAttribute("data-active", "1");
  document.getElementById(offId1)?.removeAttribute("data-active");
  document.getElementById(offId2)?.removeAttribute("data-active");
}

function openSSModal() {
  ensureModal();
  renderSSModal();
  document.getElementById("ssStatsModal")?.classList.remove("hidden");
}
function closeSSModal() {
  document.getElementById("ssStatsModal")?.classList.add("hidden");
}

function renderSSModal() {
  const { rows, totalDraws, ssTotal } = getSSStats();
  const tbody = document.getElementById("ssStatsTbody");
  const meta  = document.getElementById("ssStatsMeta");
  const thPool = document.getElementById("thPool");
  if (!tbody) return;

  // 依分組模式處理資料
  const collator = new Intl.Collator("zh-Hant");
  let viewRows = [];

  if (groupMode === "byPool") {
    // 使用 getSSStats() 原始 rows（就是已經 [name+pool] 分組）
    viewRows = rows.map(r => ({ name: r.name, pool: r.pool, count: r.count }));
    thPool.style.display = "";
  } else {
    // 合併全池：以 name 彙總
    const map = new Map();
    for (const r of rows) {
      const key = r.name || "(未知)";
      const obj = map.get(key) || { name: key, pool: "（全部池）", count: 0 };
      obj.count += r.count;
      map.set(key, obj);
    }
    viewRows = Array.from(map.values());
    thPool.style.display = "none"; // 合併模式就不顯示「來源池」欄
  }

  // 排序
  viewRows.sort((a, b) => {
    if (sortMode === "countDesc") return (b.count - a.count) || collator.compare(a.name, b.name);
    if (sortMode === "countAsc")  return (a.count - b.count) || collator.compare(a.name, b.name);
    // nameAsc
    return collator.compare(a.name, b.name) || (b.count - a.count);
  });

  // Render
  if (!viewRows.length) {
    const colspan = (groupMode === "byPool" ? 5 : 4);
    tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;color:#9aa3b2;">尚無 SS 抽卡紀錄</td></tr>`;
  } else {
    tbody.innerHTML = viewRows.map(r => {
      const pAll = totalDraws ? ((r.count / totalDraws) * 100).toFixed(3) : "0.000";
      const pSS  = ssTotal    ? ((r.count / ssTotal)    * 100).toFixed(2)  : "0.00";
      // 合併模式：不顯示 pool 欄位
      const poolCell = (groupMode === "byPool") ? `<td style="text-align:left;">${escapeHTML(r.pool)}</td>` : "";
      return `
        <tr>
          <td style="text-align:left;">
            <div class="unit-cell">
              <span class="dot dot-ss"></span>
              <span class="name">${escapeHTML(r.name)}</span>
            </div>
          </td>
          ${poolCell}
          <td>${r.count}</td>
          <td>${pAll}%</td>
          <td>${pSS}%</td>
        </tr>
      `;
    }).join("");
  }

  if (meta) {
    meta.textContent = `總抽數：${totalDraws}｜SS 總數：${ssTotal}`;
  }
}

// 輔助：escape
function escapeHTML(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// 對外：掛在按鈕上用
export function mountSSStatsButton(buttonId = "btnSSStats") {
  ensureModal();
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener("click", openSSModal);
}