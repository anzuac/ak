const jobs = {
  // === 一轉：父系（創角選擇） ===
  warrior: {
    name: "戰士",
    statMultipliers: { str: 1.1, agi: 0, int: 0, luck: 0 }
  },
  mage: {
    name: "法師",
    statMultipliers: { str: 0, agi: 0, int: 1.1, luck: 0 }
  },
  archer: {
    name: "弓箭手",
    statMultipliers: { str: 0, agi: 1.1, int: 0, luck: 0 }
  },
  thief: {
    name: "盜賊",
    statMultipliers: { str: 0, agi: 0, int: 0, luck: 1.1 }
  },
  
  // === 二轉 ===
  warrior2: {
    name: "劍聖",
    parent: "warrior",
    statMultipliers: { str: 1.3, agi: 0, int: 0, luck: 0 }
  },
  mage2: {
    name: "大法師",
    parent: "mage",
    statMultipliers: { str: 0, agi: 0, int: 1.3, luck: 0 }
  },
  archer2: {
    name: "狙擊手",
    parent: "archer",
    statMultipliers: { str: 0, agi: 1.3, int: 0, luck: 0 }
  },
  thief2: {
    name: "影舞者",
    parent: "thief",
    statMultipliers: { str: 0, agi: 0, int: 0, luck: 1.3 }
  },
  
  // === 三轉 ===
  warrior3: {
    name: "鬥神",
    parent: "warrior2",
    statMultipliers: { str: 1.5, agi: 0, int: 0, luck: 0 }
  },
  mage3: {
    name: "元素師",
    parent: "mage2",
    statMultipliers: { str: 0, agi: 0, int: 1.5, luck: 0 }
  },
  archer3: {
    name: "遊俠",
    parent: "archer2",
    statMultipliers: { str: 0, agi: 1.5, int: 0, luck: 0 }
  },
  thief3: {
    name: "刺客",
    parent: "thief2",
    statMultipliers: { str: 0, agi: 0, int: 0, luck: 1.5 }
  },
  
  // === 四轉 ===
  warrior4: {
    name: "戰神",
    parent: "warrior3",
    statMultipliers: { str: 1.7, agi: 0, int: 0, luck: 0 }
  },
  mage4: {
    name: "大賢者",
    parent: "mage3",
    statMultipliers: { str: 0, agi: 0, int: 1.7, luck: 0 }
  },
  archer4: {
    name: "神射手",
    parent: "archer3",
    statMultipliers: { str: 0, agi: 1.7, int: 0, luck: 0 }
  },
  thief4: {
    name: "暗影領主",
    parent: "thief3",
    statMultipliers: { str: 0, agi: 0, int: 0, luck: 1.7 }
  },
  
  // === 五轉 ===
  warrior5: {
    name: "永恆戰神",
    parent: "warrior4",
    statMultipliers: { str: 2.0, agi: 0, int: 0, luck: 0 }
  },
  mage5: {
    name: "神話法師",
    parent: "mage4",
    statMultipliers: { str: 0, agi: 0, int: 2.0, luck: 0 }
  },
  archer5: {
    name: "傳說神射手",
    parent: "archer4",
    statMultipliers: { str: 0, agi: 2.0, int: 0, luck: 0 }
  },
  thief5: {
    name: "幻影刺皇",
    parent: "thief4",
    statMultipliers: { str: 0, agi: 0, int: 0, luck: 2.0 }
  }
};

window.jobs = jobs;


