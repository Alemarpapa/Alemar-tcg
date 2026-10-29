/** Date helpers working on local calendar days as ISO strings (YYYY-MM-DD). */

export type IsoDate = string;

export function toIsoDate(d: Date): IsoDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + days);
  return r;
}

/** Whole days from `from` to `to` (positive if `to` is later). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = fromIsoDate(to).getTime() - fromIsoDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return toIsoDate(fromIsoDate(iso)) === iso;
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface DateMatch {
  date: IsoDate;
  /** The exact fragment of text that produced the date. */
  source: string;
}

/**
 * Resolves the first relative/absolute date expression found in Spanish text.
 * Supported: hoy, mañana, pasado mañana, "el viernes", "el próximo lunes",
 * "la semana que viene", "en 3 días", "en 2 semanas", "fin de mes",
 * "el 15", "15/11", "15/11/2026", "15 de noviembre".
 */
export function resolveDate(text: string, today: Date): DateMatch | null {
  const t = stripAccents(text.toLowerCase());
  const base = addDays(today, 0);
  type Candidate = { index: number; date: Date; source: string };
  const found: Candidate[] = [];
  const push = (m: RegExpExecArray | null, date: Date | null) => {
    if (m && date) found.push({ index: m.index, date, source: m[0].trim() });
  };

  push(/\bpasado manana\b/.exec(t), addDays(base, 2));
  {
    const m = /\bmanana\b/.exec(t);
    if (m && !/pasado $/.test(t.slice(0, m.index))) push(m, addDays(base, 1));
  }
  push(/\bhoy\b/.exec(t), base);
  push(/\b(la )?(semana que viene|proxima semana)\b/.exec(t), addDays(base, 7));
  {
    const m = /\ben (\d{1,2}) (dias?|semanas?)\b/.exec(t);
    if (m) push(m, addDays(base, Number(m[1]) * (m[2]?.startsWith('semana') ? 7 : 1)));
  }
  push(
    /\b(a )?fin(al)? de mes\b/.exec(t),
    new Date(base.getFullYear(), base.getMonth() + 1, 0),
  );
  {
    const m = /\b(?:el |este |proximo |el proximo )?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/.exec(t);
    if (m && m[1]) {
      const target = WEEKDAYS[m[1]] ?? 0;
      let delta = (target - base.getDay() + 7) % 7;
      if (delta === 0) delta = 7; // "el viernes" said on a Friday means next week
      push(m, addDays(base, delta));
    }
  }
  {
    const m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]) - 1;
      let year = m[3] ? Number(m[3]) : base.getFullYear();
      if (year < 100) year += 2000;
      let d = new Date(year, month, day);
      if (!m[3] && d < base) d = new Date(year + 1, month, day);
      if (d.getDate() === day && d.getMonth() === month) push(m, d);
    }
  }
  {
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
      'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    const m = new RegExp(`\\b(\\d{1,2}) de (${months.join('|')})\\b`).exec(t);
    if (m && m[2]) {
      const day = Number(m[1]);
      const month = months.indexOf(m[2]);
      let d = new Date(base.getFullYear(), month, day);
      if (d < base) d = new Date(base.getFullYear() + 1, month, day);
      if (d.getDate() === day) push(m, d);
    }
  }
  {
    // "el 15" (day of month). Must not be followed by an amount unit.
    const m = /\b(?:el|para el|hasta el) (\d{1,2})\b(?!\s*(?:mil|k|m\b|millon|palo|\/|de \w))/.exec(t);
    if (m) {
      const day = Number(m[1]);
      if (day >= 1 && day <= 31) {
        let d = new Date(base.getFullYear(), base.getMonth(), day);
        if (d < base) d = new Date(base.getFullYear(), base.getMonth() + 1, day);
        if (d.getDate() === day) push(m, d);
      }
    }
  }

  if (found.length === 0) return null;
  found.sort((a, b) => a.index - b.index);
  const first = found[0]!;
  return { date: toIsoDate(first.date), source: first.source };
}
