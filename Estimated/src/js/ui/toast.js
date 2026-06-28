import { elements } from './dom.js';

let toastTimer = 0;

export function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');

  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove('is-visible');
  }, 2300);
}
