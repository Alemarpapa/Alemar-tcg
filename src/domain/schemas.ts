import { z } from 'zod';
import { fromIsoDate, type IsoDate } from './dates';

/** Non-empty single-line string with sane length limits. */
export const SafeTextSchema = z.string().trim().min(1).max(200);

/** Non-negative integer in Paraguayan Guaraníes (guaraníes have no cents). */
export const AmountSchema = z
  .number({ message: 'El monto debe ser numérico' })
  .int('El monto no puede tener decimales')
  .nonnegative('El monto no puede ser negativo')
  .max(1_000_000_000, 'Monto fuera de rango (máx 1.000 millones de Gs.)');

export const PositiveAmountSchema = AmountSchema.positive('El monto debe ser mayor a 0');

/** Strict YYYY-MM-DD that parses to a real calendar date (rejects 2026-02-30). */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (debe ser YYYY-MM-DD)')
  .refine((val) => {
    try {
      const d = fromIsoDate(val as IsoDate);
      return !Number.isNaN(d.getTime());
    } catch {
      return false;
    }
  }, 'Fecha no existe en el calendario');

/** Paraguayan phone number in international format wa.me expects: 595 + 8-10 digits. */
export const PhoneSchema = z
  .string()
  .regex(/^595\d{8,10}$/, 'Teléfono paraguayo inválido (debe iniciar con 595 y 8-10 dígitos)');

export const PaymentSchema = z.object({
  id: z.string().min(1),
  amount: PositiveAmountSchema,
  date: IsoDateSchema,
  note: z.string().max(200).optional(),
});

export const SaleSchema = z
  .object({
    id: z.string().min(1),
    buyer: z.string().trim().min(1, 'Falta el nombre del comprador').max(100),
    item: z.string().trim().min(1, 'Falta la descripción del ítem').max(200),
    total: PositiveAmountSchema,
    payments: z.array(PaymentSchema),
    createdAt: IsoDateSchema,
    dueDate: IsoDateSchema.optional(),
    phone: PhoneSchema.optional(),
    notes: z.string().max(500).optional(),
  })
  .superRefine((sale, ctx) => {
    const paid = sale.payments.reduce((acc, p) => acc + p.amount, 0);
    if (paid > sale.total) {
      ctx.addIssue({
        code: 'custom',
        path: ['payments'],
        message: `El total pagado (${paid}) supera el total de la venta (${sale.total})`,
      });
    }
  });

/**
 * Structured output of the natural-language intake parser. This is the
 * contract between the free-text box and the ledger: nothing reaches storage
 * without passing through it.
 */
export const SaleDraftSchema = z
  .object({
    buyer: z.string().trim().min(1, 'No se detectó el comprador'),
    item: z.string().trim().min(1, 'No se detectó el ítem vendido'),
    total: PositiveAmountSchema,
    paid: AmountSchema,
    pending: AmountSchema,
    dueDate: IsoDateSchema.optional(),
    phone: PhoneSchema.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.paid > d.total) {
      ctx.addIssue({
        code: 'custom',
        path: ['paid'],
        message: 'Lo pagado no puede superar el total de la venta',
      });
    }
    if (d.paid + d.pending !== d.total) {
      ctx.addIssue({
        code: 'custom',
        path: ['pending'],
        message: 'Total ≠ pagado + saldo pendiente',
      });
    }
  });

export const PrizeItemSchema = z.object({
  description: z.string().trim().min(1).max(120),
  quantity: z.number().int().positive(),
  /** Market/resale value per unit in guaraníes. */
  unitValue: AmountSchema,
});

export const TournamentSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Falta el nombre del torneo').max(120),
  date: IsoDateSchema,
  game: z.string().trim().max(60).optional(),
  format: z.string().trim().max(60).optional(),
  entryFee: AmountSchema,
  travelCost: AmountSchema.optional(),
  otherCosts: AmountSchema.optional(),
  cashPrize: AmountSchema.default(0),
  productPrizes: z.array(PrizeItemSchema).default([]),
  standing: z.number().int().positive().optional(),
  players: z.number().int().positive().optional(),
  record: z.string().trim().max(20).optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (t) => t.standing === undefined || t.players === undefined || t.standing <= t.players,
  { path: ['standing'], message: 'La posición no puede ser mayor a la cantidad de jugadores' },
);

/** Extra expenses (sleeves/fundas, playmat, binders, dice, etc.) outside of tournaments. */
export const ExpenseItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().min(1, 'Falta la descripción del gasto').max(120),
  category: z.string().trim().default('Accesorios'),
  amount: PositiveAmountSchema,
  date: IsoDateSchema,
});

export const AppStateSchema = z.object({
  version: z.literal(1),
  sales: z.array(SaleSchema),
  tournaments: z.array(TournamentSchema),
  expenses: z.array(ExpenseItemSchema).default([]),
});

export type Payment = z.infer<typeof PaymentSchema>;
export type Sale = z.infer<typeof SaleSchema>;
export type SaleDraft = z.infer<typeof SaleDraftSchema>;
export type PrizeItem = z.infer<typeof PrizeItemSchema>;
export type Tournament = z.infer<typeof TournamentSchema>;
export type ExpenseItem = z.infer<typeof ExpenseItemSchema>;
export type AppState = z.infer<typeof AppStateSchema>;

export const emptyState = (): AppState => ({ version: 1, sales: [], tournaments: [], expenses: [] });

/** Flattens Zod issues into human-readable Spanish messages. */
export function issueMessages(error: z.ZodError): string[] {
  return error.issues.map((i) => i.message);
}
