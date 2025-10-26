// bank_savings_tab.js — 特殊銀行（v4.1：即時更新、VIP 動態 + 彩虹閃爍、VIP 代幣加成門檻）
// 依賴：save_hub_es5.js、town_hub.js、player.js（gold/gem）與背包 API（getItemQuantity/addItem/removeItem）
(function (w) {
  "use strict";

  if (!w.TownHub) { console.error("❌ bank_savings_tab.js: TownHub 未載入"); return; }
  if (!w.SaveHub) { console.error("❌ bank_savings_tab.js: SaveHub 未載入"); return; }

  // ====== 常數 / 設定 ======
  var NS = "bank:savings";
  var TAB_ID = "bankSaving";
  var TAB_TITLE = "特殊銀行";

  // 物品鍵值（背包）
  var KEY_STONE = "強化石";
  var KEY_ADV_TOKEN = "高級代幣";
  var KEY_BANK_TOKEN = "銀行代幣";

  // 等級上限
  var MAX_LV = 20;

  // 容量（Lv1=100萬/100萬；每升級 ×2）
  var BASE_GOLD_CAP  = 1000000;
  var BASE_STONE_CAP = 1000000;

  // 代幣生產規則（每 18 小時一個「期」）
  // 基礎門檻顆數：10萬 / 200萬 / 300萬 / 400萬 / 500萬 / 600萬（最多 6 顆）
  // VIP 額外加成門檻：
  //  - 白金 VIP：金幣 ≥ 1,000 萬 → 額外 +2 顆/期
  //  - 彩虹 VIP：金幣 ≥ 1 億     → 再額外 +2 顆/期
  var TOKEN_THRESHOLDS = [100000, 2000000, 3000000, 4000000, 5000000, 6000000];
  var VIP_EXTRA_TOKEN_RULES = [
    { tierMin: 2, goldGte: 10_000_000, extra: 2 },   // 白金
    { tierMin: 4, goldGte:100_000_000, extra: 2 },   // 彩虹
  ];
  var TOKEN_PERIOD_SEC = 18 * 3600;

  // 利息（日利率）：金幣 0.0025%；強化石 ×2
  var DAILY_INTEREST_GOLD  = 0.000025;
  var DAILY_INTEREST_STONE = DAILY_INTEREST_GOLD * 2;
  var SEC_PER_DAY = 86400;

  // 升級消耗：成本 = 目前等級（以「銀行代幣」）
  function levelUpCost(curLv) { return Math.max(1, curLv); }

  // 背包 API 檢查
  var HAS_INV = (typeof w.getItemQuantity === "function" &&
                 typeof w.removeItem === "function" &&
                 typeof w.addItem === "function");

  // ===== VIP（Lv.20 解鎖；僅金幣/鑽石贊助；沒有代幣贊助）=====
  // bonus 為「對日利率」的額外加成
  var VIP_TIERS = [
    { id:0, name:'普通會員', needGold:0,            needGem:0,        bonus:0,        frame:'#334155', inner:'#111827' },
    { id:1, name:'黃金VIP', needGold:10_000_000,    needGem:10_000,   bonus:0.000005, frame:'#facc15', inner:'#1f2937' },
    { id:2, name:'白金VIP', needGold:100_000_000,   needGem:100_000,  bonus:0.000000, frame:'#e5e7eb', inner:'#1f2937' },
    { id:3, name:'柏金VIP', needGold:1_000_000_000, needGem:500_000,  bonus:0.000005, frame:'#c0a060', inner:'#0b1220' },
    { id:4, name:'彩虹VIP', needGold:10_000_000_000,needGem:3_000_000,bonus:0.000010, frame:'RAINBOW', inner:'#0b1220' },
  ];

  // ====== SaveHub 狀態（_ver=4）======
  function loadState() {
    var now = Date.now();
    var s = w.SaveHub.get(NS, null);
    if (!s || !s._ver) {
      s = {
        _ver: 4,
        lv: 1,
        gold: 0,
        stone: 0,
        tokenProg: 0,
        interestGoldBuf: 0,
        interestStoneBuf: 0,
        lastTs: now,
        autoReinvestGold: false,
        autoReinvestStone: false,
        stats: { totalGoldInterest:0, totalStoneInterest:0, totalTokens:0, maxGoldHeld:0, maxStoneHeld:0 },
        vip: { unlocked:false, tier:0, donatedGold:0, donatedGem:0 }
      };
      w.SaveHub.set(NS, s, { replace: true });
      return s;
    }
    if (!s.vip) {
      s.vip = { unlocked:false, tier:0, donatedGold:0, donatedGem:0 };
      s._ver = 4;
      w.SaveHub.set(NS, s, { replace: true });
    }
    // 正常化
    s.lv  = Math.max(1, Math.min(MAX_LV, Number(s.lv || 1)));
    s.gold  = Math.max(0, Number(s.gold || 0));
    s.stone = Math.max(0, Number(s.stone || 0));
    s.tokenProg = Math.max(0, Number(s.tokenProg || 0));
    s.interestGoldBuf  = Math.max(0, Number(s.interestGoldBuf || 0));
    s.interestStoneBuf = Math.max(0, Number(s.interestStoneBuf || 0));
    s.lastTs = Number(s.lastTs || now);
    s.autoReinvestGold  = !!s.autoReinvestGold;
    s.autoReinvestStone = !!s.autoReinvestStone;
    s.stats = s.stats || { totalGoldInterest:0, totalStoneInterest:0, totalTokens:0, maxGoldHeld:0, maxStoneHeld:0 };
    s.vip = s.vip || { unlocked:false, tier:0, donatedGold:0, donatedGem:0 };
    return s;
  }
  function saveState(next, replace) { w.SaveHub.set(NS, next, { replace: !!replace }); }
  var state = loadState();

  // ====== 衍生參數（由等級決定）======
  function deriveByLevel(lv) {
    var mul = Math.pow(2, Math.max(0, lv - 1)); // ×2 成長
    return {
      capGold:  Math.floor(BASE_GOLD_CAP  * mul),
      capStone: Math.floor(BASE_STONE_CAP * mul)
    };
  }

  // ====== 工具：玩家/背包 ======
  function playerGold() { return Math.max(0, Number(w.player?.gold || 0)); }
  function setPlayerGold(v){ if (w.player){ w.player.gold = Math.max(0, Math.floor(v)); if (typeof w.updateResourceUI === "function") w.updateResourceUI(); } }
  function playerGem(){ return Math.max(0, Number(w.player?.gem || 0)); }
  function setPlayerGem(v){ if (w.player){ w.player.gem = Math.max(0, Math.floor(v)); if (typeof w.updateResourceUI === "function") w.updateResourceUI(); } }
  function invQty(name){ if (!HAS_INV) return 0; try { return Math.max(0, Number(w.getItemQuantity(name) || 0)); } catch(_) { return 0; } }
  function addItem(name, n){ if (HAS_INV) w.addItem(name, Math.max(0, Math.floor(n))); }
  function removeItem(name, n){ if (HAS_INV) w.removeItem(name, Math.max(0, Math.floor(n))); }

  // ===== VIP 相關 =====
  function vipBonusRate(){
    var t = state.vip?.tier || 0;
    var def = VIP_TIERS[t] || VIP_TIERS[0];
    return Number(def.bonus||0);
  }
  function vipNextTier(){ var cur = state.vip?.tier || 0; return VIP_TIERS[cur+1] || null; }
  function canUpgradeVip(nxt){
    if (!nxt) return false;
    if (!state.vip.unlocked) return false;
    return (state.vip.donatedGold >= nxt.needGold) && (state.vip.donatedGem >= nxt.needGem);
  }
  function donateGoldVIP(amount){
    if (!state.vip.unlocked) return alert('需 Lv.20 才能贊助');
    amount = Math.max(1, Math.floor(Number(amount)||0));
    if (playerGold() < amount) return alert('金幣不足');
    setPlayerGold(playerGold() - amount);
    state.vip.donatedGold += amount;
    saveState(state, true);
    refreshActive(); // 即時更新 VIP 進度
  }
  function donateGemVIP(amount){
    if (!state.vip.unlocked) return alert('需 Lv.20 才能贊助');
    amount = Math.max(1, Math.floor(Number(amount)||0));
    if (playerGem() < amount) return alert('鑽石不足');
    setPlayerGem(playerGem() - amount);
    state.vip.donatedGem += amount;
    saveState(state, true);
    refreshActive();
  }
  function upgradeVip(){
    var nxt = vipNextTier();
    if (!canUpgradeVip(nxt)) return;
    state.vip.tier = nxt.id;
    saveState(state, true);
    if (w.logPrepend) w.logPrepend('✨ VIP 提升至【'+nxt.name+'】！');
    refreshActive();
  }

  // ====== 每期可生產顆數（基礎 + VIP 額外）======
  function tokensPerPeriodByGold(goldNow) {
    var cnt = 0;
    for (var i=0;i<TOKEN_THRESHOLDS.length;i++){
      if (goldNow >= TOKEN_THRESHOLDS[i]) cnt++;
    }
    // VIP 額外規則
    var tier = state.vip?.tier || 0;
    for (var j=0;j<VIP_EXTRA_TOKEN_RULES.length;j++){
      var r = VIP_EXTRA_TOKEN_RULES[j];
      if (tier >= r.tierMin && goldNow >= r.goldGte) cnt += r.extra;
    }
    return Math.max(0, cnt);
  }

  // ====== 結算（每秒）======
  function settle(elapsedSec) {
    if (!(elapsedSec > 0)) return;

    var d = deriveByLevel(state.lv);

    // 代幣進度（連續）
    var perPeriod = tokensPerPeriodByGold(state.gold); // 基礎 + VIP 額外
    var perSec = (perPeriod > 0) ? (perPeriod / TOKEN_PERIOD_SEC) : 0; // 每秒顆數
    state.tokenProg += perSec * elapsedSec;

    // 利息累積（含 VIP 加成）
    var goldRate = DAILY_INTEREST_GOLD + vipBonusRate();
    var stoneRate = DAILY_INTEREST_STONE + vipBonusRate();

    if (state.gold > 0) {
      var goldPerSec = state.gold * (goldRate / SEC_PER_DAY);
      state.interestGoldBuf += goldPerSec * elapsedSec;
    }
    if (state.stone > 0) {
      var stonePerSec = state.stone * (stoneRate / SEC_PER_DAY);
      state.interestStoneBuf += stonePerSec * elapsedSec;
    }

    // 自動再投資（整數部分）
    if (state.autoReinvestGold) {
      var gainG = Math.floor(Math.max(0, state.interestGoldBuf || 0));
      if (gainG > 0) {
        var capLeftG = Math.max(0, d.capGold - state.gold);
        var putG = Math.min(gainG, capLeftG);
        if (putG > 0) {
          state.interestGoldBuf -= putG;
          state.gold += putG;
          state.stats.totalGoldInterest += putG;
          if (state.gold > state.stats.maxGoldHeld) state.stats.maxGoldHeld = state.gold;
        }
      }
    }
    if (state.autoReinvestStone) {
      var gainS = Math.floor(Math.max(0, state.interestStoneBuf || 0));
      if (gainS > 0) {
        var capLeftS = Math.max(0, d.capStone - state.stone);
        var putS = Math.min(gainS, capLeftS);
        if (putS > 0) {
          state.interestStoneBuf -= putS;
          state.stone += putS;
          state.stats.totalStoneInterest += putS;
          if (state.stone > state.stats.maxStoneHeld) state.stats.maxStoneHeld = state.stone;
        }
      }
    }

    // Lv20 自動解鎖 VIP（只解鎖，不自動升級）
    if (state.lv >= 20 && !state.vip.unlocked) {
      state.vip.unlocked = true;
      if (w.logPrepend) w.logPrepend('🎉 已解鎖 VIP 系統（可於下方累積贊助升級）');
    }

    // 時間戳
    state.lastTs += elapsedSec * 1000;
    saveState(state, true);
  }

  function settleToNow() {
    var now = Date.now();
    var dtSec = Math.max(0, Math.floor((now - (state.lastTs || now)) / 1000));
    if (dtSec > 0) settle(dtSec);
  }

  // ====== 即時刷新（避免整頁重繪，輸入不跳；所有動作都調用）======
  function refreshActive(){
    var body = document.getElementById('townHubBody');
    if (!body) return;
    if (String(body.getAttribute('data-tab-owner')||'') !== TAB_ID) return;
    updateDynamic(body);
  }

  // ====== 存入 / 提領 ======
  function depositGold(amount){
    settleToNow();
    amount = Math.max(1, Math.floor(Number(amount)||0));
    var d = deriveByLevel(state.lv);
    var can = Math.min(amount, playerGold(), Math.max(0, d.capGold - state.gold));
    if (can <= 0) { alert("無法存入：可能超過上限或金幣不足"); return; }
    setPlayerGold(playerGold() - can);
    state.gold += can;
    if (state.gold > state.stats.maxGoldHeld) state.stats.maxGoldHeld = state.gold;
    saveState(state, true);
    if (w.logPrepend) w.logPrepend("🏦 存入金幣 " + can);
    refreshActive();
  }
  function withdrawGold(amount){
    settleToNow();
    amount = Math.max(1, Math.floor(Number(amount)||0));
    var can = Math.min(amount, state.gold);
    if (can <= 0) { alert("無法領取：銀行存金不足"); return; }
    state.gold -= can;
    setPlayerGold(playerGold() + can);
    saveState(state, true);
    if (w.logPrepend) w.logPrepend("🏦 提領金幣 " + can);
    refreshActive();
  }
  function depositStone(amount){
    if (!HAS_INV){ alert("缺少背包介面"); return; }
    settleToNow();
    amount = Math.max(1, Math.floor(Number(amount)||0));
    var d = deriveByLevel(state.lv);
    var have = invQty(KEY_STONE);
    var can = Math.min(amount, have, Math.max(0, d.capStone - state.stone));
    if (can <= 0) { alert("無法存入：可能超過上限或庫存不足"); return; }
    removeItem(KEY_STONE, can);
    state.stone += can;
    if (state.stone > state.stats.maxStoneHeld) state.stats.maxStoneHeld = state.stone;
    saveState(state, true);
    if (w.logPrepend) w.logPrepend("🏦 存入強化石 " + can);
    refreshActive();
  }
  function withdrawStone(amount){
    if (!HAS_INV){ alert("缺少背包介面"); return; }
    settleToNow();
    amount = Math.max(1, Math.floor(Number(amount)||0));
    var can = Math.min(amount, state.stone);
    if (can <= 0) { alert("無法領取：銀行存石不足"); return; }
    state.stone -= can;
    addItem(KEY_STONE, can);
    saveState(state, true);
    if (w.logPrepend) w.logPrepend("🏦 提領強化石 " + can);
    refreshActive();
  }

  // ====== 領取利息 / 領取代幣 ======
  function claimInterestGold(){
    settleToNow();
    var gain = Math.floor(Math.max(0, state.interestGoldBuf || 0));
    if (gain <= 0) { alert("目前沒有可領取的金幣利息"); return; }

    if (state.autoReinvestGold) {
      var d = deriveByLevel(state.lv);
      var capLeft = Math.max(0, d.capGold - state.gold);
      var put = Math.min(gain, capLeft);
      if (put > 0) {
        state.interestGoldBuf -= put;
        state.gold += put;
        state.stats.totalGoldInterest += put;
        if (state.gold > state.stats.maxGoldHeld) state.stats.maxGoldHeld = state.gold;
        saveState(state, true);
        if (w.logPrepend) w.logPrepend("🔁 金幣利息自動再投資 +" + put);
        refreshActive();
      } else {
        alert("容量已滿，無法再投資。請先提高等級或提領。");
      }
      return;
    }

    state.interestGoldBuf -= gain;
    setPlayerGold(playerGold() + gain);
    state.stats.totalGoldInterest += gain;
    saveState(state, true);
    if (w.logPrepend) w.logPrepend("💰 領取利息（金幣）+" + gain);
    refreshActive();
  }
  function claimInterestStone(){
    if (!HAS_INV){ alert("缺少背包介面"); return; }
    settleToNow();
    var gain = Math.floor(Math.max(0, state.interestStoneBuf || 0));
    if (gain <= 0) { alert("目前沒有可領取的強化石利息"); return; }

    if (state.autoReinvestStone) {
      var d = deriveByLevel(state.lv);
      var capLeft = Math.max(0, d.capStone - state.stone);
      var put = Math.min(gain, capLeft);
      if (put > 0) {
        state.interestStoneBuf -= put;
        state.stone += put;
        state.stats.totalStoneInterest += put;
        if (state.stone > state.stats.maxStoneHeld) state.stats.maxStoneHeld = state.stone;
        saveState(state, true);
        if (w.logPrepend) w.logPrepend("🔁 強化石利息自動再投資 +" + put);
        refreshActive();
      } else {
        alert("容量已滿，無法再投資。請先提高等級或提領。");
      }
      return;
    }

    state.interestStoneBuf -= gain;
    addItem(KEY_STONE, gain);
    state.stats.totalStoneInterest += gain;
    saveState(state, true);
    if (w.logPrepend) w.logPrepend("💎 領取利息（強化石）+" + gain);
    refreshActive();
  }
  function claimTokens(){
    if (!HAS_INV){ alert("缺少背包介面"); return; }
    settleToNow();
    var whole = Math.floor(state.tokenProg);
    if (whole <= 0) { alert("尚未生成可領取的代幣"); return; }
    state.tokenProg -= whole;
    addItem(KEY_ADV_TOKEN, whole);
    state.stats.totalTokens += whole;
    saveState(state, true);
    if (w.logPrepend) w.logPrepend("🎟️ 領取高級代幣 ×" + whole);
    refreshActive();
  }

  // ====== 利息預估工具（含 VIP 加成）======
  function dailyInterestGoldFor(amount){
    amount = Math.max(0, Number(amount)||0);
    return Math.floor(amount * (DAILY_INTEREST_GOLD + vipBonusRate()));
  }
  function dailyInterestStoneFor(amount){
    amount = Math.max(0, Number(amount)||0);
    return Math.floor(amount * (DAILY_INTEREST_STONE + vipBonusRate()));
  }

  // ====== UI 工具 ======
  function fmtNum(n){ n = Math.floor(Number(n)||0); return n.toLocaleString(); }
  function fmtTime(sec){
    sec = Math.max(0, Math.floor(sec||0));
    var d = Math.floor(sec/86400); sec -= d*86400;
    var h = Math.floor(sec/3600);  sec -= h*3600;
    var m = Math.floor(sec/60);    var s = sec - m*60;
    var hh = (h<10?"0":"")+h, mm=(m<10?"0":"")+m, ss=(s<10?"0":"")+s;
    return (d>0? (d+"d "):"") + hh+":"+mm+":"+ss;
  }

  // —— Style（彩虹 VIP 閃爍外框）一次性注入 —— //
  var _styleInjected = false;
  function ensureVipStyle(){
    if (_styleInjected) return;
    _styleInjected = true;
    var css = document.createElement('style');
    css.textContent =
      "@keyframes vipPulse{0%{box-shadow:0 0 0px rgba(255,255,255,0.25)}50%{box-shadow:0 0 16px rgba(255,255,255,0.55)}100%{box-shadow:0 0 0px rgba(255,255,255,0.25)}}" +
      ".vip-rainbow{border-image: linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet) 1; animation: vipPulse 1.8s ease-in-out infinite;}";
    document.head.appendChild(css);
  }

  // —— 輸入穩定：重繪前快照焦點與值，重繪後還原 —— //
  function snapshotFocus(container){
    var a = document.activeElement;
    if (!a || !container.contains(a) || a.tagName!=="INPUT") return null;
    return { bind: a.getAttribute("data-bind") || null, value: a.value, selStart: a.selectionStart, selEnd: a.selectionEnd };
  }
  function restoreFocus(container, snap){
    if (!snap || !snap.bind) return;
    var input = container.querySelector('input[data-bind="'+snap.bind+'"]');
    if (!input) return;
    input.value = snap.value;
    input.focus();
    try{ input.setSelectionRange(snap.selStart, snap.selEnd); }catch(_){}
  }

  // ====== UI（渲染）======
  function renderRules(root){
    var card = document.createElement('div');
    card.style.cssText = "background:#0b1220;border:1px solid #263247;border-radius:12px;padding:10px;margin-bottom:10px";
    card.innerHTML =
      "<div style='font-weight:800;margin-bottom:6px;color:#93c5fd'>📜 規則</div>"+
      "<div style='opacity:.9;line-height:1.6'>"+
      "• 等級上限 "+MAX_LV+"；Lv1 容量：金幣 100萬、強化石 100萬；<b>每升級容量 ×2</b>。<br>"+
      "• 代幣產能（每期 18 小時）：基礎門檻最多 6 顆（10萬/200萬/300萬/400萬/500萬/600萬）。<br>"+
      "　　白金 VIP：金幣 ≥ 1,000 萬 → 額外 +2 顆/期；彩虹 VIP：金幣 ≥ 1 億 → 再 +2 顆/期。<br>"+
      "• 利息：金幣每天 0.0025%，強化石每天 0.0050%（雙倍），VIP 另有加成。<br>"+
      "• 升級：消耗「銀行代幣」，成本=目前等級。<br>"+
      "• VIP：<b>Lv.20</b> 解鎖；只需金幣/鑽石累積贊助，即可升級。"+
      "</div>";
    root.appendChild(card);
  }

  function renderHeader(root){
    var card = document.createElement('div');
    card.style.cssText = "background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap";
    var left = document.createElement('div');
    left.innerHTML =
      "<div style='font-weight:800;font-size:16px'>🏦 特殊銀行</div>" +
      "<div style='opacity:.9;margin-top:4px'>等級：<b id='bankLv'>Lv."+state.lv+"</b>（上限 "+MAX_LV+"）</div>";
    var right = document.createElement('div');
    right.style.cssText = "display:flex;gap:8px;align-items:center";
    var upBtn = document.createElement('button');
    var cost = levelUpCost(state.lv);
    upBtn.id = "btnLevelUp";
    upBtn.textContent = (state.lv>=MAX_LV) ? "已滿級" : ("升級（消耗「"+KEY_BANK_TOKEN+"」×"+cost+"）");
    upBtn.disabled = (state.lv>=MAX_LV);
    upBtn.style.cssText = "background:"+(upBtn.disabled?"#374151":"#f59e0b")+";color:#0b1220;border:0;padding:8px 12px;border-radius:10px;cursor:"+(upBtn.disabled?"not-allowed":"pointer")+";font-weight:800";
    upBtn.onclick = function(){ tryLevelUp(); };
    right.appendChild(upBtn);
    card.appendChild(left); card.appendChild(right);
    root.appendChild(card);
  }

  function renderVIP(root){
    ensureVipStyle();

    var vip = state.vip || {unlocked:false,tier:0};
    var cur = VIP_TIERS[vip.tier] || VIP_TIERS[0];
    var next = VIP_TIERS[vip.tier+1];

    var card=document.createElement('div');
    card.id = 'vipCard';
    var borderCss = (cur.frame==='RAINBOW')
      ? 'border:3px solid; border-image-slice:1;'
      : 'border:3px solid '+cur.frame+';';
    var extraClass = (cur.frame==='RAINBOW') ? 'vip-rainbow' : '';
    card.className = extraClass;
    card.style.cssText='margin-bottom:10px;border-radius:16px;padding:12px;'+borderCss+'background:'+cur.inner+';';

    var title = "<div style='font-weight:800;font-size:16px' id='vipName'>🏅 "+cur.name+"</div>";
    var bonus = "<div style='margin:6px 0 10px 0;opacity:.9'>銀行利息加成：<b id='vipBonus'>+"+((cur.bonus*100).toFixed(4))+"%</b></div>";
    card.innerHTML = title + bonus;

    var lockTxt = document.createElement('div');
    lockTxt.id = 'vipLock';
    if (!vip.unlocked) {
      lockTxt.style.cssText='opacity:.9';
      lockTxt.textContent='🔒 需先達 Lv.20 才能解鎖 VIP 贊助系統。';
      card.appendChild(lockTxt);
      root.appendChild(card);
      return;
    }

    if (!next){
      var max = document.createElement('div');
      max.style.cssText='color:#22c55e;font-weight:700';
      max.id = 'vipMaxMsg';
      max.textContent='已達最高等級（彩虹VIP）';
      card.appendChild(max);
      root.appendChild(card);
      return;
    }

    // 下一階資訊
    var nextTitle = document.createElement('div');
    nextTitle.style.cssText='font-weight:700;margin-bottom:6px';
    nextTitle.id='vipNextName';
    nextTitle.textContent = '➡️ 下一階：' + next.name;
    card.appendChild(nextTitle);

    function barRow(idPrefix, lbl, curVal, needVal, color){
      var wrap=document.createElement('div');
      wrap.style.cssText='margin:6px 0';
      var lab=document.createElement('div'); lab.style.cssText='font-size:13px;opacity:.95;margin-bottom:4px';
      lab.id = idPrefix+'Lab';
      lab.textContent = lbl + '：' + fmtNum(curVal) + ' / ' + fmtNum(needVal);
      var outer=document.createElement('div'); outer.style.cssText='height:10px;background:#1f2937;border-radius:8px;overflow:hidden';
      outer.id=idPrefix+'Outer';
      var inner=document.createElement('div'); inner.id=idPrefix+'Bar'; inner.style.cssText='height:100%;width:'+(needVal>0?Math.min(100,(curVal/needVal)*100):100).toFixed(2)+'%;background:'+color;
      outer.appendChild(inner); wrap.appendChild(lab); wrap.appendChild(outer); return wrap;
    }
    card.appendChild(barRow('vipGold', '金幣', vip.donatedGold, next.needGold, '#38bdf8'));
    card.appendChild(barRow('vipGem',  '鑽石', vip.donatedGem,  next.needGem,  '#60a5fa'));

    // 贊助輸入（金幣 / 鑽石）
    var donateRow=document.createElement('div');
    donateRow.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;margin-top:10px';
    (function(){
      var box=document.createElement('div'); box.style.cssText='border:1px solid #1f2937;border-radius:12px;padding:8px';
      var ip=document.createElement('input'); ip.type='number'; ip.placeholder='金幣數量'; ip.setAttribute('data-bind','vipGold');
      ip.style.cssText='width:140px;background:#0b1220;border:1px solid #334155;border-radius:10px;padding:8px;color:#e5e7eb';
      var btn=document.createElement('button'); btn.textContent='贊助金幣';
      btn.style.cssText='background:#fbbf24;color:#0b1220;border:0;padding:8px 12px;border-radius:10px;font-weight:800;margin-left:6px;cursor:pointer';
      btn.onclick=function(){ donateGoldVIP(Math.floor(Number(ip.value)||0)); ip.value=''; };
      var row=document.createElement('div'); row.style.cssText='display:flex;gap:6px;align-items:center';
      row.appendChild(ip); row.appendChild(btn); box.appendChild(row); donateRow.appendChild(box);
    })();
    (function(){
      var box=document.createElement('div'); box.style.cssText='border:1px solid #1f2937;border-radius:12px;padding:8px';
      var ip=document.createElement('input'); ip.type='number'; ip.placeholder='鑽石數量'; ip.setAttribute('data-bind','vipGem');
      ip.style.cssText='width:140px;background:#0b1220;border:1px solid #334155;border-radius:10px;padding:8px;color:#e5e7eb';
      var btn=document.createElement('button'); btn.textContent='贊助鑽石';
      btn.style.cssText='background:#60a5fa;color:#0b1220;border:0;padding:8px 12px;border-radius:10px;font-weight:800;margin-left:6px;cursor:pointer';
      btn.onclick=function(){ donateGemVIP(Math.floor(Number(ip.value)||0)); ip.value=''; };
      var row=document.createElement('div'); row.style.cssText='display:flex;gap:6px;align-items:center';
      row.appendChild(ip); row.appendChild(btn); box.appendChild(row); donateRow.appendChild(box);
    })();
    card.appendChild(donateRow);

    // 升級按鈕
    var ok = canUpgradeVip(next);
    var btnUp=document.createElement('button');
    btnUp.id='btnVipUpgrade';
    btnUp.textContent = ok ? '升級 VIP' : '尚未達標';
    btnUp.disabled = !ok;
    btnUp.style.cssText='background:'+(ok?'#22c55e':'#374151')+';color:#0b1220;border:0;padding:8px 12px;border-radius:10px;font-weight:800;margin-top:10px;cursor:'+(ok?'pointer':'not-allowed');
    btnUp.onclick=function(){ if (ok) upgradeVip(); };
    card.appendChild(btnUp);

    root.appendChild(card);
  }

  function renderBalances(root, d){
    var card = document.createElement('div');
    card.style.cssText = "background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:12px;margin-bottom:12px";

    // 自動再投資
    var autoLine = document.createElement('div');
    autoLine.style.cssText = "display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:10px";
    autoLine.innerHTML = "<div style='font-weight:700'>🔁 自動利息再投資</div>";
    var chkG = document.createElement('input'); chkG.type = "checkbox"; chkG.checked = !!state.autoReinvestGold;
    var lblG = document.createElement('label'); lblG.style.cssText="display:flex;align-items:center;gap:6px;cursor:pointer";
    lblG.appendChild(chkG); lblG.appendChild(document.createTextNode("金幣自動再投資"));
    chkG.onchange = function(){ state.autoReinvestGold = !!chkG.checked; saveState(state,true); refreshActive(); };
    var chkS = document.createElement('input'); chkS.type = "checkbox"; chkS.checked = !!state.autoReinvestStone;
    var lblS = document.createElement('label'); lblS.style.cssText="display:flex;align-items:center;gap:6px;cursor:pointer";
    lblS.appendChild(chkS); lblS.appendChild(document.createTextNode("強化石自動再投資"));
    chkS.onchange = function(){ state.autoReinvestStone = !!chkS.checked; saveState(state,true); refreshActive(); };
    autoLine.appendChild(lblG); autoLine.appendChild(lblS);
    card.appendChild(autoLine);

    // 金幣
    var goldLine = document.createElement('div');
    goldLine.style.cssText = "display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:8px";
    goldLine.innerHTML =
      "<div>銀行金幣：<b id='bankGold'>"+fmtNum(state.gold)+"</b> / 上限 <b id='capGold'>"+fmtNum(d.capGold)+"</b></div>" +
      "<div>玩家金幣：<b id='playerGold'>"+fmtNum(playerGold())+"</b></div>";
    var gAct = document.createElement('div');
    gAct.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
    var gIn = document.createElement('input'); gIn.type="number"; gIn.placeholder="金幣數量"; gIn.setAttribute("data-bind","inGold"); gIn.style.cssText="width:140px;padding:6px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e5e7eb";
    var gBtn1 = document.createElement('button'); gBtn1.textContent="存入"; gBtn1.style.cssText="background:#2563eb;color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:700";
    var gBtn2 = document.createElement('button'); gBtn2.textContent="提領"; gBtn2.style.cssText="background:#334155;color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:700";
    gBtn1.onclick = function(){ depositGold(gIn.value); gIn.value=''; };
    gBtn2.onclick = function(){ withdrawGold(gIn.value); gIn.value=''; };
    gAct.appendChild(gIn); gAct.appendChild(gBtn1); gAct.appendChild(gBtn2);

    var gInfo = document.createElement('div');
    gInfo.style.cssText = "opacity:.9;font-size:12px;margin-top:6px;line-height:1.6";
    gInfo.innerHTML = "當前每日利息：約 <b id='goldDaily'>0</b> 金幣　|　存入後預估：約 <b id='goldDailyEst'>0</b> 金幣 / 日";
    function updateGoldEst(){
      var d2 = deriveByLevel(state.lv);
      var val = Math.max(0, Math.floor(Number(gIn.value)||0));
      var canDeposit = Math.min(val, playerGold(), Math.max(0, d2.capGold - state.gold));
      var curDaily  = dailyInterestGoldFor(state.gold);
      var estDaily  = dailyInterestGoldFor(state.gold + canDeposit);
      var elCur = document.getElementById('goldDaily');
      var elEst = document.getElementById('goldDailyEst');
      if (elCur) elCur.textContent = curDaily.toLocaleString();
      if (elEst) elEst.textContent = estDaily.toLocaleString();
    }
    gIn.addEventListener('input', updateGoldEst);
    setTimeout(updateGoldEst, 0);

    // 強化石
    var stoneLine = document.createElement('div');
    stoneLine.style.cssText = "display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:10px 0 8px 0";
    stoneLine.innerHTML =
      "<div>銀行強化石：<b id='bankStone'>"+fmtNum(state.stone)+"</b> / 上限 <b id='capStone'>"+fmtNum(d.capStone)+"</b></div>" +
      "<div>持有強化石：<b id='invStone'>"+fmtNum(invQty(KEY_STONE))+"</b></div>";
    var sAct = document.createElement('div');
    sAct.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
    var sIn = document.createElement('input'); sIn.type="number"; sIn.placeholder="強化石數量"; sIn.setAttribute("data-bind","inStone"); sIn.style.cssText="width:140px;padding:6px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e5e7eb";
    var sBtn1 = document.createElement('button'); sBtn1.textContent="存入"; sBtn1.style.cssText="background:#2563eb;color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:700";
    var sBtn2 = document.createElement('button'); sBtn2.textContent="提領"; sBtn2.style.cssText="background:#334155;color:#fff;border:0;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:700";
    sBtn1.onclick = function(){ depositStone(sIn.value); sIn.value=''; };
    sBtn2.onclick = function(){ withdrawStone(sIn.value); sIn.value=''; };
    sAct.appendChild(sIn); sAct.appendChild(sBtn1); sAct.appendChild(sBtn2);

    var sInfo = document.createElement('div');
    sInfo.style.cssText = "opacity:.9;font-size:12px;margin-top:6px;line-height:1.6";
    sInfo.innerHTML = "當前每日利息：約 <b id='stoneDaily'>0</b> 顆強化石　|　存入後預估：約 <b id='stoneDailyEst'>0</b> 顆 / 日";
    function updateStoneEst(){
      var d2 = deriveByLevel(state.lv);
      var val = Math.max(0, Math.floor(Number(sIn.value)||0));
      var have = invQty(KEY_STONE);
      var canDeposit = Math.min(val, have, Math.max(0, d2.capStone - state.stone));
      var curDaily  = dailyInterestStoneFor(state.stone);
      var estDaily  = dailyInterestStoneFor(state.stone + canDeposit);
      var elCur = document.getElementById('stoneDaily');
      var elEst = document.getElementById('stoneDailyEst');
      if (elCur) elCur.textContent = curDaily.toLocaleString();
      if (elEst) elEst.textContent = estDaily.toLocaleString();
    }
    sIn.addEventListener('input', updateStoneEst);
    setTimeout(updateStoneEst, 0);

    card.appendChild(goldLine);
    card.appendChild(gAct);
    card.appendChild(gInfo);
    card.appendChild(stoneLine);
    card.appendChild(sAct);
    card.appendChild(sInfo);
    root.appendChild(card);
  }

  function renderInterestAndTokens(root){
    var card = document.createElement('div');
    card.style.cssText = "background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:12px;margin-bottom:12px";

    var goldRate = DAILY_INTEREST_GOLD + vipBonusRate();
    var stoneRate = DAILY_INTEREST_STONE + vipBonusRate();

    // 利息（分開顯示）
    var gReady = Math.floor(Math.max(0, state.interestGoldBuf || 0));
    var sReady = Math.floor(Math.max(0, state.interestStoneBuf || 0));
    var lineI = document.createElement('div');
    lineI.style.cssText = "display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:10px;align-items:center";
    var leftI = document.createElement('div');
    leftI.innerHTML =
      "💰 金幣利息可領：<b id='interestGold'>"+fmtNum(gReady)+"</b>（日利率 "+(goldRate*100).toFixed(4)+"%）<br>"+
      "💎 強化石利息可領：<b id='interestStone'>"+fmtNum(sReady)+"</b>（日利率 "+(stoneRate*100).toFixed(4)+"%）";
    var rightI = document.createElement('div');
    rightI.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
    var btnIG = document.createElement('button'); btnIG.textContent = "領取金幣利息";
    btnIG.style.cssText = "background:#16a34a;color:#fff;border:0;padding:8px 12px;border-radius:10px;cursor:pointer;font-weight:800";
    btnIG.onclick = function(){ claimInterestGold(); };
    var btnIS = document.createElement('button'); btnIS.textContent = "領取強化石利息";
    btnIS.style.cssText = "background:#22c55e;color:#0b1220;border:0;padding:8px 12px;border-radius:10px;cursor:pointer;font-weight:800";
    btnIS.onclick = function(){ claimInterestStone(); };
    rightI.appendChild(btnIG); rightI.appendChild(btnIS);
    lineI.appendChild(leftI); lineI.appendChild(rightI);

    // 代幣（進度條/倒數）
    var perPeriod = tokensPerPeriodByGold(state.gold);
    var perSec = (perPeriod > 0) ? (perPeriod / TOKEN_PERIOD_SEC) : 0;
    var whole = Math.floor(state.tokenProg);
    var frac = state.tokenProg - whole;

    var lineT = document.createElement('div');
    lineT.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap";
    lineT.innerHTML =
      "<div>🎟️ 可領高級代幣：<b id='tokenCan'>"+whole+"</b> 顆｜產能（每18小時）：<b id='tokenRate'>"+perPeriod+"</b> 顆</div>";
    var btnT = document.createElement('button');
    btnT.textContent = "領取代幣";
    btnT.style.cssText = "background:#f59e0b;color:#0b1220;border:0;padding:8px 12px;border-radius:10px;cursor:pointer;font-weight:800";
    btnT.onclick = function(){ claimTokens(); };

    var progWrap = document.createElement('div');
    progWrap.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px";
    var barOuter = document.createElement('div');
    barOuter.style.cssText = "position:relative;width:320px;max-width:100%;height:10px;background:#1f2937;border:1px solid #334155;border-radius:999px;overflow:hidden";
    var barInner = document.createElement('div');
    barInner.id = "tokenBar";
    barInner.style.cssText = "height:100%;width:0%;background:#f59e0b;transition:width .25s";
    barOuter.appendChild(barInner);
    var etaText = document.createElement('div');
    etaText.id = "tokenEta";
    etaText.style.cssText = "opacity:.9;font-size:12px";

    progWrap.appendChild(barOuter);
    progWrap.appendChild(etaText);

    lineT.appendChild(btnT);

    card.appendChild(lineI);
    card.appendChild(lineT);
    card.appendChild(progWrap);
    root.appendChild(card);
  }

  function renderStats(root){
    var s = state.stats || {};
    var card = document.createElement('div');
    card.style.cssText = "background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:12px;margin-bottom:12px";
    card.innerHTML =
      "<div style='font-weight:800;margin-bottom:8px;color:#93c5fd'>📈 銀行累積統計</div>"+
      "<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;line-height:1.8;opacity:.95'>"+
      "<div>累積領取金幣利息：<b id='stTotalGold'>"+fmtNum(s.totalGoldInterest||0)+"</b></div>"+
      "<div>累積領取強化石利息：<b id='stTotalStone'>"+fmtNum(s.totalStoneInterest||0)+"</b></div>"+
      "<div>累積領取高級代幣：<b id='stTokens'>"+fmtNum(s.totalTokens||0)+"</b></div>"+
      "<div>歷史最高存金：<b id='stMaxGold'>"+fmtNum(s.maxGoldHeld||0)+"</b></div>"+
      "<div>歷史最高存石：<b id='stMaxStone'>"+fmtNum(s.maxStoneHeld||0)+"</b></div>"+
      "</div>";
    root.appendChild(card);
  }

  // —— 動態小更新（避免輸入跳掉；含 VIP 進度/樣式） —— //
  function updateDynamic(container){
    var d = deriveByLevel(state.lv);

    // 等級/容量/餘額
    var elLv = container.querySelector('#bankLv'); if (elLv) elLv.textContent = "Lv."+state.lv;
    var elCapGold  = container.querySelector('#capGold');
    var elCapStone = container.querySelector('#capStone');
    var elBankGold = container.querySelector('#bankGold');
    var elBankStone= container.querySelector('#bankStone');
    var elPlayerGold = container.querySelector('#playerGold');
    var elInvStone = container.querySelector('#invStone');
    if (elCapGold)   elCapGold.textContent = fmtNum(d.capGold);
    if (elCapStone)  elCapStone.textContent = fmtNum(d.capStone);
    if (elBankGold)  elBankGold.textContent = fmtNum(state.gold);
    if (elBankStone) elBankStone.textContent= fmtNum(state.stone);
    if (elPlayerGold)elPlayerGold.textContent= fmtNum(playerGold());
    if (elInvStone)  elInvStone.textContent = fmtNum(invQty(KEY_STONE));

    // 利息可領（顯示值）
    var elIG = container.querySelector('#interestGold');
    var elIS = container.querySelector('#interestStone');
    if (elIG) elIG.textContent = fmtNum(Math.floor(Math.max(0, state.interestGoldBuf||0)));
    if (elIS) elIS.textContent = fmtNum(Math.floor(Math.max(0, state.interestStoneBuf||0)));

    // 代幣產能 / 進度
    var perPeriod = tokensPerPeriodByGold(state.gold);
    var perSec = (perPeriod > 0) ? (perPeriod / TOKEN_PERIOD_SEC) : 0;
    var whole = Math.floor(state.tokenProg);
    var frac = state.tokenProg - whole;
    var elCan = container.querySelector('#tokenCan');
    var elRate = container.querySelector('#tokenRate');
    if (elCan)  elCan.textContent = whole;
    if (elRate) elRate.textContent = perPeriod;
    var bar = container.querySelector('#tokenBar');
    var eta = container.querySelector('#tokenEta');
    if (perSec <= 0){
      if (bar) bar.style.width = "0%";
      if (eta) eta.textContent = "（條件不足：需達 10萬 金幣以上）";
    } else {
      var pct = Math.max(0, Math.min(1, frac)) * 100;
      if (bar) bar.style.width = pct.toFixed(2) + "%";
      var secLeft = (1 - frac) / perSec;
      if (eta) eta.textContent = "下一顆倒數：" + fmtTime(secLeft);
    }

    // 每日利息（含 VIP 加成）
    var elGD = container.querySelector('#goldDaily');
    var elSD = container.querySelector('#stoneDaily');
    if (elGD) elGD.textContent = (Math.floor(state.gold * (DAILY_INTEREST_GOLD + vipBonusRate()))).toLocaleString();
    if (elSD) elSD.textContent = (Math.floor(state.stone * (DAILY_INTEREST_STONE + vipBonusRate()))).toLocaleString();

    // 「存入後預估」回刷
    var gIn = container.querySelector('input[data-bind="inGold"]');
    if (gIn && document.activeElement !== gIn) { gIn.dispatchEvent(new Event('input')); }
    var sIn = container.querySelector('input[data-bind="inStone"]');
    if (sIn && document.activeElement !== sIn) { sIn.dispatchEvent(new Event('input')); }

    // 累積統計
    var st = state.stats || {};
    var stG = container.querySelector('#stTotalGold');
    var stS = container.querySelector('#stTotalStone');
    var stT = container.querySelector('#stTokens');
    var stMG= container.querySelector('#stMaxGold');
    var stMS= container.querySelector('#stMaxStone');
    if (stG) stG.textContent = fmtNum(st.totalGoldInterest||0);
    if (stS) stS.textContent = fmtNum(st.totalStoneInterest||0);
    if (stT) stT.textContent = fmtNum(st.totalTokens||0);
    if (stMG) stMG.textContent = fmtNum(st.maxGoldHeld||0);
    if (stMS) stMS.textContent = fmtNum(st.maxStoneHeld||0);

    // —— VIP 區動態（名稱/加成/條/按鈕/彩虹樣式） —— //
    var vip = state.vip || {unlocked:false,tier:0};
    var cur = VIP_TIERS[vip.tier] || VIP_TIERS[0];
    var next = VIP_TIERS[vip.tier+1];

    var vipName = container.querySelector('#vipName');
    var vipBonus = container.querySelector('#vipBonus');
    var vipCard = container.querySelector('#vipCard');
    var vipLock = container.querySelector('#vipLock');
    var vipNextName = container.querySelector('#vipNextName');
    var btnVip = container.querySelector('#btnVipUpgrade');

    if (vipName) vipName.textContent = '🏅 ' + cur.name;
    if (vipBonus) vipBonus.textContent = '+' + ((cur.bonus*100).toFixed(4)) + '%';

    if (vipCard){
      // 外框顏色 / 彩虹閃爍
      if (cur.frame==='RAINBOW') {
        vipCard.classList.add('vip-rainbow');
        vipCard.style.border = '3px solid';
        vipCard.style.borderImage = 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet) 1';
      } else {
        vipCard.classList.remove('vip-rainbow');
        vipCard.style.border = '3px solid '+cur.frame;
        vipCard.style.borderImage = '';
      }
      vipCard.style.background = cur.inner;
    }

    if (!vip.unlocked) {
      if (vipLock) vipLock.style.display = '';
      if (vipNextName) vipNextName.style.display = 'none';
      if (btnVip) { btnVip.disabled = true; btnVip.textContent = '尚未解鎖'; btnVip.style.background = '#374151'; btnVip.style.cursor='not-allowed'; }
    } else {
      if (vipLock) vipLock.style.display = 'none';
      if (!next){
        // 已最高等級
        if (vipNextName) vipNextName.style.display = 'none';
        if (btnVip) { btnVip.disabled = true; btnVip.textContent = '已達最高等級'; btnVip.style.background = '#374151'; btnVip.style.cursor='not-allowed'; }
      } else {
        if (vipNextName) { vipNextName.style.display=''; vipNextName.textContent='➡️ 下一階：' + next.name; }
        // 條與文字
        var gLab = container.querySelector('#vipGoldLab');
        var gBar = container.querySelector('#vipGoldBar');
        var gNeed = next.needGold||0;
        if (gLab) gLab.textContent = '金幣：' + fmtNum(state.vip.donatedGold) + ' / ' + fmtNum(gNeed);
        if (gBar)  gBar.style.width = (gNeed>0?Math.min(100,(state.vip.donatedGold/gNeed)*100):100).toFixed(2)+'%';

        var mLab = container.querySelector('#vipGemLab');
        var mBar = container.querySelector('#vipGemBar');
        var mNeed = next.needGem||0;
        if (mLab) mLab.textContent = '鑽石：' + fmtNum(state.vip.donatedGem) + ' / ' + fmtNum(mNeed);
        if (mBar)  mBar.style.width = (mNeed>0?Math.min(100,(state.vip.donatedGem/mNeed)*100):100).toFixed(2)+'%';

        var ok = canUpgradeVip(next);
        if (btnVip){
          btnVip.disabled = !ok;
          btnVip.textContent = ok ? '升級 VIP' : '尚未達標';
          btnVip.style.background = ok ? '#22c55e' : '#374151';
          btnVip.style.cursor = ok ? 'pointer' : 'not-allowed';
        }
      }
    }
  }

  function render(container){
    var snap = snapshotFocus(container);
    settleToNow();

    var d = deriveByLevel(state.lv);
    container.innerHTML = "";

    renderRules(container);
    renderHeader(container);
    renderVIP(container);          // VIP 區（可動態）
    renderBalances(container, d);
    renderInterestAndTokens(container);
    renderStats(container);

    updateDynamic(container);
    restoreFocus(container, snap);
  }

  // ====== 升級（銀行等級）======
  function tryLevelUp(){
    settleToNow();
    if (!HAS_INV) { alert("缺少背包介面"); return; }
    if (state.lv >= MAX_LV) { alert("已達銀行等級上限 ("+MAX_LV+")"); return; }
    var cost = levelUpCost(state.lv);
    var have = invQty(KEY_BANK_TOKEN);
    if (have < cost) { alert("需要「"+KEY_BANK_TOKEN+"」×"+cost+"，持有："+have); return; }
    removeItem(KEY_BANK_TOKEN, cost);
    state.lv++;
    if (state.lv >= 20) state.vip.unlocked = true;
    saveState(state, true);
    if (w.logPrepend) w.logPrepend("🏦 銀行升級至 Lv."+state.lv+"（容量上限 ×2）");
    refreshActive();
  }

  // ====== 每秒 tick（由 TownHub 主循環呼叫）======
  function tick(steps){
    if (!(steps > 0)) return;
    settle(steps);
    var body = document.getElementById('townHubBody');
    if (!body) return;
    if (String(body.getAttribute('data-tab-owner')||'') === TAB_ID) {
      updateDynamic(body);
    }
  }

  // ====== 註冊到 TownHub（停止自動整頁重繪，只做局部刷新）======
  w.TownHub.registerTab({
    id: TAB_ID,
    title: TAB_TITLE,
    render: render,
    tick: tick,
    noAutoRerender: true
  });

})(window);