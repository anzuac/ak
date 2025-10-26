// shop_token_store_tab.js — 代幣商店（高級/星痕）＋ 兌換商品（兌換券）
// 依賴：shop_hub.js（ShopHub）、背包 API（getItemQuantity/addItem/removeItem）
// 不使用存檔；即時扣除/發放道具

(function (w) {
  "use strict";

  if (!w.ShopHub) { console.error("[shop] ShopHub not found"); return; }

  // ===== 共用：背包/工具 =====
  var HAS_INV = (typeof w.getItemQuantity==="function" && typeof w.addItem==="function" && typeof w.removeItem==="function");
  function inv(name){ if(!HAS_INV) return 0; try { return Math.max(0, Number(w.getItemQuantity(name)||0)); }catch(_){ return 0; } }
  function add(name,n){ if(HAS_INV) w.addItem(name, Math.max(0,Math.floor(n||0))); }
  function remove(name,n){ if(HAS_INV) w.removeItem(name, Math.max(0,Math.floor(n||0))); }
  function logMsg(msg){ if (typeof w.logPrepend==="function") w.logPrepend(msg); else try{ console.log(msg); }catch(e){} }

  // ===== 共用：UI 元件 =====
  function el(tag, css){ var x=document.createElement(tag); if(css) x.style.cssText=css; return x; }
  function pill(txt, color){
    var span=el("span","display:inline-block;padding:3px 8px;border-radius:999px;font-weight:800;font-size:12px;border:1px solid transparent;"+
      (color==="price" ? "background:#0b1220;color:#e5e7eb;border-color:#374151" :
       color==="muted" ? "background:#1f2937;color:#9ca3af;border-color:#374151" :
                         "background:#0b1220;color:#e5e7eb;border-color:#374151"));
    span.textContent = txt; return span;
  }
  function btn(label, on, enabled){
    var b = el("button","padding:6px 10px;border:0;border-radius:10px;font-weight:800;cursor:pointer;background:"+ (enabled?"#1d4ed8":"#374151")+";color:#fff");
    b.textContent = label; b.disabled = !enabled; if (enabled) b.onclick = on; return b;
  }

  // ============================================================
  // ================ 分頁 A：代幣商店（一般商店） ================
  // ============================================================

  var TOKEN_ADV  = { key: "高級代幣" };
  var TOKEN_STAR = { key: "星痕代幣" };

  // { title, outItem, outQty, cost, buttons:[1,5,10] }
  var ADV_LIST = [
    { title:"能力方塊",       outItem:"能力方塊",       outQty:1,  cost:1,  buttons:[1,5,10] },
    { title:"選擇能力方塊",   outItem:"選擇能力方塊",   outQty:1,  cost:5,  buttons:[1,5,10] },
    { title:"銀行代幣",       outItem:"銀行代幣",       outQty:1,  cost:1,  buttons:[1,5,10] }
  ];
  var STAR_LIST = [
    { title:"能力方塊",         outItem:"能力方塊",         outQty:1,  cost:5,  buttons:[1,5,10] },
    { title:"選擇能力方塊",     outItem:"選擇能力方塊",     outQty:1,  cost:15, buttons:[1,5,10] },
    { title:"潛能方塊",         outItem:"潛能方塊",         outQty:1,  cost:4,  buttons:[1,5,10] },
    { title:"高級潛能方塊",     outItem:"高級潛能方塊",     outQty:1,  cost:12, buttons:[1,5,10] },
    { title:"擴充護盾上限石",   outItem:"擴充護盾上限石",   outQty:1,  cost:10, buttons:[1,5,10] },
    { title:"護盾補充器",       outItem:"護盾補充器",       outQty:1,  cost:5,  buttons:[1,5]   },
    { title:"生命藥水 ×10",     outItem:"生命藥水",         outQty:10, cost:1,  buttons:[1,5,10] },
    { title:"法力藥水 ×10",     outItem:"法力藥水",         outQty:10, cost:1,  buttons:[1,5,10] },
    { title:"高級生命藥水 ×5",  outItem:"高級生命藥水",     outQty:5,  cost:2,  buttons:[1,5,10] },
    { title:"高級法力藥水 ×5",  outItem:"高級法力藥水",     outQty:5,  cost:2,  buttons:[1,5,10] },
    { title:"超級生命藥水",     outItem:"超級生命藥水",     outQty:1,  cost:2,  buttons:[1,5]   },
    { title:"超級法力藥水",     outItem:"超級法力藥水",     outQty:1,  cost:2,  buttons:[1,5]   },
    { title:"SP點數券",         outItem:"SP點數券",         outQty:1,  cost:2,  buttons:[1,5,10] },
    { title:"強化道具兌換券 ×5", outItem:"強化道具兌換券",  outQty:5,  cost:1,  buttons:[1,5,10] },
  ];

  function tokenCard(tokenKey, def){
    var ownedToken = inv(tokenKey);
    var card = el("div","border:1px solid #1f2937;border-radius:12px;background:#0b1220;padding:12px;margin-bottom:10px;");
    var header = el("div","display:flex;justify-content:space-between;align-items:center;margin-bottom:8px");
    var title = el("div","font-weight:800;font-size:15px;letter-spacing:.3px");
    // 標題若未含 ×N 且 outQty>1，補上 ×N
    title.textContent = def.title + (def.outQty>1 && !/×\d+/.test(def.title) ? (" ×"+def.outQty) : "");
    header.appendChild(title);
    var rightHead = el("div","display:flex;align-items:center;gap:8px");
    rightHead.appendChild(pill("價格："+def.cost+"「"+tokenKey+"」","price"));
    header.appendChild(rightHead);
    card.appendChild(header);

    var row = el("div","display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center");
    var desc = el("div","opacity:.9;line-height:1.6");
    var showGain = (def.outQty>1 && !/×\d+/.test(def.title)) ? ("　|　每次獲得 ×"+def.outQty) : "";
    desc.innerHTML = "持有「"+tokenKey+"」：<b>"+ownedToken.toLocaleString()+"</b>"+ showGain;
    row.appendChild(desc);

    var ops = el("div","display:flex;gap:8px;align-items:center;justify-content:flex-end;min-width:220px");
    (def.buttons||[1,5,10]).forEach(function(n){
      var enough = ownedToken >= def.cost * n;
      ops.appendChild(btn("×"+n, function(){
        remove(tokenKey, def.cost*n);
        add(def.outItem, def.outQty * n);
        logMsg("🛒 兌換「"+def.title+"」×"+n+" 成功（花費 "+ (def.cost*n) +"「"+tokenKey+"」）");
        renderTokenStoreActive();
      }, enough));
    });
    row.appendChild(ops);
    card.appendChild(row);
    return card;
  }

  function renderTokenInner(root, kindKey, list, tabLabel){
    root.innerHTML = "";
    var head = el("div","display:flex;justify-content:space-between;align-items:center;margin-bottom:10px");
    var left = el("div","font-weight:800");
    left.textContent = "代幣種類："+tabLabel+"　持有："+inv(kindKey).toLocaleString();
    head.appendChild(left);
    var right = el("div","opacity:.85;font-size:12px"); right.textContent = "無限量供應（無每日限制）";
    head.appendChild(right);
    root.appendChild(head);

    list.forEach(function(def){ root.appendChild(tokenCard(kindKey, def)); });
  }

  function renderTokenStore(root){
    root.innerHTML = "";
    var frame = el("div","border:1px solid #334155;border-radius:12px;background:#0b1220;padding:12px");

    var current = "adv";
    var tabsBar;

    function mkSubTabs(cur, onChange){
      var bar = el("div","display:flex;gap:8px;margin-bottom:10px");
      function tabBtn(label, id){
        var b = el("button",'padding:6px 10px;border-radius:8px;border:0;font-weight:800;cursor:pointer;background:'+(cur===id?'#1d4ed8':'#1f2937')+';color:#fff');
        b.textContent = label; b.onclick = function(){ onChange(id); };
        return b;
      }
      bar.appendChild(tabBtn("高級代幣", "adv"));
      bar.appendChild(tabBtn("星痕代幣", "star"));
      return bar;
    }
    function onChangeSub(to){
      current = to;
      var newBar = mkSubTabs(current, onChangeSub);
      tabsBar.replaceWith(newBar); tabsBar = newBar;
      renderBody();
    }
    tabsBar = mkSubTabs(current, onChangeSub);
    frame.appendChild(tabsBar);

    var body = el("div"); frame.appendChild(body);
    function renderBody(){
      if (current==="adv") renderTokenInner(body, TOKEN_ADV.key, ADV_LIST, "高級代幣");
      else                 renderTokenInner(body, TOKEN_STAR.key, STAR_LIST, "星痕代幣");
    }
    renderBody();
    root.appendChild(frame);
  }

  function renderTokenStoreActive(){
    var body = document.getElementById("shopHubBody");
    if (!body) return;
    // 只在當前頁是代幣商店時重繪；最穩定做法是整頁重繪
    var owner = body.getAttribute("data-tab-owner"); // 若沒有也無妨
    body.innerHTML = "";
    renderTokenStore(body);
  }

  // 註冊分頁：代幣商店
  w.ShopHub.registerTab({
    id: "tokenStore",
    title: "代幣商店",
    render: renderTokenStore
  });

  // ============================================================
  // =============== 分頁 B：兌換商品（兌換券） ==================
  // ============================================================

  var COUPON_KEY = "強化道具兌換券";
  var EQUIP_LIST = [
    { name: "裝備解放石",       cost: 50 },
    { name: "防具強化卷60%",     cost: 30 },
    { name: "防具強化卷10%",     cost: 50 },
    { name: "手套強化卷60%",     cost: 30 },
    { name: "手套強化卷10%",     cost: 50 },
    { name: "裝備強化卷60%",     cost: 30 },
    { name: "武器強化卷10%",     cost: 50 },
    { name: "混沌卷軸60%",       cost: 70 },
    { name: "高級混沌卷軸60%",   cost: 200 },
    { name: "混沌選擇券",       cost: 200 },
    { name: "潛能方塊",         cost: 40 },
    { name: "高級潛能方塊",     cost: 90 },
    { name: "卷軸上限提升",     cost: 120 },
    { name: "恢復卷軸",         cost: 120 },
    { name: "完美重置卷軸",     cost: 800 }
  ];
  var GENERAL_LIST = [
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
    { name: "核心星力石",   cost: 7 }
  ];
  var CATS = [
    { id: "general", title: "素材/核心", list: GENERAL_LIST },
    { id: "equip",   title: "裝備相關",   list: EQUIP_LIST }
  ];
  var _activeCatId = "general";

  function getCouponQty(){ return inv(COUPON_KEY); }

  function exchangeOnce(itemName, units, costPerUnit, root){
    if (!HAS_INV) { alert("❌ 缺少背包 API（getItemQuantity/removeItem/addItem）。"); return; }
    units = Math.max(1, Math.floor(units||1));
    var need = units * costPerUnit;
    var have = getCouponQty();
    if (have < need) { alert("❌ 兌換券不足，需要："+need+"，持有："+have); return; }
    var before = have;
    var ok = remove(COUPON_KEY, need);
    var after = getCouponQty();
    if (ok === false || after > before - need) { alert("❌ 扣除兌換券失敗，請稍後再試。"); return; }
    add(itemName, units);
    logMsg("🎁 兌換成功：獲得「"+itemName+"」 ×"+units+"（花費兌換券 "+need+"）");
    alert("✅ 兌換成功！「"+itemName+"」 ×"+units);
    rerenderCoupon(root);
  }

  function mkQtyBtn(label, can, onClick){
    return btn(label, onClick, can);
  }

  function renderCouponRow(root, def){
    var row = el("div","display:flex;align-items:center;justify-content:space-between;padding:10px;border:1px solid #334155;border-radius:10px;background:#0b1220;margin-bottom:8px;gap:8px;");
    var left = el("div","display:flex;flex-direction:column;");
    var title = el("div","font-weight:700;font-size:14px;letter-spacing:.3px;"); title.textContent = def.name;
    var sub = el("div","opacity:.85;font-size:12px;margin-top:2px;"); sub.textContent = "每 1 個需「"+COUPON_KEY+"」 × "+def.cost;
    left.appendChild(title); left.appendChild(sub);

    var right = el("div","display:flex;gap:6px;");
    var have = getCouponQty();
    function make(label, units){
      var need = units * def.cost;
      var can = have >= need;
      return mkQtyBtn(label+"（需 "+need+"）", can, function(){ exchangeOnce(def.name, units, def.cost, root); });
    }
    right.appendChild(make("×1", 1));
    right.appendChild(make("×10", 10));
    right.appendChild(make("×50", 50));

    row.appendChild(left); row.appendChild(right);
    root.appendChild(row);
  }

  function renderCouponHeader(root){
    var head = el("div","display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;");
    var title = el("div","font-weight:800;font-size:16px;letter-spacing:.5px;"); title.innerHTML = "🎟️ 兌換商品（使用「"+COUPON_KEY+"」）";
    var bal = el("div","background:#0b1220;border:1px solid #334155;padding:6px 10px;border-radius:8px;");
    bal.textContent = "持有「"+COUPON_KEY+"」： " + getCouponQty().toLocaleString();
    head.appendChild(title); head.appendChild(bal); root.appendChild(head);
  }

  function renderCouponTabs(root){
    var bar = el("div","display:flex;gap:8px;margin:6px 0 10px 0;flex-wrap:wrap;");
    CATS.forEach(function(cat){
      var active = (_activeCatId === cat.id);
      var b = el("button","border:0;padding:6px 10px;border-radius:8px;font-weight:700;cursor:pointer;background:"+(active?"#1d4ed8":"#1f2937")+";color:#fff;");
      b.textContent = cat.title;
      b.onclick = function(){ if (_activeCatId!==cat.id){ _activeCatId=cat.id; rerenderCoupon(root); } };
      bar.appendChild(b);
    });
    root.appendChild(bar);
  }

  function rerenderCoupon(root){
    root.innerHTML = "";
    renderCouponHeader(root);
    renderCouponTabs(root);
    var cat = CATS.find(function(c){ return c.id===_activeCatId; }) || CATS[0];
    if (!cat.list.length){
      var empty = el("div","opacity:.8;padding:10px;border:1px dashed #334155;border-radius:10px;"); empty.textContent = "（本分類目前沒有可兌換項目）";
      root.appendChild(empty); return;
    }
    for (var i=0;i<cat.list.length;i++) renderCouponRow(root, cat.list[i]);
  }

  function renderCouponTab(root){
    if (!HAS_INV){
      var warn = el("div","padding:10px;color:#fecaca;background:#7f1d1d;border:1px solid #b91c1c;border-radius:8px;");
      warn.textContent = "❌ 缺少背包 API（getItemQuantity/removeItem/addItem）。無法使用兌換功能。";
      root.appendChild(warn); return;
    }
    rerenderCoupon(root);
  }

  // 註冊分頁：兌換商品
  w.ShopHub.registerTab({
    id: "couponExchange",
    title: "兌換商品",
    render: renderCouponTab
  });

})(window);