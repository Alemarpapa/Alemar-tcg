import { describe, expect, it } from 'vitest';
import {
  collectedThisMonth,
  createSaleFromDraft,
  registerPayment,
  saleBalance,
  saleStatus,
  summarizeReceivables,
} from '../src/domain/ledger';
import type { Sale } from '../src/domain/schemas';
import { formatRoi, seasonSummary, tournamentPnL } from '../src/domain/tournaments';
import type { Tournament } from '../src/domain/schemas';
import { buildReminderMessage, normalizePyPhone, whatsappLink } from '../src/domain/whatsapp';
import { STORAGE_KEY, loadState, saveState, type KeyValueStorage } from '../src/storage/store';

const TODAY = '2026-10-29';

function sale(overrides: Partial<Sale> = {}): Sale {
  const r = createSaleFromDraft(
    { buyer: 'Lucas', item: 'Playset de Charizard', total: 250_000, paid: 100_000, pending: 150_000, dueDate: '2026-10-30' },
    '2026-10-20',
  );
  if (!r.ok) throw new Error(r.errors.join());
  return { ...r.value, ...overrides };
}

describe('balances', () => {
  it('computes balance and status across the debt lifecycle', () => {
    const s = sale();
    expect(saleBalance(s)).toBe(150_000);
    expect(saleStatus(s, '2026-10-20')).toBe('pendiente');
    expect(saleStatus(s, TODAY)).toBe('por_vencer');
    expect(saleStatus(s, '2026-11-02')).toBe('vencido');

    const r = registerPayment(s, 150_000, '2026-11-02');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(saleBalance(r.value)).toBe(0);
    expect(saleStatus(r.value, '2026-12-01')).toBe('pagado');
  });

  it('guards against overpayment, zero/negative and fractional payments', () => {
    const s = sale();
    expect(registerPayment(s, 200_000, TODAY).ok).toBe(false);
    expect(registerPayment(s, 0, TODAY).ok).toBe(false);
    expect(registerPayment(s, -10, TODAY).ok).toBe(false);
    expect(registerPayment(s, 10.5, TODAY).ok).toBe(false);
  });

  it('aggregates "dinero colgado" per buyer, overdue first', () => {
    const sales = [
      sale(),
      sale({ id: 'b', buyer: 'lucas', dueDate: '2026-10-25' }), // same buyer, different case, overdue
      sale({ id: 'c', buyer: 'Ana', total: 80_000, payments: [] , dueDate: '2026-12-01' }),
    ];
    const sum = summarizeReceivables(sales, TODAY);
    expect(sum.outstanding).toBe(150_000 + 150_000 + 80_000);
    expect(sum.overdue).toBe(150_000);
    expect(sum.dueSoon).toBe(150_000);
    expect(sum.byBuyer).toHaveLength(2);
    expect(sum.byBuyer[0]).toMatchObject({ owed: 300_000, overdue: 150_000, openSales: 2, nextDue: '2026-10-25' });
    expect(collectedThisMonth(sales, TODAY)).toBe(200_000);
  });

  it('rejects invalid sales at the schema boundary', () => {
    const r = createSaleFromDraft({ buyer: '', item: 'X', total: 0, paid: 0, pending: 0 }, TODAY);
    expect(r.ok).toBe(false);
  });
});

describe('tournament P&L', () => {
  const base: Tournament = {
    id: 't1',
    name: 'Regional Asunción',
    date: '2026-10-10',
    entryFee: 150_000,
    travelCost: 50_000,
    otherCosts: 0,
    cashPrize: 100_000,
    productPrizes: [{ description: 'Sobres', quantity: 12, unitValue: 25_000 }],
    standing: 4,
    players: 64,
  };

  it('computes net and ROI including monetizable product prizes', () => {
    const p = tournamentPnL(base);
    expect(p).toMatchObject({ costs: 200_000, productRevenue: 300_000, revenue: 400_000, net: 200_000, roi: 1 });
    expect(formatRoi(p.roi)).toBe('+100%');
  });

  it('summarizes a season and handles zero-cost events', () => {
    const loss: Tournament = { ...base, id: 't2', cashPrize: 0, productPrizes: [], standing: 20 };
    const free: Tournament = { ...base, id: 't3', entryFee: 0, travelCost: 0, cashPrize: 0, productPrizes: [], standing: 1, players: 8 };
    expect(tournamentPnL(free).roi).toBeNull();
    const s = seasonSummary([base, loss, free]);
    expect(s).toMatchObject({ count: 3, profitable: 1, costs: 400_000, revenue: 400_000, net: 0, roi: 0, bestStanding: 1 });
  });
});

describe('WhatsApp reminders', () => {
  it('normalizes Paraguayan numbers', () => {
    expect(normalizePyPhone('0981 123 456')).toBe('595981123456');
    expect(normalizePyPhone('+595 981-123456')).toBe('595981123456');
    expect(normalizePyPhone('123')).toBeNull();
  });

  it('builds a wa.me link with the outstanding balance', () => {
    const s = sale({ phone: '595981123456', dueDate: '2026-10-25' });
    const msg = buildReminderMessage(s, TODAY);
    expect(msg).toContain('₲ 150.000');
    expect(msg).toContain('hace 4 días');
    const link = whatsappLink(msg, s.phone);
    expect(link.startsWith('https://wa.me/595981123456?text=')).toBe(true);
    expect(decodeURIComponent(link.split('text=')[1]!)).toBe(msg);
  });
});

describe('persistence', () => {
  const memory = (): KeyValueStorage & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };

  it('round-trips valid state', () => {
    const store = memory();
    saveState(store, { version: 1, sales: [sale()], tournaments: [] });
    expect(loadState(store).state.sales[0]?.buyer).toBe('Lucas');
  });

  it('backs up corrupted data instead of crashing or losing it', () => {
    const store = memory();
    store.setItem(STORAGE_KEY, '{"version":1,"sales":[{"total":-5}]');
    const r = loadState(store, () => 42);
    expect(r.state.sales).toEqual([]);
    expect(r.recoveredFrom).toContain(':corrupt:42');
    expect(store.data.get(`${STORAGE_KEY}:corrupt:42`)).toContain('-5');
  });
});
