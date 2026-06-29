const STORAGE_KEY = 'level-tracker-es2022-state-v3-event-skip';
const RESTORE_KEY = 'level-tracker-es2022-restore-points-v1';
const MAX_RESTORE_POINTS = 3;

export const STORAGE_MODES = Object.freeze({
  BROWSER: 'browser',
});

export async function initializeStorageService() {
  // 瀏覽器版固定使用 localStorage。匯出 / 匯入 JSON 只作為手動備份，不再嘗試自動寫入本機檔案。
}

export function hasStorageChoice() {
  return true;
}

export function getStorageInfo() {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';

  return {
    mode: STORAGE_MODES.BROWSER,
    preferredMode: STORAGE_MODES.BROWSER,
    fileName: '',
    isFileSupported: false,
    warning: '',
    reconnectRequired: false,
    bytes: new Blob([raw]).size,
  };
}

export async function loadStateFromStorage() {
  return loadStateFromBrowserStorage();
}

export async function saveStateToStorage(state) {
  saveStateToBrowserStorage(state);
}

export async function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}


export function createRestorePoint(state, reason = '操作前自動還原點') {
  const restorePoints = getRestorePoints();
  const point = {
    id: crypto.randomUUID(),
    reason,
    createdAt: new Date().toISOString(),
    data: normalizeState(state ?? { goal: null, records: [] }),
  };

  const nextPoints = [point, ...restorePoints].slice(0, MAX_RESTORE_POINTS);
  localStorage.setItem(RESTORE_KEY, JSON.stringify(nextPoints));
  return point;
}

export function getRestorePoints() {
  const raw = localStorage.getItem(RESTORE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(point => point && typeof point === 'object' && point.data)
      .map(point => ({
        id: String(point.id || crypto.randomUUID()),
        reason: String(point.reason || '自動還原點'),
        createdAt: String(point.createdAt || new Date().toISOString()),
        data: normalizeState(point.data),
      }))
      .slice(0, MAX_RESTORE_POINTS);
  } catch (error) {
    console.warn('Restore point parse failed:', error);
    return [];
  }
}

export function getLatestRestorePoint() {
  return getRestorePoints()[0] ?? null;
}

export function clearRestorePoints() {
  localStorage.removeItem(RESTORE_KEY);
}

export async function exportStateAsJson(state) {
  const payload = createStoragePayload(state);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateText = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `level-tracker-backup-${dateText}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function importStateFromJsonFile(file) {
  const text = await file.text();
  return parseStorageText(text);
}

function loadStateFromBrowserStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return parseStorageText(raw);
  } catch (error) {
    console.warn('Storage parse failed:', error);
    return null;
  }
}

function saveStateToBrowserStorage(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state ?? { goal: null, records: [] }));
}

function createStoragePayload(state) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    app: 'level-tracker-es2022',
    storage: 'browser-localStorage',
    data: state ?? { goal: null, records: [] },
  };
}

function parseStorageText(text) {
  const parsed = JSON.parse(text);

  if (parsed && typeof parsed === 'object' && 'data' in parsed) {
    return normalizeState(parsed.data);
  }

  if (parsed && typeof parsed === 'object' && ('goal' in parsed || 'records' in parsed)) {
    return normalizeState(parsed);
  }

  throw new Error('JSON 格式不是有效的練等紀錄存檔');
}

function normalizeState(state) {
  return {
    goal: state?.goal ?? null,
    records: Array.isArray(state?.records) ? state.records : [],
  };
}
