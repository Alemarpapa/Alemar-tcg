import React, { useState } from 'react';
import { newId, summarizePurchase, todayIso } from '../domain/ledger';
import { formatGs } from '../domain/money';
import type { InventoryItem, Purchase } from '../domain/schemas';

interface ReinvestmentViewProps {
  purchases: Purchase[];
  inventory: InventoryItem[];
  onAddPurchase: (p: Purchase) => void;
  onDeletePurchase: (id: string) => void;
  onAddInventory: (item: InventoryItem) => void;
}

const labelStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' };
const selectStyle: React.CSSProperties = {
  width: '100%',
  background: '#1e293b',
  color: '#f8fafc',
  border: '1px solid #334155',
  borderRadius: '0.5rem',
  padding: '0.6rem',
};
const signed = (n: number) => (n >= 0 ? `+${formatGs(n)}` : formatGs(n));
const toAmount = (raw: string) => parseInt(raw.replace(/\D/g, ''), 10);

/** Form to stock one card/product from a lot into "Stock por Vender". */
const StockFromLotForm: React.FC<{ purchase: Purchase; onAddInventory: (item: InventoryItem) => void }> = ({
  purchase,
  onAddInventory,
}) => {
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('Carta Suelta');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = toAmount(price);
    if (!desc.trim()) return setError('Ingresa el nombre de la carta o producto.');
    if (isNaN(parsed) || parsed <= 0) return setError('Ingresa un precio de venta mayor a 0.');
    setError(null);
    onAddInventory({
      id: newId(),
      description: desc.trim(),
      category,
      price: parsed,
      status: 'disponible',
      createdAt: todayIso(),
      purchaseId: purchase.id,
      notes: `Del lote: ${purchase.description}`,
    });
    setDesc('');
    setPrice('');
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>Carta / producto a stockear *</label>
          <input type="text" placeholder="Ej: Charizard ex SIR" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Categoría</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
            <option value="Carta Suelta">🃏 Carta Suelta / Single</option>
            <option value="Mazo / Lote">📦 Mazo / Lote de Cartas</option>
            <option value="Carpeta">📁 Carpeta</option>
            <option value="Sellado">🎁 Producto Sellado</option>
            <option value="Accesorio">🛡️ Accesorio</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Precio de venta (Gs) *</label>
          <input type="number" placeholder="Ej: 50000" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1rem' }}>
          📦 Stockear
        </button>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.5rem' }}>⚠️ {error}</div>}
    </form>
  );
};

export const ReinvestmentView: React.FC<ReinvestmentViewProps> = ({
  purchases,
  inventory,
  onAddPurchase,
  onDeletePurchase,
  onAddInventory,
}) => {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<string>(todayIso());
  const [error, setError] = useState<string | null>(null);

  const summaries = purchases.map((p) => ({ purchase: p, summary: summarizePurchase(p, inventory) }));
  const totals = summaries.reduce(
    (acc, { summary: s }) => ({
      invested: acc.invested + s.invested,
      stockValue: acc.stockValue + s.stockValue,
      soldValue: acc.soldValue + s.soldValue,
    }),
    { invested: 0, stockValue: 0, soldValue: 0 },
  );
  const totalRecovered = totals.soldValue - totals.invested;

  const handleAddPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = toAmount(amount);
    if (!desc.trim()) return setError('Ingresa qué compraste (ej: Lote de 200 cartas).');
    if (isNaN(parsed) || parsed <= 0) return setError('Ingresa el monto invertido mayor a 0.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Ingresa una fecha válida.');
    setError(null);
    onAddPurchase({ id: newId(), description: desc.trim(), amount: parsed, date });
    setDesc('');
    setAmount('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderColor: '#ef4444' }}>
          <div className="kpi-label">Dinero Reinvertido</div>
          <div className="kpi-value" style={{ color: '#f87171' }}>-{formatGs(totals.invested)}</div>
          <div className="kpi-subtitle">{purchases.length} lote(s) comprados</div>
        </div>
        <div className="kpi-card colgado">
          <div className="kpi-label">Stock de Lotes por Vender</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>{formatGs(totals.stockValue)}</div>
          <div className="kpi-subtitle">Valor esperado de venta</div>
        </div>
        <div className="kpi-card" style={{ borderColor: '#10b981' }}>
          <div className="kpi-label">Vendido de Lotes</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>{formatGs(totals.soldValue)}</div>
          <div className="kpi-subtitle">Cartas de lotes ya vendidas</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Recuperación Neta</div>
          <div className="kpi-value" style={{ color: totalRecovered >= 0 ? '#10b981' : '#ef4444' }}>
            {signed(totalRecovered)}
          </div>
          <div className="kpi-subtitle">Vendido − reinvertido</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span>🔄 Registrar Reinversión (Compra de Lote / Cartas)</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '-0.5rem', marginBottom: '1rem' }}>
          Registra la plata que pones en mercadería para revender. Sale como dinero negativo del mes y se va recuperando a
          medida que stockeas y vendes sus cartas.
        </p>
        <form onSubmit={handleAddPurchase}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>¿Qué compraste? *</label>
              <input type="text" placeholder="Ej: Lote de cartas para restock" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Monto invertido (Gs) *</label>
              <input type="number" placeholder="Ej: 180000" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1rem' }}>
              💾 Registrar Compra
            </button>
          </div>
          {error && <div style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.5rem' }}>⚠️ {error}</div>}
        </form>
      </div>

      {summaries.length === 0 && (
        <div className="card" style={{ color: '#94a3b8', textAlign: 'center' }}>
          Todavía no registraste compras. Cuando compres un lote, cargalo arriba y después stockea sus cartas.
        </div>
      )}

      {summaries.map(({ purchase, summary }) => {
        const items = inventory.filter((i) => i.purchaseId === purchase.id);
        const pct = Math.min(100, Math.round((summary.soldValue / summary.invested) * 100));
        return (
          <div className="card" key={purchase.id}>
            <div className="card-title" style={{ justifyContent: 'space-between' }}>
              <span>📦 {purchase.description}</span>
              <button
                className="btn btn-outline"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: '#ef4444' }}
                title="Eliminar compra"
                onClick={() => {
                  if (window.confirm(`¿Eliminar la compra "${purchase.description}"? Sus cartas stockeadas se mantienen en Stock por Vender.`)) {
                    onDeletePurchase(purchase.id);
                  }
                }}
              >
                🗑️
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.9rem' }}>
              <span>📅 {purchase.date}</span>
              <span style={{ color: '#f87171', fontWeight: 700 }}>Invertido: -{formatGs(summary.invested)}</span>
              <span style={{ color: '#f59e0b' }}>En stock: {formatGs(summary.stockValue)}</span>
              <span style={{ color: '#10b981' }}>Vendido: {formatGs(summary.soldValue)}</span>
              <span style={{ fontWeight: 800, color: summary.recovered >= 0 ? '#10b981' : '#ef4444' }}>
                {summary.recovered >= 0 ? '✓ Ganancia' : 'Falta recuperar'}: {signed(summary.recovered)}
              </span>
            </div>
            <div style={{ marginTop: '0.75rem', height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#10b981' }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>{pct}% recuperado</div>

            {items.length > 0 && (
              <div className="table-wrapper" style={{ marginTop: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Carta / producto</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'right' }}>Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.description}</td>
                        <td>{i.status === 'vendido' ? '✅ Vendido' : i.status === 'reservado' ? '⏳ Reservado' : '🟢 Disponible'}</td>
                        <td style={{ textAlign: 'right' }}>{formatGs(i.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <StockFromLotForm purchase={purchase} onAddInventory={onAddInventory} />
          </div>
        );
      })}
    </div>
  );
};
