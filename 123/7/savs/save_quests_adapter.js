// save_quests_adapter.js
(function() {
  // —— 對外統一 API ——
  window.QuestAPI = {
    dump() {
      return {
        schemaVersion: 1,
        daily: (typeof Daily_exportState === 'function') ? Daily_exportState() : null,
        weekly: (typeof Weekly_exportState === 'function') ? Weekly_exportState() : null,
        repeat: (typeof Repeat_exportState === 'function') ? Repeat_exportState() : null,
        // achievements 之後再補，先給空
        achievements: null
      };
    },
    apply(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') return;
      // 按現有狀態逐一套回；每日/每週檔案會自己做跨日/跨週校正
      if (snapshot.daily && typeof Daily_applyState === 'function') Daily_applyState(snapshot.daily);
      if (snapshot.weekly && typeof Weekly_applyState === 'function') Weekly_applyState(snapshot.weekly);
      if (snapshot.repeat && typeof Repeat_applyState === 'function') Repeat_applyState(snapshot.repeat);
      // achievements 之後再補
    }
  };
  
  // —— 統一存取點（給你的「總存檔系統」用） ——
  window.SaveBridge = window.SaveBridge || {};
  window.SaveBridge.getQuestsBlob = () => window.QuestAPI.dump();
  window.SaveBridge.putQuestsBlob = (blob) => window.QuestAPI.apply(blob);
})();