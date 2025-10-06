// ✅ 插入飄字樣式
(function injectFloatingStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .floating-text {
      position: absolute;
      font-weight: bold;
      animation: floatUp 1.2s ease-out forwards;
      z-index: 99;
      left: 50%;
      transform: translateX(-50%);
      font-size: 18px;
      pointer-events: none;
    }

    @keyframes floatUp {
      from { opacity: 1; top: 0; }
      to   { opacity: 0; top: -40px; }
    }

    .floating-text.damage   { color: #f44336; }
    .floating-text.crit     { color: #ff1744; }
    .floating-text.heal     { color: #4caf50; }
    .floating-text.miss     { color: #999; }
    .floating-text.playerHit{ color: #2196f3; }
    .floating-text.poison   { color: #9c27b0; }
    .floating-text.burn     { color: #ff5722; }
    .floating-text.buff     { color: #03a9f4; }
    .floating-text.weaken   { color: #ff9800; }
    .floating-text.default  { color: white; }
  `;
  document.head.appendChild(style);
})();

// ✅ 飄字顯示（基本）
function showFloatingText(text, type = "default", target = "monster") {
  const targetEl = target === "player"
    ? document.getElementById("playerStatus")
    : document.getElementById("monsterInfo");

  if (!targetEl) return;

  const span = document.createElement("div");
  span.className = `floating-text ${type}`;
  span.textContent = text;

  targetEl.appendChild(span);

  setTimeout(() => span.remove(), 1200);
}

// ✅ 狀態提示（BUFF 顯示專用）
function showStatusEffectHint(type = "atk", target = "player") {
  let text = "", effectClass = "buff";

  switch (type) {
    case "atk":    text = "🟢 攻擊力↑"; break;
    case "def":    text = "🛡️ 防禦力↑"; break;
    case "recover":text = "💚 回復力↑"; break;
    case "dodge":  text = "⚡ 閃避率↑"; break;
    case "crit":   text = "🔥 爆擊率↑"; break;
    case "weaken": text = "🔻 虛弱"; effectClass = "weaken"; break;
    case "poison": text = "☠️ 中毒"; effectClass = "poison"; break;
    case "burn":   text = "🔥 燒傷"; effectClass = "burn"; break;
    case "paralyze":text = "💫 麻痺"; effectClass = "buff"; break;
    default:       text = "🌀 狀態變化"; break;
  }

  showFloatingText(text, effectClass, target);
}