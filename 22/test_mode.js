(function () {
  const ORIG = {
    mathRandom: Math.random,
    getItemQuantity: (typeof getItemQuantity === 'function') ? getItemQuantity : null,
    removeItem: (typeof removeItem === 'function') ? removeItem : null,
    alert: window.alert,                 // 原生 alert（未綁定）
    alertBound: window.alert.bind(window), // ✅ 綁定好的 alert
    playerGold: null,
    logPrepend: (typeof window.logPrepend === 'function') ? window.logPrepend : null,
  };

  function enableDevSuccess() {
    console.warn('🔧 [DEV] enableDevSuccess: 鎖定 100% 成功 + 無限材料/楓幣 + 靜音 alert');
    Math.random = () => 0;
    if (ORIG.getItemQuantity) window.getItemQuantity = () => Number.MAX_SAFE_INTEGER;
    if (ORIG.removeItem) window.removeItem = () => {};
    if (typeof player === 'object') {
      ORIG.playerGold = player.gold;
      player.gold = Number.MAX_SAFE_INTEGER;
    }
    window.alert = function(){ /* 靜音 */ };
    if (ORIG.logPrepend) window.logPrepend = () => {};
  }

  function disableDevSuccess() {
    console.warn('🔧 [DEV] disableDevSuccess: 還原環境');
    Math.random = ORIG.mathRandom;
    if (ORIG.getItemQuantity) window.getItemQuantity = ORIG.getItemQuantity;
    if (ORIG.removeItem) window.removeItem = ORIG.removeItem;
    if (ORIG.playerGold != null && typeof player === 'object') {
      player.gold = ORIG.playerGold; ORIG.playerGold = null;
    }
    window.alert = ORIG.alert;
    if (ORIG.logPrepend) window.logPrepend = ORIG.logPrepend;
  }

  function safeCall(fnName, ...args) {
    const fn = window[fnName];
    if (typeof fn === 'function') return fn(...args);
    return undefined;
  }

  function setAllEquipmentToMax() {
    console.warn('⚠️ [DEV] setAllEquipmentToMax: 開始模擬滿級強化');
    enableDevSuccess();

    const report = [];

    try {
      // ===== 元素裝備 =====
      if (typeof elementGearData === 'object') {
        const starMax  = (typeof STARFORCE_MAX_LEVEL === 'number') ? STARFORCE_MAX_LEVEL : 30;
        const breakMax = (typeof BREAKTHROUGH_MAX_LEVEL === 'number') ? BREAKTHROUGH_MAX_LEVEL : 10;

        for (const key in elementGearData) {
          const eq = elementGearData[key];
          if (!eq) continue;

          const before = { L:eq.level, A:eq.advance, S:eq.starforce, B:eq.break };

          let guard = 0;
          while (eq.level < 20 && guard++ < 200) safeCall('upgradeElementEquipment', key);
          guard = 0;
          while (eq.advance < 20 && guard++ < 200) safeCall('advanceElementEquipment', key);
          guard = 0;
          while (eq.starforce < starMax && guard++ < 400) safeCall('starforceElementEquipment', key);
          guard = 0;
          while (eq.break < breakMax && guard++ < 200) safeCall('breakElementEquipment', key);

          const after = { L:eq.level, A:eq.advance, S:eq.starforce, B:eq.break };
          report.push(`元素-${eq.name}: L${before.L}->${after.L}, A${before.A}->${after.A}, S${before.S}->${after.S}, B${before.B}->${after.B}`);
        }
      }

      // ===== 高級裝備 =====
      if (typeof equipmentList === 'object') {
        for (const key in equipmentList) {
          const eq = equipmentList[key];
          if (!eq) continue;

          const before = { L:eq.level, A:eq.advance, S:eq.starforce };
          let guard = 0;
          while (eq.level < 15 && guard++ < 150) safeCall('upgradeEquipment', key);
          guard = 0;
          while (eq.advance < 11 && guard++ < 150) safeCall('advanceEquipment', key);
          guard = 0;
          while (eq.starforce < 50 && guard++ < 300) safeCall('starpowerUpgrade', key);

          const after = { L:eq.level, A:eq.advance, S:eq.starforce };
          report.push(`高裝-${eq.name}: L${before.L}->${after.L}, A${before.A}->${after.A}, S${before.S}->${after.S}`);
        }
      }

      // ===== 統一刷新 =====
      safeCall('applyElementEquipmentBonusToPlayer');
      safeCall('updateElementSetBonus');
      safeCall('updateElementEquipmentPanelContent');

      safeCall('applyCardBonusToPlayer');
      safeCall('updateEquipmentModalContent');

      safeCall('updateAllUI');
      safeCall('updateResourceUI');

      console.table(report);
      ORIG.alertBound('✨ 所有裝備已強化至最大等級！（測試模式）\n請查看 Console 的表格紀錄。'); // ✅ 用已綁定的 alert
    } catch (e) {
      console.error('❌ setAllEquipmentToMax 發生例外：', e);
      ORIG.alertBound('❌ setAllEquipmentToMax 發生例外，詳見 Console。'); // ✅
    } finally {
      disableDevSuccess();
    }
  }

  window.enableDevSuccess = enableDevSuccess;
  window.disableDevSuccess = disableDevSuccess;
  window.setAllEquipmentToMax = setAllEquipmentToMax;

  console.log('✅ test_utils 就緒：可用 setAllEquipmentToMax() / enableDevSuccess() / disableDevSuccess()');
})();