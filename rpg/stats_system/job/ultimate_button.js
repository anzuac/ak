// ==================================
// ultimate_button.js — 五轉快捷施放主頁面板（常駐/展開、鍵盤、動畫）
// 依賴：ultimateSkills.js, player.js
// ==================================
(function(w){
  "use strict";
  if (!w.player || !w.getUltimateStateForJob || !w.castUltimateSkill) { console.error("ultimate_button.js: 缺少依賴"); return; }

  var WRAP_ID = "UltimateQuickWrap";
  var BTN_ID  = "UltimateQuickToggle";
  var JOBS = ["warrior", "mage", "archer", "thief"];

  function jobKeyRaw(){ return String(w.player?.job||"").toLowerCase(); }
  function baseJob(){ return (typeof w.getBaseJob === "function") ? w.getBaseJob(jobKeyRaw()) : jobKeyRaw().replace(/\d+$/,""); }

  function inCombat(){
    try{
      if (typeof w.isInCombat === "function") return !!w.isInCombat();
      if (typeof w.isInBattle === "function") return !!w.isInBattle();
      if (w.combat && typeof w.combat.isFighting === "boolean") return !!w.combat.isFighting;
    }catch(_){}
    try{
      var m = w.currentMonster || w.global?.currentMonster;
      var hp = (typeof w.monsterHP === "number") ? w.monsterHP : w.global?.monsterHP;
      return !!(m && !m.isDead && (hp||0) > 0);
    }catch(_){ return false; }
  }

  (function injectCSS(){
    if (document.getElementById("UltimateQuickCSS")) return;
    var css = document.createElement("style");
    css.id = "UltimateQuickCSS";
    css.textContent = `
    @keyframes pulseGlow { 0%{box-shadow:0 0 0 rgba(255,255,255,0.0);} 50%{box-shadow:0 0 18px rgba(255,255,255,0.35);} 100%{box-shadow:0 0 0 rgba(255,255,255,0);} }
    @keyframes charge { 0%{transform:scale(0.95);opacity:.7;} 100%{transform:scale(1);opacity:1;} }
    @keyframes flash { 0%{opacity:0;} 20%{opacity:.9;} 100%{opacity:0;} }
    @keyframes shake {
      0%{ transform:translate(0,0); } 15%{ transform:translate(-4px,2px); } 30%{ transform:translate(3px,-3px); }
      45%{ transform:translate(-2px,4px); } 60%{ transform:translate(4px,0); } 75%{ transform:translate(-3px,-2px);} 100%{ transform:translate(0,0); }
    }
    #${WRAP_ID}{ position:fixed; left:10px; top:50%; transform:translateY(-50%); z-index:9998; display:flex; flex-direction:column; gap:8px; }
    #${WRAP_ID} .panel{ background:#0b1220cc; border:1px solid #1f2937; border-radius:12px; padding:8px; }
    #${WRAP_ID} .row{ display:flex; flex-direction:column; gap:6px; max-height:70vh; overflow:auto; }
    #${BTN_ID}{ background:#111827; color:#fff; border:1px solid #334155; padding:8px; border-radius:999px; cursor:pointer; width:42px; height:42px; display:flex; align-items:center; justify-content:center; }
    #${BTN_ID}.active{ animation:pulseGlow 1.6s infinite; }
    .ult-item{ display:flex; align-items:center; gap:8px; background:#111827; border:1px solid #374151; border-radius:10px; padding:8px; cursor:pointer; color:#fff; min-width:220px; }
    .ult-item .icon{ font-size:18px; }
    .ult-item .name{ font-weight:800; letter-spacing:.5px; }
    .ult-item .meta{ font-size:12px; opacity:.8; }
    .ult-item.charging{ outline:2px dashed #f97316; animation:charge .6s ease-in-out alternate infinite; }
    .ult-item.disabled{ opacity:.5; cursor:not-allowed; }
    .ult-cool{ margin-left:auto; font-size:12px; padding:2px 6px; border-radius:8px; background:#1f2937; }
    .ult-flash{ position:fixed; inset:0; background:radial-gradient(ellipse at center, rgba(255,255,255,.75), rgba(255,255,255,0)); pointer-events:none; animation:flash .35s ease-out; z-index:9997; }
    .shake-all{ animation:shake .35s ease-in-out; }
    .ult-lock-banner{ position:fixed; left:50%; top:16%; transform:translateX(-50%);
      background:#111827cc; color:#fff; border:1px solid #f97316; padding:6px 10px; border-radius:10px; font-weight:700; z-index:9999; display:none; }
    `;
    document.head.appendChild(css);
  })();

  // 震動 / 閃光（給 ultimateSkills 呼叫）
  w.__ultimateShake = function(){
    try{
      var flash = document.createElement("div");
      flash.className = "ult-flash";
      document.body.appendChild(flash);
      document.body.classList.add("shake-all");
      setTimeout(function(){
        document.body.classList.remove("shake-all");
        flash.remove();
      }, 380);
    }catch(_){}
  };

  function createPanel(){
    if (document.getElementById(WRAP_ID)) return;
    var wrap = document.createElement("div"); wrap.id = WRAP_ID;

    var toggle = document.createElement("button"); toggle.id = BTN_ID; toggle.textContent = "🔥";
    toggle.title = "五轉技能";
    var panel = document.createElement("div"); panel.className = "panel";
    var list  = document.createElement("div"); list.className  = "row";
    list.style.display = "none"; // 預設收合

    toggle.onclick = function(){
      list.style.display = (list.style.display==="none") ? "block" : "none";
      toggle.classList.toggle("active");
    };

    panel.appendChild(list);
    wrap.appendChild(toggle);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);

    // lock 橫幅
    var banner = document.createElement("div"); banner.id = "ultLockBanner"; banner.className = "ult-lock-banner";
    document.body.appendChild(banner);

    renderList(list);
    setInterval(function(){
      renderList(list);
      // 顯示/隱藏鎖橫幅
      if (w.isUltimateLockActive && w.isUltimateLockActive()){
        var left = Math.ceil((window.__ULT_LOCK__?.until||0) - Math.floor(Date.now()/1000));
        banner.textContent = "蓄力中…暫停普攻/技能 (" + Math.max(0,left) + "s)";
        banner.style.display = "block";
      } else {
        banner.style.display = "none";
      }
    }, 1000);

    // 鍵盤（1~4，僅當前職業）
    window.addEventListener("keydown", function(e){
      var k = String(e.key||"");
      var map = { "1":"warrior", "2":"mage", "3":"archer", "4":"thief" };
      if (!map[k]) return;
      if (map[k] !== baseJob()) return;
      tryCast(map[k]);
    });
  }

  function fmt(sec){ sec=Math.max(0,Math.floor(sec)); var m=Math.floor(sec/60), s=sec%60; return (m<10?"0":"")+m+":"+(s<10?"0":"")+s; }

  function renderList(container){
    var bj = baseJob();
    container.innerHTML = "";
    var jobsToShow = [bj]; // 只顯示當前職業

    jobsToShow.forEach(function(jobKey){
      var s = w.getUltimateStateForJob(jobKey);
      if (!s) return;

      var item = document.createElement("div");
      item.className = "ult-item";
      if (s.charging>0) item.classList.add("charging");

      var icon = document.createElement("div"); icon.className = "icon"; icon.textContent = s.icon; icon.style.color = s.color;
      var name = document.createElement("div"); name.className = "name"; name.textContent = s.name;
      var meta = document.createElement("div"); meta.className = "meta";
      var pill = document.createElement("div"); pill.className = "ult-cool";

      var statusText = "";
      var pillText   = "";
      var disabled   = false;

      if (!inCombat()) {
        statusText = "非戰鬥";
        pillText   = "Idle";
        disabled   = true;
      } else if (!w.passedUltimateGate || !w.passedUltimateGate()) {
        statusText = "未解放（需五轉或等級≥220）";
        pillText   = "Locked";
        disabled   = true;
      } else if (s.charging>0) {
        statusText = "蓄力 " + fmt(s.charging);
        pillText   = "蓄力";
        disabled   = true;
      } else if (s.cool>0) {
        statusText = "冷卻 " + fmt(s.cool);
        pillText   = fmt(s.cool);
        disabled   = true;
      } else {
        statusText = "可施放";
        pillText   = "Ready";
        disabled   = false;
      }

      if (disabled) item.classList.add("disabled"); else item.classList.remove("disabled");
      meta.textContent = statusText;
      pill.textContent = pillText;

      item.appendChild(icon); item.appendChild(name); item.appendChild(meta); item.appendChild(pill);
      item.onclick = function(){ if (!disabled) tryCast(jobKey); };

      container.appendChild(item);
    });
  }

  function tryCast(jobKey){
    var s = w.getUltimateStateForJob(jobKey);
    if (!s) return;
    if (!inCombat()) { w.CombatLog?.log?.("⚠️ 非戰鬥狀態，無法施放五轉技能"); return; }
    if (!w.passedUltimateGate || !w.passedUltimateGate()) { w.CombatLog?.log?.("⚠️ 尚未解放：需五轉或等級≥220"); return; }
    if (s.cool>0 || s.charging>0) return;
    if (jobKey !== baseJob()) return;
    w.castUltimateSkill(jobKey);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", createPanel);
  else createPanel();

})(window);