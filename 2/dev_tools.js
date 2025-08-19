// dev/dev_tools.js － 開發者專用：一鍵清除所有 localStorage（ES5）
(function(){
  var DEV_TOOL_VISIBLE = true;

  function clearSaves() {
    try { localStorage.clear(); } catch(e) {}
    // 如果你有用 sessionStorage，也一起清（可選）
    // try { sessionStorage.clear(); } catch(e) {}

    if (typeof updateResourceUI === "function") updateResourceUI();
    alert("已清空 localStorage（所有儲存）。請重新整理頁面。");
  }

  // Console 可呼叫
  window.__DEV_CLEAR_SAVES = clearSaves;

  function mountButton(){
    if (!DEV_TOOL_VISIBLE) return;
    if (document.getElementById("__devClearBtn")) return;

    var btn = document.createElement("button");
    btn.id = "__devClearBtn";
    btn.textContent = "🧹清存（DEV）";
    btn.title = "清空 localStorage（所有資料）";
    btn.onclick = function(){
      var ok = confirm("確定要清空 localStorage？（所有儲存都會消失）");
      if (ok) clearSaves();
    };
    btn.style.position = "fixed";
    btn.style.right = "10px";
    btn.style.bottom = "10px";
    btn.style.zIndex = "100000";
    btn.style.border = "none";
    btn.style.borderRadius = "8px";
    btn.style.padding = "6px 10px";
    btn.style.background = "#7a2";
    btn.style.color = "#fff";
    btn.style.fontSize = "12px";
    btn.style.cursor = "pointer";
    btn.style.opacity = "0.9";
    btn.onmouseenter = function(){ btn.style.opacity = "1"; };
    btn.onmouseleave = function(){ btn.style.opacity = "0.9"; };

    document.body.appendChild(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountButton);
  } else {
    mountButton();
  }
})();