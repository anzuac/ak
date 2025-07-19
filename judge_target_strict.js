
function checkTargetMatch(drawn, targets) {
  const drawnCounts = {};
  const targetCounts = {};

  drawn.forEach(name => {
    drawnCounts[name] = (drawnCounts[name] || 0) + 1;
  });

  targets.forEach(name => {
    targetCounts[name] = (targetCounts[name] || 0) + 1;
  });

  for (let key in targetCounts) {
    if (!drawnCounts[key] || drawnCounts[key] < targetCounts[key]) {
      return false;
    }
  }
  return true;
}
