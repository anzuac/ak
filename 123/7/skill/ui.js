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
  Object.assign(list.style, {
    width: "100%",
  });
  modal.appendChild(list);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "關閉";
  closeBtn.onclick = () => window.closeSkillModal();
  modal.appendChild(closeBtn);

  document.body.appendChild(modal);
  document.body.appendChild(backdrop);
};

// 顯示技能彈窗（支援分類）
window.openSkillModal = function(type = "all") {
  const modal = document.getElementById("skillModal");
  const backdrop = document.getElementById("skillBackdrop");
  const list = document.getElementById("skillList");
  list.innerHTML = "";

  const uniqueSkills = [...new Map(skills.map(s => [s.id, s])).values()];
  const filteredSkills = type === "all" ?
    uniqueSkills :
    uniqueSkills.filter(skill => skill.type === type);

  filteredSkills.forEach((skill) => {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "6px 0",
      borderBottom: "1px solid #444",
    });

    const info = document.createElement("div");
    info.innerHTML = `
      <strong>${skill.name}</strong> Lv.${skill.level}<br>
      MP：${skill.mpCost || 0}｜冷卻：${skill.cooldown || 0}s
      <br>
      ${typeof skill.getDescription === 'function' ? skill.getDescription() : skill.description || ""}
    `;

    const upgradeBtn = document.createElement("button");
    upgradeBtn.textContent = `升級（${skill.getUpgradeCost()} 鑽）`;
    upgradeBtn.disabled = skill.level >= 20 || player.gem < skill.getUpgradeCost();
    upgradeBtn.onclick = () => {
      upgradeSkill(skill.id);
      openSkillModal(type);
    };

    row.appendChild(info);
    row.appendChild(upgradeBtn);
    list.appendChild(row);
  });

  modal.style.display = "block";
  backdrop.style.display = "block";
};

// 關閉技能彈窗
window.closeSkillModal = function() {
  document.getElementById("skillModal").style.display = "none";
  document.getElementById("skillBackdrop").style.display = "none";
};

// 建立下拉式技能選單按鈕
window.createSkillSelectButton = function() {
  const container = document.querySelector(".container .row") || document.querySelector(".container");
  const section = document.createElement("div");
  section.className = "section";

  const label = document.createElement("label");
  label.textContent = "查看技能：";
  section.appendChild(label);

  const select = document.createElement("select");
  const types = [
    { label: "全部", value: "all" },
    { label: "攻擊技能", value: "attack" },
    { label: "補助技能", value: "buff" },
    { label: "被動技能", value: "passive" },
  ];
  types.forEach(t => {
    const option = document.createElement("option");
    option.value = t.value;
    option.textContent = t.label;
    select.appendChild(option);
  });
  section.appendChild(select);

  const btn = document.createElement("button");
  btn.textContent = " 查看技能";
  btn.style.marginLeft = "6px";
  btn.onclick = () => {
    const selectedType = select.value;
    openSkillModal(selectedType);
  };
  section.appendChild(btn);

  container.appendChild(section);
};

// 技能升級功能
function upgradeSkill(skillId) {
  const skill = skills.find((s) => s.id === skillId);
  if (!skill) return;

  const cost = skill.getUpgradeCost();
  if (player.gem < cost) {
    logPrepend("❌ 鑽石不足，無法升級技能");
    return;
  }

  if (skill.level >= 20) {
    logPrepend("⚠️ 技能已達最高等級");
    return;
  }

  player.gem -= cost;
  skill.level++;
  logPrepend(`🔼 ${skill.name} 升級至 Lv.${skill.level}`);
}

// 技能冷卻遞減（每回合呼叫）
function reduceSkillCooldowns() {
  for (const skill of skills) {
    if (skill.currentCooldown > 0) {
      skill.currentCooldown--;
    }
  }
}

// ===== Bootstrapping: 初始化 + 啟動技能AI（和 UI 無關）=====

