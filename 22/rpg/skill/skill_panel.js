// =======================
// skill_panel.js
// 技能控制區渲染（攻擊=只顯示CD；補助/增益=顯示CD+Buff倒數；被動=顯示已啟動）
// 依賴：window.player、window.skills 或 window.activeSkills
// =======================

(function() {
  const $ = (id) => document.getElementById(id);
  
  // 若外部未提供 togglePanel，這裡補一個最簡版（顯示/隱藏）
  if (typeof window.togglePanel !== 'function') {
    window.togglePanel = function(bodyId) {
      const el = $(bodyId);
      if (!el) return;
      const hidden = (getComputedStyle(el).display === 'none');
      el.style.display = hidden ? '' : 'none';
      const btn = document.querySelector(`[onclick*="${bodyId}"]`);
      if (btn) btn.textContent = hidden ? '▼' : '▲';
    };
  }
  
  function fmtSec(s) {
    s = Math.max(0, Math.ceil(Number(s) || 0));
    return s + "s";
  }
  
  // 取得冷卻剩餘秒數：優先 currentCooldown；其次用 cooldownStart 推算
  function getCdRemain(skill) {
    const cd = Number(skill.cooldown || 0);
    if (cd <= 0) return 0;
    if (Number(skill.currentCooldown) > 0) {
      return Math.max(0, Math.ceil(skill.currentCooldown));
    }
    if (skill.cooldownStart) {
      const past = (Date.now() - skill.cooldownStart) / 1000;
      return Math.max(0, Math.ceil(cd - past));
    }
    return 0;
  }
  
  // 取得 Buff 剩餘秒數（若有 activeUntil）
  function getBuffRemain(skill) {
    if (!skill) return 0;
    const end = Number(skill.activeUntil || 0);
    if (!end) return 0;
    const remainMs = end - Date.now();
    return Math.max(0, Math.ceil(remainMs / 1000));
  }
  
  function bar(percent, cls) {
    percent = Math.max(0, Math.min(100, percent));
    return `
      <div class="skill-bar ${cls || ''}">
        <div class="skill-bar-fill" style="width:${percent}%"></div>
      </div>
    `;
  }
  
  function renderOne(skill) {
    const type = (skill.type || "attack").toLowerCase();
    const name = skill.name || skill.id || "技能";
    const cd = Number(skill.cooldown || 0);
    const cdRemain = getCdRemain(skill);
    const isBuffLike = (type === 'support' || type === 'buff');
    const buffRemain = isBuffLike ? getBuffRemain(skill) : 0;
    
    // 進度：CD 百分比（倒數→0）
    const cdPct = cd > 0 ? (100 * (cd - cdRemain) / cd) : 100;
    
    // 顯示文字
    const meta = [];
    if (cd > 0) meta.push(`CD ${fmtSec(cdRemain)}`);
    if (isBuffLike && buffRemain > 0) meta.push(`Buff ${fmtSec(buffRemain)}`);
    if (type === 'passive') meta.push(`已啟動`);
    
    // 規則：
    // - 攻擊：只顯示 CD
    // - 補助/增益：顯示 CD + Buff（若有）
    // - 被動：顯示「已啟動」
    const showCdBar = cd > 0;
    const showBuffBar = isBuffLike && buffRemain > 0;
    
    return `
      <div class="skill-row">
        <div class="skill-head">
          <span class="skill-name">${name}</span>
          <span class="skill-meta">${meta.join(" ｜ ")}</span>
        </div>
        <div class="skill-progress">
          ${showCdBar ? bar(cdPct, 'cd') : ''}
          ${showBuffBar ? bar(100, 'buff') : ''}
        </div>
      </div>
    `;
  }
  
  function getSkillList() {
    if (Array.isArray(window.skills)) return window.skills;
    if (Array.isArray(window.activeSkills)) return window.activeSkills;
    return [];
  }
  
  window.renderSkillPanel = function() {
    const host = $("skillStatus");
    if (!host) return;
    
    const list = getSkillList();
    
    // 顯示順序：攻擊 → 補助/增益 → 被動
    const atk = list.filter(s => (s.type || '').toLowerCase() === 'attack');
    const sup = list.filter(s => ['support', 'buff'].includes((s.type || '').toLowerCase()));
    const pas = list.filter(s => (s.type || '').toLowerCase() === 'passive');
    const ordered = [...atk, ...sup, ...pas];
    
    host.innerHTML = ordered.map(renderOne).join("");
  };
  
  // 初始化：如果面板存在，就先渲染一次；之後每 500ms 自動更新倒數
  function boot() {
    if (document.getElementById('skillStatus')) {
      try { window.renderSkillPanel(); } catch {}
      setInterval(() => { try { window.renderSkillPanel(); } catch {} }, 500);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();