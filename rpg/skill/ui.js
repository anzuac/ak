// =======================
// ui_skills_full.js — 技能彈窗 + SkillsHub 分頁（最終卡片版, ES5）
// =======================

(function(w, d){
  "use strict";

  // ========== 0) 一次性樣式注入 ==========
  (function injectSkillsUIStyle(){
    if (d.getElementById('skills-ui-style')) return;
    var css = ''
    + ':root{--sk-bg:#0f172a;--sk-panel:#0b1220;--sk-card:#111827;--sk-border:#233047;--sk-text:#e5e7eb;--sk-muted:#9ca3af;--sk-accent:#3b82f6;--sk-accent-2:#2563eb;--sk-success:#22c55e;}'
    + '.sk-list{display:flex;flex-direction:column;gap:10px;}'
    + '.sk-card{background:var(--sk-card);border:1px solid var(--sk-border);border-radius:12px;padding:12px;box-shadow:0 10px 24px rgba(0,0,0,.25)}'
    + '.sk-head{display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:6px}'
    + '.sk-title{font-weight:700;font-size:15px;color:var(--sk-text)}'
    + '.sk-badges{display:flex;gap:6px;flex-wrap:wrap}'
    + '.sk-pill{font-size:12px;border:1px solid var(--sk-border);border-radius:9999px;padding:2px 8px;color:#cbd5e1;background:#0b1220}'
    + '.sk-pill.info{color:#bfdbfe;border-color:#1d4ed8;background:#0b1530}'
    + '.sk-desc{color:var(--sk-text);opacity:.95;font-size:13px;line-height:1.45;margin:6px 0}'
    + '.sk-meta{color:var(--sk-muted);font-size:12px}'
    + '.sk-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}'
    + '.sk-actions .left{display:flex;gap:8px;flex-wrap:wrap}'
    + '.btn{background:#1f2937;border:1px solid var(--sk-border);color:#f8fafc;padding:6px 10px;border-radius:8px;cursor:pointer}'
    + '.btn.primary{background:var(--sk-accent);border-color:var(--sk-accent-2)}'
    + '.btn.primary:disabled{opacity:.5;cursor:not-allowed}'
    + '.sk-switch{position:relative;display:inline-block;width:42px;height:24px;vertical-align:middle}'
    + '.sk-switch input{opacity:0;width:0;height:0}'
    + '.sk-slider{position:absolute;cursor:pointer;inset:0;background:#334155;border-radius:9999px;transition:.2s}'
    + '.sk-slider:before{content:"";position:absolute;height:18px;width:18px;left:3px;top:3px;background:white;border-radius:50%;transition:.2s}'
    + '.sk-switch input:checked + .sk-slider{background:var(--sk-accent)}'
    + '.sk-switch input:checked + .sk-slider:before{transform:translateX(18px)}';

    var el = d.createElement('style');
    el.id = 'skills-ui-style';
    el.textContent = css;
    d.head.appendChild(el);
  })();

  // ========== 1) 技能彈窗骨架 ==========
  w.initSkillModal = function () {
    if (d.getElementById("skillModal")) return;

    var backdrop = d.createElement("div");
    backdrop.id = "skillBackdrop";
    backdrop.style.cssText = "display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:998;";

    var modal = d.createElement("div");
    modal.id = "skillModal";
    modal.style.cssText = "display:none;position:fixed;top:10vh;left:50%;transform:translateX(-50%);width:90vw;max-height:80vh;overflow-y:auto;background:#111827;padding:16px;border:1px solid #334155;border-radius:12px;z-index:999;color:#e5e7eb;-webkit-overflow-scrolling:touch;box-shadow:0 20px 40px rgba(0,0,0,.45)";

    var head = d.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";
    var title = d.createElement("h3");
    title.textContent = "🧠 技能清單";
    title.style.cssText = "margin:0;font-size:15px;";
    var closeBtn = d.createElement("button");
    closeBtn.textContent = "✖";
    closeBtn.className = "btn";
    closeBtn.onclick = function(){ w.closeSkillModal(); };
    head.appendChild(title); head.appendChild(closeBtn);
    modal.appendChild(head);

    var list = d.createElement("div");
    list.id = "skillList";
    list.style.width = "100%";
    modal.appendChild(list);

    d.body.appendChild(modal);
    d.body.appendChild(backdrop);
  };

  // ========== 2) 技能券成本（依轉數 1~4） ==========
  w.getTicketCostForSkill = function (skill) {
    var rank = Number((skill && (skill.requiredJobRank || skill.jobRank || skill.rank)) || 1);
    if (!(rank > 0)) rank = 1;
    if (rank > 4) rank = 4;
    return Math.max(1, Math.min(4, rank));
  };

  // ========== 3) 共用渲染器（卡片版） ==========
  // type: "all" | "active" | "passive" | "aura"
  w.renderSkillListInto = function(container, type) {
    if (!container) return;
    container.innerHTML = "";
    container.className = 'sk-list';

    var src = Array.isArray(w.skills) ? w.skills : [];

    // 去重
    var map = {}, uniqueSkills = [];
    for (var i=0;i<src.length;i++){
      var s = src[i]; if (!s || s.id == null) continue;
      map[s.id] = s;
    }
    for (var k in map) if (map.hasOwnProperty(k)) uniqueSkills.push(map[k]);

    // 智能分類（相容 skillPool/tiers）
    function classifySkill(s){
      if (!s) return { isActive:false, isPassive:false, isAura:false };
      var t = String(s.type || s.kind || s.category || "").toLowerCase();
      var byTypeActive  = (t === "active");
      var byTypePassive = (t === "passive");
      var byTypeAura    = (t === "aura");
      var hasTierAct = !!(s.tiers && s.tiers.some(function(tt){
        return tt && (tt.cooldown != null || tt.mpCost != null || (tt.logic && typeof tt.logic === 'object'));
      }));
      var hasActHints = byTypeActive || hasTierAct ||
        (s.cooldown != null) || (s.mpCost != null) ||
        (typeof s.logic === 'object') || (typeof s.cast === 'function') ||
        (typeof s.onUse === 'function');
      var hasPassiveHints = byTypePassive || s.isPassive === true || /passive/i.test(s.name||'');
      var hasAuraHints    = byTypeAura    || s.isAura === true    || /aura|光環/i.test(s.name||'');
      return { isActive:!!hasActHints, isPassive:!!hasPassiveHints, isAura:!!hasAuraHints };
    }

    var filtered = (function(){
      if (type === "all") return uniqueSkills;
      if (type === "active")  return uniqueSkills.filter(function(s){ return classifySkill(s).isActive;  });
      if (type === "passive") return uniqueSkills.filter(function(s){ return classifySkill(s).isPassive; });
      if (type === "aura")    return uniqueSkills.filter(function(s){ return classifySkill(s).isAura;    });
      return [];
    })();

    if (!filtered.length){
      var empty = d.createElement('div');
      empty.className = 'sk-card';
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--sk-muted)';
      empty.textContent = '沒有可顯示的技能';
      container.appendChild(empty);
      return;
    }

    // 建卡
    for (var j=0;j<filtered.length;j++){
      (function(skill){
        // 取 tier 顯示值
        var t = (typeof w.getActiveTier === "function" && skill.tiers) ? w.getActiveTier(skill) : null;
        var baseMp = Number(t && t.mpCost != null ? t.mpCost : (skill.mpCost || 0));
        var mpGrow = Number(t && t.logic && t.logic.mpCostLevelGrowth || 0) * Math.max(0, (skill.level || 1) - 1);
        var viewMP = baseMp + mpGrow;
        var viewCD = Number(t && t.cooldown != null ? t.cooldown : (skill.cooldown || 0));

        var card = d.createElement('div');
        card.className = 'sk-card';

        // 標題列
        var head = d.createElement('div');
        head.className = 'sk-head';

        var title = d.createElement('div');
        title.className = 'sk-title';
        title.textContent = (skill.name || "(未命名技能)") + "  Lv." + (skill.level || 1);
        head.appendChild(title);

        var badges = d.createElement('div'); badges.className = 'sk-badges';
        var pillMP = d.createElement('span'); pillMP.className = 'sk-pill info'; pillMP.textContent = "MP " + viewMP;
        var pillCD = d.createElement('span'); pillCD.className = 'sk-pill info'; pillCD.textContent = "CD " + viewCD + "s";
        var rank = Math.max(1, Math.min(4, Number(skill.requiredJobRank || skill.rank || 0)));
        var pillLv = d.createElement('span'); pillLv.className = 'sk-pill'; pillLv.textContent = rank ? (rank + "轉") : "一般";
        badges.appendChild(pillMP); badges.appendChild(pillCD); badges.appendChild(pillLv);
        head.appendChild(badges);
        card.appendChild(head);

        // 說明
        var desc = d.createElement('div');
        desc.className = 'sk-desc';
        desc.innerHTML = (typeof skill.getDescription === 'function' ? skill.getDescription() : (skill.description || ""));
        card.appendChild(desc);

        // 底部操作列
        var actions = d.createElement('div'); actions.className = 'sk-actions';
        var leftAct = d.createElement('div'); leftAct.className = 'left';

        // 升級鈕
        var tkCost = (typeof w.getTicketCostForSkill === "function") ? w.getTicketCostForSkill(skill) : 1;
        var own = (typeof w.getItemQuantity === "function") ? w.getItemQuantity("技能強化券") : 0;
        var canUpgrade = (skill.level || 1) < 20 && own >= tkCost;

        var upBtn = d.createElement('button');
        upBtn.className = 'btn primary';
        upBtn.textContent = "🔼 升級（" + tkCost + " 張）";
        upBtn.disabled = !canUpgrade;
        upBtn.onclick = function(){
          if (typeof w.upgradeSkill === "function") w.upgradeSkill(skill.id);
          w.renderSkillListInto(container, type);
        };
        leftAct.appendChild(upBtn);
        actions.appendChild(leftAct);

        // 右側：自動施放開關
        var rightAct = d.createElement('div');

        var target = Array.isArray(w.skills) ? w.skills.find(function(x){ return x.id === skill.id; }) : skill;
        if (typeof target.autoEnabled === "undefined") {
          var saved = w.localStorage ? w.localStorage.getItem("skillAuto_"+ skill.id) : null;
          target.autoEnabled = saved === null ? false : (saved === "1");
        }

        var switchWrap = d.createElement('label'); switchWrap.className = 'sk-switch';
        var chk = d.createElement('input'); chk.type = 'checkbox'; chk.checked = !!target.autoEnabled;
        var slider = d.createElement('span'); slider.className = 'sk-slider';
        chk.addEventListener('change', function(){
          var on = !!chk.checked;
          if (target) target.autoEnabled = on;
          if (w.localStorage) w.localStorage.setItem("skillAuto_"+ skill.id, on ? "1" : "0");
        });
        switchWrap.appendChild(chk); switchWrap.appendChild(slider);

        var autoText = d.createElement('span');
        autoText.textContent = ' 自動施放';
        autoText.style.cssText = 'margin-left:8px;color:var(--sk-muted);font-size:12px;vertical-align:middle';

        var autoWrap = d.createElement('div');
        autoWrap.appendChild(switchWrap); autoWrap.appendChild(autoText);

        rightAct.appendChild(autoWrap);
        actions.appendChild(rightAct);

        card.appendChild(actions);
        container.appendChild(card);
      })(filtered[j]);
    }
  };

  // ========== 4) 彈窗 API ==========
  w.openSkillModal = function(type){
    if (!type) type = "all";
    var modal = d.getElementById("skillModal");
    var backdrop = d.getElementById("skillBackdrop");
    var list = d.getElementById("skillList");
    if (!modal || !backdrop || !list) return;
    w.renderSkillListInto(list, type);
    modal.style.display = "block";
    backdrop.style.display = "block";
  };
  w.closeSkillModal = function(){
    var m = d.getElementById("skillModal");
    var b = d.getElementById("skillBackdrop");
    if (m) m.style.display = "none";
    if (b) b.style.display = "none";
  };

  // ========== 5) 技能升級（依轉數 1~4 張）==========
  w.upgradeSkill = function upgradeSkill(skillId) {
    var skill = Array.isArray(w.skills) ? w.skills.find(function(s){ return s.id === skillId; }) : null;
    if (!skill) return;

    var tkCost = (typeof w.getTicketCostForSkill === "function") ? w.getTicketCostForSkill(skill) : 1;
    var itemName = "技能強化券";
    var owned = (typeof w.getItemQuantity === "function") ? w.getItemQuantity(itemName) : 0;

    if ((skill.level || 1) >= 20) {
      if (typeof w.logPrepend === "function") w.logPrepend("⚠️ 技能已達最高等級");
      return;
    }
    if (owned < tkCost) {
      if (typeof w.logPrepend === "function") w.logPrepend("❌ " + itemName + " 不足，無法升級技能");
      return;
    }

    if (typeof w.removeItem === "function") w.removeItem(itemName, tkCost);
    skill.level = (skill.level || 1) + 1;

    if (typeof w.logPrepend === "function") w.logPrepend("🔼 " + (skill.name||"技能") + " 升級至 Lv." + skill.level);
    if (typeof w.saveGame === "function") w.saveGame();
  };

  // ========== 6) 掛到 SkillsHub：主動技能分頁（無 Hub 時 fallback）==========
  (function attachToSkillsHub(){
    var hub =
      (w.SkillsHub && typeof w.SkillsHub.registerTab === "function" && w.SkillsHub) ||
      (w.skills_hub && typeof w.skills_hub.registerTab === "function" && w.skills_hub) ||
      null;

    function renderActiveTab(container){
      container.style.color = "#e5e7eb";
      container.style.backgroundColor = "transparent";
      container.style.padding = "4px 0";
      if (typeof w.renderSkillListInto === "function") {
        w.renderSkillListInto(container, "active");
      } else {
        container.innerHTML = "<div style='opacity:.8'>找不到 renderSkillListInto</div>";
      }
    }

    if (hub) {
      hub.registerTab({
        id: "skills-active",
        title: "主動技能",
        render: renderActiveTab,
        tick: function(){},
        onOpen: function(){},
        onClose: function(){}
      });
      // 例：<button onclick="SkillsHub.open(); SkillsHub.switchTo('skills-active')">🧠 主動技能</button>
    } else {
      function mountFallback(){
        var host = d.getElementById("skills-active-fallback");
        if (!host) {
          host = d.createElement("div");
          host.id = "skills-active-fallback";
          host.style.cssText = "margin:12px;padding:12px;border:1px dashed #334155;border-radius:8px;color:#fff;background:#111827;";
          host.innerHTML = "<div style='margin-bottom:8px;font-weight:700'>主動技能（Fallback）</div>";
          d.body.appendChild(host);
        }
        renderActiveTab(host);
      }
      if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", mountFallback);
      else mountFallback();
    }
  })();

  // ========== 7) 自動建立彈窗骨架 ==========
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", function(){ w.initSkillModal(); });
  else w.initSkillModal();

})(window, document);