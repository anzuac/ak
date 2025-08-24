window.addEventListener("DOMContentLoaded", () => {
  initPlayer();
  updateResourceUI();

  const levelSelect = document.getElementById("levelRange");
  const mapSelect = document.getElementById("mapSelect");

  levelRangeOptions.forEach(range => {
    const opt = document.createElement("option");
    opt.value = range.value;
    opt.textContent = range.label;
    levelSelect.appendChild(opt);
  });

  mapOptions.forEach(map => {
    const opt = document.createElement("option");
    opt.value = map.value;
    opt.textContent = map.label;
    mapSelect.appendChild(opt);
  });

  levelSelect.addEventListener("change", () => selectedRange = levelSelect.value);
  mapSelect.addEventListener("change", () => selectedMap = mapSelect.value);

  setInterval(battleRound, 1000);
  
  document.getElementById('btnStart')?.addEventListener('click', () => {
  if (!autoEnabled) {
    autoEnabled = true;
    // Idle 狀態且場上沒怪的話，請觸發一次生怪（如果你不想等下一個 tick）
    if (!currentMonster) spawnNewMonster?.();
    // 開始就鎖難度（保險起見，也可以只靠生怪時鎖）
    window.setDifficultySelectDisabled?.(true);
  }
});

document.getElementById('btnStop')?.addEventListener('click', () => {
  // 不立刻停，改為優雅停止：本隻打完就停
  stopAfterEncounter = true;
});


});


