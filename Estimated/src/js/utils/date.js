const pad = value => String(value).padStart(2, '0');

export function toDateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDatetimeLocalValue(date = new Date()) {
  return `${toDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getDefaultDeadlineValue(now = new Date()) {
  let deadline = new Date(now.getFullYear(), 9, 20, 23, 59, 0, 0);

  if (deadline.getTime() < now.getTime()) {
    deadline = new Date(now.getFullYear() + 1, 9, 20, 23, 59, 0, 0);
  }

  return toDatetimeLocalValue(deadline);
}

export function formatDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
