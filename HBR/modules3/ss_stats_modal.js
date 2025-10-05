// modules/ss_stats_modal.js
import { getSSStats } from "./history.js";

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
      <div class="modal-body">
        <div class="table-wrap">
          <table class="ss-table">
            <thead>
              <tr>
                <th style="text-align:left;">角色</th>
                <th>次數</th>
                <th>機率（佔全部）</th>
                <th>機率（佔SS）</th>
              </tr>
            </thead>
            <tbody id="ssStatsTbody"></tbody>
          </table>
        </div>
        <div class="meta" id="ssStatsMeta"></div>
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
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#9aa3b2;">尚無 SS 抽卡紀錄</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(r => {
      const pAll = totalDraws ? ((r.count / totalDraws) * 100).toFixed(3) : "0.000";
      const pSS  = ssTotal    ? ((r.count / ssTotal)    * 100).toFixed(2)  : "0.00";
      return `
        <tr>
          <td style="text-align:left;">
            <div class="unit-cell">
              <span class="dot dot-ss"></span>
              <span class="name">${escapeHTML(r.name)}</span>

            </div>
          </td>
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