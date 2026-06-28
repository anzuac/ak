import { EXP_BASIS, LEVEL_EXP, MAX_LEVEL, MIN_LEVEL } from '../constants/expTable.js';

export const BURNING_MODES = Object.freeze({
  NONE: 'none',
  BURN_270: 'burn270',
  BURN_280: 'burn280',
});

export function normalizeBurningMode(mode) {
  return Object.values(BURNING_MODES).includes(mode) ? mode : BURNING_MODES.BURN_270;
}

export function getBurningCap(mode) {
  const normalizedMode = normalizeBurningMode(mode);

  if (normalizedMode === BURNING_MODES.BURN_270) return 270;
  if (normalizedMode === BURNING_MODES.BURN_280) return 280;
  return null;
}

export function getBurningModeLabel(mode) {
  const normalizedMode = normalizeBurningMode(mode);

  if (normalizedMode === BURNING_MODES.NONE) return '無燃燒';
  if (normalizedMode === BURNING_MODES.BURN_280) return '燃燒 1+1（到 280）';
  return '燃燒 1+1（到 270）';
}

export function getLevelNeed(level) {
  return LEVEL_EXP[Number(level)] ?? 0n;
}

export function getNextEffectiveLevel(level, burningMode = BURNING_MODES.BURN_270) {
  const numericLevel = Number(level);
  const burningCap = getBurningCap(burningMode);

  return burningCap !== null && numericLevel < burningCap
    ? numericLevel + 2
    : numericLevel + 1;
}

export function isEventSkipRangeLevel(level, burningMode = BURNING_MODES.BURN_270) {
  const numericLevel = Number(level);
  const burningCap = getBurningCap(burningMode);

  return burningCap !== null && numericLevel >= MIN_LEVEL && numericLevel < burningCap;
}

export function isValidLevel(level, burningMode = BURNING_MODES.BURN_270) {
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) return false;

  // 燃燒 1+1 時，燃燒上限前每次升等會額外 +1 等。
  // 例如 1+1（270）有效路線是 260 → 262 → 264 → 266 → 268 → 270。
  // 被跳過的奇數等級不算進需求，也不允許輸入。
  if (isEventSkipRangeLevel(level, burningMode)) return level % 2 === 0;

  return true;
}

export function parsePercentToBasisPoints(value) {
  const raw = String(value ?? '').trim();
  if (raw === '') return Number.NaN;

  // UI 不要求玩家輸入 %，但若貼上 12.345% 或 12.345％ 也會自動判別。
  const normalized = raw
    .replace(/％/g, '%')
    .replace(/\s+/g, '')
    .replace(/%$/, '');

  if (!/^(100(?:\.0{0,3})?|(?:\d|[1-9]\d)(?:\.\d{0,3})?)$/.test(normalized)) {
    return Number.NaN;
  }

  const [integerPart, decimalPart = ''] = normalized.split('.');
  const basisPoints = Number(integerPart) * 1000 + Number(decimalPart.padEnd(3, '0'));

  return Math.min(Math.max(basisPoints, 0), 100_000);
}

export function isValidExpBasisPoints(_level, expBp) {
  return Number.isInteger(expBp) && expBp >= 0 && expBp <= 100_000;
}

export function normalizeLevelAndExp(level, expBp) {
  const numericLevel = Number(level);
  const numericExpBp = Number(expBp);

  // 保留玩家輸入的等級與百分比，不在畫面上自動改寫。
  // 計算時 100.000% 會依目前燃燒規則等同下一個有效等級 0.000%。
  return { level: numericLevel, expBp: numericExpBp };
}

export function toTotalExp(level, expBp, burningMode = BURNING_MODES.BURN_270) {
  const numericLevel = Number(level);
  const numericExpBp = Number(expBp);

  if (!isValidLevel(numericLevel, burningMode) || !isValidExpBasisPoints(numericLevel, numericExpBp)) {
    throw new Error('invalid level or exp percent');
  }

  let total = 0n;

  for (let currentLevel = MIN_LEVEL; currentLevel < numericLevel; currentLevel = getNextEffectiveLevel(currentLevel, burningMode)) {
    total += getLevelNeed(currentLevel);
  }

  const currentNeed = getLevelNeed(numericLevel);
  total += (currentNeed * BigInt(numericExpBp)) / EXP_BASIS;

  return total;
}

export function toNumberSafe(value) {
  if (typeof value === 'bigint') return Number(value);
  return Number(value);
}

function getRecordTotalForSort(record, burningMode = BURNING_MODES.BURN_270) {
  try {
    return toTotalExp(record.endLevel, record.endExpBp, burningMode);
  } catch {
    return null;
  }
}

function compareBigInt(a, b) {
  if (a === b) return 0;
  return a > b ? 1 : -1;
}

function getTimeForSort(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function sortRecords(records, burningMode = BURNING_MODES.BURN_270) {
  return [...records].sort((a, b) => {
    const dateResult = getTimeForSort(a.date) - getTimeForSort(b.date);
    if (dateResult !== 0) return dateResult;

    // 同一天可能會新增多筆紀錄，但表單只有日期、沒有時間。
    // 因此同日紀錄改用「結束進度」由低到高排序，避免玩家同一天升等時，
    // 因 randomUUID 字串順序導致高等紀錄被排到前面，誤判成進度倒退。
    const totalA = getRecordTotalForSort(a, burningMode);
    const totalB = getRecordTotalForSort(b, burningMode);

    if (totalA !== null && totalB !== null) {
      const progressResult = compareBigInt(totalA, totalB);
      if (progressResult !== 0) return progressResult;
    }

    const createdAtResult = getTimeForSort(a.createdAt) - getTimeForSort(b.createdAt);
    if (createdAtResult !== 0) return createdAtResult;

    return String(a.id).localeCompare(String(b.id));
  });
}

export function validateRecordProgress(goal, records) {
  const burningMode = normalizeBurningMode(goal.burningMode);
  let previousTotal = toTotalExp(goal.startLevel, goal.startExpBp, burningMode);

  for (const record of sortRecords(records, burningMode)) {
    const currentTotal = toTotalExp(record.endLevel, record.endExpBp, burningMode);

    if (currentTotal < previousTotal) return false;
    previousTotal = currentTotal;
  }

  return true;
}

export function calculateRows(goal, records) {
  if (!goal) return [];

  const burningMode = normalizeBurningMode(goal.burningMode);
  let previousTotal = toTotalExp(goal.startLevel, goal.startExpBp, burningMode);

  return sortRecords(records, burningMode).map(record => {
    const previousRecordTotal = previousTotal;
    const currentTotal = toTotalExp(record.endLevel, record.endExpBp, burningMode);
    const gainedExp = currentTotal - previousRecordTotal;
    const minutes = Number(record.minutes || 0);
    const isTrainingEntry = minutes > 0;
    const expPerHour = isTrainingEntry ? toNumberSafe(gainedExp) / minutes * 60 : 0;
    const currentNeed = getLevelNeed(record.endLevel);
    const percentPerHour = currentNeed > 0n ? expPerHour / toNumberSafe(currentNeed) * 100 : 0;

    previousTotal = currentTotal;

    return {
      record,
      previousTotal: previousRecordTotal,
      currentTotal,
      currentNeed,
      gainedExp,
      expPerHour,
      percentPerHour,
      isTrainingEntry,
    };
  });
}



export function calculateDailyRows(goal, records) {
  const rows = calculateRows(goal, records);
  const groups = [];

  for (const row of rows) {
    let group = groups.at(-1);

    if (!group || group.date !== row.record.date) {
      group = {
        key: `day-${row.record.date}`,
        date: row.record.date,
        rows: [],
        firstPreviousTotal: row.previousTotal,
        currentTotal: row.currentTotal,
        currentNeed: row.currentNeed,
        endRecord: row.record,
        gainedExp: 0n,
        trainingGainedExp: 0n,
        otherGainedExp: 0n,
        minutes: 0,
        otherEntryCount: 0,
        notes: [],
        expPerHour: 0,
        percentPerHour: 0,
      };
      groups.push(group);
    }

    const minutes = Number(row.record.minutes || 0);

    group.rows.push(row);
    group.currentTotal = row.currentTotal;
    group.currentNeed = row.currentNeed;
    group.endRecord = row.record;
    group.gainedExp += row.gainedExp;

    if (minutes > 0) {
      group.trainingGainedExp += row.gainedExp;
      group.minutes += minutes;
    } else {
      group.otherGainedExp += row.gainedExp;
      group.otherEntryCount += 1;
    }

    const note = String(row.record.note || '').trim();
    if (note && !group.notes.includes(note)) group.notes.push(note);
  }

  for (const group of groups) {
    group.expPerHour = group.minutes > 0
      ? toNumberSafe(group.trainingGainedExp) / group.minutes * 60
      : 0;

    group.percentPerHour = group.currentNeed > 0n
      ? group.expPerHour / toNumberSafe(group.currentNeed) * 100
      : 0;
  }

  return groups;
}

export function calculateSummary(goal, records, now = new Date()) {
  if (!goal) return null;

  const burningMode = normalizeBurningMode(goal.burningMode);
  const sortedRecords = sortRecords(records, burningMode);
  const startTotal = toTotalExp(goal.startLevel, goal.startExpBp, burningMode);
  const targetTotal = toTotalExp(goal.targetLevel, goal.targetExpBp, burningMode);

  const lastRecord = sortedRecords.at(-1) ?? null;
  const currentLevel = lastRecord?.endLevel ?? goal.startLevel;
  const currentExpBp = lastRecord?.endExpBp ?? goal.startExpBp;
  const currentTotal = lastRecord
    ? toTotalExp(lastRecord.endLevel, lastRecord.endExpBp, burningMode)
    : startTotal;

  const totalNeed = targetTotal - startTotal;
  const completed = currentTotal - startTotal;
  const remaining = targetTotal > currentTotal ? targetTotal - currentTotal : 0n;
  const rows = calculateRows(goal, sortedRecords);
  const trainingGained = rows.reduce((sum, row) => row.isTrainingEntry ? sum + row.gainedExp : sum, 0n);
  const otherGained = rows.reduce((sum, row) => row.isTrainingEntry ? sum : sum + row.gainedExp, 0n);
  const totalMinutes = sortedRecords.reduce((sum, record) => {
    const minutes = Number(record.minutes || 0);
    return minutes > 0 ? sum + minutes : sum;
  }, 0);
  const otherRecordCount = sortedRecords.filter(record => Number(record.minutes || 0) === 0).length;
  const dayCount = new Set(sortedRecords.map(record => record.date)).size;
  const trainingDates = new Set(
    sortedRecords
      .filter(record => Number(record.minutes || 0) > 0)
      .map(record => record.date),
  );
  const trainingDayCount = trainingDates.size;
  const completedNumber = toNumberSafe(completed < 0n ? 0n : completed);
  const remainingNumber = toNumberSafe(remaining);
  const trainingGainedNumber = toNumberSafe(trainingGained < 0n ? 0n : trainingGained);

  const avgExpPerHour = totalMinutes > 0 ? trainingGainedNumber / totalMinutes * 60 : 0;
  const estimateHours = avgExpPerHour > 0 && remainingNumber > 0 ? remainingNumber / avgExpPerHour : 0;
  const completeRate = totalNeed > 0n ? completedNumber / toNumberSafe(totalNeed) * 100 : 0;
  const avgTotalExpPerDay = dayCount > 0 ? completedNumber / dayCount : 0;
  const totalExpEstimatedCalendarDays = avgTotalExpPerDay > 0 && remainingNumber > 0
    ? remainingNumber / avgTotalExpPerDay
    : 0;
  const totalExpProjectedFinishDate = totalExpEstimatedCalendarDays > 0
    ? new Date(now.getTime() + totalExpEstimatedCalendarDays * 24 * 60 * 60 * 1000)
    : null;

  const deadline = new Date(goal.targetTime);
  const deadlineHours = (deadline.getTime() - now.getTime()) / 1000 / 60 / 60;
  const deadlineDays = deadlineHours > 0 ? deadlineHours / 24 : 0;
  const defaultDailyTrainingHours = Number(goal.dailyTrainingHours || 0);
  const actualDailyTrainingHours = trainingDayCount > 0
    ? totalMinutes / 60 / trainingDayCount
    : 0;
  const effectiveDailyTrainingHours = actualDailyTrainingHours > 0
    ? actualDailyTrainingHours
    : defaultDailyTrainingHours;
  const isUsingActualDailyAverage = actualDailyTrainingHours > 0;
  const estimatedCalendarDays = effectiveDailyTrainingHours > 0 && estimateHours > 0
    ? estimateHours / effectiveDailyTrainingHours
    : 0;
  const projectedFinishDate = estimatedCalendarDays > 0
    ? new Date(now.getTime() + estimatedCalendarDays * 24 * 60 * 60 * 1000)
    : null;
  const requiredExpPerHour = deadlineHours > 0 && remainingNumber > 0 ? remainingNumber / deadlineHours : 0;
  const requiredExpPerDay = deadlineDays > 0 && remainingNumber > 0 ? remainingNumber / deadlineDays : 0;
  const requiredDailyTrainingHours = deadlineDays > 0 && avgExpPerHour > 0 && remainingNumber > 0
    ? estimateHours / deadlineDays
    : 0;

  return {
    startTotal,
    targetTotal,
    currentTotal,
    currentLevel,
    currentExpBp,
    totalNeed,
    completed,
    remaining,
    totalMinutes,
    trainingGained,
    otherGained,
    otherRecordCount,
    recordCount: sortedRecords.length,
    dayCount,
    trainingDayCount,
    avgExpPerHour,
    estimateHours,
    completeRate,
    avgTotalExpPerDay,
    totalExpEstimatedCalendarDays,
    totalExpProjectedFinishDate,
    deadline,
    deadlineHours,
    deadlineDays,
    dailyTrainingHours: defaultDailyTrainingHours,
    actualDailyTrainingHours,
    effectiveDailyTrainingHours,
    isUsingActualDailyAverage,
    estimatedCalendarDays,
    projectedFinishDate,
    requiredExpPerHour,
    requiredExpPerDay,
    requiredDailyTrainingHours,
  };
}
