// 📦 game_init.js —— rAF 三條即時節奏 + 攻速百分比驅動（玩家/怪物）

// ===== 可調參數（毫秒） =====
var RT = {
  // 基準（100% 時的間隔）
  basePlayerMs: 2000,    // 例：100% 時 1.5 秒
  baseMonsterMs: 2000,

  // 目前實際使用的間隔（會被動態回填）
  playerActMs: 1000,
  monsterActMs: 2000,

  // 系統節奏
  tickMs: 1000,          // 狀態/冷卻/DoT
  uiMs: 100,             // UI 節流

  // 安全下限（避免過快）
  minActMs: 10,

  // 固定覆寫（≠null 即採用固定毫秒、不吃百分比）
  playerMsFixed: null,
  monsterMsFixed: null,

  // 額外百分比覆寫（乘在最終上，預設 1 = 不變）
  playerPctOverride: 1,
  monsterPctOverride: 1
};

// —— 對外安全 setter（改參數會重置累加器，避免爆跑）——
function _resetAccumulators(){ _accP = _accM = _accT = _accUI = 0; }

// 舊相容：直接用毫秒覆寫（固定模式）
window.setAttackSpeed = function (ms) {
  var v = Number(ms);
  if (isFinite(v) && v > 0) { RT.playerMsFixed = v; _resetAccumulators(); }
};
window.setMonsterSpeed = function (ms) {
  var v = Number(ms);
  if (isFinite(v) && v > 0) { RT.monsterMsFixed = v; _resetAccumulators(); }
};

// 新接口：用百分比倍數（小數倍數；1=100%，10=1000%）
window.setPlayerSpeedPct = function (pct) {
  var p = Number(pct);
  RT.playerPctOverride = (isFinite(p) && p > 0) ? p : 1;
  RT.playerMsFixed = null; // 回到自動模式
  _resetAccumulators();
};
window.setMonsterSpeedPct = function (pct) {
  var p = Number(pct);
  RT.monsterPctOverride = (isFinite(p) && p > 0) ? p : 1;
  RT.monsterMsFixed = null;
  _resetAccumulators();
};

// 可選：調整系統節奏
window.setTickMs = function (ms) {
  var v = Number(ms);
  if (isFinite(v) && v >= 16) { RT.tickMs = v; _resetAccumulators(); }
};
window.setUiMs = function (ms) {
  var v = Number(ms);
  if (isFinite(v) && v >= 16) { RT.uiMs = v; _resetAccumulators(); }
};

// ===== rAF 迴圈累加器 =====
var _lastTs = 0, _accP = 0, _accM = 0, _accT = 0, _accUI = 0;
var _loopOn = false;

// 每幀：把【攻速百分比】換算成實際毫秒
function _recalcIntervals() {
  // —— 玩家 —— //
  var wantPlayerMs;
  if (RT.playerMsFixed && RT.playerMsFixed > 0) {
    // 固定毫秒模式
    wantPlayerMs = RT.playerMsFixed;
  } else {
    // 自動：從 player.totalStats.attackSpeedPct（小數倍數）換算
    var aspd = 1;
    if (window.player && player.totalStats) {
      var raw = Number(player.totalStats.attackSpeedPct);
      aspd = (isFinite(raw) && raw > 0) ? raw : 1;
    }
    var effPct = aspd * (RT.playerPctOverride || 1);
    wantPlayerMs = Math.max(RT.minActMs, Math.round(RT.basePlayerMs / effPct));
  }
  if (RT.playerActMs !== wantPlayerMs) { RT.playerActMs = wantPlayerMs; _accP = 0; }

  // —— 怪物 —— //
  var wantMonsterMs;
  if (RT.monsterMsFixed && RT.monsterMsFixed > 0) {
    wantMonsterMs = RT.monsterMsFixed;
  } else {
    var mpct = 1;
    if (window.currentMonster) {
      var rawM = Number(currentMonster.attackSpeedPct ?? currentMonster.speedPct ?? 1);
      mpct = (isFinite(rawM) && rawM > 0) ? rawM : 1;

      // 若你有狀態（如 haste.mul）也會乘上
      var haste = currentMonster.statusEffects && currentMonster.statusEffects.haste;
      if (haste && Number(haste.mul) && haste.duration > 0) mpct *= Number(haste.mul);
    }
    var effMpct = mpct * (RT.monsterPctOverride || 1);
    wantMonsterMs = Math.max(RT.minActMs, Math.round(RT.baseMonsterMs / effMpct));
  }
  if (RT.monsterActMs !== wantMonsterMs) { RT.monsterActMs = wantMonsterMs; _accM = 0; }
}

function _loop(ts) {
  if (!_loopOn) return;
  if (_lastTs === 0) _lastTs = ts;
  var dt = ts - _lastTs; _lastTs = ts;

  // ★ 每幀依照百分比重算一次實際間隔
  _recalcIntervals();

  if (window.autoEnabled) {
    _accT += dt; _accP += dt; _accM += dt; _accUI += dt;

    while (_accT >= RT.tickMs) {
      if (typeof window.rtTickSec === "function") window.rtTickSec();
      _accT -= RT.tickMs;
    }
    while (_accP >= RT.playerActMs) {
      if (typeof window.rtPlayerAct === "function") window.rtPlayerAct();
      _accP -= RT.playerActMs;
      if (!window.autoEnabled) break;
    }
    while (_accM >= RT.monsterActMs) {
      if (typeof window.rtMonsterAct === "function") window.rtMonsterAct();
      _accM -= RT.monsterActMs;
      if (!window.autoEnabled) break;
    }

    if (_accUI >= RT.uiMs) {
      if (typeof window.updateResourceUI === "function") window.updateResourceUI();
      if (window.currentMonster && typeof window.updateMonsterInfo === "function") {
        window.updateMonsterInfo(window.currentMonster, Math.max(window.monsterHP || 0, 0));
      }
      _accUI = 0;
    }
  }
  requestAnimationFrame(_loop);
}

window.addEventListener("DOMContentLoaded", function () {
  // 初始化玩家與 UI
  if (typeof window.initPlayer === "function") window.initPlayer();
  if (typeof window.updateResourceUI === "function") window.updateResourceUI();

  // ====== 保留你的地圖/等級填入 ======
  var levelSelect = document.getElementById("levelRange");
  var mapSelect   = document.getElementById("mapSelect");

  if (typeof levelRangeOptions !== 'undefined' && levelSelect && levelSelect.options.length === 0) {
    for (var i = 0; i < levelRangeOptions.length; i++) {
      var rng = levelRangeOptions[i];
      var opt = document.createElement("option");
      opt.value = rng.value;
      opt.textContent = rng.label;
      levelSelect.appendChild(opt);
    }
  }
  if (typeof mapOptions !== 'undefined' && mapSelect && mapSelect.options.length === 0) {
    for (var j = 0; j < mapOptions.length; j++) {
      var mp = mapOptions[j];
      var opt2 = document.createElement("option");
      opt2.value = mp.value;
      opt2.textContent = mp.label;
      mapSelect.appendChild(opt2);
    }
  }

  if (levelSelect) levelSelect.addEventListener("change", function(){
    window.selectedRange = levelSelect.value;
  });
  if (mapSelect)   mapSelect.addEventListener("change", function(){
    window.selectedMap = mapSelect.value;
  });

  // 啟動 rAF 主迴圈
  if (!_loopOn) { _loopOn = true; requestAnimationFrame(_loop); }

  // Start：開啟自動戰鬥
  var btnStart = document.getElementById('btnStart');
  if (btnStart) btnStart.addEventListener('click', function () {
    if (!window.autoEnabled) {
      window.autoEnabled = true;

      if (!window.currentMonster) {
        if (window.BattleGate && window.BattleGate.requestAutoSpawn) {
          window.BattleGate.requestAutoSpawn();
        } else if (typeof window.spawnNewMonster === "function") {
          window.spawnNewMonster();
        }
      }
      if (typeof window.setDifficultySelectDisabled === "function") window.setDifficultySelectDisabled(true);
      _resetAccumulators();
    }
  });

  // Stop：優雅停止
  var btnStop  = document.getElementById('btnStop');
  if (btnStop) btnStop.addEventListener('click', function () {
    window.stopAfterEncounter = true;
  });
});


function _loop(ts) {
  if (!_loopOn) return;
  if (_lastTs === 0) _lastTs = ts;
  var dt = ts - _lastTs; _lastTs = ts;

  _recalcIntervals();

  if (window.autoEnabled) {
    _accT += dt; _accP += dt; _accM += dt; _accUI += dt;

    while (_accT >= RT.tickMs) { window.rtTickSec?.(); _accT -= RT.tickMs; }
    while (_accP >= RT.playerActMs) { window.rtPlayerAct?.(); _accP -= RT.playerActMs; if (!window.autoEnabled) break; }
    while (_accM >= RT.monsterActMs) { window.rtMonsterAct?.(); _accM -= RT.monsterActMs; if (!window.autoEnabled) break; }

    if (_accUI >= RT.uiMs) {
      window.updateResourceUI?.();
      if (window.currentMonster && typeof window.updateMonsterInfo === "function") {
        window.updateMonsterInfo(window.currentMonster, Math.max(window.monsterHP || 0, 0));
      }

      // ★ 只讀顯示 APS（次/秒），不影響運算
      const pAPS = (1000 / RT.playerActMs).toFixed(2);
      const mAPS = (1000 / RT.monsterActMs).toFixed(2);
      const pEl = document.getElementById("hudPlayerAPS");
      const mEl = document.getElementById("hudMonsterAPS");
      if (pEl) pEl.textContent = `${pAPS}/s`;
      if (mEl) mEl.textContent = `${mAPS}/s`;

      _accUI = 0;
    }
  }
  requestAnimationFrame(_loop);
}