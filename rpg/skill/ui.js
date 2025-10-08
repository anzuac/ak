// === ui.js ===

// 初始化技能彈窗
window.initSkillModal = function () {
  const backdrop = document.createElement("div");
  backdrop.id = "skillBackdrop";
  Object.assign(backdrop.style, {
    display: "none",
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.5)",
    zIndex: "998",
  });

  const modal = document.createElement("div");
  modal.id = "skillModal";
  Object.assign(modal.style, {
    display: "none",
    position: "fixed",
    top: "10vh",
    left: "50%",
    transform: "translateX(-50%)",
    width: "90vw",
    maxHeight: "80vh",
    overflowY: "auto",
    backgroundColor: "#222",
    padding: "16px",
    border: "1px solid #888",
    borderRadius: "6px",
    zIndex: "999",
    color: "#fff",
    WebkitOverflowScrolling: "touch"
  });

  const title = document.createElement("h3");
  title.textContent = "技能清單";
  Object.assign(title.style, {
    marginTop: "0",
    fontSize: "14px",
    borderBottom: "1px solid #666",
    paddingBottom: "4px",
    color: "#fff",
  });
  modal.appendChild(title);

  const list = document.createElement("div");
  list.id = "skillList";
  Object.assign(list.style, { width: "100%" });
  modal.appendChild(list);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "關閉";
  closeBtn.onclick = () => window.closeSkillModal();
  modal.appendChild(closeBtn);

  document.body.appendChild(modal);
  document.body.appendChild(backdrop);
};

// === 技能券成本（依轉數）：1轉=1、2轉=2、3轉=3、4轉=4（超過一律當4）
window.getTicketCostForSkill = function (skill) {
  const rank = Number(skill?.requiredJobRank ?? skill?.jobRank ?? skill?.rank ?? 1);
  return Math.max(1, Math.min(4, rank));
};
window.openSkillModal = function(type = "all") {
  const modal = document.getElementById("skillModal");
  const backdrop = document.getElementById("skillBackdrop");
  const list = document.getElementById("skillList");
  list.innerHTML = "";

  const src = Array.isArray(window.skills) ? window.skills : [];
  const uniqueSkills = [...new Map(src.map(s => [s.id, s])).values()];
  const filteredSkills = (type === "all") ? uniqueSkills : uniqueSkills.filter(skill => skill.type === type);

  filteredSkills.forEach((skill) => {
    // 顯示用 MP/CD
    const t = (typeof getActiveTier === "function" && skill.tiers) ? getActiveTier(skill) : null;
    const baseMp = Number(t?.mpCost ?? skill.mpCost ?? 0);
    const mpGrow = Number(t?.logic?.mpCostLevelGrowth ?? 0) * Math.max(0, (skill.level ?? 1) - 1);
    const viewMP = baseMp + mpGrow;
    const viewCD = Number(t?.cooldown ?? skill.cooldown ?? 0);

    // 外層：左右佈局（左：資訊＋升級鈕；右：自動）
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      padding: "6px 0",
      borderBottom: "1px solid #444",
      gap: "12px",
    });

    // 左側欄：名稱、MP/CD、說明、升級鈕（按鈕在說明下方）
    const left = document.createElement("div");
    left.style.flex = "1 1 auto";

    const info = document.createElement("div");
    info.innerHTML = `
      <strong>${skill.name}</strong> Lv.${skill.level}<br>
      MP：${viewMP}｜冷卻：${viewCD}s
      <br>
      ${typeof skill.getDescription === 'function' ? skill.getDescription() : (skill.description || "")}
    `;

    // 升級鈕（技能券依轉數）
    const btnBar = document.createElement("div");
    Object.assign(btnBar.style, { marginTop: "6px" });
    const upgradeBtn = document.createElement("button");
    const tkCost = (typeof getTicketCostForSkill === "function") ? getTicketCostForSkill(skill) : 1;
    upgradeBtn.textContent = `升級（${tkCost} 張）`;
    upgradeBtn.disabled = skill.level >= 20 || getItemQuantity("技能強化券") < tkCost;
    upgradeBtn.onclick = () => { upgradeSkill(skill.id); openSkillModal(type); };
    btnBar.appendChild(upgradeBtn);

    left.appendChild(info);
    left.appendChild(btnBar);

    // 右側欄：自動勾選
    const right = document.createElement("div");
    Object.assign(right.style, { 
      display: "flex", 
      alignItems: "center", 
      gap: "8px", 
      // 新增：保持內容靠右對齊
      alignSelf: "flex-end", 
      // 新增：不壓縮空間
      flexShrink: 0
    });

    const target = Array.isArray(window.skills) ? window.skills.find(x => x.id === skill.id) : skill;
    if (typeof target.autoEnabled === "undefined") {
      const saved = localStorage.getItem(`skillAuto_${skill.id}`);
      target.autoEnabled = saved === null ? false : (saved === "1");
    }
    const autoLabel = document.createElement("label");
    autoLabel.style.userSelect = "none";
    const autoChk = document.createElement("input");
    autoChk.type = "checkbox";
    autoChk.checked = !!target.autoEnabled;
    autoChk.addEventListener("change", () => {
      const tSkill = Array.isArray(window.skills) ? window.skills.find(x => x.id === skill.id) : skill;
      const on = !!autoChk.checked;
      if (tSkill) tSkill.autoEnabled = on;
      localStorage.setItem(`skillAuto_${skill.id}`, on ? "1" : "0");
    });
    autoLabel.appendChild(autoChk);
    autoLabel.append("自動");

    right.appendChild(autoLabel);

    // 組裝
    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  });

  modal.style.display = "block";
  backdrop.style.display = "block";
};


// 關閉技能彈窗
window.closeSkillModal = function() {
  const m = document.getElementById("skillModal");
  const b = document.getElementById("skillBackdrop");
  if (m) m.style.display = "none";
  if (b) b.style.display = "none";
};

// 技能升級功能（固定消耗 1 張技能強化券）
function upgradeSkill(skillId) {
  const skill = skills.find((s) => s.id === skillId);
  if (!skill) return;
  
  const cost = 1; // ✅ 固定 1 張
  const itemName = "技能強化券";
  const owned = getItemQuantity(itemName);
  
  if (owned < cost) {
    logPrepend(`❌ ${itemName} 不足，無法升級技能`);
    return;
  }
  
  if (skill.level >= 20) {
    logPrepend("⚠️ 技能已達最高等級");
    return;
  }
  
  removeItem(itemName, cost);
  skill.level++;
  logPrepend(`🔼 ${skill.name} 升級至 Lv.${skill.level}`);
  
  if (typeof saveGame === 'function') saveGame();
}