import { elements } from './dom.js';
import { normalizeBurningMode, normalizeLevelAndExp, parsePercentToBasisPoints } from '../domain/calculator.js';
import { formatPercentInput } from '../utils/format.js';
import { getDefaultDeadlineValue, toDateInputValue } from '../utils/date.js';

function readNormalizedLevelExp(levelElement, expElement) {
  return normalizeLevelAndExp(
    Number(levelElement.value),
    parsePercentToBasisPoints(expElement.value),
  );
}

export function fillGoalForm(goal) {
  elements.startLevel.value = goal?.startLevel ?? 260;
  elements.startExp.value = formatPercentInput(goal?.startExpBp ?? 0);
  elements.targetLevel.value = goal?.targetLevel ?? 300;
  elements.burningModeInputs.forEach(input => {
    input.checked = input.value === normalizeBurningMode(goal?.burningMode);
  });
  elements.targetTime.value = goal?.targetTime ?? getDefaultDeadlineValue();
  elements.dailyTrainingHours.value = goal?.dailyTrainingHours ?? 2;
}

export function readGoalForm() {
  const start = readNormalizedLevelExp(elements.startLevel, elements.startExp);
  return {
    startLevel: start.level,
    startExpBp: start.expBp,
    targetLevel: Number(elements.targetLevel.value),
    targetExpBp: 0,
    burningMode: normalizeBurningMode(elements.burningModeInputs.find(input => input.checked)?.value),
    targetTime: elements.targetTime.value || getDefaultDeadlineValue(),
    dailyTrainingHours: Number(elements.dailyTrainingHours.value),
  };
}

export function resetRecordForm() {
  elements.recordDate.value = toDateInputValue();
  elements.endLevel.value = '';
  elements.endExp.value = '';
  elements.minutes.value = '';
  elements.note.value = '';
}

export function readRecordForm() {
  const end = readNormalizedLevelExp(elements.endLevel, elements.endExp);

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: elements.recordDate.value,
    endLevel: end.level,
    endExpBp: end.expBp,
    minutes: Number(elements.minutes.value),
    note: elements.note.value.trim(),
    createdAt: new Date().toISOString(),
  };
}

export function setDefaultDates() {
  if (!elements.recordDate.value) elements.recordDate.value = toDateInputValue();
  if (!elements.targetTime.value) elements.targetTime.value = getDefaultDeadlineValue();
  if (!elements.dailyTrainingHours.value) elements.dailyTrainingHours.value = 2;
}
