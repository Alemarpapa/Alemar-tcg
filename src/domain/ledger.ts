import { addDays, daysBetween, fromIsoDate, toIsoDate, type IsoDate } from './dates';
import {
  SaleSchema,
  issueMessages,
  type Payment,
  type Sale,
  type SaleDraft,
} from './schemas';

export type SaleStatus = 'pagado' | 'vencido' | 'por_vencer' | 'pendiente';

/** Days before the due date at which a debt is flagged as "por vencer". */
export const DUE_SOON_DAYS = 3;

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function salePaid(sale: Pick<Sale, 'payments'>): number {
  return sale.payments.reduce((acc, p) => acc + p.amount, 0);
}

export function saleBalance(sale: Pick<Sale, 'payments' | 'total'>): number {
  return Math.max(0, sale.total - salePaid(sale));
}

export function saleStatus(sale: Sale, today: IsoDate): SaleStatus {
  if (saleBalance(sale) === 0) return 'pagado';
  if (!sale.dueDate) return 'pendiente';
  const diff = daysBetween(today, sale.dueDate);
  if (diff < 0) return 'vencido';
  if (diff <= DUE_SOON_DAYS) return 'por_vencer';
  return 'pendiente';
}

/** Builds a validated Sale from a parser draft (or the manual form). */
export function createSaleFromDraft(
  draft: SaleDraft,
  today: IsoDate,
  extra: { notes?: string } = {},
): Result<Sale> {
  const payments: Payment[] = draft.paid > 0
    ? [{ id: newId(), amount: draft.paid, date: today, note: 'Pago inicial' }]
    : [];
  const candidate = {
    id: newId(),
    buyer: draft.buyer.trim(),
    item: draft.item.trim(),
    total: draft.total,
    payments,
    createdAt: today,
    ...(draft.phone ? { phone: draft.phone } : {}),
    ...(draft.dueDate && draft.paid < draft.total ? { dueDate: draft.dueDate } : {}),
    ...(extra.notes ? { notes: extra.notes } : {}),
  };
  const parsed = SaleSchema.safeParse(candidate);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: issueMessages(parsed.error) };
}

/**
 * Guardrail: a payment must be positive and can never exceed the outstanding
 * balance (no accidental overpayments / double-entries).
 */
export function registerPayment(sale: Sale, amount: number, date: IsoDate, note?: string): Result<Sale> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, errors: ['El pago debe ser un monto entero mayor a 0'] };
  }
  const balance = saleBalance(sale);
  if (balance === 0) return { ok: false, errors: ['Esta venta ya está saldada'] };
  if (amount > balance) {
    return { ok: false, errors: [`El pago (${amount}) supera el saldo pendiente (${balance})`] };
  }
  const payment: Payment = { id: newId(), amount, date, ...(note ? { note } : {}) };
  const parsed = SaleSchema.safeParse({ ...sale, payments: [...sale.payments, payment] });
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: issueMessages(parsed.error) };
}

export interface BuyerSummary {
  buyer: string;
  phone?: string;
  owed: number;
  overdue: number;
  openSales: number;
  /** Earliest due date among open sales, if any. */
  nextDue?: IsoDate;
}

export interface ReceivablesSummary {
  totalSold: number;
  totalCollected: number;
  /** "Dinero colgado": everything still owed. */
  outstanding: number;
  overdue: number;
  dueSoon: number;
  byBuyer: BuyerSummary[];
}

export function summarizeReceivables(sales: Sale[], today: IsoDate): ReceivablesSummary {
  const byBuyer = new Map<string, BuyerSummary>();
  let totalSold = 0;
  let totalCollected = 0;
  let outstanding = 0;
  let overdue = 0;
  let dueSoon = 0;

  for (const sale of sales) {
    const balance = saleBalance(sale);
    const status = saleStatus(sale, today);
    totalSold += sale.total;
    totalCollected += salePaid(sale);
    outstanding += balance;
    if (status === 'vencido') overdue += balance;
    if (status === 'por_vencer') dueSoon += balance;
    if (balance === 0) continue;

    const key = sale.buyer.trim().toLowerCase();
    const entry: BuyerSummary = byBuyer.get(key) ?? { buyer: sale.buyer, owed: 0, overdue: 0, openSales: 0 };
    entry.owed += balance;
    entry.openSales += 1;
    if (status === 'vencido') entry.overdue += balance;
    if (sale.phone && !entry.phone) entry.phone = sale.phone;
    if (sale.dueDate && (!entry.nextDue || sale.dueDate < entry.nextDue)) entry.nextDue = sale.dueDate;
    byBuyer.set(key, entry);
  }

  return {
    totalSold,
    totalCollected,
    outstanding,
    overdue,
    dueSoon,
    byBuyer: [...byBuyer.values()].sort((a, b) => b.overdue - a.overdue || b.owed - a.owed),
  };
}

/** Amount collected within the calendar month containing `today`. */
export function collectedThisMonth(sales: Sale[], today: IsoDate): number {
  const prefix = today.slice(0, 7);
  return sales.reduce(
    (acc, s) => acc + s.payments.filter((p) => p.date.startsWith(prefix)).reduce((a, p) => a + p.amount, 0),
    0,
  );
}

export const todayIso = (): IsoDate => toIsoDate(new Date());
export const isoPlusDays = (iso: IsoDate, days: number): IsoDate => toIsoDate(addDays(fromIsoDate(iso), days));
