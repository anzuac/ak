// ===============================
// register.js — 多補助技能中心（SaveHub持久化 + 自動施放 + 升級 + 頂部面板）
// 依賴：save_hub_es5.js、player.js、skills_hub.js
// ===============================
(function (w) {
  "use strict";

  // 依賴檢查
  if (!w.SkillsHub) { console.error("❌ register.js: SkillsHub 未載入"); return; }
  if (!w.SaveHub)   { console.error("❌ register.js: SaveHub 未載入");   return; }

  // 讓技能能安全寫入（避免載入順序）
  w.skillBonus = w.skillBonus || w.player?.skillBonus;

  // ===== 通用設定 =====
  var TAB_ID    = "assistSkills";
  var TAB_TITLE = "補助技能";
  var TICKET_ITEM_KEY = "被動能力券";
  var TICKET_PER_LV   = 1;
  var RESET_GEM_COST  = 1000; // 一鍵重置全部技能花費（鑽石）

  // ===== 小工具 =====
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function fmt(sec){
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec/60), s = sec%60;
    return (m<10?"0":"")+m+":"+(s<10?"0":"")+s;
  }
  function pct(x, digits){ return ((Number(x)||0) * 100).toFixed(digits ?? 0) + "%"; }

  // ===== 技能定義（四個）=====
  var SKILLS = [
    // 1) 怒氣上升 — 固定值（MP20） Lv上限20：每級 +2攻、+1秒；CD300
    {
      id: "rage",
      name: "怒氣上升",
      ns: "skill:rageRise",
      buffKey: "buff:RageRise",
      lvCap: 20,
      cooldown: 300,
      cost: { mp: 20 },
      calcBuff: function(lv){ return { atkFlat: 10 + 2*(lv-1), defFlat: -15 }; },
      calcDuration: function(lv){ return 30 + 1*(lv-1); },
      describeNow: function(lv){ return "攻擊 +" + (10 + 2*(lv-1)) + "，防禦 -15；持續 " + (30 + (lv-1)) + " 秒；冷卻 300 秒"; },
      describeNext: function(lv){
        if (lv>=this.lvCap) return "已達等級上限";
        var nlv = lv+1; return "下一級 → 攻擊 +" + (10 + 2*(nlv-1)) + "，持續 " + (30 + (nlv-1)) + " 秒；需要『"+TICKET_ITEM_KEY+"』x"+TICKET_PER_LV;
      }
    },
    // 2) 迴避躲閃 — dodgePercent（小數制），MP25，CD180；Lv上限20：每級 +2% 迴避、+2秒
    {
      id: "dodge",
      name: "迴避躲閃",
      ns: "skill:dodgeBoost",
      buffKey: "buff:DodgeBoost",
      lvCap: 20,
      cooldown: 180,
      cost: { mp: 25 },
      calcBuff: function(lv){ return { dodgePercent: (0.20 + 0.02*(lv-1)) }; },
      calcDuration: function(lv){ return 30 + 2*(lv-1); },
      describeNow: function(lv){
        var rate = 0.20 + 0.02*(lv-1);
        return "迴避率 +" + pct(rate) + "；持續 " + (30 + 2*(lv-1)) + " 秒；冷卻 180 秒";
      },
      describeNext: function(lv){
        if (lv>=this.lvCap) return "已達等級上限";
        var nlv = lv+1, rate = 0.20 + 0.02*(nlv-1);
        return "下一級 → 迴避率 +" + pct(rate) + "、持續 " + (30 + 2*(nlv-1)) + " 秒；需要『"+TICKET_ITEM_KEY+"』x"+TICKET_PER_LV;
      }
    },
    // 3) 穿透 — ignoreDefPct（小數制），MP30，60s，CD300；Lv上限10：每級 +1.5% 穿透
    {
      id: "pierce",
      name: "穿透",
      ns: "skill:pierce",
      buffKey: "buff:Pierce",
      lvCap: 10,
      cooldown: 300,
      cost: { mp: 30 },
      calcBuff: function(lv){ return { ignoreDefPct: (0.10 + 0.015*(lv-1)) }; },
      calcDuration: function(_){ return 60; },
      describeNow: function(lv){
        var v = 0.10 + 0.015*(lv-1);
        return "穿透 +" + pct(v,1) + "；持續 60 秒；冷卻 300 秒";
      },
      describeNext: function(lv){
        if (lv>=this.lvCap) return "已達等級上限";
        var nlv = lv+1, v = 0.10 + 0.015*(nlv-1);
        return "下一級 → 穿透 +" + pct(v,1) + "；需要『"+TICKET_ITEM_KEY+"』x"+TICKET_PER_LV;
      }
    },
    // 4) 幸運財寶 — 消耗HP20%，exp/drop/gold +10% 基礎；Lv上限20：每級 +1%；60s，CD300
    {
      id: "lucky",
      name: "幸運財寶",
      ns: "skill:luckyTreasure",
      buffKey: "buff:LuckyTreasure",
      lvCap: 20,
      cooldown: 300,
      cost: { hpPct: 0.20 },
      calcBuff: function(lv){
        var b = 0.10 + 0.01*(lv-1);
        return { expBonus:b, dropBonus:b, goldBonus:b };
      },
      calcDuration: function(_){ return 60; },
      describeNow: function(lv){
        var b = 0.10 + 0.01*(lv-1);
        return "消耗 HP 20%，經驗/掉寶/金幣 +" + pct(b) + "；持續 60 秒；冷卻 300 秒";
      },
      describeNext: function(lv){
        if (lv>=this.lvCap) return "已達等級上限";
        var nlv = lv+1, b = 0.10 + 0.01*(nlv-1);
        return "下一級 → 經驗/掉寶/金幣 +" + pct(b) + "；需要『"+TICKET_ITEM_KEY+"』x"+TICKET_PER_LV;
      }
    }
  ];

  // ===== 狀態集合（SaveHub）=====
  var states = {}; // ns -> { level, auto, remain, cool }

  function loadState(skill){
    var s = w.SaveHub.get(skill.ns, { _ver:1, level:1, auto:false, remain:0, cool:0 }) || {};
    s.level  = clamp(Number(s.level || 1), 1, skill.lvCap);
    s.auto   = !!s.auto;
    s.remain = Math.max(0, Number(s.remain || 0));
    s.cool   = Math.max(0, Number(s.cool || 0));
    return s;
  }
  function saveState(skill){
    var st = states[skill.ns];
    w.SaveHub.set(skill.ns, {
      _ver: 1,
      level: clamp(Number(st.level||1), 1, skill.lvCap),
      auto: !!st.auto,
      remain: Math.max(0, Math.floor(st.remain || 0)),
      cool:   Math.max(0, Math.floor(st.cool   || 0))
    });
  }

  function getLv(skill){ return clamp(Number(states[skill.ns]?.level || 1), 1, skill.lvCap); }
  function canCast(skill){ var st = states[skill.ns]; return (st.cool <= 0) && (st.remain <= 0); }

  // ===== Buff 寫入 / 移除 =====
  function applyBuff(skill, on){
    var SB = w.skillBonus || w.player?.skillBonus;
    if (!SB || !SB.bonusData) return;
    if (on) {
      SB.bonusData[skill.buffKey] = skill.calcBuff(getLv(skill));
    } else {
      delete SB.bonusData[skill.buffKey];
    }
  }

  // ===== 資源檢查（不彈窗；自動施放用）=====
  function hasResources(skill){
    var p = w.player; if (!p) return false;

    if (skill.cost?.mp){
      if ((p.currentMP||0) < skill.cost.mp) return false;
    }
    if (skill.cost?.hpPct){
      var maxHP = Number(p.totalStats?.hp || 0);
      var need = Math.ceil(maxHP * skill.cost.hpPct);
      if ((p.currentHP||0) <= need) return false; // 至少留 1 HP
    }
    return true;
  }

  // ===== 扣除資源（保留 UI 更新）=====
  function payCost(skill){
    var p = w.player;
    if (!p) return;

    if (skill.cost?.mp){
      p.currentMP = Math.max(0, (p.currentMP||0) - skill.cost.mp);
    }
    if (skill.cost?.hpPct){
      var maxHP = Number(p.totalStats?.hp || 0);
      var need = Math.ceil(maxHP * skill.cost.hpPct);
      p.currentHP = Math.max(1, (p.currentHP||0) - need);
    }
    if (typeof w.updateResourceUI === "function") w.updateResourceUI();
  }

  // ===== 升級 =====
  function tryUpgrade(skill){
    var st = states[skill.ns];
    var lv = getLv(skill);
    if (lv >= skill.lvCap) { alert("等級已達上限 (" + skill.lvCap + ")"); return; }

    if (typeof w.getItemQuantity !== "function" || typeof w.removeItem !== "function") {
      alert("❌ 找不到道具介面（getItemQuantity/removeItem）");
      return;
    }
    var owned = Number(w.getItemQuantity(TICKET_ITEM_KEY) || 0);
    if (owned < TICKET_PER_LV) {
      alert("需要『" + TICKET_ITEM_KEY + "』x" + TICKET_PER_LV + "，持有：" + owned);
      return;
    }

    w.removeItem(TICKET_ITEM_KEY, TICKET_PER_LV);
    st.level = clamp(lv + 1, 1, skill.lvCap);

    // 若生效中，以新等級覆蓋數值與（必要時）刷新持續時間
    if (st.remain > 0) {
      st.remain = skill.calcDuration(getLv(skill));
      applyBuff(skill, true);
    }

    saveState(skill);
    if (w.logPrepend) w.logPrepend("⬆️ " + skill.name + " 等級提升至 Lv." + getLv(skill));
    w.SkillsHub.requestRerender();
    if (typeof w.updateResourceUI === "function") w.updateResourceUI();
  }

  function toggleAuto(skill, on){
    states[skill.ns].auto = !!on;
    saveState(skill);
    w.SkillsHub.requestRerender();
  }

  // ===== 施放（自動不足時安靜等待；手動不足時提示）=====
  function cast(skill, isAuto){
    var st = states[skill.ns];
    if (!canCast(skill)) return;

    if (!hasResources(skill)) {
      if (isAuto) return; // 自動：安靜等待
      // 手動：提示一次
      var needTxt = [];
      if (skill.cost?.mp)    needTxt.push("MP " + skill.cost.mp);
      if (skill.cost?.hpPct) needTxt.push("HP " + pct(skill.cost.hpPct));
      alert("資源不足，需：" + needTxt.join("、"));
      return;
    }

    payCost(skill);

    var lv = getLv(skill);
    st.remain = skill.calcDuration(lv);
    st.cool   = skill.cooldown;
    applyBuff(skill, true);

    if (w.logPrepend) w.logPrepend("🔥 " + skill.name + " 發動！");
    saveState(skill);
    w.SkillsHub.requestRerender();
  }

  // ===== 頂部面板：被動券/總能力/一鍵重置 =====
  function getTicketCount(){
    try {
      return (typeof w.getItemQuantity === "function")
        ? Number(w.getItemQuantity(TICKET_ITEM_KEY) || 0)
        : 0;
    } catch(_) { return 0; }
  }

  function aggregateActiveBuffs(){
    var SB = w.skillBonus || w.player?.skillBonus;
    var sum = { atkFlat:0, defFlat:0, dodgePercent:0, ignoreDefPct:0, expBonus:0, dropBonus:0, goldBonus:0 };
    if (!SB || !SB.bonusData) return sum;

    for (var i=0;i<SKILLS.length;i++){
      var key = SKILLS[i].buffKey;
      var b = SB.bonusData[key];
      if (!b) continue;
      if (typeof b.atkFlat        === "number") sum.atkFlat        += b.atkFlat;
      if (typeof b.defFlat        === "number") sum.defFlat        += b.defFlat;
      if (typeof b.dodgePercent   === "number") sum.dodgePercent   += b.dodgePercent;
      if (typeof b.ignoreDefPct   === "number") sum.ignoreDefPct   += b.ignoreDefPct;
      if (typeof b.expBonus       === "number") sum.expBonus       += b.expBonus;
      if (typeof b.dropBonus      === "number") sum.dropBonus      += b.dropBonus;
      if (typeof b.goldBonus      === "number") sum.goldBonus      += b.goldBonus;
    }
    return sum;
  }

  function resetAllSkills(){
    var p = w.player;
    if (!p) { alert("玩家尚未初始化"); return; }
    if ((p.gem||0) < RESET_GEM_COST) { alert("鑽石不足，需要 " + RESET_GEM_COST); return; }

    var ok = confirm("確定花費 " + RESET_GEM_COST + " 鑽石重置全部技能？（等級重置為 1、生效與冷卻清空）");
    if (!ok) return;

    p.gem = Math.max(0, (p.gem||0) - RESET_GEM_COST);

    for (var i=0;i<SKILLS.length;i++){
      var s = SKILLS[i];
      var st = states[s.ns];
      st.level = 1;
      st.remain = 0;
      st.cool = 0;
      applyBuff(s, false);
      saveState(s);
    }

    if (typeof w.updateResourceUI === "function") w.updateResourceUI();
    if (w.logPrepend) w.logPrepend("🔁 已重置所有補助技能（Lv. 重置為 1）");
    w.SkillsHub.requestRerender();
  }

  function renderTopPanel(container){
    var card = document.createElement("div");
    card.style.cssText = "background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:12px;margin-bottom:12px";

    var tickets = getTicketCount();
    var canReset = (w.player?.gem || 0) >= RESET_GEM_COST;

    var agg = aggregateActiveBuffs();
    var lines = [];
    if (agg.atkFlat)      lines.push("攻擊 +" + agg.atkFlat);
    if (agg.defFlat)      lines.push("防禦 " + agg.defFlat);
    if (agg.dodgePercent) lines.push("迴避率 +" + pct(agg.dodgePercent));
    if (agg.ignoreDefPct) lines.push("穿透 +" + pct(agg.ignoreDefPct,1));
    if (agg.expBonus)     lines.push("經驗 +" + pct(agg.expBonus));
    if (agg.dropBonus)    lines.push("掉寶 +" + pct(agg.dropBonus));
    if (agg.goldBonus)    lines.push("金幣 +" + pct(agg.goldBonus));
    var aggText = lines.length ? lines.join("，") : "（目前無生效中的技能加成）";

    card.innerHTML =
      "<div style='display:flex;flex-wrap:wrap;row-gap:10px;column-gap:12px;align-items:center;justify-content:space-between'>" +
        "<div style='font-weight:700'>🧾 被動能力券：<span style='color:#fde68a'>"+ tickets +"</span></div>" +
        "<div style='opacity:.9'>目前生效總能力：<span style='color:#93c5fd'>" + aggText + "</span></div>" +
        "<div>" +
          "<button id='btnResetSkills' style='background:"+ (canReset?"#f59e0b":"#374151") +";color:#0b1220;border:0;padding:8px 12px;border-radius:10px;cursor:"+ (canReset?"pointer":"not-allowed") +";font-weight:800'>重置全部技能（💎"+ RESET_GEM_COST +"）</button>" +
        "</div>" +
      "</div>";

    var btn = card.querySelector("#btnResetSkills");
    btn.disabled = !canReset;
    btn.onclick = function(){ if (canReset) resetAllSkills(); };

    container.appendChild(card);
  }

  // ===== 單張技能卡 UI =====
  function renderSkillCard(skill, container){
    var st = states[skill.ns];
    var lv = getLv(skill);

    var wrap = document.createElement("div");
    wrap.style.cssText = "background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:12px;margin-bottom:12px";

    var title = "<div style='font-size:16px;font-weight:700;margin-bottom:6px'>" + skill.name + "</div>";
    var desc  = "<div style='opacity:.9;margin-bottom:8px'>" + skill.describeNow(lv) + "</div>";

    var status = "<div style='display:flex;gap:14px;flex-wrap:wrap;margin:8px 0'>" +
      "<div>等級：<b>Lv." + lv + "</b></div>" +
      "<div>狀態：" + (st.remain>0 ? "<span style='color:#22c55e'>生效中 " + fmt(st.remain) + "</span>"
                                    : "<span style='color:#9ca3af'>未生效</span>") + "</div>" +
      "<div>冷卻：" + (st.cool>0 ? "<span style='color:#f59e0b'>" + fmt(st.cool) + "</span>"
                                 : "<span style='color:#22c55e'>可使用</span>") + "</div>" +
      "</div>";

    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;align-items:center;flex-wrap:wrap";

    var btn = document.createElement("button");
    btn.textContent = canCast(skill) ? "發動技能" : "冷卻中";
    btn.disabled = !canCast(skill);
    btn.style.cssText = "background:"+(btn.disabled?"#374151":"#2563eb")+";color:#fff;border:0;padding:8px 12px;border-radius:10px;cursor:"+(btn.disabled?"not-allowed":"pointer")+";font-weight:700";
    btn.onclick = function(){ cast(skill, /*isAuto=*/false); }; // 手動
    row.appendChild(btn);

    var autoWrap = document.createElement("label");
    autoWrap.style.cssText = "display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none";
    var auto = document.createElement("input");
    auto.type = "checkbox";
    auto.checked = !!st.auto;
    auto.onchange = function(){ toggleAuto(skill, auto.checked); };
    var autoTxt = document.createElement("span");
    autoTxt.textContent = "自動施放（可用時自動觸發）";
    autoWrap.appendChild(auto); autoWrap.appendChild(autoTxt);
    row.appendChild(autoWrap);

    var upRow = document.createElement("div");
    upRow.style.cssText = "display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:6px";

    var nextInfo = document.createElement("div");
    nextInfo.style.cssText = "opacity:.9;font-size:12px";
    nextInfo.innerHTML = skill.describeNext(lv);
    upRow.appendChild(nextInfo);

    var btnUp = document.createElement("button");
    btnUp.textContent = "升級";
    btnUp.disabled = (lv >= skill.lvCap);
    btnUp.style.cssText = "background:"+(btnUp.disabled?"#374151":"#16a34a")+";color:#fff;border:0;padding:6px 10px;border-radius:10px;cursor:"+(btnUp.disabled?"not-allowed":"pointer")+";font-weight:600";
    btnUp.onclick = function(){ tryUpgrade(skill); };
    upRow.appendChild(btnUp);

    // 預覽目前 buff
    var SB = w.skillBonus || w.player?.skillBonus;
    var preview = document.createElement("div");
    preview.style.cssText = "opacity:.85;font-size:12px;margin-top:8px";
    var cur = SB && SB.bonusData ? SB.bonusData[skill.buffKey] : null;
    var pv = "目前提供：";
    if (cur){
      var parts=[];
      if (cur.atkFlat != null)  parts.push("攻擊 +" + cur.atkFlat);
      if (cur.defFlat != null)  parts.push("防禦 " + cur.defFlat);
      if (cur.dodgePercent != null) parts.push("迴避率 +" + pct(cur.dodgePercent));
      if (cur.ignoreDefPct != null) parts.push("穿透 +" + pct(cur.ignoreDefPct,1));
      if (cur.expBonus != null)  parts.push("經驗 +" + pct(cur.expBonus));
      if (cur.dropBonus != null) parts.push("掉寶 +" + pct(cur.dropBonus));
      if (cur.goldBonus != null) parts.push("金幣 +" + pct(cur.goldBonus));
      pv += (parts.length? parts.join("，") : "無");
    }else{
      pv += "無";
    }
    preview.textContent = pv;

    wrap.innerHTML = title + desc + status;
    wrap.appendChild(row);
    wrap.appendChild(upRow);
    wrap.appendChild(preview);
    container.appendChild(wrap);
  }

  // ===== 整頁 render =====
  function render(container){
    w.skillBonus = w.skillBonus || w.player?.skillBonus;
    renderTopPanel(container);            // 頂部資訊面板
    for (var i=0;i<SKILLS.length;i++){   // 每一張技能卡
      renderSkillCard(SKILLS[i], container);
    }
  }

  // ===== Tick（所有技能）=====
  function tick(steps){
    for (var i=0;i<SKILLS.length;i++){
      var skill = SKILLS[i];
      var st = states[skill.ns];

      if (st.cool > 0)   st.cool   = Math.max(0, st.cool - steps);
      if (st.remain > 0) {
        st.remain = Math.max(0, st.remain - steps);
        if (st.remain === 0) {
          applyBuff(skill, false);
          if (w.logPrepend) w.logPrepend("⏹️ " + skill.name + " 結束");
        }
      }
      // ✅ 自動施放：僅在冷卻好 + 無生效 + 資源足夠時才施放；不足時安靜等待
      if (st.auto && canCast(skill) && hasResources(skill)) {
        cast(skill, /*isAuto=*/true);
      }
      saveState(skill);
    }
  }

  // ===== 初始化：載入狀態 → 重掛 Buff（如有）→ 註冊分頁 → 自動施放 =====
  for (var i=0;i<SKILLS.length;i++){
    var s = SKILLS[i];
    states[s.ns] = loadState(s);
    if (states[s.ns].remain > 0) applyBuff(s, true);
  }

  w.SkillsHub.registerTab({
    id: TAB_ID,
    title: TAB_TITLE,
    render: render,
    tick: tick
  });

  // 自動施放初始化（若一開始就可施放且資源足夠）
  for (var i=0;i<SKILLS.length;i++){
    var s = SKILLS[i];
    if (states[s.ns].auto && canCast(s) && hasResources(s)) cast(s, /*isAuto=*/true);
  }

})(window);