import { hasStorageChoice, initializeStorageService, loadStateFromStorage, saveStateToStorage } from './services/storageService.js';
import { createDefaultGoal, getState, setState } from './domain/state.js';
import { fillGoalForm, resetRecordForm, setDefaultDates } from './ui/forms.js';
import { registerEvents, showStorageChoiceModal, updateStorageStatus } from './ui/events.js';
import { render } from './ui/render.js';

async function bootstrap() {
  await initializeStorageService();

  const savedState = await loadStateFromStorage();
  const initialState = savedState ?? { goal: createDefaultGoal(), records: [] };

  setState(initialState);

  const state = getState();
  fillGoalForm(state.goal ?? createDefaultGoal());
  resetRecordForm();
  setDefaultDates();
  registerEvents();
  render(state);
  updateStorageStatus();

  if (!hasStorageChoice()) {
    showStorageChoiceModal({ force: true });
  } else {
    await saveStateToStorage(state);
  }
}

bootstrap().catch(error => {
  console.error(error);
  alert(`初始化失敗：${error.message}`);
});
