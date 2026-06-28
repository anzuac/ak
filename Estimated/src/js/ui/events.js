import { elements } from './dom.js';
import { fillGoalForm, readGoalForm, readRecordForm, resetRecordForm } from './forms.js';
import { render, renderDeviceMode } from './render.js';
import { showToast } from './toast.js';
import { addRecord, clearRecords, createDefaultGoal, getState, removeRecord, resetState, setGoal, setState } from '../domain/state.js';
import { calculateSummary, getBurningModeLabel, isValidExpBasisPoints, isValidLevel, parsePercentToBasisPoints, toTotalExp, validateRecordProgress } from '../domain/calculator.js';
import { clearStorage, exportStateAsJson, getStorageInfo, importStateFromJsonFile, saveStateToStorage } from '../services/storageService.js';
import { formatPercentInput } from '../utils/format.js';

let goalAutoSaveTimer = 0;

export function registerEvents() {
  elements.goalForm.addEventListener('submit', event => {
    event.preventDefault();
    autoSaveGoal({ showToastMessage: true });
  });

  elements.recordForm.addEventListener('submit', handleRecordSubmit);

  elements.clearRecordFormButton.addEventListener('click', () => {
    resetRecordForm();
    showToast('已清空每日紀錄輸入欄位');
  });

  elements.clearRecordsButton.addEventListener('click', handleClearRecords);
  elements.resetAllButton.addEventListener('click', handleResetAll);
  elements.fillDefaultGoalButton.addEventListener('click', handleFillDefaultGoal);
  elements.changeStorageButton.addEventListener('click', handleStorageInfo);
  elements.exportBackupButton.addEventListener('click', handleExportBackup);
  elements.importBackupButton.addEventListener('click', () => elements.importBackupInput.click());
  elements.importBackupInput.addEventListener('change', handleImportBackup);

  elements.startExp.addEventListener('input', event => {
    sanitizePercentInputValue(event);
    scheduleGoalAutoSave();
  });
  elements.startExp.addEventListener('blur', event => {
    finalizePercentInputValue(event);
    scheduleGoalAutoSave(0);
  });
  elements.startExp.addEventListener('change', event => {
    finalizePercentInputValue(event);
    scheduleGoalAutoSave(0);
  });

  elements.endExp.addEventListener('input', sanitizePercentInputValue);
  elements.endExp.addEventListener('blur', finalizePercentInputValue);
  elements.endExp.addEventListener('change', finalizePercentInputValue);

  [elements.startLevel, elements.targetLevel, elements.targetTime, elements.dailyTrainingHours, ...elements.burningModeInputs].forEach(input => {
    input.addEventListener('input', () => scheduleGoalAutoSave());
    input.addEventListener('change', () => scheduleGoalAutoSave(0));
  });

  elements.recordList.addEventListener('click', handleRecordListClick);
  window.addEventListener('resize', renderDeviceMode);

  setGoalStatus('目標設定會自動儲存', 'neutral');
}

function scheduleGoalAutoSave(delay = 350) {
  window.clearTimeout(goalAutoSaveTimer);
  setGoalStatus('輸入中，等待自動儲存…', 'neutral');

  goalAutoSaveTimer = window.setTimeout(() => {
    autoSaveGoal().catch(error => {
      console.error(error);
      showToast(error?.message || '自動儲存失敗');
    });
  }, delay);
}

async function autoSaveGoal({ showToastMessage = false, message = '目標設定已自動儲存' } = {}) {
  const state = getState();
  const goal = readGoalForm();
  const error = validateGoal(goal) || validateGoalAgainstRecords(goal, state.records);

  if (error) {
    setGoalStatus(error, 'bad');
    if (showToastMessage) showToast(error);
    return false;
  }

  setGoal(goal);
  const nextState = getState();

  try {
    await saveStateToStorage(nextState);
  } catch (error) {
    console.error(error);
    setGoalStatus(error?.message || '儲存失敗，請檢查儲存方式', 'bad');
    showToast(error?.message || '儲存失敗，請檢查儲存方式');
    return false;
  }

  render(nextState);
  updateStorageStatus();
  maybeNormalizeGoalForm(goal);
  setGoalStatus(`已自動儲存 ${new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`, 'good');

  if (showToastMessage) showToast(message);
  return true;
}

function maybeNormalizeGoalForm(goal) {
  const active = document.activeElement;
  const isEditingGoal = [elements.startLevel, elements.startExp, elements.targetLevel, elements.targetTime, elements.dailyTrainingHours, ...elements.burningModeInputs].includes(active);

  // 玩家仍在輸入時不強制重填表單，避免游標跳動；失焦或按預設時再正規化顯示。
  if (!isEditingGoal) {
    fillGoalForm(goal);
  }
}

function setGoalStatus(message, type = 'neutral') {
  elements.goalSaveStatus.textContent = message;
  elements.goalSaveStatus.classList.remove('status-good', 'status-warn', 'status-bad');

  if (type === 'good') elements.goalSaveStatus.classList.add('status-good');
  if (type === 'warn') elements.goalSaveStatus.classList.add('status-warn');
  if (type === 'bad') elements.goalSaveStatus.classList.add('status-bad');
}

async function handleRecordSubmit(event) {
  event.preventDefault();

  const state = getState();
  if (!state.goal) {
    showToast('請先完成目標設定，目標設定會自動儲存');
    return;
  }

  const record = readRecordForm();
  const error = validateRecord(record, state.goal);

  if (error) {
    showToast(error);
    return;
  }

  const nextRecords = [...state.records, record];

  try {
    if (!validateRecordProgress(state.goal, nextRecords)) {
      showToast('新增後進度會倒退，請確認日期、等級或經驗數字');
      return;
    }
  } catch {
    showToast('紀錄資料有誤，請重新確認');
    return;
  }

  addRecord(record);
  resetRecordForm();
  await persistAndRender('已新增每日紀錄');
}

async function handleClearRecords() {
  const ok = confirm('確定要清除所有每日紀錄嗎？目標設定會保留。');
  if (!ok) return;

  clearRecords();
  await persistAndRender('每日紀錄已清除');
}

async function handleResetAll() {
  const ok = confirm('確定要重置全部資料嗎？目標設定與每日紀錄都會清除。');
  if (!ok) return;

  resetState();
  await clearStorage();
  fillGoalForm(createDefaultGoal());
  resetRecordForm();
  render(getState());
  setGoalStatus('已重置，修改目標設定後會自動儲存', 'warn');
  showToast('全部資料已重置');
}

function handleFillDefaultGoal() {
  fillGoalForm(createDefaultGoal());
  autoSaveGoal({ showToastMessage: true, message: '已套用並自動儲存預設目標 260 → 300' });
}

function sanitizePercentText(value) {
  let text = String(value ?? '')
    .replace(/[％%]/g, '')
    .replace(/[，,。．]/g, '.')
    .replace(/\s+/g, '')
    .replace(/[^0-9.]/g, '');

  if (text === '') return '';

  const firstDotIndex = text.indexOf('.');
  if (firstDotIndex !== -1) {
    text = text.slice(0, firstDotIndex + 1) + text.slice(firstDotIndex + 1).replace(/\./g, '');
  }

  if (text.startsWith('.')) {
    text = `0${text}`;
  }

  const hasDot = text.includes('.');
  let [integerPart = '0', decimalPart = ''] = text.split('.');
  integerPart = integerPart.replace(/^0+(?=\d)/, '') || '0';

  if (Number(integerPart) > 100) {
    return '100';
  }

  decimalPart = decimalPart.slice(0, 3);

  if (integerPart === '100') {
    const hasNonZeroDecimal = /[1-9]/.test(decimalPart);
    if (hasNonZeroDecimal) return '100';
    return hasDot ? `100${decimalPart ? `.${decimalPart}` : '.'}` : '100';
  }

  return hasDot ? `${integerPart}.${decimalPart}` : integerPart;
}

function sanitizePercentInputValue(event) {
  const input = event.currentTarget;
  const before = input.value;
  const after = sanitizePercentText(before);

  if (before !== after) {
    const cursor = input.selectionStart ?? after.length;
    const diff = after.length - before.length;
    input.value = after;
    const nextCursor = Math.max(0, cursor + diff);
    input.setSelectionRange?.(nextCursor, nextCursor);
  }
}

function finalizePercentInputValue(event) {
  const input = event.currentTarget;
  const sanitized = sanitizePercentText(input.value);

  if (sanitized === '') {
    input.value = '';
    return;
  }

  const basisPoints = parsePercentToBasisPoints(sanitized);
  if (!Number.isFinite(basisPoints)) {
    input.value = sanitized;
    return;
  }

  input.value = formatPercentInput(basisPoints);
}

async function handleRecordListClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const action = button.dataset.action;

  if (action === 'toggle-details') {
    const row = button.closest('tr[data-day-key]');
    const dayKey = row?.dataset.dayKey;
    if (!dayKey) return;

    toggleRecordDetails(dayKey, button);
    return;
  }

  if (action === 'delete-day') {
    const row = button.closest('tr[data-day-date]');
    const dayDate = row?.dataset.dayDate;
    if (!dayDate) return;

    const state = getState();
    const count = state.records.filter(record => record.date === dayDate).length;
    const ok = confirm(`確定要刪除 ${dayDate} 的 ${count} 筆紀錄嗎？`);
    if (!ok) return;

    state.records
      .filter(record => record.date === dayDate)
      .forEach(record => removeRecord(record.id));

    await persistAndRender('已刪除此日紀錄');
    return;
  }

  if (action !== 'delete-record') return;

  const recordId = button.dataset.recordId;
  if (!recordId) return;

  const ok = confirm('確定要刪除此筆明細嗎？');
  if (!ok) return;

  removeRecord(recordId);
  await persistAndRender('已刪除此筆明細');
}

function toggleRecordDetails(dayKey, button) {
  const detailRow = elements.recordList.querySelector(`[data-detail-for="${CSS.escape(dayKey)}"]`);
  if (!detailRow) return;

  const shouldOpen = detailRow.hidden;
  detailRow.hidden = !shouldOpen;
  button.setAttribute('aria-expanded', String(shouldOpen));
  button.textContent = shouldOpen ? '收合' : '詳細';
}

function validateGoal(goal) {
  if (!isValidLevel(goal.startLevel, goal.burningMode) || !isValidLevel(goal.targetLevel, goal.burningMode)) {
    return `等級不符合目前規則：${getBurningModeLabel(goal.burningMode)}`;
  }

  if (!isValidExpBasisPoints(goal.startLevel, goal.startExpBp)) {
    return '初始經驗請輸入 0 ~ 100，最多小數點第三位';
  }

  if (!goal.targetTime || Number.isNaN(new Date(goal.targetTime).getTime())) {
    return '請輸入有效的目標結束時間';
  }

  if (!Number.isFinite(goal.dailyTrainingHours) || goal.dailyTrainingHours <= 0 || goal.dailyTrainingHours > 24) {
    return '預設每日練等小時請輸入 0.1 ~ 24';
  }

  try {
    const startTotal = toTotalExp(goal.startLevel, goal.startExpBp, goal.burningMode);
    const targetTotal = toTotalExp(goal.targetLevel, goal.targetExpBp, goal.burningMode);

    if (targetTotal <= startTotal) {
      return '目標進度必須大於初始進度';
    }
  } catch {
    return '目標資料有誤，請重新確認';
  }

  return '';
}

function validateGoalAgainstRecords(goal, records) {
  if (!records.length) return '';

  try {
    if (!validateRecordProgress(goal, records)) {
      return '起始進度不能高於既有紀錄，請先調整起始設定或清除紀錄';
    }
  } catch {
    return '既有紀錄資料有誤，請重新確認';
  }

  return '';
}

function validateRecord(record, goal) {
  if (!record.date) return '請選擇日期';
  if (!isValidLevel(record.endLevel, goal?.burningMode)) return `結束等級不符合目前規則：${getBurningModeLabel(goal?.burningMode)}`;
  if (!isValidExpBasisPoints(record.endLevel, record.endExpBp)) return '結束經驗請輸入 0 ~ 100，最多小數點第三位';
  if (!Number.isFinite(record.minutes) || record.minutes < 0) return '練等分鐘請輸入 0 或正整數；0 代表其他渠道獲得，不納入練等效率';
  return '';
}

async function persistAndRender(message) {
  const state = getState();
  const summary = calculateSummary(state.goal, state.records);

  if (summary && summary.currentTotal > summary.targetTotal) {
    showToast('目前進度已超過目標，仍會保留紀錄');
  } else {
    showToast(message);
  }

  try {
    await saveStateToStorage(state);
  } catch (error) {
    console.error(error);
    showToast(error?.message || '儲存失敗，請檢查儲存方式');
    return;
  }

  render(state);
  updateStorageStatus();
}

function handleStorageInfo() {
  const info = getStorageInfo();
  showToast(`瀏覽器自動儲存中，目前約 ${formatStorageSize(info.bytes)}。可用「匯出備份」下載 JSON 保險。`);
}

export function updateStorageStatus() {
  if (!elements.storageModeBadge) return;

  const info = getStorageInfo();
  elements.storageModeBadge.textContent = `瀏覽器儲存 · ${formatStorageSize(info.bytes)}`;
  elements.storageModeBadge.title = '資料自動保存在目前瀏覽器。需要保險時請使用「匯出備份」，可再用「匯入備份」還原。';
}

function formatStorageSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function handleExportBackup() {
  await exportStateAsJson(getState());
  showToast('已匯出 JSON 備份');
}

async function handleImportBackup(event) {
  const [file] = event.target.files ?? [];
  event.target.value = '';

  if (!file) return;

  await runStorageAction(async () => {
    const importedState = await importStateFromJsonFile(file);
    const ok = confirm('匯入備份會覆蓋目前畫面資料，確定要繼續嗎？');
    if (!ok) return;

    setState(importedState);
    const state = getState();
    fillGoalForm(state.goal ?? createDefaultGoal());
    resetRecordForm();
    render(state);
    await saveStateToStorage(state);
    showToast('已匯入 JSON 備份');
  });
}

async function runStorageAction(action) {
  try {
    await action();
    updateStorageStatus();
  } catch (error) {
    if (error?.name === 'AbortError') return;
    console.error(error);
    showToast(error?.message || '儲存操作失敗');
  }
}
