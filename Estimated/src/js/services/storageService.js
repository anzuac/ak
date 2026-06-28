const STORAGE_KEY = 'level-tracker-es2022-state-v3-event-skip';
const STORAGE_MODE_KEY = 'level-tracker-es2022-storage-mode';
const STORAGE_FILE_NAME_KEY = 'level-tracker-es2022-storage-file-name';
const IDB_NAME = 'level-tracker-es2022-file-storage';
const IDB_STORE = 'handles';
const FILE_HANDLE_KEY = 'save-file-handle';

export const STORAGE_MODES = Object.freeze({
  BROWSER: 'browser',
  FILE: 'file',
});

let activeMode = STORAGE_MODES.BROWSER;
let activeFileHandle = null;
let activeFileName = '';
let filePermissionWarning = '';

export function isFileSystemStorageSupported() {
  return typeof window !== 'undefined'
    && typeof window.showSaveFilePicker === 'function'
    && typeof window.showOpenFilePicker === 'function'
    && window.isSecureContext;
}

export async function initializeStorageService() {
  const savedMode = localStorage.getItem(STORAGE_MODE_KEY);
  activeMode = savedMode === STORAGE_MODES.FILE ? STORAGE_MODES.FILE : STORAGE_MODES.BROWSER;
  activeFileName = localStorage.getItem(STORAGE_FILE_NAME_KEY) || '';
  activeFileHandle = null;
  filePermissionWarning = '';

  if (activeMode !== STORAGE_MODES.FILE) return;

  if (!isFileSystemStorageSupported()) {
    filePermissionWarning = '此瀏覽器不支援本機 JSON 檔案儲存，已暫時改用瀏覽器儲存。';
    activeMode = STORAGE_MODES.BROWSER;
    return;
  }

  try {
    const savedHandle = await readFileHandleFromIndexedDb();

    if (!savedHandle) {
      filePermissionWarning = '找不到先前連結的本機 JSON 檔案，請重新連結。';
      activeMode = STORAGE_MODES.BROWSER;
      return;
    }

    // 重新整理頁面時，瀏覽器可能把本機檔案權限重設為 prompt。
    // requestPermission 必須由使用者點擊觸發，不能在初始化時自動呼叫，
    // 否則 Chrome / Edge 會丟出 SecurityError，造成「初始化失敗」提示。
    const permission = await savedHandle.queryPermission({ mode: 'readwrite' });

    if (permission !== 'granted') {
      filePermissionWarning = '本機 JSON 檔案需要重新授權，請點「儲存方式」→「讀取既有 JSON 存檔」。目前暫時使用瀏覽器儲存。';
      activeMode = STORAGE_MODES.BROWSER;
      return;
    }

    activeFileHandle = savedHandle;
    activeFileName = savedHandle.name || activeFileName || 'level-tracker-save.json';
  } catch (error) {
    console.warn('File storage handle restore failed:', error);
    filePermissionWarning = '本機 JSON 檔案連結已失效，請重新連結。已暫時改用瀏覽器儲存。';
    activeMode = STORAGE_MODES.BROWSER;
    activeFileHandle = null;
  }
}

export function hasStorageChoice() {
  return localStorage.getItem(STORAGE_MODE_KEY) === STORAGE_MODES.BROWSER
    || localStorage.getItem(STORAGE_MODE_KEY) === STORAGE_MODES.FILE;
}

export function getStorageInfo() {
  return {
    mode: activeMode,
    fileName: activeFileName,
    isFileSupported: isFileSystemStorageSupported(),
    warning: filePermissionWarning,
  };
}

export async function loadStateFromStorage() {
  if (activeMode === STORAGE_MODES.FILE && activeFileHandle) {
    try {
      const fileState = await readStateFromFile(activeFileHandle);
      if (fileState) return fileState;
    } catch (error) {
      console.warn('File storage read failed:', error);
      filePermissionWarning = '讀取本機 JSON 存檔失敗，請重新連結檔案。';
    }
  }

  return loadStateFromBrowserStorage();
}

export async function saveStateToStorage(state) {
  if (activeMode === STORAGE_MODES.FILE && activeFileHandle) {
    await writeStateToFile(activeFileHandle, state);
    return;
  }

  saveStateToBrowserStorage(state);
}

export async function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);

  if (activeMode === STORAGE_MODES.FILE && activeFileHandle) {
    await writeStateToFile(activeFileHandle, { goal: null, records: [] });
  }
}

export async function useBrowserStorage(state) {
  activeMode = STORAGE_MODES.BROWSER;
  activeFileHandle = null;
  activeFileName = '';
  filePermissionWarning = '';

  localStorage.setItem(STORAGE_MODE_KEY, STORAGE_MODES.BROWSER);
  localStorage.removeItem(STORAGE_FILE_NAME_KEY);
  await deleteFileHandleFromIndexedDb();

  if (state) saveStateToBrowserStorage(state);
}

export async function createFileStorage(state) {
  ensureFileSystemStorageSupport();

  const handle = await window.showSaveFilePicker({
    suggestedName: 'level-tracker-save.json',
    types: [
      {
        description: '練等紀錄 JSON 存檔',
        accept: {
          'application/json': ['.json'],
        },
      },
    ],
    excludeAcceptAllOption: false,
  });

  const hasPermission = await requestFilePermission(handle, 'readwrite');
  if (!hasPermission) throw new Error('未取得本機 JSON 檔案讀寫權限');

  activeMode = STORAGE_MODES.FILE;
  activeFileHandle = handle;
  activeFileName = handle.name || 'level-tracker-save.json';
  filePermissionWarning = '';

  localStorage.setItem(STORAGE_MODE_KEY, STORAGE_MODES.FILE);
  localStorage.setItem(STORAGE_FILE_NAME_KEY, activeFileName);
  await writeFileHandleToIndexedDb(handle);
  await writeStateToFile(handle, state ?? { goal: null, records: [] });

  return getStorageInfo();
}

export async function openFileStorage() {
  ensureFileSystemStorageSupport();

  const [handle] = await window.showOpenFilePicker({
    types: [
      {
        description: '練等紀錄 JSON 存檔',
        accept: {
          'application/json': ['.json'],
        },
      },
    ],
    excludeAcceptAllOption: false,
    multiple: false,
  });

  const hasPermission = await requestFilePermission(handle, 'readwrite');
  if (!hasPermission) throw new Error('未取得本機 JSON 檔案讀寫權限');

  const state = await readStateFromFile(handle);

  activeMode = STORAGE_MODES.FILE;
  activeFileHandle = handle;
  activeFileName = handle.name || 'level-tracker-save.json';
  filePermissionWarning = '';

  localStorage.setItem(STORAGE_MODE_KEY, STORAGE_MODES.FILE);
  localStorage.setItem(STORAGE_FILE_NAME_KEY, activeFileName);
  await writeFileHandleToIndexedDb(handle);

  return state;
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
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Storage parse failed:', error);
    return null;
  }
}

function saveStateToBrowserStorage(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureFileSystemStorageSupport() {
  if (!isFileSystemStorageSupported()) {
    throw new Error('此瀏覽器不支援本機 JSON 檔案儲存。請使用 Chrome / Edge 桌面版，並透過 localhost 或 HTTPS 開啟。');
  }
}

async function requestFilePermission(handle, mode) {
  const options = { mode };

  if (await handle.queryPermission(options) === 'granted') return true;
  return await handle.requestPermission(options) === 'granted';
}

async function readStateFromFile(handle) {
  const file = await handle.getFile();
  const text = await file.text();

  if (!text.trim()) return null;
  return parseStorageText(text);
}

async function writeStateToFile(handle, state) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(createStoragePayload(state), null, 2));
  await writable.close();
}

function createStoragePayload(state) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    app: 'level-tracker-es2022',
    data: state ?? { goal: null, records: [] },
  };
}

function parseStorageText(text) {
  const parsed = JSON.parse(text);

  if (parsed && typeof parsed === 'object' && 'data' in parsed) {
    return parsed.data;
  }

  if (parsed && typeof parsed === 'object' && ('goal' in parsed || 'records' in parsed)) {
    return parsed;
  }

  throw new Error('JSON 格式不是有效的練等紀錄存檔');
}

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transactHandleStore(mode, callback) {
  const db = await openHandleDb();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE, mode);
      const store = transaction.objectStore(IDB_STORE);
      const request = callback(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

function readFileHandleFromIndexedDb() {
  return transactHandleStore('readonly', store => store.get(FILE_HANDLE_KEY));
}

function writeFileHandleToIndexedDb(handle) {
  return transactHandleStore('readwrite', store => store.put(handle, FILE_HANDLE_KEY));
}

function deleteFileHandleFromIndexedDb() {
  return transactHandleStore('readwrite', store => store.delete(FILE_HANDLE_KEY)).catch(() => undefined);
}
