import React from 'react';
import { summarizeReceivables } from '../domain/ledger';
import { seasonSummary } from '../domain/tournaments';
import { formatGs } from '../domain/money';
import { todayIso } from '../domain/ledger';
import type { Sale, Tournament, ExpenseItem } from '../domain/schemas';

interface BalanceTotalViewProps {
  sales: Sale[];
  tournaments: Tournament[];
  expenses: ExpenseItem[];
  onNavigate: (tab: 'intake' | 'receivables' | 'tournaments') => void;
}

export const BalanceTotalView: React.FC<BalanceTotalViewProps> = ({
  sales,
  tournaments,
  expenses = [],
  onNavigate,
}) => {
  const today = todayIso();
  const rec = summarizeReceivables(sales, today);
  const tour = seasonSummary(tournaments);

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

  // Total cash collected from sales + tournament cash + tournament product prizes
  const totalRevenue = rec.totalCollected + tour.revenue;

  // Total costs: tournament entries + accessories/extra expenses
  const totalCosts = tour.costs + totalExpenses;

  // Net Consolidated Balance (Current realized earnings)
  const netBalance = totalRevenue - totalCosts;

  // Liquid Cash in hand (Cash sales + Cash tournament prizes - all costs)
  const liquidCash = (rec.totalCollected + tour.cashRevenue) - totalCosts;

  // Potential Max Net (if 100% of outstanding debt is collected)
  const potentialNet = netBalance + rec.outstanding;

  // Collection efficiency rate
  const collectionRate = rec.totalSold > 0 ? Math.round((rec.totalCollected / rec.totalSold) * 100) : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner: Global Net Balance */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
          borderColor: netBalance >= 0 ? '#10b981' : '#ef4444',
          padding: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '1.2rem' }}>💎</span>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>
                Balance Consolidado Global • Alemar TCG
              </span>
            </div>
            <div
              style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                color: netBalance >= 0 ? '#10b981' : '#ef4444',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              {netBalance >= 0 ? `+${formatGs(netBalance)}` : formatGs(netBalance)}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.6rem' }}>
              Efectivo Líquido Real en Mano:{' '}
              <strong style={{ color: liquidCash >= 0 ? '#38bdf8' : '#f87171' }}>
                {liquidCash >= 0 ? `+${formatGs(liquidCash)}` : formatGs(liquidCash)}
              </strong>{' '}
              | Premios en Producto:{' '}
              <strong style={{ color: '#a78bfa' }}>{formatGs(tour.productRevenue)}</strong>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              padding: '1rem 1.25rem',
              borderRadius: '0.75rem',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              minWidth: '220px',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Potencial Máximo al Cobrar Todo
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
              +{formatGs(potentialNet)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem' }}>
              Sumando {formatGs(rec.outstanding)} de dinero colgado
            </div>
          </div>
        </div>
      </div>

      {/* 4 Core Financial Pillar KPIs */}
      <div className="kpi-grid">
        {/* Pillar 1: Sales Collected */}
        <div className="kpi-card cobrado">
          <div className="kpi-label">Ventas Cobradas (Efectivo)</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>
            {formatGs(rec.totalCollected)}
          </div>
          <div className="kpi-subtitle">
            Facturado total: <strong>{formatGs(rec.totalSold)}</strong> ({collectionRate}% cobrado)
          </div>
        </div>

        {/* Pillar 2: Money Still Owed */}
        <div className="kpi-card colgado">
          <div className="kpi-label">Dinero Colgado (Pendiente)</div>
          <div className="kpi-value" style={{ color: rec.outstanding > 0 ? '#f59e0b' : '#10b981' }}>
            {formatGs(rec.outstanding)}
          </div>
          <div className="kpi-subtitle">
            {rec.overdue > 0 ? (
              <span style={{ color: '#f87171' }}>⚠️ {formatGs(rec.overdue)} en mora vencida</span>
            ) : (
              'Sin deudas vencidas'
            )}
          </div>
        </div>

        {/* Pillar 3: Tournament P&L */}
        <div className="kpi-card torneos">
          <div className="kpi-label">Ganancia Neta Torneos</div>
          <div
            className="kpi-value"
            style={{ color: tour.net >= 0 ? '#10b981' : '#ef4444' }}
          >
            {tour.net >= 0 ? `+${formatGs(tour.net)}` : formatGs(tour.net)}
          </div>
          <div className="kpi-subtitle">
            Premios: {formatGs(tour.revenue)} | Entradas: {formatGs(tour.costs)}
          </div>
        </div>

        {/* Pillar 4: Accessories & Costs */}
        <div className="kpi-card" style={{ borderColor: '#8b5cf6' }}>
          <div className="kpi-label">Insumos &amp; Accesorios</div>
          <div className="kpi-value" style={{ color: '#a78bfa' }}>
            {formatGs(totalExpenses)}
          </div>
          <div className="kpi-subtitle">
            {expenses.length} compra{expenses.length === 1 ? '' : 's'} (Fundas, Playmats, etc.)
          </div>
        </div>
      </div>

      {/* Financial Breakdown & Cashflow Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Left: Summary Breakdown Table */}
        <div className="card">
          <div className="card-title">
            <span>📋 Resumen de Flujo de Fondos</span>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ventas Efectivamente Cobradas</td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                      Ingreso
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                    +{formatGs(rec.totalCollected)}
                  </td>
                </tr>
                <tr>
                  <td>Premios Torneos (Efectivo)</td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                      Ingreso
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                    +{formatGs(tour.cashRevenue)}
                  </td>
                </tr>
                <tr>
                  <td>Premios Torneos (Sobres / Cartas)</td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                      Activo
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                    +{formatGs(tour.productRevenue)}
                  </td>
                </tr>
                <tr>
                  <td>Inscripciones a Torneos</td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                      Egreso
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f87171' }}>
                    -{formatGs(tour.costs)}
                  </td>
                </tr>
                <tr>
                  <td>Gastos en Accesorios &amp; Insumos</td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                      Egreso
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f87171' }}>
                    -{formatGs(totalExpenses)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid rgba(255, 255, 255, 0.15)' }}>
                  <td style={{ fontWeight: 800, color: '#fff' }}>TOTAL NETO REALIZADO</td>
                  <td></td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 900,
                      fontSize: '1.1rem',
                      color: netBalance >= 0 ? '#10b981' : '#ef4444',
                    }}
                  >
                    {netBalance >= 0 ? `+${formatGs(netBalance)}` : formatGs(netBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Right: Health Metrics & Quick Actions */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-title">
              <span>📊 Salud Financiera &amp; Cobranza</span>
            </div>

            {/* Collection Health Bar */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span style={{ color: '#94a3b8' }}>Efectividad de Cobro de Ventas</span>
                <strong style={{ color: collectionRate >= 80 ? '#10b981' : '#f59e0b' }}>
                  {collectionRate}% ({formatGs(rec.totalCollected)} de {formatGs(rec.totalSold)})
                </strong>
              </div>
              <div style={{ height: '10px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, collectionRate))}%`,
                    background: collectionRate >= 80 ? '#10b981' : '#f59e0b',
                    borderRadius: '999px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            {/* Competitive Win Rate Bar */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span style={{ color: '#94a3b8' }}>Tasa de Torneos con Ganancia</span>
                <strong style={{ color: '#38bdf8' }}>
                  {tour.count > 0 ? Math.round((tour.profitable / tour.count) * 100) : 0}% ({tour.profitable} de {tour.count})
                </strong>
              </div>
              <div style={{ height: '10px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${tour.count > 0 ? Math.round((tour.profitable / tour.count) * 100) : 0}%`,
                    background: '#38bdf8',
                    borderRadius: '999px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
              💡 <em>Consejo táctico:</em> Mantén tu dinero colgado por debajo del 20% de tus ventas totales para garantizar flujo de caja continuo para nuevas inscripciones y singles.
            </p>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline"
              style={{ flex: 1, minWidth: '130px', fontSize: '0.8rem' }}
              onClick={() => onNavigate('receivables')}
            >
              💸 Cobrar Deudas
            </button>
            <button
              className="btn btn-outline"
              style={{ flex: 1, minWidth: '130px', fontSize: '0.8rem' }}
              onClick={() => onNavigate('tournaments')}
            >
              🏆 Ver Torneos
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, minWidth: '130px', fontSize: '0.8rem' }}
              onClick={() => onNavigate('intake')}
            >
              ✨ Nueva Venta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
