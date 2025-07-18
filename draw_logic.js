
function drawOne() {
  const totalWeight = beastData.reduce((sum, item) => sum + item.rate, 0);
  let rand = Math.random() * totalWeight;
  for (let item of beastData) {
    if (rand < item.rate) return item;
    rand -= item.rate;
  }
  return beastData[beastData.length - 1]; // fallback
}

function drawByPosition(position) {
  const item = drawOne();
  const level = judgeLevel(item, position);
  return { item, level };
}
