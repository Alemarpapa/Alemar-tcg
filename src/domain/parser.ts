/**
 * Deterministic natural-language intake parser (no LLM, no network).
 *
 * Turns phrases like
 *   "Le vendí un playset de Charizard a Lucas por 250mil, me dio 100mil y
 *    los 150mil me paga el viernes"
 * into a SaleDraft validated by Zod. Extraction is rule-based and every
 * inference is reported back as a warning so the user can confirm or correct
 * it before anything is saved.
 */
import { resolveDate, toIsoDate } from './dates';
import { AMOUNT_PATTERN, amountFromParts, formatGs } from './money';
import { SaleDraftSchema, issueMessages, type SaleDraft } from './schemas';
import { normalizePyPhone } from './whatsapp';

export interface ExtractedFields {
  buyer?: string;
  item?: string;
  total?: number;
  paid?: number;
  pending?: number;
  dueDate?: string;
  dueDateText?: string;
  phone?: string;
}

export type IntakeResult =
  | { ok: true; draft: SaleDraft; fields: ExtractedFields; warnings: string[] }
  | { ok: false; fields: ExtractedFields; errors: string[]; warnings: string[] };

export const MAX_INPUT_LENGTH = 500;

type Role = 'total' | 'paid' | 'pending';

interface AmountToken {
  value: number;
  start: number;
  end: number;
  raw: string;
  role?: Role;
}

const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Keyword sets are matched against accent-stripped, lower-cased text.
const ROLE_KEYWORDS: Record<Role, RegExp> = {
  total: /\b(por|en|a|precio|total|vale|valor|cotice)\b/g,
  paid: /\b(me dio|dio|me dieron|pago|pague|abono|adelanto|adelantado|anticipo|sena|a cuenta|transfirio|deposito|entrego|recibi|cobre)\b/g,
  pending: /\b(los|las|el resto|resto|saldo|falta|faltan|queda|quedan|debe|deben|pendiente|me paga|paga|pagara|va a pagar|me va a pagar)\b/g,
};

// Markers that appear *after* an amount ("150mil me paga el viernes").
const TRAILING_KEYWORDS: Array<[Role, RegExp]> = [
  ['paid', /^\s*(de sena|a cuenta|de adelanto|adelantado|ya (me )?(lo )?(dio|pago))\b/],
  ['pending', /^\s*(me (lo )?(paga|debe|va a pagar)|(lo )?(paga|debe|queda|pendiente|para el|el (lunes|martes|miercoles|jueves|viernes|sabado|domingo)))\b/],
];

const FULL_PAYMENT = /\b(al contado|pago todo|pago completo|me pago todo|cancelo todo|ya esta pagado|pagado completo|todo pagado)\b/;
const NOTHING_PAID = /\b(fiado|no me pago nada|no me dio nada|sin pagar|me debe todo|todo a credito)\b/;

const NAME_STOPWORDS = new Set([
  'un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las', 'mi', 'su', 'sus', 'cuenta', 'pagar', 'fin',
  'final', 'partir', 'mitad', 'plazo', 'credito', 'semana', 'traves', 'mano', 'precio', 'cambio',
  'gs', 'me', 'te', 'le', 'que', 'pasado', 'manana', 'hoy', 'lo', 'pago', 'cuotas', 'medias',
]);

const TITLE = (s: string) =>
  s.split(/\s+/).map((w) => (w ? w[0]!.toLocaleUpperCase('es') + w.slice(1) : w)).join(' ');

/** Replaces matches with spaces so indices stay aligned with the original text. */
function mask(text: string, re: RegExp): string {
  return text.replace(re, (m) => ' '.repeat(m.length));
}

function lastKeywordEnd(segment: string, re: RegExp): number {
  let end = -1;
  for (const m of segment.matchAll(re)) end = Math.max(end, (m.index ?? 0) + m[0].length);
  return end;
}

function extractAmounts(scan: string, warnings: string[]): AmountToken[] {
  const tokens: AmountToken[] = [];
  const re = new RegExp(AMOUNT_PATTERN.source, AMOUNT_PATTERN.flags);
  for (const m of scan.matchAll(re)) {
    const digits = m[1];
    if (!digits || m.index === undefined) continue;
    const unit = m[2];
    let value = amountFromParts(digits, unit);
    if (value === null) continue;
    const raw = m[0].trim();
    const hasCurrency = /gs|₲|guaran/i.test(raw);
    if (!unit && !hasCurrency && value < 1000) {
      // Bare small numbers ("me dio 100") are read as thousands only when
      // they sit right after a money keyword; otherwise they're quantities/dates.
      const before = strip(scan.slice(Math.max(0, m.index - 14), m.index));
      const moneyContext = /(por|dio|pago|debe|resto|saldo|los|las|sena|paga|en)\s*$/.test(before);
      if (!moneyContext || value === 0) continue;
      warnings.push(`Interpreté "${raw}" como ${formatGs(value * 1000)} (se asumió "mil").`);
      value *= 1000;
    }
    const start = m.index + (m[0].length - m[0].trimStart().length);
    tokens.push({ value, start, end: start + raw.length, raw });
  }
  return tokens;
}

function classify(tokens: AmountToken[], lower: string): void {
  tokens.forEach((tok, i) => {
    const prevEnd = i === 0 ? 0 : tokens[i - 1]!.end;
    const before = lower.slice(prevEnd, tok.start);
    let best: { role: Role; end: number } | null = null;
    for (const role of Object.keys(ROLE_KEYWORDS) as Role[]) {
      const end = lastKeywordEnd(before, ROLE_KEYWORDS[role]);
      if (end >= 0 && (!best || end > best.end)) best = { role, end };
    }
    if (best) {
      tok.role = best.role;
      return;
    }
    const nextStart = i + 1 < tokens.length ? tokens[i + 1]!.start : lower.length;
    const after = lower.slice(tok.end, Math.min(nextStart, tok.end + 30));
    for (const [role, re] of TRAILING_KEYWORDS) {
      if (re.test(after)) {
        tok.role = role;
        return;
      }
    }
  });
}

const SALE_VERB = /\b(?:le\s+|les\s+)?(?:vend[ií](?:mos)?|compr[oó])(?=[\s,.;:]|$)/iu;
const NAME_RE = "([A-Za-zÁÉÍÓÚÑáéíóúñü][A-Za-zÁÉÍÓÚÑáéíóúñü.'-]*(?:\\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü'-]*)?)";

function extractBuyer(text: string): string | undefined {
  // "Lucas me compró …"
  const buyerFirst = new RegExp(`^${NAME_RE}\\s+me\\s+compr[oó](?=[\\s,.;:]|$)`, 'u').exec(text);
  if (buyerFirst?.[1] && !NAME_STOPWORDS.has(strip(buyerFirst[1].split(/\s+/)[0]!))) {
    return TITLE(buyerFirst[1]);
  }
  // "… a Lucas …" / "… para Lucas …"
  const re = new RegExp(`(?:^|\\s)(?:[Aa]|[Pp]ara)\\s+${NAME_RE}`, 'gu');
  for (const m of text.matchAll(re)) {
    const name = m[1];
    if (!name) continue;
    const words = name.split(/\s+/);
    const first = strip(words[0]!);
    if (NAME_STOPWORDS.has(first) || /^\d/.test(first)) continue;
    // Drop a trailing capitalised word that is actually a stopword ("a Lucas El").
    const kept = words.filter((w, idx) => idx === 0 || !NAME_STOPWORDS.has(strip(w)));
    return TITLE(kept.join(' '));
  }
  return undefined;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[]\\]/g, '\\$&');
}

function extractItem(text: string, buyer: string | undefined): string | undefined {
  const verb = SALE_VERB.exec(text);
  if (!verb) return undefined;
  let rest = text.slice(verb.index + verb[0].length);
  if (buyer) {
    rest = rest.replace(new RegExp(`^\\s*(?:a|para)\\s+${escapeRe(buyer)}(?=[\s,.;:]|$)`, 'iu'), '');
  }
  const cuts: RegExp[] = [
    /,/,
    /\s+(?:por|en|a)\s+(?:gs\.?\s*|₲\s*)?\d/iu,
    /\s+(?:y|me|que)\s+/iu,
    /\s+(?:a|para)\s+[A-ZÁÉÍÓÚÑ]/u,
  ];
  if (buyer) cuts.unshift(new RegExp(`\\s+(?:a|para)\\s+${escapeRe(buyer)}(?=[\s,.;:]|$)`, 'iu'));
  let cut = rest.length;
  for (const re of cuts) {
    const m = re.exec(rest);
    if (m && m.index < cut && rest.slice(0, m.index).trim().length > 0) cut = m.index;
  }
  const item = rest
    .slice(0, cut)
    .trim()
    .replace(/^(?:un|una|unos|unas|el|la|los|las)\s+/iu, '')
    .replace(/[.;:]+$/, '')
    .trim();
  if (!item) return undefined;
  return item[0]!.toLocaleUpperCase('es') + item.slice(1);
}

export function parseSaleIntake(input: string, today: Date = new Date()): IntakeResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const fields: ExtractedFields = {};

  const text = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, fields, errors: ['Escribí una frase describiendo la venta.'], warnings };
  if (text.length > MAX_INPUT_LENGTH) {
    return { ok: false, fields, errors: [`Texto demasiado largo (máx. ${MAX_INPUT_LENGTH} caracteres).`], warnings };
  }
  const lower = strip(text);

  // Phone
  const phoneMatch = /(?:\+?\s?595[s-]?|0)9\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/.exec(text);
  let scan = text;
  if (phoneMatch) {
    const phone = normalizePyPhone(phoneMatch[0]);
    if (phone) fields.phone = phone;
    scan = scan.slice(0, phoneMatch.index) + ' '.repeat(phoneMatch[0].length) + scan.slice(phoneMatch.index + phoneMatch[0].length);
  }

  // Due date
  const due = resolveDate(text, today);
  if (due) {
    fields.dueDate = due.date;
    fields.dueDateText = due.source;
  }

  // Mask date-like and quantity-like numbers so they're never read as money.
  scan = mask(scan, /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g);
  scan = mask(scan, /\ben \d{1,2} (?:d[ií]as?|semanas?)\b/giu);
  scan = mask(scan, /\b(?:el|para el|hasta el) \d{1,2}(?= de |\s*$|[s,.;])(?!\s*(?:mil|k|m\b|mill|palo))/giu);
  scan = mask(scan, /\b\d{1,2} de (?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/giu);
  scan = mask(scan, /\b(?:x\s?\d+|\d+\s?x|\d+\s+(?:copias|cartas|sobres|unidades|booster|boosters|cajas|etb))\b/giu);

  const tokens = extractAmounts(scan, warnings);
  classify(tokens, lower);

  const firstOf = (role: Role) => tokens.find((t) => t.role === role);
  const sumOf = (role: Role) => {
    const list = tokens.filter((t) => t.role === role);
    return list.length ? list.reduce((a, t) => a + t.value, 0) : undefined;
  };

  let total = firstOf('total')?.value;
  // Extra "total" tokens beyond the first are likely misreads; surface them.
  tokens.filter((t) => t.role === 'total').slice(1).forEach((t) => {
    warnings.push(`Monto "${t.raw}" ignorado: ya había un total.`);
    delete t.role;
  });
  let paid = sumOf('paid');
  const statedPending = sumOf('pending');

  for (const t of tokens.filter((tok) => !tok.role)) {
    if (total === undefined && !t.raw.startsWith('0')) {
      total = t.value;
      t.role = 'total';
      warnings.push(`Asumí ${formatGs(t.value)} como precio total.`);
    } else {
      warnings.push(`Monto "${t.raw}" sin contexto: no se usó.`);
    }
  }

  if (total === undefined && paid !== undefined && statedPending !== undefined) {
    total = paid + statedPending;
    warnings.push(`Total inferido como pagado + saldo = ${formatGs(total)}.`);
  }

  if (paid === undefined) {
    if (FULL_PAYMENT.test(lower) && total !== undefined) {
      paid = total;
    } else if (total !== undefined && statedPending !== undefined) {
      paid = total - statedPending;
      if (paid < 0) {
        errors.push(`El saldo mencionado (${formatGs(statedPending)}) supera el total (${formatGs(total)}).`);
        paid = undefined;
      }
    } else if (NOTHING_PAID.test(lower)) {
      paid = 0;
    } else if (total !== undefined) {
      paid = 0;
      warnings.push('No se mencionó pago inicial: se registra todo como saldo pendiente.');
    }
  }

  let pending: number | undefined;
  if (total !== undefined && paid !== undefined) {
    pending = total - paid;
    if (statedPending !== undefined && statedPending !== pending) {
      errors.push(
        `Inconsistencia: el saldo mencionado (${formatGs(statedPending)}) no coincide con total − pagado (${formatGs(pending)}).`,
      );
    }
  }

  const buyer = extractBuyer(text);
  const item = extractItem(text, buyer);

  if (total !== undefined) fields.total = total;
  if (paid !== undefined) fields.paid = paid;
  if (pending !== undefined) fields.pending = Math.max(0, pending);
  if (buyer) fields.buyer = buyer;
  if (item) fields.item = item;

  if (pending !== undefined && pending > 0 && !fields.dueDate) {
    warnings.push('Hay saldo pendiente pero no se detectó fecha de vencimiento.');
  }
  if (fields.dueDate && fields.dueDate < toIsoDate(today)) {
    warnings.push('La fecha de vencimiento detectada ya pasó.');
  }

  if (total === undefined) errors.push('No se detectó el monto total de la venta.');
  if (!buyer) errors.push('No se detectó el comprador (ej: "a Lucas").');
  if (!item) errors.push('No se detectó el ítem vendido (ej: "vendí un playset de Charizard").');

  if (errors.length > 0) return { ok: false, fields, errors: dedupe(errors), warnings };

  const candidate = {
    buyer: fields.buyer,
    item: fields.item,
    total: fields.total,
    paid: fields.paid,
    pending: fields.pending,
    ...(fields.dueDate && (fields.pending ?? 0) > 0 ? { dueDate: fields.dueDate } : {}),
    ...(fields.phone ? { phone: fields.phone } : {}),
  };
  const parsed = SaleDraftSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, fields, errors: dedupe(issueMessages(parsed.error)), warnings };
  }
  return { ok: true, draft: parsed.data, fields, warnings };
}

function dedupe(list: string[]): string[] {
  return [...new Set(list)];
}
