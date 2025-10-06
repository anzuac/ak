// save_export_import.js
// 匯出 / 匯入 本機存檔（支援 A/B 雙槽與舊版單鍵）

(function () {
  const NS = "GAME_SAVE_V2";
  const MANIFEST_KEY = `${NS}:manifest`;
  const SLOT_A = `${NS}:slotA`;
  const SLOT_B = `${NS}:slotB`;
  const OLD_SINGLE_KEY = `${NS}`; // 你的舊版單一 key

  function ts() {
    const d = new Date();
    const pad = (n)=>String(n).padStart(2,"0");
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function readActiveRaw() {
    const manifestRaw = localStorage.getItem(MANIFEST_KEY);
    if (manifestRaw) {
      try {
        const m = JSON.parse(manifestRaw);
        const activeKey = m?.active === "slotB" ? SLOT_B : SLOT_A;
        const raw = localStorage.getItem(activeKey);
        if (raw) return { raw, schemaVersion: m.schemaVersion || 1, format: "ab-slots" };
        // 沒有 active 時嘗試 backup
        const backupKey = (activeKey === SLOT_A) ? SLOT_B : SLOT_A;
        const raw2 = localStorage.getItem(backupKey);
        if (raw2) return { raw: raw2, schemaVersion: m.schemaVersion || 1, format: "ab-slots" };
      } catch {}
    }
    const old = localStorage.getItem(OLD_SINGLE_KEY);
    if (old) {
      // 舊版單鍵
      let sv = 1;
      try { sv = JSON.parse(old)?.schemaVersion || 1; } catch {}
      return { raw: old, schemaVersion: sv, format: "single-key" };
    }
    return null;
  }

  // 下載文字檔
  function download(filename, text) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  // 對外：匯出
  window.exportSaveToFile = function exportSaveToFile() {
    // 先確保把暫存進度落盤（若有你的新 save_core）
    try { window.saveGame?.(); } catch {}
    const pack = readActiveRaw();
    if (!pack) {
      alert("找不到可匯出的存檔。");
      return;
    }
    // 用信封包起來，保留 schema 與來源格式
    const envelope = {
      type: "rpg-save",
      storageFormat: pack.format,     // "ab-slots" | "single-key"
      schemaVersion: pack.schemaVersion || 1,
      exportedAt: Date.now(),
      payload: pack.raw               // 直接保存原始 JSON 字串
    };
    download(`save-${ts()}.json`, JSON.stringify(envelope));
  };

  // 對外：匯入
  window.importSaveFromFile = async function importSaveFromFile(evt) {
    const file = evt?.target?.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let payloadRaw = null;
      let schemaVersion = 1;

      // 嘗試辨識「信封格式」
      try {
        const obj = JSON.parse(text);
        if (obj && obj.type === "rpg-save" && typeof obj.payload === "string") {
          payloadRaw = obj.payload;
          schemaVersion = obj.schemaVersion || 1;
        } else {
          // 也可能直接給存檔物件 → 我們 stringify 回原文
          payloadRaw = JSON.stringify(obj);
          schemaVersion = obj.schemaVersion || 1;
        }
      } catch {
        // 純文字（不太可能），直接用
        payloadRaw = text;
      }

      // 基本檢查：至少要能 parse
      try { JSON.parse(payloadRaw); }
      catch (e) {
        alert("匯入失敗：檔案內容不是有效的存檔 JSON。");
        console.error(e);
        return;
      }

      // 寫入本機 A 槽並設為 active（簡化流程，讓 save_core 接手之後的原子寫）
      localStorage.setItem(SLOT_A, payloadRaw);
      localStorage.setItem(MANIFEST_KEY, JSON.stringify({
        schemaVersion,
        active: "slotA",
        backup: "slotB",
        savedAt: Date.now(),
        size: payloadRaw.length,
        checksum: "imported"
      }));

      // 重新載入到遊戲狀態
      const ok = window.loadGame?.();
      if (ok) {
        alert("✅ 匯入完成，已套用到遊戲。");
      } else {
        alert("⚠️ 已寫入本機，但載入流程未成功。請重新整理或稍後再試。");
      }

      // 清空 input 值，方便下次選同一檔
      if (evt?.target) evt.target.value = "";
    } catch (err) {
      console.error("匯入錯誤：", err);
      alert("匯入失敗，請檢查檔案格式。");
    }
  };
})();