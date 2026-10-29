import { daysBetween, fromIsoDate, type IsoDate } from './dates';
import { formatGs } from './money';
import type { Sale } from './schemas';
import { saleBalance } from './ledger';

/**
 * Normalizes Paraguayan phone numbers to the international format wa.me
 * expects (digits only, country code 595, no leading 0).
 *   "0981 123 456"    -> "595981123456"
 *   "+595 981-123456" -> "595981123456"
 *   "981123456"       -> "595981123456"
 */
export function normalizePyPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let local: string;
  if (digits.startsWith('595')) local = digits.slice(3);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else local = digits;
  if (!/^\d{8,10}$/.test(local)) return null;
  return `595${local}`;
}

const DATE_FMT = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });

export function buildReminderMessage(sale: Sale, today: IsoDate): string {
  const balance = saleBalance(sale);
  const name = sale.buyer.split(' ')[0] ?? sale.buyer;
  const lines = [`¡Hola ${name}! 👋 Te escribo por ${sale.item}.`];
  lines.push(`Quedó un saldo pendiente de *${formatGs(balance)}* (total ${formatGs(sale.total)}).`);
  if (sale.dueDate) {
    const diff = daysBetween(today, sale.dueDate);
    const when = DATE_FMT.format(fromIsoDate(sale.dueDate));
    if (diff < 0) lines.push(`Habíamos quedado para el ${when} (hace ${-diff} día${diff === -1 ? '' : 's'}).`);
    else if (diff === 0) lines.push('Habíamos quedado para hoy.');
    else lines.push(`Te recuerdo que vence el ${when}.`);
  }
  lines.push('¿Me avisás cuándo podés transferir? ¡Gracias! 🙌');
  return lines.join('\n');
}

export function whatsappLink(message: string, phone?: string): string {
  const text = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}
