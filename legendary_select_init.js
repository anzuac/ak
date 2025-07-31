const potentialData_legendary = [
  { name: "STR +20", weights: [5.63, 1.24, 1.31] },
  { name: "STR +15", weights: [11.25, 3.72, 3.27] },
  { name: "STR +13", weights: [0, 4.96, 5.56] },
  { name: "STR +10", weights: [0, 6.20, 6.54] },

  { name: "DEX +20", weights: [5.63, 1.24, 1.31] },
  { name: "DEX +15", weights: [11.25, 3.72, 3.27] },
  { name: "DEX +13", weights: [0, 4.96, 5.56] },
  { name: "DEX +10", weights: [0, 6.20, 6.54] },

  { name: "INT +20", weights: [5.63, 1.24, 1.31] },
  { name: "INT +15", weights: [11.25, 3.72, 3.27] },
  { name: "INT +13", weights: [0, 4.96, 5.56] },
  { name: "INT +10", weights: [0, 6.20, 6.54] },

  { name: "LUK +20", weights: [5.63, 1.24, 1.31] },
  { name: "LUK +15", weights: [11.25, 3.72, 3.27] },
  { name: "LUK +13", weights: [0, 4.96, 5.56] },
  { name: "LUK +10", weights: [0, 6.20, 6.54] },

  { name: "全屬性 +20", weights: [3.52, 0.87, 0.98] },
  { name: "全屬性 +15", weights: [7.03, 2.23, 1.63] },
  { name: "全屬性 +13", weights: [0, 3.10, 2.61] },
  { name: "全屬性 +10", weights: [0, 4.96, 4.25] },

  { name: "攻擊力 +20", weights: [1.13, 0.37, 0.33] },
  { name: "攻擊力 +15", weights: [1.41, 0.99, 0.98] },
  { name: "攻擊力 +13", weights: [0, 1.49, 1.31] },
  { name: "攻擊力 +10", weights: [0, 1.24, 0.98] },

  { name: "魔法攻擊力 +20", weights: [1.13, 0.37, 0.33] },
  { name: "魔法攻擊力 +15", weights: [1.41, 0.99, 0.98] },
  { name: "魔法攻擊力 +13", weights: [0, 1.49, 1.31] },
  { name: "魔法攻擊力 +10", weights: [0, 1.24, 0.98] },

  { name: "MaxHP +300", weights: [5.63, 1.24, 1.31] },
  { name: "MaxHP +250", weights: [11.25, 3.72, 3.27] },
  { name: "MaxHP +230", weights: [0, 4.96, 5.56] },
  { name: "MaxHP +200", weights: [0, 6.20, 6.54] },
];

// 插入多選 checkbox 到對應的欄位（第一、第二、第三條潛能）
function generateCheckboxes(containerId, lineIndex) {
  const container = document.getElementById(containerId);
  potentialData_legendary.forEach(potential => {
    const value = potential.name;
    const probability = potential.weights[lineIndex];
    if (probability > 0) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = value;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(value));
      container.appendChild(label);
    }
  });
}

window.onload = function () {
  generateCheckboxes("firstLineOptions", 0);
  generateCheckboxes("secondLineOptions", 1);
  generateCheckboxes("thirdLineOptions", 2);
};