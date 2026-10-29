import { describe, expect, it } from 'vitest';
import { formatGs, formatGsCompact, parseAmount } from '../src/domain/money';
import { resolveDate } from '../src/domain/dates';

describe('parseAmount', () => {
  it.each([
    ['250mil', 250_000],
    ['250 mil', 250_000],
    ['250k', 250_000],
    ['1,5 millones', 1_500_000],
    ['2 palos', 2_000_000],
    ['Gs. 1.250.000', 1_250_000],
    ['₲250.000', 250_000],
    ['250000', 250_000],
  ])('%s -> %d', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it('returns null for garbage', () => {
    expect(parseAmount('mucho')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('formats guaraníes deterministically', () => {
    expect(formatGs(1_250_000)).toBe('₲ 1.250.000');
    expect(formatGs(-5000)).toBe('-₲ 5.000');
    expect(formatGsCompact(1_500_000)).toBe('₲ 1,5 M');
    expect(formatGsCompact(250_000)).toBe('₲ 250 mil');
  });
});

describe('resolveDate (today = jueves 2026-10-29)', () => {
  const today = new Date(2026, 9, 29);
  it.each([
    ['me paga el viernes', '2026-10-30'],
    ['el jueves', '2026-11-05'],
    ['mañana', '2026-10-30'],
    ['pasado mañana', '2026-10-31'],
    ['a fin de mes', '2026-10-31'],
    ['la semana que viene', '2026-11-05'],
    ['el 3/1', '2027-01-03'],
    ['el 5 de diciembre', '2026-12-05'],
  ])('%s -> %s', (text, iso) => {
    expect(resolveDate(text, today)?.date).toBe(iso);
  });
});
