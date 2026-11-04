import { describe, expect, it } from 'vitest';
import {
  calculateMonthSummary,
  collectedThisMonth,
  createSaleFromDraft,
  registerPayment,
  saleBalance,
  saleStatus,
  summarizeInventory,
  summarizeReinvestment,
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
    cashPrize: 100_000,
    productPrizes: [{ description: 'Sobres', quantity: 12, unitValue: 25_000 }],
    standing: 4,
    players: 64,
  };

  it('computes net and ROI including monetizable product prizes', () => {
    const p = tournamentPnL(base);
    expect(p).toMatchObject({ costs: 150_000, productRevenue: 300_000, revenue: 400_000, net: 250_000 });
    expect(formatRoi(p.roi)).toBe('+166,7%');
  });

  it('summarizes a season and handles zero-cost events', () => {
    const loss: Tournament = { ...base, id: 't2', cashPrize: 0, productPrizes: [], standing: 20 };
    const free: Tournament = { ...base, id: 't3', entryFee: 0, cashPrize: 0, productPrizes: [], standing: 1, players: 8 };
    expect(tournamentPnL(free).roi).toBeNull();
    const s = seasonSummary([base, loss, free]);
    expect(s).toMatchObject({ count: 3, profitable: 1, costs: 300_000, revenue: 400_000, net: 100_000, bestStanding: 1 });
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
    expect(msg).toContain('Playset de Charizard');
    const url = whatsappLink(msg, s.phone);
    expect(url).toMatch(/^https:\/\/wa\.me\/595981123456\?text=/);
  });
});

describe('storage & resilience', () => {
  const fakeStorage = (): KeyValueStorage & { map: Map<string, string> } => {
    const map = new Map<string, string>();
    return {
      map,
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
    };
  };

  it('saves and reloads state idempotently', () => {
    const st = fakeStorage();
    const initial = { version: 1 as const, sales: [sale()], tournaments: [], expenses: [], inventory: [], purchases: [] };
    saveState(st, initial);
    const loaded = loadState(st);
    expect(loaded.state.sales).toHaveLength(1);
    expect(loaded.recoveredFrom).toBeUndefined();
  });

  it('backs up corrupted JSON and returns an empty state instead of crashing', () => {
    const st = fakeStorage();
    st.setItem(STORAGE_KEY, '{ invalid json');
    const loaded = loadState(st, () => 1234);
    expect(loaded.state.sales).toHaveLength(0);
    expect(loaded.recoveredFrom).toBe(`${STORAGE_KEY}:corrupt:1234 (JSON inválido)`);
    expect(st.map.get(`${STORAGE_KEY}:corrupt:1234`)).toBe('{ invalid json');
  });

  it('backs up schema-violating JSON payload', () => {
    const st = fakeStorage();
    st.setItem(STORAGE_KEY, JSON.stringify({ version: 2, sales: [] }));
    const loaded = loadState(st, () => 9999);
    expect(loaded.state.sales).toHaveLength(0);
    expect(loaded.recoveredFrom).toContain(`${STORAGE_KEY}:corrupt:9999`);
  });
});

describe('monthly balances & inventory stock', () => {
  it('calculates monthly summary with sales, tournament prizes, and expenses', () => {
    const s1 = sale({
      createdAt: '2026-11-01',
      total: 300_000,
      payments: [{ id: 'p1', amount: 150_000, date: '2026-11-02' }],
    });
    const s2 = sale({
      createdAt: '2026-10-15',
      total: 200_000,
      payments: [{ id: 'p2', amount: 200_000, date: '2026-10-16' }],
    });
    const tour1: Tournament = {
      id: 't1',
      name: 'Torneo Noviembre',
      date: '2026-11-05',
      entryFee: 30_000,
      cashPrize: 80_000,
      productPrizes: [{ description: 'Sobres', quantity: 2, unitValue: 25_000 }],
    };
    const expenses = [
      { id: 'e1', description: 'Fundas Katana', category: 'Accesorios', amount: 45_000, date: '2026-11-03' },
      { id: 'e2', description: 'Playmat', category: 'Accesorios', amount: 100_000, date: '2026-10-10' },
    ];

    const nov = calculateMonthSummary('2026-11', [s1, s2], [tour1], expenses);
    expect(nov.salesCollected).toBe(150_000);
    expect(nov.tournamentCash).toBe(80_000);
    expect(nov.tournamentProduct).toBe(50_000);
    expect(nov.tournamentCosts).toBe(30_000);
    expect(nov.expenses).toBe(45_000);
    // totalRevenue = 150k + 80k + 50k = 280k
    // totalCosts = 30k + 45k = 75k
    // net = 280k - 75k = 205k
    expect(nov.totalRevenue).toBe(280_000);
    expect(nov.totalCosts).toBe(75_000);
    expect(nov.net).toBe(205_000);
    expect(nov.liquidNet).toBe(155_000); // 150k + 80k - 75k = 155k
  });

  it('summarizes inventory stock (available, reserved, sold)', () => {
    const items = [
      { id: '1', description: 'Carpeta Ultra Pro 9 bolsillos', category: 'Carpeta', price: 150_000, status: 'disponible' as const, createdAt: '2026-11-01' },
      { id: '2', description: 'Charizard ex SAR', category: 'Carta Suelta', price: 200_000, status: 'reservado' as const, createdAt: '2026-11-02' },
      { id: '3', description: 'Mew ex', category: 'Carta Suelta', price: 80_000, status: 'vendido' as const, createdAt: '2026-10-10' },
    ];

    const summary = summarizeInventory(items);
    // Active stock value = 150_000 + 200_000 = 350_000
    expect(summary.totalValue).toBe(350_000);
    expect(summary.availableCount).toBe(1);
    expect(summary.reservedCount).toBe(1);
    expect(summary.soldCount).toBe(1);
    expect(summary.count).toBe(3);
  });
});

describe('reinversión en lotes', () => {
  const lot = { id: 'lot1', description: 'Lote restock', amount: 180_000, date: '2026-11-04' };
  const item = (id: string, price: number, status: 'disponible' | 'vendido') => ({
    id, description: id, category: 'Carta Suelta', price, status, createdAt: '2026-11-04', purchaseId: 'lot1',
  });

  it('sums every purchase into one pool and recovers as any stock is sold', () => {
    const second = { ...lot, id: 'lot2', amount: 125_000 };
    const inv = [item('a', 100_000, 'vendido'), item('b', 120_000, 'disponible'), { ...item('x', 50_000, 'vendido'), purchaseId: undefined }];
    expect(summarizeReinvestment([lot, second], inv)).toEqual({
      invested: 305_000, stockValue: 120_000, soldValue: 150_000, recovered: -155_000,
    });
  });

  it('counts the purchase as money out in its month only', () => {
    expect(calculateMonthSummary('2026-11', [], [], [], [lot]).net).toBe(-180_000);
    expect(calculateMonthSummary('2026-10', [], [], [], [lot]).reinvestment).toBe(0);
  });
});

describe('balance total = 3 pestañas', () => {
  it('cobrado − reinversión + (torneos − gastos) equals the month net', () => {
    const sales = [{ id: 's', buyer: 'L', item: 'x', total: 200_000, createdAt: '2026-11-01', payments: [{ id: 'p', amount: 150_000, date: '2026-11-02' }] }];
    const tournaments: Tournament[] = [
      { id: 't', name: 'Liga', date: '2026-11-03', entryFee: 30_000, cashPrize: 50_000, productPrizes: [{ description: 'Sobres', quantity: 1, unitValue: 20_000 }] },
    ];
    const expenses = [{ id: 'e', description: 'fundas', category: 'Fundas', amount: 25_000, date: '2026-11-04' }];
    const purchases = [{ id: 'l', description: 'lote', amount: 180_000, date: '2026-11-04' }];
    const m = calculateMonthSummary('2026-11', sales, tournaments, expenses, purchases);
    expect(m.salesCollected - m.reinvestment + (m.tournamentNet - m.expenses)).toBe(m.net);
    expect(m.net).toBe(150_000 - 180_000 + (70_000 - 30_000 - 25_000));
  });
});
