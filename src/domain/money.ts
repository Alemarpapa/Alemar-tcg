/**
 * Guaraní (PYG) money helpers. PYG has no decimals, so every amount is an
 * integer number of guaraníes.
 */

/** Hard ceiling to catch typos like an extra "000" (1.000 millones de Gs.). */
export const MAX_AMOUNT = 1_000_000_000;

const MULTIPLIERS: ReadonlyArray<[RegExp, number]> = [
  [/^(millones|mill[oó]n|palos?|m)$/i, 1_000_000],
  [/^(mil|k)$/i, 1_000],
];

/**
 * Source pattern for an amount token inside free text. Exposed so the parser
 * can scan for every amount with its position.
 *
 * Examples matched: "250mil", "250 mil", "250k", "1,5 millones", "2 palos",
 * "Gs. 250.000", "₲250.000", "250000".
 */
export const AMOUNT_PATTERN =
  /(?:(?:gs\.?|₲)\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,2})?)(?:\s*(millones|mill[oó]n|palos?|mil|k|m)(?![a-záéíóúñ]))?(?:\s*(?:gs\.?|guaran[ií]es))?/giu;

function toNumber(digits: string, hasMultiplier: boolean): number | null {
  // With a multiplier, "1,5" / "1.5" is a decimal (1,5 millones = 1.500.000).
  if (hasMultiplier && /^\d+[.,]\d{1,2}$/.test(digits)) {
    return Number(digits.replace(',', '.'));
  }
  // Otherwise dots/commas are thousands separators.
  const clean = digits.replace(/[.,]/g, '');
  if (!/^\d+$/.test(clean)) return null;
  return Number(clean);
}

/** Parses a single amount expression into guaraníes. Returns null if invalid. */
export function parseAmount(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const re = new RegExp(`^${AMOUNT_PATTERN.source}$`, 'iu');
  const m = re.exec(text);
  if (!m || !m[1]) return null;
  return amountFromParts(m[1], m[2]);
}

export function amountFromParts(digits: string, unit: string | undefined): number | null {
  let multiplier = 1;
  if (unit) {
    const hit = MULTIPLIERS.find(([re]) => re.test(unit));
    if (!hit) return null;
    multiplier = hit[1];
  }
  const base = toNumber(digits, unit !== undefined);
  if (base === null || !Number.isFinite(base)) return null;
  const value = Math.round(base * multiplier);
  return value;
}

/** Formats an integer amount as "₲ 250.000" (deterministic, no ICU dependency). */
export function formatGs(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(Math.round(amount)).toString();
  const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}₲ ${grouped}`;
}

/** Compact format for KPIs: 250.000 -> "250 mil", 1.500.000 -> "1,5 M". */
export function formatGsCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const v = (abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1).replace('.', ',');
    return `${sign}₲ ${v} M`;
  }
  if (abs >= 1_000) {
    const v = (abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1).replace('.', ',');
    return `${sign}₲ ${v} mil`;
  }
  return formatGs(amount);
}
