import { describe, expect, it } from 'vitest';
import { parseSaleIntake } from '../src/domain/parser';

// Thursday 2026-10-29 — fixed so relative dates are deterministic.
const TODAY = new Date(2026, 9, 29);

describe('parseSaleIntake', () => {
  it('parses the canonical sentence (playset de Charizard a Lucas)', () => {
    const r = parseSaleIntake(
      'Le vendí un playset de Charizard a Lucas por 250mil, me dio 100mil y los 150mil me paga el viernes',
      TODAY,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft).toEqual({
      buyer: 'Lucas',
      item: 'Playset de Charizard',
      total: 250_000,
      paid: 100_000,
      pending: 150_000,
      dueDate: '2026-10-30',
    });
  });

  it('handles buyer-first phrasing, Gs. formats, phone and absolute dates', () => {
    const r = parseSaleIntake(
      'Martín Benítez me compró una Pikachu ex SIR por Gs. 1.200.000, adelantó 400.000 y el resto el 15/11. Tel 0981 123 456',
      TODAY,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft).toMatchObject({
      buyer: 'Martín Benítez',
      item: 'Pikachu ex SIR',
      total: 1_200_000,
      paid: 400_000,
      pending: 800_000,
      dueDate: '2026-11-15',
      phone: '595981123456',
    });
  });

  it('supports "millones", "k" and relative dates like "en 2 semanas"', () => {
    const r = parseSaleIntake('Vendí una caja de Prismatic a Sofi por 1,5 millones, me pagó 500k, el saldo en 2 semanas', TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft).toMatchObject({ buyer: 'Sofi', total: 1_500_000, paid: 500_000, pending: 1_000_000, dueDate: '2026-11-12' });
  });

  it('marks full payment when the sale was "al contado"', () => {
    const r = parseSaleIntake('Le vendí un Umbreon VMAX alt art a Diego por 900mil al contado', TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.paid).toBe(900_000);
    expect(r.draft.pending).toBe(0);
    expect(r.draft.dueDate).toBeUndefined();
  });

  it('infers the total when only paid + pending are mentioned', () => {
    const r = parseSaleIntake('Le vendí 4 sobres de 151 a Ana, me dio 50mil y me debe 30mil para el lunes', TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft).toMatchObject({ buyer: 'Ana', total: 80_000, paid: 50_000, pending: 30_000, dueDate: '2026-11-02' });
    expect(r.warnings.join(' ')).toMatch(/Total inferido/);
  });

  it('reads bare numbers as thousands in money context and warns about it', () => {
    const r = parseSaleIntake('Le vendí un Mew ex a Pedro por 250, me dio 100 y los 150 el sábado', TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft).toMatchObject({ total: 250_000, paid: 100_000, pending: 150_000, dueDate: '2026-10-31' });
    expect(r.warnings.some((w) => w.includes('se asumió "mil"'))).toBe(true);
  });
});

describe('parser guardrails', () => {
  it('rejects a payment larger than the total', () => {
    const r = parseSaleIntake('Le vendí un Charizard a Lucas por 100mil y me dio 150mil', TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join(' ')).toMatch(/pagado no puede superar el total/);
  });

  it('flags inconsistent pending amounts instead of guessing', () => {
    const r = parseSaleIntake('Le vendí un playset a Lucas por 250mil, me dio 100mil y los 100mil me paga el viernes', TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join(' ')).toMatch(/Inconsistencia/);
  });

  it('reports missing fields and never produces a draft', () => {
    const r = parseSaleIntake('me dio 100mil', TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/comprador/), expect.stringMatching(/ítem/)]),
    );
  });

  it('rejects empty and oversized input', () => {
    expect(parseSaleIntake('   ', TODAY).ok).toBe(false);
    expect(parseSaleIntake('a'.repeat(501), TODAY).ok).toBe(false);
  });

  it('does not treat dates, quantities or phones as money', () => {
    const r = parseSaleIntake('Le vendí 3 cartas a Juan por 60mil, paga el 15. Cel 0971 555 444', TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft).toMatchObject({ total: 60_000, paid: 0, pending: 60_000, dueDate: '2026-11-15', phone: '595971555444' });
  });
});
