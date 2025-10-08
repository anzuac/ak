function refreshCPUI(){
  if (typeof computeCombatPower !== "function") return;
  var el = document.getElementById("cp-display");
  if (!el) return;
  el.textContent = computeCombatPower(); // 直接讀即算
}

// 點明細（可選）
function showCPSummary(){
  if (typeof getCombatPowerSummary !== "function") return;
  var s = getCombatPowerSummary();
  alert(
    "戰鬥力："+s.cp+
    "\nDPS近似："+Math.round(s.dpsLike)+
    "\nEHP近似："+Math.round(s.ehpLike)+
    "\n（爆率："+(s.parts.critRate*100).toFixed(1)+"%，爆傷："+(s.parts.critMultiplier*100).toFixed(1)+"%）"
  );
}

// 你已有 updateResourceUI；尾端加一行即可：
(function(){
  var _oldUpdate = window.updateResourceUI;
  window.updateResourceUI = function(){
    if (typeof _oldUpdate === "function") _oldUpdate();
    refreshCPUI(); // 每次屬性/裝備變動後自動更新 CP 顯示
  };
})();

(function () {
  function refreshCPUI() {
    if (typeof window.computeCombatPower !== "function") return;
    const v = window.computeCombatPower();

    const el = document.getElementById("cp-display");
    const bd = document.getElementById("cp-badge");
    const old = parseInt((el && el.textContent) || (bd && bd.textContent)) || 0;

    if (el) el.textContent = v;
    if (bd) bd.textContent = v;

    // 上升動畫（cp-display 上做個綠光）
    if (el && v > old) {
      el.style.color = "#4caf50";
      setTimeout(() => (el.style.color = "#fff"), 600);
    }
  }

  function showCPSummary() {
    if (typeof window.getCombatPowerSummary !== "function") return;
    const s = window.getCombatPowerSummary();
    const box = document.getElementById("cp-detail");
    if (!box) return;

    box.innerHTML = `
      <strong>戰鬥力：</strong>${s.cp}<br>
      攻擊潛力：<span style="color:#7fc">${Math.round(s.dpsLike)}</span><br>
      生存潛力：<span style="color:#7cf">${Math.round(s.ehpLike)}</span><br>
      爆擊率 ${(s.parts.critRate*100).toFixed(1)}%／爆傷 ${(s.parts.critMultiplier*100).toFixed(1)}%<br>
      攻速 ${(s.parts.attackSpeedPct*100).toFixed(1)}%　減傷 ${(s.parts.damageReduce*100).toFixed(1)}%<br>
      閃避 ${(s.parts.dodgePercent*100).toFixed(1)}%　回血 ${(s.parts.recoverPercent*100).toFixed(1)}%
    `;
    box.style.display = (box.style.display === "none" || !box.style.display) ? "block" : "none";
  }

  // 掛全域
  window.refreshCPUI = refreshCPUI;
  window.showCPSummary = showCPSummary;

  // 併到你的 UI 更新流程
  const oldUpdate = window.updateResourceUI;
  window.updateResourceUI = function () {
    if (typeof oldUpdate === "function") oldUpdate();
    refreshCPUI();
  };

  // 首次也刷新一次
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshCPUI);
  } else {
    refreshCPUI();
  }
})();