const DAY_MS = 24 * 60 * 60 * 1000;

function currentShanghaiDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((entry) => entry.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function utcDate(year, month, day) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date;
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError('endDate must be a valid YYYY-MM-DD date');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = utcDate(year, month - 1, day);
  if (date.toISOString().slice(0, 10) !== value) {
    throw new RangeError('endDate must be a valid YYYY-MM-DD date');
  }
  return date;
}

/**
 * Build an inclusive six-calendar-month reading history, ending today in
 * Shanghai by default. Activity runs oldest to newest; its last value belongs
 * to endDate. UTC date arithmetic keeps the calendar stable in every timezone.
 */
export function buildReadingHistory(activity = [], endDate = currentShanghaiDate()) {
  const end = parseDate(endDate);
  const targetMonth = end.getUTCFullYear() * 12 + end.getUTCMonth() - 6;
  const startYear = Math.floor(targetMonth / 12);
  const startMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = utcDate(startYear, startMonth + 1, 0).getUTCDate();
  const start = utcDate(startYear, startMonth, Math.min(end.getUTCDate(), lastDay));
  const dayCount = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const values = Array.isArray(activity) ? activity : [];
  const activityOffset = values.length - dayCount;
  const days = Array.from({ length: dayCount }, (_, index) => {
    const activityIndex = activityOffset + index;
    const rawValue = activityIndex >= 0 ? values[activityIndex] : undefined;
    const value = Number.isFinite(rawValue) ? rawValue : 0;
    return {
      date: new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10),
      read: value > 0.6,
      value,
    };
  });

  return {
    days,
    leadingDays: (start.getUTCDay() + 6) % 7,
    startDate: days[0].date,
    endDate,
  };
}
