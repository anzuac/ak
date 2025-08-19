// save_element_equipment.js
// 元素裝備系統存檔/載入（外接，不修改 element_equipment.js）
// 請在 element_equipment.js 之後載入

(function () {
  const VERSION = 1;

  // 安全取得資料來源
  function getData() {
    if (typeof window.elementGearData !== 'object' || !window.elementGearData) {
      console.warn('[save_element_equipment] elementGearData 不存在');
      return null;
    }
    return window.elementGearData;
  }

  // 深拷貝（避免引用互相污染）
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj || {}));
  }

  // 只序列化安全欄位：避免把函式或循環參考塞進存檔
  function sanitizeSlot(slotObj) {
    // 允許所有基礎型別與平鋪物件；未知欄位也保留（方便你未來擴充）
    const keep = {};
    for (const k in slotObj) {
      if (!Object.prototype.hasOwnProperty.call(slotObj, k)) continue;
      const v = slotObj[k];
      // 過濾掉函式
      if (typeof v === 'function') continue;
      // 拷貝物件/陣列/字串/數字/布林/null
      keep[k] = deepClone(v);
    }
    return keep;
  }

  // ===== 匯出（dump）=====
  window.dumpElementGear = function dumpElementGear() {
    const src = getData();
    if (!src) return { __v: VERSION, slots: {} };

    const out = {};
    for (const slotKey in src) {
      if (!Object.prototype.hasOwnProperty.call(src, slotKey)) continue;
      out[slotKey] = sanitizeSlot(src[slotKey]);
    }
    return { __v: VERSION, slots: out };
  };

  // ===== 匯入（load）=====
  window.loadElementGear = function loadElementGear(saved) {
    const dst = getData();
    if (!dst || !saved || typeof saved !== 'object') return;

    const from = saved.slots || {};
    // 把存檔數值覆蓋到現有結構：已存在欄位覆寫；新的欄位也加入
    for (const slotKey in from) {
      if (!Object.prototype.hasOwnProperty.call(from, slotKey)) continue;

      // 若目標沒有該槽，先建一個空殼（保留你原本資料結構的彈性）
      if (typeof dst[slotKey] !== 'object' || !dst[slotKey]) {
        dst[slotKey] = {};
      }

      const savedSlot = from[slotKey];
      const targetSlot = dst[slotKey];

      // 逐鍵寫回（含你未來新增的欄位）
      for (const k in savedSlot) {
        if (!Object.prototype.hasOwnProperty.call(savedSlot, k)) continue;
        targetSlot[k] = deepClone(savedSlot[k]);
      }
    }

    // 載入後重算加成 → 回灌到 player.coreBonus
    try {
      if (typeof window.applyElementEquipmentBonusToPlayer === 'function') {
        window.applyElementEquipmentBonusToPlayer();
      }
    } catch (err) {
      console.warn('[save_element_equipment] apply bonus failed:', err);
    }
  };

  //（可選）重置所有欄位為 0 的小工具：window.resetElementGear()
  window.resetElementGear = function resetElementGear() {
    const data = getData(); if (!data) return;
    for (const slotKey in data) {
      const s = data[slotKey];
      if (!s || typeof s !== 'object') continue;
      s.level = 0; s.advance = 0; s.starforce = 0; s.break = 0;
      s.isDivine = false;
      s.stats = s.stats || {};
      s.upgradeStats = s.upgradeStats || {};
      for (const k in s.stats) s.stats[k] = 0;
      for (const k in s.upgradeStats) s.upgradeStats[k] = 0;
    }
    if (typeof window.applyElementEquipmentBonusToPlayer === 'function') {
      window.applyElementEquipmentBonusToPlayer();
    }
  };

})();