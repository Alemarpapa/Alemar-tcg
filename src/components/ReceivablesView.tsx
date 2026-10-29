import React, { useState } from 'react';
import {
  summarizeReceivables,
  collectedThisMonth,
  todayIso,
  saleStatus,
  saleBalance,
  salePaid,
  registerPayment,
} from '../domain/ledger';
import { formatGs } from '../domain/money';
import { buildReminderMessage, whatsappLink } from '../domain/whatsapp';
import type { Sale } from '../domain/schemas';

interface ReceivablesViewProps {
  sales: Sale[];
  onUpdateSale: (updated: Sale) => void;
  onDeleteSale: (id: string) => void;
}

export const ReceivablesView: React.FC<ReceivablesViewProps> = ({
  sales,
  onUpdateSale,
  onDeleteSale,
}) => {
  const today = todayIso();
  const summary = summarizeReceivables(sales, today);
  const thisMonth = collectedThisMonth(sales, today);

  const [filter, setFilter] = useState<'todos' | 'colgado' | 'vencido' | 'pagado'>('colgado');
  const [search, setSearch] = useState('');
  const [activePaymentSaleId, setActivePaymentSaleId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  return (
    <div>
      {/* KPI Summary Cards */}
      <div className="kpi-grid">
        <div className="kpi-card colgado">
          <div className="kpi-label">Dinero Colgado Total</div>
          <div className="kpi-value" style={{ color: '#ef4444' }}>
            {formatGs(summary.outstanding)}
          </div>
          <div className="kpi-subtitle">
            {summary.byBuyer.length} compradores con saldo pendiente
          </div>
        </div>

        <div className="kpi-card colgado">
          <div className="kpi-label">Saldo Vencido (Mora)</div>
          <div className="kpi-value" style={{ color: '#f87171' }}>
            {formatGs(summary.overdue)}
          </div>
          <div className="kpi-subtitle">Plazo límite ya superado</div>
        </div>

        <div className="kpi-card" style={{ borderColor: '#f59e0b' }}>
          <div className="kpi-label">Por Vencer (&le; 3 días)</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>
            {formatGs(summary.dueSoon)}
          </div>
          <div className="kpi-subtitle">Vencimientos inmediatos</div>
        </div>

        <div className="kpi-card cobrado">
          <div className="kpi-label">Cobrado este Mes</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>
            {formatGs(thisMonth)}
          </div>
          <div className="kpi-subtitle">Total cobrado histórico: {formatGs(summary.totalCollected)}</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="card-title">
          <span>Libro de Ventas y Cobranzas</span>
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
              Vencidos
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
    </div>
  );
};
