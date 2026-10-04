import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadingHistory } from '../src/data/readingHistory.js';

test('reading history covers the latest six calendar months through the requested date', () => {
  const history = buildReadingHistory([], '2026-10-04');
  assert.equal(history.startDate, '2026-04-04');
  assert.equal(history.endDate, '2026-10-04');
  assert.equal(history.days.length, 184);
  assert.equal(history.days[0].date, history.startDate);
  assert.equal(history.days.at(-1).date, history.endDate);
  for (let index = 0; index < history.days.length; index++) {
    const day = history.days[index];
    assert.ok(day.date <= history.endDate, 'there are no future days');
    assert.equal(day.value, 0);
    assert.equal(day.read, false);
    if (index > 0) {
      const previous = Date.parse(`${history.days[index - 1].date}T00:00:00Z`);
      const current = Date.parse(`${day.date}T00:00:00Z`);
      assert.equal(current - previous, 86_400_000, 'every calendar day occurs once');
    }
  }
});

test('recent activity is aligned to the end and uses the existing reading threshold', () => {
  const activity = [0.6, 0.61, 1];
  const { days } = buildReadingHistory(activity, '2026-10-04');
  assert.deepEqual(days.slice(-3), [
    { date: '2026-10-02', read: false, value: 0.6 },
    { date: '2026-10-03', read: true, value: 0.61 },
    { date: '2026-10-04', read: true, value: 1 },
  ]);
  assert.equal(days.at(-4).value, 0, 'missing older activity is zero');
  assert.deepEqual(activity, [0.6, 0.61, 1], 'the source activity is unchanged');

  const longerActivity = Array.from({ length: 350 }, (_, index) => index / 350);
  const longer = buildReadingHistory(longerActivity, '2026-10-04');
  assert.equal(longer.days[0].value, longerActivity.at(-longer.days.length));
  assert.equal(longer.days.at(-1).value, longerActivity.at(-1));
});

test('leading placeholders position the first date in a Monday-first calendar', () => {
  assert.equal(buildReadingHistory([], '2026-10-04').leadingDays, 5, 'April 4 is Saturday');
  assert.equal(buildReadingHistory([], '2026-10-06').leadingDays, 0, 'April 6 is Monday');
  assert.equal(buildReadingHistory([], '2026-10-05').leadingDays, 6, 'April 5 is Sunday');
});

test('six-month subtraction clamps to month ends and respects leap years', () => {
  const cases = [
    ['2026-10-31', '2026-04-30'],
    ['2026-08-31', '2026-02-28'],
    ['2024-08-31', '2024-02-29'],
    ['2024-02-29', '2023-08-29'],
    ['2026-03-31', '2025-09-30'],
    ['2026-01-31', '2025-07-31'],
  ];
  for (const [endDate, startDate] of cases) {
    const history = buildReadingHistory([], endDate);
    assert.equal(history.startDate, startDate);
    assert.equal(history.days.at(-1).date, endDate);
  }
});

test('invalid or missing activity is displayed as unread days', () => {
  const { days } = buildReadingHistory([NaN, undefined, null, '1', 0.7], '2026-10-04');
  assert.deepEqual(days.slice(-5).map(({ value, read }) => ({ value, read })), [
    { value: 0, read: false },
    { value: 0, read: false },
    { value: 0, read: false },
    { value: 0, read: false },
    { value: 0.7, read: true },
  ]);
  assert.equal(buildReadingHistory(null, '2026-10-04').days.at(-1).value, 0);
});

test('the default end date is today in Asia/Shanghai', () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((entry) => entry.type === type).value;
  const expected = `${part('year')}-${part('month')}-${part('day')}`;
  assert.equal(buildReadingHistory().endDate, expected);
});

test('malformed dates are rejected instead of silently shifting calendar days', () => {
  for (const date of ['2026-02-29', '2026-13-01', '2026-04-31', '2026-1-02', '', null]) {
    assert.throws(() => buildReadingHistory([], date), RangeError);
  }
});
