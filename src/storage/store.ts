import { AppStateSchema, emptyState, issueMessages, type AppState } from '../domain/schemas';

export const STORAGE_KEY = 'tcg-pro-ledger:v1';

/** Minimal subset of the Web Storage API so tests can inject a fake. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LoadResult {
  state: AppState;
  /** Set when stored data was unreadable; the raw blob is backed up. */
  recoveredFrom?: string;
}

/**
 * Loads and validates persisted state. Corrupted or schema-incompatible data
 * is never silently discarded: it is copied to a backup key and an empty
 * state is returned.
 */
export function loadState(storage: KeyValueStorage, now: () => number = Date.now): LoadResult {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return { state: emptyState() };
  let reason: string;
  try {
    const parsed = AppStateSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return { state: parsed.data };
    reason = issueMessages(parsed.error).slice(0, 3).join('; ');
  } catch {
    reason = 'JSON inválido';
  }
  const backupKey = `${STORAGE_KEY}:corrupt:${now()}`;
  storage.setItem(backupKey, raw);
  return { state: emptyState(), recoveredFrom: `${backupKey} (${reason})` };
}

export function saveState(storage: KeyValueStorage, state: AppState): void {
  const valid = AppStateSchema.parse(state);
  storage.setItem(STORAGE_KEY, JSON.stringify(valid));
}

/** Validates a JSON backup file before importing it. */
export function importState(json: string): { ok: true; state: AppState } | { ok: false; errors: string[] } {
  try {
    const parsed = AppStateSchema.safeParse(JSON.parse(json));
    return parsed.success ? { ok: true, state: parsed.data } : { ok: false, errors: issueMessages(parsed.error) };
  } catch {
    return { ok: false, errors: ['El archivo no es JSON válido'] };
  }
}
