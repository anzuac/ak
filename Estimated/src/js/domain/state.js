import { getDefaultDeadlineValue } from '../utils/date.js';
import { BURNING_MODES, normalizeBurningMode, sortRecords } from './calculator.js';

export const createDefaultState = () => ({
  goal: null,
  records: [],
});

let appState = createDefaultState();

export function getState() {
  return structuredClone(appState);
}

export function setState(nextState) {
  const goal = nextState?.goal
    ? {
        ...nextState.goal,
        burningMode: normalizeBurningMode(nextState.goal.burningMode),
        targetExpBp: 0,
        dailyTrainingHours: Number(nextState.goal.dailyTrainingHours || 2),
      }
    : null;

  appState = {
    goal,
    records: Array.isArray(nextState?.records) ? sortRecords(nextState.records, goal?.burningMode) : [],
  };
}

export function setGoal(goal) {
  appState.goal = goal
    ? {
        ...goal,
        burningMode: normalizeBurningMode(goal.burningMode),
        targetExpBp: 0,
        dailyTrainingHours: Number(goal.dailyTrainingHours || 2),
      }
    : null;

  appState.records = sortRecords(appState.records, appState.goal?.burningMode);
}

export function addRecord(record) {
  appState.records = sortRecords([...appState.records, record], appState.goal?.burningMode);
}

export function removeRecord(recordId) {
  appState.records = appState.records.filter(record => record.id !== recordId);
}

export function clearRecords() {
  appState.records = [];
}

export function resetState() {
  appState = createDefaultState();
}

export function createDefaultGoal() {
  return {
    startLevel: 260,
    startExpBp: 0,
    targetLevel: 300,
    targetExpBp: 0,
    burningMode: BURNING_MODES.BURN_270,
    targetTime: getDefaultDeadlineValue(),
    dailyTrainingHours: 2,
  };
}
