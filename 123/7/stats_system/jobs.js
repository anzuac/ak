const jobs = {
  warrior: {
    name: "戰士",
    statMultipliers: {
      str: 1.1,
      agi: 0,
      int: 0,
      luck: 0
    },
  },
  mage: {
    name: "法師",
    statMultipliers: {
      str: 0,
      agi: 0,
      int: 1.1,
      luck: 0
    },
  },
  archer: {
    name: "弓箭手",
    statMultipliers: {
      str: 0,
      agi: 1.1,
      int: 0,
      luck: 0
    },
  },
  thief: {
    name: "盜賊",
    statMultipliers: {
      str: 0,
      agi: 0,
      int: 0,
      luck: 1.1
    },
  }
};
// --- 職業標準化 ---


// --- 判斷是否法師 ---
function isMage() {
  return player?.job === "mage";
}