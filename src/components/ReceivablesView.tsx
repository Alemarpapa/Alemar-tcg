import React, { useState } from 'react';
import {
  summarizeReceivables,
  collectedThisMonth,
  todayIso,
  saleStatus,
  saleBalance,
  salePaid,
  registerPayment,
  summarizeInventory,
  newId,
} from '../domain/ledger';
import { formatGs } from '../domain/money';
import { buildReminderMessage, whatsappLink } from '../domain/whatsapp';
import type { Sale, InventoryItem } from '../domain/schemas';

interface ReceivablesViewProps {
  sales: Sale[];
  inventory?: InventoryItem[];
  onUpdateSale: (updated: Sale) => void;
  onDeleteSale: (id: string) => void;
  onAddInventory?: (item: InventoryItem) => void;
  onUpdateInventory?: (item: InventoryItem) => void;
  onDeleteInventory?: (id: string) => void;
  onConvertInventoryToSale?: (
    item: InventoryItem,
    buyer: string,
    paidAmount: number,
    phone?: string,
    dueDate?: string,
  ) => void;
}

export const ReceivablesView: React.FC<ReceivablesViewProps> = ({
  sales,
  inventory = [],
  onUpdateSale,
  onDeleteSale,
  onAddInventory,
  onUpdateInventory,
  onDeleteInventory,
  onConvertInventoryToSale,
}) => {
  const today = todayIso();
  const summary = summarizeReceivables(sales, today);
  const thisMonth = collectedThisMonth(sales, today);
  const invSummary = summarizeInventory(inventory);

  const [activeSection, setActiveSection] = useState<'deudas' | 'stock'>('deudas');

  // Deudas state
  const [filter, setFilter] = useState<'todos' | 'colgado' | 'vencido' | 'pagado'>('colgado');
  const [search, setSearch] = useState('');
  const [activePaymentSaleId, setActivePaymentSaleId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stock / Inventario por vender state
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<string>('Carpeta');
  const [newPrice, setNewPrice] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [invError, setInvError] = useState<string | null>(null);
  const [invFilter, setInvFilter] = useState<'activos' | 'disponible' | 'reservado' | 'vendido' | 'todos'>('activos');

  // Sell modal state
  const [sellingItem, setSellingItem] = useState<InventoryItem | null>(null);
  const [sellBuyer, setSellBuyer] = useState('');
  const [sellPaid, setSellPaid] = useState('');
  const [sellPhone, setSellPhone] = useState('');
  const [sellDueDate, setSellDueDate] = useState('');
  const [sellError, setSellError] = useState<string | null>(null);

  const filteredSales = sales.filter((sale) => {
    const status = saleStatus(sale, today);
    const balance = saleBalance(sale);

    if (filter === 'colgado' && balance === 0) return false;
    if (filter === 'vencido' && status !== 'vencido') return false;
    if (filter === 'pagado' && balance > 0) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        sale.buyer.toLowerCase().includes(q) ||
        sale.item.toLowerCase().includes(q) ||
        (sale.phone && sale.phone.includes(q))
      );
    }
    return true;
  });

  const handleApplyPayment = (sale: Sale) => {
    setErrorMsg(null);
    const amountNum = parseInt(paymentAmount.replace(/\D/g, ''), 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg('Ingresa un monto válido.');
      return;
    }
    const res = registerPayment(sale, amountNum, today, paymentNote.trim() || undefined);
    if (!res.ok) {
      setErrorMsg(res.errors.join('; '));
      return;
    }
    onUpdateSale(res.value);
    setActivePaymentSaleId(null);
    setPaymentAmount('');
    setPaymentNote('');
  };

  const handleCreateInventoryItem = (e: React.FormEvent) => {
    e.preventDefault();
    setInvError(null);
    const parsedPrice = parseInt(newPrice.replace(/\D/g, ''), 10);
    if (!newDesc.trim()) {
      setInvError('Ingresa el nombre o descripción del artículo (ej: Carpeta 9 bolsillos).');
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setInvError('Ingresa un precio esperado de venta mayor a 0.');
      return;
    }

    const newItem: InventoryItem = {
      id: newId(),
      description: newDesc.trim(),
      category: newCategory,
      price: parsedPrice,
      status: 'disponible',
      createdAt: today,
      notes: newNotes.trim() || undefined,
    };

    if (onAddInventory) {
      onAddInventory(newItem);
    }

    setNewDesc('');
    setNewPrice('');
    setNewNotes('');
  };

  const handleStartSell = (item: InventoryItem) => {
    setSellingItem(item);
    setSellBuyer('');
    setSellPaid(item.price.toString());
    setSellPhone('');
    setSellDueDate('');
    setSellError(null);
  };

  const handleConfirmSell = () => {
    if (!sellingItem) return;
    setSellError(null);

    if (!sellBuyer.trim()) {
      setSellError('Ingresa el nombre del comprador.');
      return;
    }
    const paidNum = parseInt(sellPaid.replace(/\D/g, '') || '0', 10);
    if (isNaN(paidNum) || paidNum < 0) {
      setSellError('El monto pagado no puede ser negativo.');
      return;
    }
    if (paidNum > sellingItem.price) {
      setSellError(`Lo pagado (${paidNum}) no puede superar el precio (${sellingItem.price}).`);
      return;
    }

    if (onConvertInventoryToSale) {
      onConvertInventoryToSale(
        sellingItem,
        sellBuyer.trim(),
        paidNum,
        sellPhone.trim() || undefined,
        sellDueDate || undefined,
      );
    }

    setSellingItem(null);
  };

  const filteredInventory = inventory.filter((item) => {
    if (invFilter === 'activos') return item.status !== 'vendido';
    if (invFilter === 'disponible') return item.status === 'disponible';
    if (invFilter === 'reservado') return item.status === 'reservado';
    if (invFilter === 'vendido') return item.status === 'vendido';
    return true;
  });

  return (
    <div>
      {/* Section Switcher: Deudas vs Stock */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeSection === 'deudas' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', fontWeight: 700 }}
          onClick={() => setActiveSection('deudas')}
        >
          💳 Deudas de Clientes ({sales.filter((s) => saleBalance(s) > 0).length})
        </button>
        <button
          className={`btn ${activeSection === 'stock' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', fontWeight: 700 }}
          onClick={() => setActiveSection('stock')}
        >
          📦 Stock por Vender / Plata Parada ({invSummary.availableCount + invSummary.reservedCount})
        </button>
      </div>

      {/* Global Dinero Colgado Combined Banner */}
      <div className="kpi-grid">
        <div className="kpi-card colgado">
          <div className="kpi-label">Plata Parada en Stock</div>
          <div className="kpi-value" style={{ color: '#38bdf8' }}>
            {formatGs(invSummary.totalValue)}
          </div>
          <div className="kpi-subtitle">
            {invSummary.availableCount} disponible{invSummary.availableCount === 1 ? '' : 's'} (Carpetas, singles, etc.)
          </div>
        </div>

        <div className="kpi-card colgado">
          <div className="kpi-label">Deudas Pendientes de Clientes</div>
          <div className="kpi-value" style={{ color: '#ef4444' }}>
            {formatGs(summary.outstanding)}
          </div>
          <div className="kpi-subtitle">
            {summary.byBuyer.length} compradores con saldo colgado
          </div>
        </div>

        <div className="kpi-card" style={{ borderColor: '#f59e0b' }}>
          <div className="kpi-label">Plata Colgada Consolidada</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>
            {formatGs(summary.outstanding + invSummary.totalValue)}
          </div>
          <div className="kpi-subtitle">Stock por vender + deudas a cobrar</div>
        </div>

        <div className="kpi-card cobrado">
          <div className="kpi-label">Cobrado este Mes</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>
            {formatGs(thisMonth)}
          </div>
          <div className="kpi-subtitle">Total cobrado: {formatGs(summary.totalCollected)}</div>
        </div>
      </div>

      {/* SECTION 1: DEUDAS DE CLIENTES */}
      {activeSection === 'deudas' && (
        <div className="card">
          <div className="card-title">
            <span>Libro de Cuentas por Cobrar (Deudas)</span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className={`btn ${filter === 'colgado' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                onClick={() => setFilter('colgado')}
              >
                Colgado ({sales.filter((s) => saleBalance(s) > 0).length})
              </button>
              <button
                className={`btn ${filter === 'vencido' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                onClick={() => setFilter('vencido')}
              >
                Vencidos ({sales.filter((s) => saleStatus(s, today) === 'vencido').length})
              </button>
              <button
                className={`btn ${filter === 'pagado' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                onClick={() => setFilter('pagado')}
              >
                Saldados
              </button>
              <button
                className={`btn ${filter === 'todos' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                onClick={() => setFilter('todos')}
              >
                Todos ({sales.length})
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Buscar por comprador, carta o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filteredSales.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
              No se encontraron ventas para este filtro.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Comprador &amp; Carta</th>
                    <th>Total &amp; Avance</th>
                    <th>Dinero Colgado</th>
                    <th>Estado / Vence</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => {
                    const balance = saleBalance(sale);
                    const paid = salePaid(sale);
                    const status = saleStatus(sale, today);
                    const pct = Math.round((paid / sale.total) * 100);
                    const reminderText = buildReminderMessage(sale, today);
                    const waUrl = whatsappLink(reminderText, sale.phone);

                    return (
                      <React.Fragment key={sale.id}>
                        <tr>
                          <td>
                            <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
                              {sale.buyer}
                            </div>
                            <div style={{ color: '#38bdf8', fontSize: '0.85rem' }}>{sale.item}</div>
                            {sale.phone && (
                              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                📞 {sale.phone}
                              </div>
                            )}
                          </td>
                          <td style={{ minWidth: '140px' }}>
                            <div style={{ fontWeight: 600 }}>{formatGs(sale.total)}</div>
                            <div style={{ fontSize: '0.75rem', color: '#10b981' }}>
                              Pagado: {formatGs(paid)} ({pct}%)
                            </div>
                            <div className="progress-bar-bg">
                              <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                          <td>
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: '1.05rem',
                                color: balance > 0 ? '#ef4444' : '#10b981',
                              }}
                            >
                              {balance > 0 ? formatGs(balance) : '0 (Saldado)'}
                            </div>
                          </td>
                          <td>
                            <span className={`badge badge-${status}`}>
                              {status === 'vencido'
                                ? 'Vencido'
                                : status === 'por_vencer'
                                ? 'Por vencer'
                                : status === 'pagado'
                                ? 'Pagado'
                                : 'Pendiente'}
                            </span>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                              {sale.dueDate ? `Límite: ${sale.dueDate}` : 'Sin límite'}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {balance > 0 && (
                                <button
                                  className="btn btn-primary"
                                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                                  onClick={() => {
                                    setActivePaymentSaleId(
                                      activePaymentSaleId === sale.id ? null : sale.id
                                    );
                                    setPaymentAmount(balance.toString());
                                  }}
                                >
                                  💵 Cobrar
                                </button>
                              )}

                              {balance > 0 && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-whatsapp"
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '0.35rem 0.6rem',
                                    textDecoration: 'none',
                                  }}
                                >
                                  💬 WhatsApp
                                </a>
                              )}

                              <button
                                className="btn btn-outline"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.35rem 0.5rem',
                                  color: '#ef4444',
                                }}
                                onClick={() => {
                                  if (confirm(`¿Eliminar la venta de "${sale.item}" a ${sale.buyer}?`)) {
                                    onDeleteSale(sale.id);
                                  }
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Payment Modal/Row */}
                        {activePaymentSaleId === sale.id && (
                          <tr>
                            <td colSpan={5} style={{ background: '#1e293b', padding: '1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#38bdf8' }}>
                                  Registrar Cobro / Entrega de {sale.buyer} (Saldo actual: {formatGs(balance)})
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <input
                                    type="number"
                                    placeholder="Monto en Gs (ej: 100000)"
                                    style={{ maxWidth: '200px' }}
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                  />
                                  <input
                                    type="text"
                                    placeholder="Nota (ej: Transferencia Ueno / Efectivo)"
                                    style={{ maxWidth: '280px' }}
                                    value={paymentNote}
                                    onChange={(e) => setPaymentNote(e.target.value)}
                                  />
                                  <button
                                    className="btn btn-success"
                                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}
                                    onClick={() => handleApplyPayment(sale)}
                                  >
                                    Registrar Pago
                                  </button>
                                  <button
                                    className="btn btn-outline"
                                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                                    onClick={() => setActivePaymentSaleId(null)}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                                {errorMsg && (
                                  <div style={{ color: '#f87171', fontSize: '0.75rem' }}>{errorMsg}</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: STOCK / ARTÍCULOS POR VENDER (PLATA PARADA) */}
      {activeSection === 'stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Form to Register Item for Sale */}
          <div className="card">
            <div className="card-title">
              <span>📦 Registrar Artículo / Carta / Carpeta por Vender (Plata Parada)</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '-0.5rem', marginBottom: '1rem' }}>
              Registra artículos que tienes listos para vender (ej: carpeta a 150 mil o singles) para saber exactamente cuánto dinero tienes parado en mercadería.
            </p>

            <form onSubmit={handleCreateInventoryItem}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                    Descripción o Nombre del Artículo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Carpeta 9 bolsillos con hojas / Playset Mewtwo ex"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                    Categoría
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      borderRadius: '0.5rem',
                      padding: '0.6rem',
                    }}
                  >
                    <option value="Carpeta">📁 Carpeta</option>
                    <option value="Carta Suelta">🃏 Carta Suelta / Single</option>
                    <option value="Mazo / Lote">📦 Mazo / Lote de Cartas</option>
                    <option value="Accesorio">🛡️ Accesorio (Fundas/Playmat)</option>
                    <option value="Sellado">🎁 Producto Sellado (Sobres/ETB)</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                    Precio Esperado de Venta (Gs) *
                  </label>
                  <input
                    type="number"
                    placeholder="Ej: 150000"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Notas adicionales (opcional, ej: estado NM, incluye 10 hojas Ultra Pro)..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>

              {invError && (
                <div style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  ⚠️ {invError}
                </div>
              )}

              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem' }}>
                  + Guardar en Stock por Vender
                </button>
              </div>
            </form>
          </div>

          {/* Unsold Items Table */}
          <div className="card">
            <div className="card-title">
              <span>Inventario en Espera de Venta</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  className={`btn ${invFilter === 'activos' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => setInvFilter('activos')}
                >
                  Por Vender ({invSummary.availableCount + invSummary.reservedCount})
                </button>
                <button
                  className={`btn ${invFilter === 'disponible' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => setInvFilter('disponible')}
                >
                  Disponibles ({invSummary.availableCount})
                </button>
                <button
                  className={`btn ${invFilter === 'reservado' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => setInvFilter('reservado')}
                >
                  Reservados ({invSummary.reservedCount})
                </button>
                <button
                  className={`btn ${invFilter === 'vendido' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => setInvFilter('vendido')}
                >
                  Vendidos ({invSummary.soldCount})
                </button>
              </div>
            </div>

            {filteredInventory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                No tienes artículos registrados en esta sección.
                <br />
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Usa el formulario superior para registrar tus carpetas o cartas que quieras vender.
                </span>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Artículo &amp; Categoría</th>
                      <th>Fecha Registro</th>
                      <th style={{ textAlign: 'right' }}>Precio Esperado</th>
                      <th style={{ textAlign: 'center' }}>Estado</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
                            {item.description}
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.2rem' }}>
                            <span
                              className="badge"
                              style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', fontSize: '0.7rem' }}
                            >
                              {item.category}
                            </span>
                            {item.notes && (
                              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                • {item.notes}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                          {item.createdAt}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1rem', color: '#38bdf8' }}>
                          {formatGs(item.price)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className="badge"
                            style={{
                              background:
                                item.status === 'disponible'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : item.status === 'reservado'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(100, 116, 139, 0.2)',
                              color:
                                item.status === 'disponible'
                                  ? '#10b981'
                                  : item.status === 'reservado'
                                  ? '#f59e0b'
                                  : '#94a3b8',
                            }}
                          >
                            {item.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {item.status !== 'vendido' && (
                              <>
                                <button
                                  className="btn btn-success"
                                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                                  onClick={() => handleStartSell(item)}
                                >
                                  ⚡ ¡Ya lo vendí!
                                </button>
                                <button
                                  className="btn btn-outline"
                                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                                  onClick={() => {
                                    if (onUpdateInventory) {
                                      onUpdateInventory({
                                        ...item,
                                        status: item.status === 'disponible' ? 'reservado' : 'disponible',
                                      });
                                    }
                                  }}
                                >
                                  {item.status === 'disponible' ? 'Reservar' : 'Liberar'}
                                </button>
                              </>
                            )}

                            <button
                              className="btn btn-outline"
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', color: '#ef4444' }}
                              onClick={() => {
                                if (confirm(`¿Eliminar "${item.description}" del stock?`)) {
                                  if (onDeleteInventory) onDeleteInventory(item.id);
                                }
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
            )}
          </div>
        </div>
      )}

      {/* Sell Modal / Dialog: Convert Inventory Item into Real Sale */}
      {sellingItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '480px',
              width: '100%',
              background: '#0f172a',
              borderColor: '#10b981',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div className="card-title">
              <span>🎉 ¡Venta Concretada! Pasar al Libro</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1rem' }}>
              Estás registrando la venta de <strong>{sellingItem.description}</strong> por un total de{' '}
              <strong style={{ color: '#10b981' }}>{formatGs(sellingItem.price)}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                  ¿Quién te lo compró? (Nombre del comprador) *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Lucas / Matías"
                  value={sellBuyer}
                  onChange={(e) => setSellBuyer(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                  Teléfono de WhatsApp (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: 0981 123456"
                  value={sellPhone}
                  onChange={(e) => setSellPhone(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                  ¿Cuánto te pagó ya? (Gs)
                </label>
                <input
                  type="number"
                  placeholder={`Ej: ${sellingItem.price}`}
                  value={sellPaid}
                  onChange={(e) => setSellPaid(e.target.value)}
                />
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  Si te pagó todo, déjalo en {formatGs(sellingItem.price)}. Si te pagó una seña o es a crédito, pon lo cobrado.
                </div>
              </div>

              {parseInt(sellPaid || '0', 10) < sellingItem.price && (
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'block', marginBottom: '0.2rem' }}>
                    Fecha límite para saldar la deuda restante (opcional)
                  </label>
                  <input
                    type="date"
                    value={sellDueDate}
                    onChange={(e) => setSellDueDate(e.target.value)}
                  />
                </div>
              )}

              {sellError && (
                <div style={{ color: '#f87171', fontSize: '0.8rem' }}>
                  ⚠️ {sellError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setSellingItem(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleConfirmSell}
                >
                  ✓ Confirmar Venta &amp; Pasar a Libro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
