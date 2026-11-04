import React, { useState } from 'react';
import { newId, summarizeReinvestment, todayIso } from '../domain/ledger';
import { formatGs } from '../domain/money';
import type { InventoryItem, Purchase } from '../domain/schemas';

interface ReinvestmentViewProps {
  purchases: Purchase[];
  inventory: InventoryItem[];
  onAddPurchase: (p: Purchase) => void;
  onDeletePurchase: (id: string) => void;
  onAddInventory: (item: InventoryItem) => void;
  onUpdateInventory: (item: InventoryItem) => void;
  onDeleteInventory: (id: string) => void;
  onConvertInventoryToSale: (item: InventoryItem, buyer: string, paidAmount: number, phone?: string, dueDate?: string) => void;
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

/** Single restock form: every card goes to the same stock. */
const RestockForm: React.FC<{ onAddInventory: (item: InventoryItem) => void }> = ({ onAddInventory }) => {
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

type StockActions = Pick<ReinvestmentViewProps, 'onUpdateInventory' | 'onDeleteInventory'> & {
  onSell: (item: InventoryItem) => void;
};

/** Item list with sell / reserve / delete actions (used per lot and for own stock). */
const StockTable: React.FC<{ items: InventoryItem[] } & StockActions> = ({ items, onSell, onUpdateInventory, onDeleteInventory }) => (
  <div className="table-wrapper" style={{ marginTop: '1rem' }}>
    <table>
      <thead>
        <tr>
          <th>Carta / producto</th>
          <th>Estado</th>
          <th style={{ textAlign: 'right' }}>Precio</th>
          <th style={{ textAlign: 'right' }}>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i) => (
          <tr key={i.id}>
            <td>
              {i.description}
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{i.category} · {i.createdAt}</div>
            </td>
            <td>{i.status === 'vendido' ? '✅ Vendido' : i.status === 'reservado' ? '⏳ Reservado' : '🟢 Disponible'}</td>
            <td style={{ textAlign: 'right' }}>{formatGs(i.price)}</td>
            <td style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {i.status !== 'vendido' && (
                  <>
                    <button className="btn btn-success" style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }} onClick={() => onSell(i)}>
                      ⚡ ¡Ya lo vendí!
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                      onClick={() => onUpdateInventory({ ...i, status: i.status === 'disponible' ? 'reservado' : 'disponible' })}
                    >
                      {i.status === 'disponible' ? 'Reservar' : 'Liberar'}
                    </button>
                  </>
                )}
                <button
                  className="btn btn-outline"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', color: '#ef4444' }}
                  title="Eliminar del stock"
                  onClick={() => {
                    if (window.confirm(`¿Eliminar "${i.description}" del stock?`)) onDeleteInventory(i.id);
                  }}
                >
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** Turns a stock item into a real sale; any unpaid part shows up in Dinero Colgado. */
const SellModal: React.FC<{
  item: InventoryItem;
  onClose: () => void;
  onConfirm: ReinvestmentViewProps['onConvertInventoryToSale'];
}> = ({ item, onClose, onConfirm }) => {
  const [buyer, setBuyer] = useState('');
  const [paid, setPaid] = useState(item.price.toString());
  const [phone, setPhone] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const paidNum = toAmount(paid || '0');

  const handleConfirm = () => {
    if (!buyer.trim()) return setError('Ingresa el nombre del comprador.');
    if (isNaN(paidNum) || paidNum < 0) return setError('El monto pagado no puede ser negativo.');
    if (paidNum > item.price) return setError(`Lo pagado (${paidNum}) no puede superar el precio (${item.price}).`);
    onConfirm(item, buyer.trim(), paidNum, phone.trim() || undefined, dueDate || undefined);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '480px', width: '100%', background: '#0f172a', borderColor: '#10b981' }}>
        <div className="card-title">
          <span>🎉 ¡Venta Concretada!</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1rem' }}>
          Vendés <strong>{item.description}</strong> por <strong style={{ color: '#10b981' }}>{formatGs(item.price)}</strong>. Si
          queda saldo sin pagar, pasa a 💸 Dinero Colgado.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>¿Quién te lo compró? *</label>
            <input type="text" placeholder="Ej: Lucas / Matías" value={buyer} onChange={(e) => setBuyer(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Teléfono de WhatsApp (opcional)</label>
            <input type="text" placeholder="Ej: 0981 123456" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>¿Cuánto te pagó ya? (Gs)</label>
            <input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} />
          </div>
          {paidNum < item.price && (
            <div>
              <label style={{ ...labelStyle, color: '#f59e0b' }}>Fecha límite para saldar la deuda (opcional)</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          )}
          {error && <div style={{ color: '#f87171', fontSize: '0.8rem' }}>⚠️ {error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn btn-success" onClick={handleConfirm}>
              ✓ Confirmar Venta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ReinvestmentView: React.FC<ReinvestmentViewProps> = ({
  purchases,
  inventory,
  onAddPurchase,
  onDeletePurchase,
  onAddInventory,
  onUpdateInventory,
  onDeleteInventory,
  onConvertInventoryToSale,
}) => {
  const [selling, setSelling] = useState<InventoryItem | null>(null);
  const [showSold, setShowSold] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<string>(todayIso());
  const [error, setError] = useState<string | null>(null);

  const s = summarizeReinvestment(purchases, inventory);
  const pct = s.invested > 0 ? Math.min(100, Math.round((s.soldValue / s.invested) * 100)) : 0;
  const soldCount = inventory.filter((i) => i.status === 'vendido').length;
  const visibleStock = showSold ? inventory : inventory.filter((i) => i.status !== 'vendido');
  const sortedPurchases = [...purchases].sort((a, b) => b.date.localeCompare(a.date));

  const handleAddPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = toAmount(amount);
    if (!desc.trim()) return setError('Ponle un nombre a lo que compraste (ej: Vex alter).');
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
          <div className="kpi-label">Total Reinvertido</div>
          <div className="kpi-value" style={{ color: '#f87171' }}>-{formatGs(s.invested)}</div>
          <div className="kpi-subtitle">{purchases.length} compra(s)</div>
        </div>
        <div className="kpi-card colgado">
          <div className="kpi-label">Stock por Vender</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>{formatGs(s.stockValue)}</div>
          <div className="kpi-subtitle">{inventory.length - soldCount} artículo(s) en stock</div>
        </div>
        <div className="kpi-card" style={{ borderColor: '#10b981' }}>
          <div className="kpi-label">Vendido</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>{formatGs(s.soldValue)}</div>
          <div className="kpi-subtitle">{soldCount} artículo(s) vendidos</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{s.recovered >= 0 ? '✓ Ganancia' : 'Falta Recuperar'}</div>
          <div className="kpi-value" style={{ color: s.recovered >= 0 ? '#10b981' : '#ef4444' }}>{signed(s.recovered)}</div>
          <div style={{ marginTop: '0.5rem', height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#10b981' }} />
          </div>
          <div className="kpi-subtitle">{pct}% recuperado</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span>💰 Cargar Reinversión</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '-0.5rem', marginBottom: '1rem' }}>
          Cada compra se suma al total reinvertido. Ponele un nombre para acordarte qué fue.
        </p>
        <form onSubmit={handleAddPurchase}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Nombre *</label>
              <input type="text" placeholder="Ej: Vex alter / Lote de cartas" value={desc} onChange={(e) => setDesc(e.target.value)} />
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
              ➕ Sumar
            </button>
          </div>
          {error && <div style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.5rem' }}>⚠️ {error}</div>}
        </form>

        {sortedPurchases.length > 0 && (
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Compra</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedPurchases.map((p) => (
                  <tr key={p.id}>
                    <td>{p.description}</td>
                    <td style={{ color: '#94a3b8' }}>{p.date}</td>
                    <td style={{ textAlign: 'right', color: '#f87171' }}>-{formatGs(p.amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: '#ef4444' }}
                        title="Eliminar compra"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar la compra "${p.description}"? El stock cargado se mantiene.`)) onDeletePurchase(p.id);
                        }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 800 }}>TOTAL</td>
                  <td></td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#f87171' }}>-{formatGs(s.invested)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <span>📦 Cargar Restock</span>
          <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => setShowSold((v) => !v)}>
            {showSold ? 'Ocultar vendidos' : `Ver vendidos (${soldCount})`}
          </button>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '-0.5rem' }}>
          Todas las cartas y productos que tenés para vender, en una sola lista.
        </p>
        <RestockForm onAddInventory={onAddInventory} />
        {visibleStock.length > 0 ? (
          <StockTable items={visibleStock} onSell={setSelling} onUpdateInventory={onUpdateInventory} onDeleteInventory={onDeleteInventory} />
        ) : (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '1.5rem' }}>No hay stock cargado todavía.</div>
        )}
      </div>

      {selling && <SellModal item={selling} onClose={() => setSelling(null)} onConfirm={onConvertInventoryToSale} />}
    </div>
  );
};
