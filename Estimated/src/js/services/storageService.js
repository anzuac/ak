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
let rememberedFileHandle = null;
let activeFileName = '';
let filePermissionWarning = '';
let fileReconnectRequired = false;

export function isFileSystemStorageSupported() {
  return typeof window !== 'undefined'
    && typeof window.showSaveFilePicker === 'function'
    && typeof window.showOpenFilePicker === 'function'
    && window.isSecureContext;
}

export async function initializeStorageService() {
  const savedMode = localStorage.getItem(STORAGE_MODE_KEY);
  activeMode = STORAGE_MODES.BROWSER;
  activeFileHandle = null;
  rememberedFileHandle = null;
  activeFileName = localStorage.getItem(STORAGE_FILE_NAME_KEY) || '';
  filePermissionWarning = '';
  fileReconnectRequired = false;

  if (savedMode !== STORAGE_MODES.FILE) return;

  if (!isFileSystemStorageSupported()) {
    filePermissionWarning = '此瀏覽器不支援本機 JSON 檔案同步，已使用瀏覽器快取。';
    fileReconnectRequired = false;
    return;
  }

  try {
    const savedHandle = await readFileHandleFromIndexedDb();
    rememberedFileHandle = savedHandle || null;

    if (!savedHandle) {
      filePermissionWarning = '找不到先前連結的本機 JSON 檔案，已使用瀏覽器快取。需要時可重新讀取 JSON。';
      fileReconnectRequired = true;
      return;
    }

    const permission = await savedHandle.queryPermission({ mode: 'readwrite' });

    if (permission !== 'granted') {
      filePermissionWarning = '本機 JSON 檔案需要重新授權，目前先使用瀏覽器快取。';
      fileReconnectRequired = true;
      activeFileName = savedHandle.name || activeFileName || 'level-tracker-save.json';
      return;
    }

    activeMode = STORAGE_MODES.FILE;
    activeFileHandle = savedHandle;
    activeFileName = savedHandle.name || activeFileName || 'level-tracker-save.json';
    fileReconnectRequired = false;
  } catch (error) {
    console.warn('File storage handle restore failed:', error);
    filePermissionWarning = '本機 JSON 檔案連結暫時無法使用，已使用瀏覽器快取。';
    fileReconnectRequired = true;
  }
}

export function hasStorageChoice() {
  return localStorage.getItem(STORAGE_MODE_KEY) === STORAGE_MODES.BROWSER
    || localStorage.getItem(STORAGE_MODE_KEY) === STORAGE_MODES.FILE;
}

export function needsFileReconnect() {
  return fileReconnectRequired;
}

export function getStorageInfo() {
  const preferredMode = localStorage.getItem(STORAGE_MODE_KEY) || STORAGE_MODES.BROWSER;

  return {
    mode: activeMode,
    preferredMode,
    fileName: activeFileName,
    isFileSupported: isFileSystemStorageSupported(),
    warning: filePermissionWarning,
    reconnectRequired: fileReconnectRequired,
  };
}

export async function loadStateFromStorage() {
  if (activeMode === STORAGE_MODES.FILE && activeFileHandle) {
    try {
      const fileState = await readStateFromFile(activeFileHandle);
      if (fileState) {
        saveStateToBrowserStorage(fileState);
        return fileState;
      }
    } catch (error) {
      console.warn('File storage read failed:', error);
      filePermissionWarning = '讀取本機 JSON 存檔失敗，已改用瀏覽器快取。';
      fileReconnectRequired = true;
      rememberedFileHandle = activeFileHandle;
      activeFileHandle = null;
      activeMode = STORAGE_MODES.BROWSER;
    }
  }

  return loadStateFromBrowserStorage();
}

export async function saveStateToStorage(state) {
  // 瀏覽器快取永遠保留，作為本機 JSON 權限失效或檔案遺失時的保險。
  saveStateToBrowserStorage(state);

  if (activeMode !== STORAGE_MODES.FILE || !activeFileHandle) return;

  try {
    await writeStateToFile(activeFileHandle, state);
    filePermissionWarning = '';
    fileReconnectRequired = false;
  } catch (error) {
    console.warn('File storage write failed:', error);
    rememberedFileHandle = activeFileHandle;
    activeFileHandle = null;
    activeMode = STORAGE_MODES.BROWSER;
    fileReconnectRequired = true;
    filePermissionWarning = '本機 JSON 寫入失敗，資料已先保存到瀏覽器快取。請重新授權或重新讀取 JSON 檔。';
  }
}

export async function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);

  if (activeMode === STORAGE_MODES.FILE && activeFileHandle) {
    try {
      await writeStateToFile(activeFileHandle, { goal: null, records: [] });
    } catch (error) {
      console.warn('File storage clear failed:', error);
      filePermissionWarning = '本機 JSON 清除失敗，但瀏覽器快取已清除。';
      fileReconnectRequired = true;
    }
  }
}

export async function useBrowserStorage(state) {
  activeMode = STORAGE_MODES.BROWSER;
  activeFileHandle = null;
  rememberedFileHandle = null;
  activeFileName = '';
  filePermissionWarning = '';
  fileReconnectRequired = false;

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

  const nextState = state ?? { goal: null, records: [] };

  activeMode = STORAGE_MODES.FILE;
  activeFileHandle = handle;
  rememberedFileHandle = handle;
  activeFileName = handle.name || 'level-tracker-save.json';
  filePermissionWarning = '';
  fileReconnectRequired = false;

  localStorage.setItem(STORAGE_MODE_KEY, STORAGE_MODES.FILE);
  localStorage.setItem(STORAGE_FILE_NAME_KEY, activeFileName);
  saveStateToBrowserStorage(nextState);
  await writeFileHandleToIndexedDb(handle);
  await writeStateToFile(handle, nextState);

  return getStorageInfo();
}

export async function openFileStorage(fallbackState) {
  ensureFileSystemStorageSupport();

  const savedHandle = rememberedFileHandle || await readFileHandleFromIndexedDb();

  if (savedHandle) {
    try {
      const hasPermission = await requestFilePermission(savedHandle, 'readwrite');
      if (hasPermission) {
        return await activateFileHandle(savedHandle, fallbackState);
      }
    } catch (error) {
      console.warn('Saved file handle reconnect failed:', error);
    }
  }

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

  return await activateFileHandle(handle, fallbackState);
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

async function activateFileHandle(handle, fallbackState) {
  const state = await readStateFromFile(handle);
  const nextState = state ?? fallbackState ?? { goal: null, records: [] };

  activeMode = STORAGE_MODES.FILE;
  activeFileHandle = handle;
  rememberedFileHandle = handle;
  activeFileName = handle.name || activeFileName || 'level-tracker-save.json';
  filePermissionWarning = '';
  fileReconnectRequired = false;

  localStorage.setItem(STORAGE_MODE_KEY, STORAGE_MODES.FILE);
  localStorage.setItem(STORAGE_FILE_NAME_KEY, activeFileName);
  saveStateToBrowserStorage(nextState);
  await writeFileHandleToIndexedDb(handle);

  if (!state) {
    await writeStateToFile(handle, nextState);
  }

  return state;
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
