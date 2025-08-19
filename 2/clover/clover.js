// clover/clover.js（使用 player.gold / player.gem / player.stone）

const cloverData = { level: 0, expBonus: 0, dropBonus: 0, goldBonus: 0 };

const EXP_INC = 0.02;   // +2%
const DROP_INC = 0.005; // +0.5%
const GOLD_INC = 0.01;  // +1%

// 將初始化邏輯拉出來，確保函式能被全域存取
function initClover() {
  injectCloverStyles();
  initializeCloverSystem();
}
// 呼叫初始化函式
initClover();

function initializeCloverSystem() {
  if (typeof player !== 'undefined' && player.coreBonus) {
    if (!player.coreBonus.bonusData) player.coreBonus.bonusData = {};
    player.coreBonus.bonusData.clover = cloverData;
    return;
  }
  setTimeout(initializeCloverSystem, 100);
}

/* ========= 資源：只讀寫 player.gold / player.gem / player.stone ========= */
function getGold()    { return Number(player?.gold  ?? 0); }
function getDiamond() { return Number(player?.gem   ?? 0); }
function getStone()   { return Number(player?.stone ?? 0); }

function spendGold(n)    { player.gold  = getGold()    - n; updateResourceUI?.(); }
function spendDiamond(n) { player.gem   = getDiamond() - n; updateResourceUI?.(); }
function spendStone(n)   { player.stone = getStone()   - n; updateResourceUI?.(); }

/* ================== 成本規則（各路線獨立） ================== */
function baseGoldCost(nextLevel) { return nextLevel * 5000; }
function diamondCost(nextLevel)  { return Math.ceil(baseGoldCost(nextLevel) / 11071); }
function stoneCost(nextLevel)    { return Math.ceil(baseGoldCost(nextLevel) / 500); }

/* ================== Modal（自建） ================== */
function ensureCloverModal() {
  if (document.getElementById('cloverModal')) return;

  const modal = document.createElement('div');
  modal.id = 'cloverModal';
  modal.className = 'clover-modal';
  modal.innerHTML = `
    <div class="clover-panel" role="dialog" aria-modal="true" aria-labelledby="clover-title">
      <div class="clover-header">
        <span id="clover-title">🍀 幸運草</span>
        <button class="clover-close" aria-label="close">✕</button>
      </div>

      <div class="clover-body">
        <div class="clover-row"><div>等級</div><div id="clover-level">Lv.0</div></div>
        <div class="clover-row">
          <div>目前加成</div>
          <div>
            經驗 <b id="clover-exp-bonus">0.00%</b> ・
            掉落 <b id="clover-drop-bonus">0.00%</b> ・
            楓幣 <b id="clover-gold-bonus">0.00%</b>
          </div>
        </div>

        <hr class="clover-sep">

        <div class="clover-row">
          <div>下一級增幅</div>
          <div>經驗 +${(EXP_INC*100).toFixed(1)}%、掉落 +${(DROP_INC*100).toFixed(1)}%、楓幣 +${(GOLD_INC*100).toFixed(1)}%</div>
        </div>

        <div class="clover-block">
          <div class="clover-row"><div>楓幣路線</div><div id="cost-gold">—</div></div>
          <button class="clover-btn w-100" id="btn-gold">用楓幣升級</button>
        </div>

        <div class="clover-block">
          <div class="clover-row"><div>鑽石路線 <span id="diamond-lock" class="muted"></span></div><div id="cost-diamond">—</div></div>
          <button class="clover-btn w-100" id="btn-diamond">用鑽石升級</button>
        </div>

        <div class="clover-block">
          <div class="clover-row"><div>強化石路線</div><div id="cost-stone">—</div></div>
          <button class="clover-btn w-100" id="btn-stone">用強化石升級</button>
        </div>

        <div class="clover-note" id="limit-note" style="display:none;">已達 Lv.100 上限</div>
      </div>

      <div class="clover-footer">
        <button class="clover-btn ghost" id="btn-close">關閉</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const backdrop = document.createElement('div');
  backdrop.id = 'cloverBackdrop';
  backdrop.className = 'clover-backdrop';
  document.body.appendChild(backdrop);

  const close = () => closeCloverModal();
  backdrop.addEventListener('click', close);
  modal.querySelector('.clover-close').addEventListener('click', close);
  modal.querySelector('#btn-close').addEventListener('click', close);

  modal.querySelector('#btn-gold').addEventListener('click', upgradeViaGold);
  modal.querySelector('#btn-diamond').addEventListener('click', upgradeViaDiamond);
  modal.querySelector('#btn-stone').addEventListener('click', upgradeViaStone);

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

function openCloverModal() {
  ensureCloverModal();
  document.getElementById('cloverModal').style.display = 'flex';
  document.getElementById('cloverBackdrop').style.display = 'block';
  renderCloverModal();
}
function closeCloverModal() {
  const m = document.getElementById('cloverModal');
  const b = document.getElementById('cloverBackdrop');
  if (m) m.style.display = 'none';
  if (b) b.style.display = 'none';
}

function renderCloverModal() {
  const m = document.getElementById('cloverModal');
  if (!m || m.style.display === 'none') return;

  const lv = cloverData.level;
  m.querySelector('#clover-level').textContent = `Lv.${lv}`;
  m.querySelector('#clover-exp-bonus').textContent  = `${(cloverData.expBonus*100).toFixed(2)}%`;
  m.querySelector('#clover-drop-bonus').textContent = `${(cloverData.dropBonus*100).toFixed(2)}%`;
  m.querySelector('#clover-gold-bonus').textContent = `${(cloverData.goldBonus*100).toFixed(2)}%`;

  const limitNote   = m.querySelector('#limit-note');
  const costGoldEl  = m.querySelector('#cost-gold');
  const costDiamEl  = m.querySelector('#cost-diamond');
  const costStoneEl = m.querySelector('#cost-stone');
  const btnGold     = m.querySelector('#btn-gold');
  const btnDiamond  = m.querySelector('#btn-diamond');
  const btnStone    = m.querySelector('#btn-stone');
  const diamondLock = m.querySelector('#diamond-lock');

  if (lv >= 100) {
    limitNote.style.display = '';
    costGoldEl.textContent = costDiamEl.textContent = costStoneEl.textContent = '—';
    btnGold.disabled = btnDiamond.disabled = btnStone.disabled = true;
    diamondLock.textContent = '';
    return;
  } else {
    limitNote.style.display = 'none';
  }

  const nextLv = lv + 1;
  const gCost  = baseGoldCost(nextLv);
  const dCost  = diamondCost(nextLv);
  const sCost  = stoneCost(nextLv);

  costGoldEl.textContent  = `楓幣 ${gCost.toLocaleString()}`;
  costDiamEl.textContent  = `鑽石 ${dCost.toLocaleString()}`;
  costStoneEl.textContent = `強化石 ${sCost.toLocaleString()}`;

  const g = getGold();
  const d = getDiamond();
  const s = getStone();

  btnGold.disabled = !(g >= gCost);

  const diamondUnlocked = lv >= 30;
  diamondLock.textContent = diamondUnlocked ? '' : '（Lv.30 解鎖）';
  btnDiamond.disabled = !(diamondUnlocked && d >= dCost);

  btnStone.disabled = !(s >= sCost);
}

function applyGainAndLog(routeLabel) {
  cloverData.level++;
  cloverData.expBonus  += EXP_INC;
  cloverData.dropBonus += DROP_INC;
  cloverData.goldBonus += GOLD_INC;

  if (typeof logPrepend === "function") {
    logPrepend(`🍀 幸運草升級至 Lv.${cloverData.level}（使用${routeLabel}）。`);
    logPrepend(`目前加成：經驗 ${(cloverData.expBonus*100).toFixed(2)}%、掉落 ${(cloverData.dropBonus*100).toFixed(2)}%、楓幣 ${(cloverData.goldBonus*100).toFixed(2)}%`);
  }
  if (typeof updateResourceUI === "function") updateResourceUI();
  renderCloverModal();
}

function upgradeViaGold() {
  const lv = cloverData.level; if (lv >= 100) return;
  const need = baseGoldCost(lv + 1);
  const g = getGold();
  if (g >= need) { spendGold(need); applyGainAndLog('楓幣'); }
  else if (typeof logPrepend === "function") logPrepend(`💡 資源不足：需要 楓幣 ${need - g}`);
}

function upgradeViaDiamond() {
  const lv = cloverData.level; if (lv >= 100) return;
  if (lv < 30) { if (typeof logPrepend === "function") logPrepend('🔒 鑽石路線需 Lv.30 解鎖。'); return; }
  const need = diamondCost(lv + 1);
  const d = getDiamond();
  if (d >= need) { spendDiamond(need); applyGainAndLog('鑽石'); }
  else if (typeof logPrepend === "function") logPrepend(`💡 資源不足：需要 鑽石 ${need - d}`);
}

function upgradeViaStone() {
  const lv = cloverData.level; if (lv >= 100) return;
  const need = stoneCost(lv + 1);
  const s = getStone();
  if (s >= need) { spendStone(need); applyGainAndLog('強化石'); }
  else if (typeof logPrepend === "function") logPrepend(`💡 資源不足：需要 強化石 ${need - s}`);
}

// 這是唯一的對外接口，供 HTML 按鈕使用
function upgradeClover() { openCloverModal(); }

/* ================== 內嵌樣式 ================== */
function injectCloverStyles() {
  if (document.getElementById('clover-style')) return;
  const css = `
  .clover-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9998;display:none}
  .clover-modal{position:fixed;inset:0;display:none;justify-content:center;align-items:center;z-index:9999}
  .clover-panel{width:90vw;max-width:300px;background:#222;border:1px solid #666;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.5);padding:16px;color:#fff;font-family:inherit}
  .clover-header{display:flex;justify-content:space-between;align-items:center;font-weight:700}
  .clover-close{background:#444;border:1px solid #666;border-radius:6px;color:#fff;cursor:pointer;padding:4px 10px}
  .clover-body{margin-top:8px;font-size:12px}
  .clover-row{display:flex;justify-content:space-between;align-items:center;margin:8px 0}
  .clover-sep{border:none;border-top:1px solid #555;margin:8px 0}
  .clover-note{color:#ffd700;font-size:12px;margin-top:6px}
  .clover-footer{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
  .clover-btn{background:#4a4a8a;border:1px solid #666;color:#fff;border-radius:8px;padding:10px 12px;cursor:pointer}
  .clover-btn:disabled{opacity:.5;cursor:not-allowed}
  .clover-btn.ghost{background:#333}
  .clover-block{background:#1a1a1a;border:1px solid #444;border-radius:10px;padding:10px;margin-top:10px}
  .w-100{width:100%}
  .muted{color:#aaa;font-size:11px}
  `;
  const style = document.createElement('style');
  style.id = 'clover-style';
  style.textContent = css;
  document.head.appendChild(style);
}

// 這是唯一的對外接口，供 HTML 按鈕使用
window.openCloverModal = openCloverModal;
window.upgradeClover = upgradeClover;
