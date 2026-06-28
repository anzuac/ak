export function formatBigInt(value) {
  if (typeof value !== 'bigint') return '-';
  return value < 0n ? '0' : value.toLocaleString('en-US');
}

export function formatExpRate(value) {
  if (!Number.isFinite(value)) return '-';
  return Math.max(0, Math.floor(value)).toLocaleString('en-US');
}

export function formatCompactExp(value) {
  const numberValue = typeof value === 'bigint' ? Number(value) : Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) return '0';

  const units = [
    { value: 1_0000_0000_0000_0000, label: '京' },
    { value: 1_0000_0000_0000, label: '兆' },
    { value: 1_0000_0000, label: '億' },
    { value: 10_000, label: '萬' },
  ];

  const matchedUnit = units.find(unit => numberValue >= unit.value);

  if (!matchedUnit) {
    return Math.floor(numberValue).toLocaleString('en-US');
  }

  const compactValue = numberValue / matchedUnit.value;
  const decimals = compactValue >= 100 ? 0 : compactValue >= 10 ? 1 : 2;
  const text = compactValue
    .toFixed(decimals)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1');

  return `${text} ${matchedUnit.label}`;
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return '-';
  return `${Math.max(0, value).toFixed(2)}%`;
}

export function formatBasisPoints(bp) {
  if (!Number.isFinite(bp)) return '0.000';
  return (bp / 1000).toFixed(3);
}

export function formatPercentInput(bp) {
  if (!Number.isFinite(bp)) return '0';
  return (bp / 1000).toFixed(3).replace(/\.?0+$/, '');
}

export function formatHours(hours) {
  if (!Number.isFinite(hours) || hours < 0) return '-';

  const totalMinutes = Math.round(hours * 60);
  const days = Math.floor(totalMinutes / 1440);
  const remainMinutes = totalMinutes % 1440;
  const h = Math.floor(remainMinutes / 60);
  const m = remainMinutes % 60;

  if (days > 0) return `${days} 天 ${h} 小時 ${m} 分`;
  if (h > 0) return `${h} 小時 ${m} 分`;
  return `${m} 分`;
}





export function formatHoursOnly(hours) {
  if (!Number.isFinite(hours) || hours < 0) return '-';

  if (hours === 0) return '0 小時';

  const decimals = hours >= 100 ? 0 : hours >= 10 ? 1 : 2;
  const text = hours
    .toFixed(decimals)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1');

  return `${text} 小時`;
}

export function formatDecimalHoursPerDay(hours) {
  if (!Number.isFinite(hours) || hours < 0) return '-';

  const roundedHours = Math.round(hours * 100) / 100;
  return `${roundedHours.toFixed(2)} 小時 / 日`;
}

export function formatDailyHours(hours) {
  if (!Number.isFinite(hours) || hours < 0) return '-';

  const totalMinutes = Math.ceil(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h <= 0) return `${m} 分 / 日`;
  if (m <= 0) return `${h} 小時 / 日`;
  return `${h} 小時 ${m} 分 / 日`;
}
