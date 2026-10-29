import { z } from 'zod';
import { isValidIsoDate } from './dates';
import { MAX_AMOUNT } from './money';

/** Integer guaraníes, never negative, with a sanity ceiling against typos. */
export const AmountSchema = z
  .number()
  .int('El monto debe ser un número entero de guaraníes')
  .nonnegative('El monto no puede ser negativo')
  .max(MAX_AMOUNT, 'Monto sospechosamente alto (¿un 000 de más?)');

export const PositiveAmountSchema = AmountSchema.refine((n) => n > 0, 'El monto debe ser mayor a 0');

export const IsoDateSchema = z.string().refine(isValidIsoDate, 'Fecha inválida (formato AAAA-MM-DD)');

export const PhoneSchema = z
  .string()
  .regex(/^595\d{8,10}$/, 'Teléfono inválido: usar formato paraguayo (09xx… o +595…)');

export const PaymentSchema = z.object({
  id: z.string().min(1),
  amount: PositiveAmountSchema,
  date: IsoDateSchema,
  note: z.string().max(200).optional(),
});

export const SaleSchema = z
  .object({
    id: z.string().min(1),
    buyer: z.string().trim().min(1, 'Falta el comprador').max(80),
    phone: PhoneSchema.optional(),
    item: z.string().trim().min(1, 'Falta el ítem').max(200),
    total: PositiveAmountSchema,
    payments: z.array(PaymentSchema),
    dueDate: IsoDateSchema.optional(),
    createdAt: IsoDateSchema,
    notes: z.string().max(500).optional(),
  })
  .superRefine((sale, ctx) => {
    const paid = sale.payments.reduce((acc, p) => acc + p.amount, 0);
    if (paid > sale.total) {
      ctx.addIssue({
        code: 'custom',
        path: ['payments'],
        message: `Los pagos (${paid}) superan el total de la venta (${sale.total})`,
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
  travelCost: AmountSchema,
  otherCosts: AmountSchema,
  cashPrize: AmountSchema,
  productPrizes: z.array(PrizeItemSchema),
  standing: z.number().int().positive().optional(),
  players: z.number().int().positive().optional(),
  record: z.string().trim().max(20).optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (t) => t.standing === undefined || t.players === undefined || t.standing <= t.players,
  { path: ['standing'], message: 'La posición no puede ser mayor a la cantidad de jugadores' },
);

export const AppStateSchema = z.object({
  version: z.literal(1),
  sales: z.array(SaleSchema),
  tournaments: z.array(TournamentSchema),
});

export type Payment = z.infer<typeof PaymentSchema>;
export type Sale = z.infer<typeof SaleSchema>;
export type SaleDraft = z.infer<typeof SaleDraftSchema>;
export type PrizeItem = z.infer<typeof PrizeItemSchema>;
export type Tournament = z.infer<typeof TournamentSchema>;
export type AppState = z.infer<typeof AppStateSchema>;

export const emptyState = (): AppState => ({ version: 1, sales: [], tournaments: [] });

/** Flattens Zod issues into human-readable Spanish messages. */
export function issueMessages(error: z.ZodError): string[] {
  return error.issues.map((i) => i.message);
}
