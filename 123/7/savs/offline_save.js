// offline/offline_save.js
(function () {
  if (!window.GameSave) window.GameSave = {};
  if (!GameSave.adapters) GameSave.adapters = {};

  const LS_KEY = "rpg_last_offline_ts";

  function dumpOffline() {
    return {
      __v: 1,
      lastSeenMs: Number(localStorage.getItem(LS_KEY) || 0)
    };
  }

  function loadOffline(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    const t = Number(snapshot.lastSeenMs || 0);
    // 雲端載入到本機：同步回 localStorage
    if (t > 0) localStorage.setItem(LS_KEY, String(t));
  }

  GameSave.adapters.offline = {
    key: 'offline',
    version: 1,
    dump: dumpOffline,
    load: loadOffline,
  };
})();