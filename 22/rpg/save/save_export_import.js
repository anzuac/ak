// ==========================
// save_export_import.js — 單槽版
// ==========================
(function () {
  const NS = "GAME_SAVE_V4";
  const KEY_DATA = `${NS}:data`;
  const KEY_META = `${NS}:meta`;

  // 舊制（只讀）
  const OLD_NS = "GAME_SAVE_V2";
  const OLD_MANIFEST = `${OLD_NS}:manifest`;
  const OLD_SLOT_A   = `${OLD_NS}:slotA`;
  const OLD_SLOT_B   = `${OLD_NS}:slotB`;
  const OLD_SINGLE   = `${OLD_NS}`;

  function ts() {
    const d = new Date();
    const pad = (n)=>String(n).padStart(2,"0");
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function readActiveRaw() {
    // 單槽優先
    const raw = localStorage.getItem(KEY_DATA);
    if (raw) return { raw, schemaVersion: JSON.parse(localStorage.getItem(KEY_META)||"{}").schemaVersion || 2, format: "single-slot" };

    // 退回舊制 A/B
    const manifestRaw = localStorage.getItem(OLD_MANIFEST);
    if (manifestRaw) {
      try {
        const m = JSON.parse(manifestRaw);
        const activeKey = m?.active === "slotB" ? OLD_SLOT_B : OLD_SLOT_A;
        const rawAB = localStorage.getItem(activeKey) || localStorage.getItem(activeKey===OLD_SLOT_A?OLD_SLOT_B:OLD_SLOT_A);
        if (rawAB) return { raw: rawAB, schemaVersion: m.schemaVersion || 1, format: "ab-slots" };
      } catch {}
    }
    // 舊單鍵
    const old = localStorage.getItem(OLD_SINGLE);
    if (old) {
      let sv = 1; try { sv = JSON.parse(old)?.schemaVersion || 1; } catch {}
      return { raw: old, schemaVersion: sv, format: "single-key-legacy" };
    }
    return null;
  }

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

  window.exportSaveToFile = function exportSaveToFile() {
    try { window.saveGame?.(); } catch {}
    const pack = readActiveRaw();
    if (!pack) {
      alert("找不到可匯出的存檔。");
      return;
    }
    const envelope = {
      type: "rpg-save",
      storageFormat: pack.format,   // "single-slot" | "ab-slots" | "single-key-legacy"
      schemaVersion: pack.schemaVersion || 1,
      exportedAt: Date.now(),
      payload: pack.raw
    };
    download(`save-${ts()}.json`, JSON.stringify(envelope));
  };

  window.importSaveFromFile = async function importSaveFromFile(evt) {
    const file = evt?.target?.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let payloadRaw = null;
      let schemaVersion = 1;

      try {
        const obj = JSON.parse(text);
        if (obj && obj.type === "rpg-save" && typeof obj.payload === "string") {
          payloadRaw = obj.payload;
          schemaVersion = obj.schemaVersion || 1;
        } else {
          payloadRaw = JSON.stringify(obj);
          schemaVersion = obj.schemaVersion || 1;
        }
      } catch {
        payloadRaw = text;
      }

      try { JSON.parse(payloadRaw); }
      catch (e) {
        alert("匯入失敗：檔案內容不是有效的存檔 JSON。");
        console.error(e);
        return;
      }

      // 直接覆蓋單槽主檔（meta 交由 core 在下次 save 重算；這裡先簡單寫入）
      localStorage.setItem(KEY_DATA, payloadRaw);
      localStorage.setItem(KEY_META, JSON.stringify({
        schemaVersion,
        importedAt: Date.now(),
        size: payloadRaw.length,
        checksum: "imported" // 標記，代表這筆 meta 不是核心寫入的
      }));

      const ok = window.loadGame?.();
      if (ok) {
        alert("✅ 匯入完成，已套用到遊戲。");
      } else {
        alert("⚠️ 已寫入本機，但載入流程未成功。請重新整理或稍後再試。");
      }
      if (evt?.target) evt.target.value = "";
    } catch (err) {
      console.error("匯入錯誤：", err);
      alert("匯入失敗，請檢查檔案格式。");
    }
  };
})();