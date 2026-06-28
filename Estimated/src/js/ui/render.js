import { elements } from './dom.js';
import { formatDateTime } from '../utils/date.js';
import { formatBasisPoints, formatBigInt, formatCompactExp, formatDailyHours, formatDecimalHoursPerDay, formatExpRate, formatHoursOnly, formatPercent } from '../utils/format.js';
import { calculateDailyRows, calculateSummary } from '../domain/calculator.js';

const clearClass = element => {
  element.classList.remove('status-good', 'status-warn', 'status-bad');
};

export function render(state) {
  renderStats(state);
  renderRecords(state);
  renderDeviceMode();
}

export function renderStats(state) {
  const summary = calculateSummary(state.goal, state.records);

  if (!summary) {
    setEmptyStats();
    return;
  }

  elements.currentProgress.textContent = `${summary.currentLevel} 等 ${formatBasisPoints(summary.currentExpBp)}%`;
  elements.currentTotalExp.textContent = `${formatCompactExp(summary.currentTotal)} 累積 EXP`;
  elements.currentTotalExp.title = `${formatBigInt(summary.currentTotal)} EXP`;
  elements.remainingExp.textContent = `${formatCompactExp(summary.remaining)} EXP`;
  elements.remainingExp.title = `${formatBigInt(summary.remaining)} EXP`;
  elements.completeRate.textContent = formatPercent(Math.min(summary.completeRate, 100));
  elements.progressFill.style.width = `${Math.min(Math.max(summary.completeRate, 0), 100)}%`;
  elements.totalMinutes.textContent = `${summary.totalMinutes.toLocaleString('en-US')} 分鐘`;
  elements.recordCount.textContent = `${summary.recordCount} 筆紀錄 / ${summary.dayCount} 天${summary.otherRecordCount > 0 ? ` / ${summary.otherRecordCount} 筆其他渠道` : ''}`;
  elements.avgPerHour.textContent = summary.totalMinutes > 0 ? `${formatCompactExp(summary.avgExpPerHour)} EXP` : '-';
  elements.avgPerHour.title = summary.totalMinutes > 0 ? `${formatExpRate(summary.avgExpPerHour)} EXP / 小時；其他渠道 ${formatBigInt(summary.otherGained)} EXP 不納入效率` : '0 分鐘紀錄只記錄成長，不納入效率';
  renderAverageDailyHours(summary);
  elements.estimateTime.textContent = summary.remaining === 0n
    ? '已達成'
    : summary.avgExpPerHour > 0
      ? formatHoursOnly(summary.estimateHours)
      : '-';
  elements.estimateTime.title = summary.avgExpPerHour > 0 ? `${summary.estimateHours.toFixed(3)} 小時` : '';
  renderProjectedFinish(summary);
  renderTotalExpProjectedFinish(summary);
  elements.requiredSpeed.textContent = summary.deadlineDays > 0 ? `${formatCompactExp(summary.requiredExpPerDay)} EXP / 日` : '-';
  elements.requiredSpeed.title = summary.deadlineDays > 0 ? `${formatExpRate(summary.requiredExpPerDay)} EXP / 日` : '';

  renderSpeedStatus(summary);
  renderRequiredDailyHours(summary);
}


function renderAverageDailyHours(summary) {
  clearClass(elements.averageDailyHourStatus);

  if (summary.isUsingActualDailyAverage) {
    elements.averageDailyHours.textContent = formatDecimalHoursPerDay(summary.actualDailyTrainingHours);
    elements.averageDailyHours.title = `${Math.round(summary.actualDailyTrainingHours * 60).toLocaleString('en-US')} 分 / 日`;
    elements.averageDailyHourStatus.textContent = `依 ${summary.trainingDayCount} 天有練等紀錄平均，0 分鐘紀錄不納入`;
    elements.averageDailyHourStatus.classList.add('status-good');
    return;
  }

  elements.averageDailyHours.textContent = formatDecimalHoursPerDay(summary.dailyTrainingHours);
  elements.averageDailyHours.title = '尚無練等分鐘紀錄，暫用目標設定的預設值';
  elements.averageDailyHourStatus.textContent = '尚無練等紀錄，先使用預設每日時數';
  elements.averageDailyHourStatus.classList.add('status-warn');
}

function renderProjectedFinish(summary) {
  clearClass(elements.projectedFinishStatus);
  clearClass(elements.projectedFinishDate);

  const unavailableText = getProjectedFinishUnavailableText(summary);

  if (unavailableText) {
    elements.projectedFinishDate.textContent = unavailableText.title;
    elements.projectedFinishStatus.textContent = unavailableText.status;
    elements.projectedFinishStatus.classList.add(unavailableText.statusClass);
    if (unavailableText.titleClass) elements.projectedFinishDate.classList.add(unavailableText.titleClass);
    return;
  }

  const sourceText = summary.isUsingActualDailyAverage
    ? `依實際每日平均 ${summary.effectiveDailyTrainingHours.toFixed(2)} 小時`
    : `暫用預設每日 ${summary.effectiveDailyTrainingHours.toFixed(2)} 小時`;

  elements.projectedFinishDate.textContent = formatDateTime(summary.projectedFinishDate);
  elements.projectedFinishDate.title = `${sourceText}，約 ${summary.estimatedCalendarDays.toFixed(1)} 天後完成`;
  elements.projectedFinishStatus.textContent = `${sourceText}，約 ${summary.estimatedCalendarDays.toFixed(1)} 天後完成`;

  if (summary.deadline instanceof Date && !Number.isNaN(summary.deadline.getTime())) {
    if (summary.projectedFinishDate.getTime() > summary.deadline.getTime()) {
      elements.projectedFinishStatus.textContent += `，預估超過目標時間 ${formatDateTime(summary.deadline)}`;
      elements.projectedFinishStatus.classList.add('status-warn');
      elements.projectedFinishDate.classList.add('status-warn');
      return;
    }

    elements.projectedFinishStatus.textContent += '，可在目標時間前完成';
    elements.projectedFinishStatus.classList.add('status-good');
    elements.projectedFinishDate.classList.add('status-good');
    return;
  }

  elements.projectedFinishStatus.classList.add('status-warn');
}

function renderTotalExpProjectedFinish(summary) {
  clearClass(elements.totalExpProjectedFinishStatus);
  clearClass(elements.totalExpProjectedFinishDate);

  if (summary.remaining === 0n) {
    elements.totalExpProjectedFinishDate.textContent = '已達成';
    elements.totalExpProjectedFinishStatus.textContent = '目標已完成';
    elements.totalExpProjectedFinishStatus.classList.add('status-good');
    elements.totalExpProjectedFinishDate.classList.add('status-good');
    return;
  }

  if (summary.dayCount <= 0 || summary.avgTotalExpPerDay <= 0 || !summary.totalExpProjectedFinishDate) {
    elements.totalExpProjectedFinishDate.textContent = '-';
    elements.totalExpProjectedFinishStatus.textContent = '新增紀錄後才會用每日總 EXP 推算';
    elements.totalExpProjectedFinishStatus.classList.add('status-warn');
    return;
  }

  elements.totalExpProjectedFinishDate.textContent = formatDateTime(summary.totalExpProjectedFinishDate);
  elements.totalExpProjectedFinishDate.title = `每日總獲得平均 ${formatExpRate(summary.avgTotalExpPerDay)} EXP，約 ${summary.totalExpEstimatedCalendarDays.toFixed(1)} 天後完成`;
  elements.totalExpProjectedFinishStatus.textContent = `依 ${summary.dayCount} 天每日總獲得平均 ${formatCompactExp(summary.avgTotalExpPerDay)} EXP / 日，約 ${summary.totalExpEstimatedCalendarDays.toFixed(1)} 天後完成`;

  if (summary.deadline instanceof Date && !Number.isNaN(summary.deadline.getTime())) {
    if (summary.totalExpProjectedFinishDate.getTime() > summary.deadline.getTime()) {
      elements.totalExpProjectedFinishStatus.textContent += `，預估超過目標時間 ${formatDateTime(summary.deadline)}`;
      elements.totalExpProjectedFinishStatus.classList.add('status-warn');
      elements.totalExpProjectedFinishDate.classList.add('status-warn');
      return;
    }

    elements.totalExpProjectedFinishStatus.textContent += '，可在目標時間前完成';
    elements.totalExpProjectedFinishStatus.classList.add('status-good');
    elements.totalExpProjectedFinishDate.classList.add('status-good');
    return;
  }

  elements.totalExpProjectedFinishStatus.classList.add('status-warn');
}

function getProjectedFinishUnavailableText(summary) {
  if (summary.remaining === 0n) {
    return {
      title: '已達成',
      status: '目標已完成',
      statusClass: 'status-good',
      titleClass: 'status-good',
    };
  }

  if (summary.avgExpPerHour <= 0) {
    return {
      title: '-',
      status: '新增有練等分鐘的紀錄後才會估算',
      statusClass: 'status-warn',
    };
  }

  if (!summary.effectiveDailyTrainingHours || summary.effectiveDailyTrainingHours <= 0) {
    return {
      title: '-',
      status: '請設定預設每日練等小時',
      statusClass: 'status-warn',
    };
  }

  if (!summary.projectedFinishDate) {
    return {
      title: '-',
      status: '無法推算完成日期',
      statusClass: 'status-warn',
    };
  }

  return null;
}

function setEmptyStats() {
  [
    elements.currentProgress,
    elements.currentTotalExp,
    elements.remainingExp,
    elements.completeRate,
    elements.totalMinutes,
    elements.recordCount,
    elements.avgPerHour,
    elements.averageDailyHours,
    elements.averageDailyHourStatus,
    elements.estimateTime,
    elements.projectedFinishDate,
    elements.projectedFinishStatus,
    elements.totalExpProjectedFinishDate,
    elements.totalExpProjectedFinishStatus,
    elements.requiredSpeed,
    elements.speedStatus,
    elements.requiredDailyHours,
    elements.dailyHourStatus,
  ].forEach(element => {
    element.textContent = '-';
  });

  clearClass(elements.speedStatus);
  clearClass(elements.dailyHourStatus);
  clearClass(elements.averageDailyHourStatus);
  clearClass(elements.projectedFinishDate);
  clearClass(elements.projectedFinishStatus);
  clearClass(elements.totalExpProjectedFinishDate);
  clearClass(elements.totalExpProjectedFinishStatus);
  elements.progressFill.style.width = '0%';
}

function renderSpeedStatus(summary) {
  clearClass(elements.speedStatus);

  if (summary.remaining === 0n) {
    elements.speedStatus.textContent = '目標已完成';
    elements.speedStatus.classList.add('status-good');
    return;
  }

  if (summary.deadlineHours <= 0) {
    elements.speedStatus.textContent = '已超過結束時間';
    elements.speedStatus.classList.add('status-bad');
    return;
  }

  elements.speedStatus.textContent = `平均每天需 ${formatCompactExp(summary.requiredExpPerDay)} EXP`;
  elements.speedStatus.classList.add(summary.totalMinutes > 0 ? 'status-good' : 'status-warn');
}

function renderRequiredDailyHours(summary) {
  clearClass(elements.dailyHourStatus);

  if (summary.remaining === 0n) {
    elements.requiredDailyHours.textContent = '已達成';
    elements.dailyHourStatus.textContent = '目標已完成';
    elements.dailyHourStatus.classList.add('status-good');
    return;
  }

  if (summary.deadlineHours <= 0) {
    elements.requiredDailyHours.textContent = '-';
    elements.dailyHourStatus.textContent = '已超過目標時間';
    elements.dailyHourStatus.classList.add('status-bad');
    return;
  }

  if (summary.totalMinutes <= 0 || summary.avgExpPerHour <= 0) {
    elements.requiredDailyHours.textContent = '-';
    elements.dailyHourStatus.textContent = '新增至少一筆紀錄後，才能用平均效率估算';
    elements.dailyHourStatus.classList.add('status-warn');
    return;
  }

  elements.requiredDailyHours.textContent = formatDailyHours(summary.requiredDailyTrainingHours);
  elements.requiredDailyHours.title = `${summary.requiredDailyTrainingHours.toFixed(3)} 小時 / 日`;

  if (summary.requiredDailyTrainingHours <= 24) {
    elements.dailyHourStatus.textContent = `距離目標剩 ${summary.deadlineDays.toFixed(1)} 天，未來每天至少練這麼久`;
    elements.dailyHourStatus.classList.add('status-good');
    return;
  }

  elements.dailyHourStatus.textContent = '以目前平均效率計算，每天超過 24 小時仍不夠';
  elements.dailyHourStatus.classList.add('status-bad');
}

export function renderRecords(state) {
  elements.recordList.replaceChildren();

  if (!state.goal || state.records.length === 0) {
    const emptyRow = elements.emptyRecordTemplate.content.cloneNode(true);
    elements.recordList.append(emptyRow);
    return;
  }

  const groups = calculateDailyRows(state.goal, state.records).toReversed();

  for (const group of groups) {
    const fragment = elements.recordRowTemplate.content.cloneNode(true);
    const detailFragment = elements.recordDetailTemplate.content.cloneNode(true);
    const tr = fragment.querySelector('tr');
    const detailTr = detailFragment.querySelector('tr');
    const detailButton = tr.querySelector('[data-action="toggle-details"]');
    const deleteDayButton = tr.querySelector('[data-action="delete-day"]');
    const gainedFullText = `${formatBigInt(group.gainedExp)} EXP`;
    const expPerHourFullText = group.minutes > 0 ? `${formatExpRate(group.expPerHour)} EXP / 小時` : '不納入練等效率';
    const noteText = group.notes.length > 0 ? group.notes.join('、') : '-';

    tr.dataset.dayKey = group.key;
    tr.dataset.dayDate = group.date;
    detailTr.dataset.detailFor = group.key;
    detailButton.setAttribute('aria-controls', `record-detail-${group.key}`);
    detailTr.querySelector('[data-detail-card]').id = `record-detail-${group.key}`;

    if (deleteDayButton) {
      deleteDayButton.title = `刪除 ${group.date} 的 ${group.rows.length} 筆紀錄`;
    }

    tr.querySelector('[data-cell="date"]').textContent = group.date;
    tr.querySelector('[data-cell="endLevel"]').textContent = group.endRecord.endLevel;
    tr.querySelector('[data-cell="endExp"]').textContent = `${formatBasisPoints(group.endRecord.endExpBp)}%`;
    tr.querySelector('[data-cell="gainedExp"]').textContent = `${formatCompactExp(group.gainedExp)} EXP`;
    tr.querySelector('[data-cell="gainedExp"]').title = gainedFullText;
    tr.querySelector('[data-cell="minutes"]').textContent = `${Number(group.minutes).toLocaleString('en-US')} 分`;
    tr.querySelector('[data-cell="expPerHour"]').textContent = group.minutes > 0 ? `${formatCompactExp(group.expPerHour)} EXP` : '不納入';
    tr.querySelector('[data-cell="expPerHour"]').title = expPerHourFullText;
    tr.querySelector('[data-cell="percentPerHour"]').textContent = group.minutes > 0 ? `${formatPercent(group.percentPerHour)} / 小時` : '不納入';
    tr.querySelector('[data-cell="note"]').textContent = group.rows.length > 1
      ? `${group.rows.length} 筆${noteText === '-' ? '' : ` / ${noteText}`}`
      : noteText;
    tr.querySelector('[data-cell="note"]').title = noteText;

    detailTr.querySelector('[data-detail="previousTotal"]').textContent = `${formatBigInt(group.firstPreviousTotal)} EXP`;
    detailTr.querySelector('[data-detail="currentTotal"]').textContent = `${formatBigInt(group.currentTotal)} EXP`;
    detailTr.querySelector('[data-detail="gainedExpFull"]').textContent = gainedFullText;
    detailTr.querySelector('[data-detail="trainingGainedFull"]').textContent = `${formatBigInt(group.trainingGainedExp)} EXP`;
    detailTr.querySelector('[data-detail="otherGainedFull"]').textContent = `${formatBigInt(group.otherGainedExp)} EXP`;
    detailTr.querySelector('[data-detail="expPerHourFull"]').textContent = expPerHourFullText;
    detailTr.querySelector('[data-detail="currentNeed"]').textContent = `${formatBigInt(group.currentNeed)} EXP`;
    detailTr.querySelector('[data-detail="percentPerHourFull"]').textContent = group.minutes > 0 ? `${formatPercent(group.percentPerHour)} / 小時` : '不納入';
    detailTr.querySelector('[data-detail="noteFull"]').textContent = noteText;

    renderDailyEntryList(detailTr, group.rows);

    elements.recordList.append(fragment, detailFragment);
  }
}

function renderDailyEntryList(detailTr, rows) {
  const entryList = detailTr.querySelector('[data-detail="entryList"]');
  if (!entryList) return;

  entryList.replaceChildren();

  for (const row of rows) {
    const item = document.createElement('tr');
    const minutes = Number(row.record.minutes || 0);
    const cells = [
      `${row.record.endLevel} 等 ${formatBasisPoints(row.record.endExpBp)}%`,
      `${formatCompactExp(row.gainedExp)} EXP`,
      minutes > 0 ? `${minutes.toLocaleString('en-US')} 分` : '0 分（其他渠道）',
      minutes > 0 ? `${formatCompactExp(row.expPerHour)} EXP / 小時` : '不納入練等效率',
      row.record.note || '-',
    ];

    for (const value of cells) {
      const td = document.createElement('td');
      td.textContent = value;
      item.append(td);
    }

    const actionTd = document.createElement('td');
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'mini-danger-button';
    deleteButton.dataset.action = 'delete-record';
    deleteButton.dataset.recordId = row.record.id;
    deleteButton.textContent = '刪除';
    actionTd.append(deleteButton);
    item.append(actionTd);

    entryList.append(item);
  }
}

export function renderDeviceMode() {
  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  elements.deviceMode.textContent = isMobile ? 'Mobile Layout' : 'PC Layout';
}
