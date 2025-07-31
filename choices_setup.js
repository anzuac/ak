document.addEventListener("DOMContentLoaded", () => {
  const config = {
    removeItemButton: true,
    shouldSort: false,
    placeholder: true,
    placeholderValue: '請選擇潛能條件…',
    searchEnabled: true
  };
  
  const selects = ['target1', 'target2', 'target3'];
  const instances = {};
  
  for (const id of selects) {
    const select = document.getElementById(id);
    if (!select) continue;
    const choice = new Choices(select, config);
    instances[id] = choice;
  }
  
  window.getSelectedValues = function(selectId) {
    return instances[selectId]?.getValue(true) || [];
  };
  
  window.updateChoicesOptions = function(pools) {
    for (const id of selects) {
      const instance = instances[id];
      if (!instance) continue;
      
      const isFirst = (id === 'target1');
      const choices = pools
        .filter(opt => opt.weights && opt.weights.some(w => w > 0))
        .map(opt => ({
          value: opt.name,
          label: opt.name + (isFirst && (!opt.weights[0] || opt.weights[0] === 0) ? '（無法作為第一條）' : ''),
          disabled: isFirst && (!opt.weights[0] || opt.weights[0] === 0)
        }));
      
      instance.clearChoices();
      instance.setChoices(choices, 'value', 'label', true);
    }
  };
});