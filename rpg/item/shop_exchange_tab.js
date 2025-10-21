// shop_exchange_tab.js — 「兌換商品」分頁（讀取背包：強化道具兌換券；x1 / x10 / x50）
(function (w) {
  "use strict";

  // ========= 依賴 =========
  var HAS_INV = (typeof w.getItemQuantity === "function" &&
                 typeof w.removeItem === "function" &&
                 typeof w.addItem === "function");

  var COUPON_KEY = "強化道具兌換券";

  // ========= 兌換表（每 1 個成品所需的券數）=========
  var EX_LIST = [
    { name: "元素碎片",     cost: 1 },
    { name: "衝星石",       cost: 2 },
    { name: "進階石",       cost: 10 },
    { name: "元素精華",     cost: 25 },
    { name: "飾品進化石",   cost: 3 },
    { name: "飾品星力石",   cost: 3 },
    { name: "飾品突破石",   cost: 12 },
    { name: "生命強化石",   cost: 5 },
    { name: "生命突破石",   cost: 7 },
    { name: "核心強化石",   cost: 10 },
    { name: "核心覺醒石",   cost: 12 },
    { name: "核心星力石",   cost: 7 },
    { name: "護盾補充器",   cost: 2000 }
  ];

  function getCouponQty() {
    try { return Math.max(0, Number(w.getItemQuantity(COUPON_KEY) || 0)); } catch (e) { return 0; }
  }

  function logMsg(msg) {
    if (typeof w.logPrepend === "function") { w.logPrepend(msg); }
    else { try { console.log(msg); } catch(e){} }
  }

  function exchangeOnce(itemName, units, costPerUnit) {
    if (!HAS_INV) { alert("❌ 缺少背包 API（getItemQuantity/removeItem/addItem）。"); return; }
    units = Math.max(1, Math.floor(units||1));
    var need = units * costPerUnit;
    var have = getCouponQty();
    if (have < need) {
      alert("❌ 兌換券不足，需要："+need+"，持有："+have);
      return;
    }
    // 扣券、給物
    var ok = w.removeItem(COUPON_KEY, need);
    // 某些實作不回傳布林，保險再檢查一次持有量是否足以判定已扣。
    var after = getCouponQty();
    if (ok === false || after > have - need) {
      alert("❌ 扣除兌換券失敗，請稍後再試。");
      return;
    }
    w.addItem(itemName, units);
    logMsg("🎁 兌換成功：獲得「"+itemName+"」 ×"+units+"（花費兌換券 "+need+"）");
    alert("✅ 兌換成功！「"+itemName+"」 ×"+units);
  }

  function renderRow(root, def) {
    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:10px;border:1px solid #334155;border-radius:10px;background:#0b1220;margin-bottom:8px;gap:8px;";

    var left = document.createElement("div");
    left.style.cssText = "display:flex;flex-direction:column;";
    var title = document.createElement("div");
    title.textContent = def.name;
    title.style.cssText = "font-weight:700;font-size:14px;letter-spacing:.3px;";
    var sub = document.createElement("div");
    sub.textContent = "每 1 個需「"+COUPON_KEY+"」 × "+def.cost;
    sub.style.cssText = "opacity:.85;font-size:12px;margin-top:2px;";
    left.appendChild(title); left.appendChild(sub);

    var right = document.createElement("div");
    right.style.cssText = "display:flex;gap:6px;";

    function mkBtn(label, units) {
      var need = units * def.cost;
      var have = getCouponQty();
      var can = have >= need;
      var b = document.createElement("button");
      b.textContent = label + "（需 " + need + "）";
      b.style.cssText = "border:0;padding:6px 10px;border-radius:8px;cursor:"+(can?"pointer":"not-allowed")+";background:"+(can?"#1d4ed8":"#374151")+";color:#fff;font-weight:600;";
      b.disabled = !can;
      b.onclick = function(){ if (can) { exchangeOnce(def.name, units, def.cost); rerender(root); } };
      return b;
    }

    right.appendChild(mkBtn("×1", 1));
    right.appendChild(mkBtn("×10", 10));
    right.appendChild(mkBtn("×50", 50));

    row.appendChild(left);
    row.appendChild(right);
    root.appendChild(row);
  }

  function renderHeader(root) {
    var head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;";

    var title = document.createElement("div");
    title.innerHTML = "🎟️ 兌換商品（使用「"+COUPON_KEY+"」）";
    title.style.cssText = "font-weight:800;font-size:16px;letter-spacing:.5px;";

    var bal = document.createElement("div");
    var have = getCouponQty();
    bal.textContent = "持有「"+COUPON_KEY+"」： " + have;
    bal.style.cssText = "background:#0b1220;border:1px solid #334155;padding:6px 10px;border-radius:8px;";

    head.appendChild(title); head.appendChild(bal);
    root.appendChild(head);
  }

  function rerender(root){
    // 重新繪製（保留在當前分頁）
    root.innerHTML = "";
    renderHeader(root);
    for (var i=0;i<EX_LIST.length;i++) renderRow(root, EX_LIST[i]);
  }

  function renderTab(root) {
    if (!HAS_INV) {
      var warn = document.createElement("div");
      warn.textContent = "❌ 缺少背包 API（getItemQuantity/removeItem/addItem）。無法使用兌換功能。";
      warn.style.cssText = "padding:10px;color:#fecaca;background:#7f1d1d;border:1px solid #b91c1c;border-radius:8px;";
      root.appendChild(warn);
      return;
    }
    rerender(root);
  }

  // ========= 註冊到 ShopHub =========
  if (w.ShopHub && typeof w.ShopHub.registerTab === "function") {
    w.ShopHub.registerTab({
      id: "couponExchange",
      title: "兌換商品",
      render: renderTab
    });
  } else {
    // 若 ShopHub 尚未載入，延後註冊
    var tryReg = function(){
      if (w.ShopHub && typeof w.ShopHub.registerTab === "function") {
        w.ShopHub.registerTab({ id:"couponExchange", title:"兌換商品", render: renderTab });
        document.removeEventListener("DOMContentLoaded", tryReg);
      }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tryReg);
    else tryReg();
  }

})(window);