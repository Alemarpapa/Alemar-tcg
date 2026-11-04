import React, { useState } from 'react';
import {
  summarizeReceivables,
  calculateMonthSummary,
  getAllMonths,
  summarizeInventory,
  todayIso,
} from '../domain/ledger';
import { seasonSummary } from '../domain/tournaments';
import { formatGs } from '../domain/money';
import type { Sale, Tournament, ExpenseItem, InventoryItem, Purchase } from '../domain/schemas';

interface BalanceTotalViewProps {
  sales: Sale[];
  tournaments: Tournament[];
  expenses: ExpenseItem[];
  inventory?: InventoryItem[];
  purchases?: Purchase[];
  onNavigate: (tab: 'receivables' | 'reinvest' | 'tournaments') => void;
}

export const BalanceTotalView: React.FC<BalanceTotalViewProps> = ({
  sales,
  tournaments,
  expenses = [],
  inventory = [],
  purchases = [],
  onNavigate,
}) => {
  const today = todayIso();
  const currentMonthKey = today.slice(0, 7);

  // Period selector: defaults to current month (YYYY-MM) or 'all'
  const allMonths = getAllMonths(sales, tournaments, expenses, today, purchases);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  const isAllTime = selectedMonth === 'all';

  // Global receivables and inventory summaries
  const rec = summarizeReceivables(sales, today);
  const inv = summarizeInventory(inventory);
  const totalMoneyOnHold = rec.outstanding + inv.totalValue;

  // Global tour & expenses (for all-time)
  const tourAll = seasonSummary(tournaments);
  const totalExpensesAll = expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalReinvestAll = purchases.reduce((acc, p) => acc + p.amount, 0);

  // Current selected month summary (or aggregate if all-time)
  const monthData = calculateMonthSummary(
    selectedMonth,
    sales,
    tournaments,
    expenses,
    purchases,
  );

  // Active metrics depending on view (selected month vs all-time)
  const activeLabel = isAllTime ? 'Histórico Global Consolidado' : monthData.monthLabel;
  const activeCollected = isAllTime ? rec.totalCollected : monthData.salesCollected;
  const activeTournamentCash = isAllTime ? tourAll.cashRevenue : monthData.tournamentCash;
  const activeTournamentProduct = isAllTime ? tourAll.productRevenue : monthData.tournamentProduct;
  const activeTournamentCosts = isAllTime ? tourAll.costs : monthData.tournamentCosts;
  const activeTournamentNet = isAllTime ? tourAll.net : monthData.tournamentNet;
  const activeExpenses = isAllTime ? totalExpensesAll : monthData.expenses;
  const activeReinvest = isAllTime ? totalReinvestAll : monthData.reinvestment;

  const activeRevenue = isAllTime
    ? rec.totalCollected + tourAll.revenue
    : monthData.totalRevenue;
  const activeCosts = isAllTime
    ? tourAll.costs + totalExpensesAll + totalReinvestAll
    : monthData.totalCosts;
  const activeNet = isAllTime ? activeRevenue - activeCosts : monthData.net;
  // The three pillars (one per tab) add up exactly to activeNet.
  const activeTorneos = activeTournamentNet - activeExpenses;
  const activeLiquid = isAllTime
    ? (rec.totalCollected + tourAll.cashRevenue) - activeCosts
    : monthData.liquidNet;

  // Monthly breakdown for all months in history
  const monthlyBreakdown = allMonths.map((m) =>
    calculateMonthSummary(m, sales, tournaments, expenses, purchases),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Month / Period Filter Toolbar */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📅</span>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>
            Período de Balance:
          </span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              background: '#1e293b',
              color: '#38bdf8',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              padding: '0.4rem 0.8rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {allMonths.map((m) => {
              const label = calculateMonthSummary(m, sales, tournaments, expenses).monthLabel;
              return (
                <option key={m} value={m}>
                  {m === currentMonthKey ? `⭐ Este Mes (${label})` : label}
                </option>
              );
            })}
            <option value="all">🌐 Todo el Histórico Global</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            className={`btn ${selectedMonth === currentMonthKey ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
            onClick={() => setSelectedMonth(currentMonthKey)}
          >
            Este Mes
          </button>
          <button
            className={`btn ${selectedMonth === 'all' ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
            onClick={() => setSelectedMonth('all')}
          >
            Histórico Total
          </button>
        </div>
      </div>

      {/* Top Banner: Selected Period Net Balance */}
      <div
        className="card"
        style={{
          background:
            activeNet >= 0
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(56, 189, 248, 0.08) 100%)'
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(245, 158, 11, 0.08) 100%)',
          borderColor: activeNet >= 0 ? '#10b981' : '#ef4444',
          padding: '1.75rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '1.2rem' }}>{activeNet >= 0 ? '📈' : '📉'}</span>
              <span
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#94a3b8',
                }}
              >
                Balance Neto • {activeLabel}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  background: activeNet >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: activeNet >= 0 ? '#10b981' : '#f87171',
                }}
              >
                {activeNet >= 0 ? '✓ GANANCIA NETA' : '⚠ PÉRDIDA NETA'}
              </span>
            </div>
            <div
              style={{
                fontSize: '2.6rem',
                fontWeight: 900,
                color: activeNet >= 0 ? '#10b981' : '#ef4444',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              {activeNet >= 0 ? `+${formatGs(activeNet)}` : formatGs(activeNet)}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.6rem' }}>
              Efectivo Líquido del Período:{' '}
              <strong style={{ color: activeLiquid >= 0 ? '#38bdf8' : '#f87171' }}>
                {activeLiquid >= 0 ? `+${formatGs(activeLiquid)}` : formatGs(activeLiquid)}
              </strong>{' '}
              | Premios en Producto:{' '}
              <strong style={{ color: '#a78bfa' }}>{formatGs(activeTournamentProduct)}</strong>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              padding: '1rem 1.25rem',
              borderRadius: '0.75rem',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              minWidth: '240px',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
              Plata en Espera (no cuenta en el neto)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
              {formatGs(totalMoneyOnHold)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem', lineHeight: 1.4 }}>
              💸 {formatGs(rec.outstanding)} por cobrar (Dinero Colgado)
              <br />
              🔄 {formatGs(inv.totalValue)} en stock por vender (Reinversión)
            </div>
          </div>
        </div>
      </div>

      {/* 3 pillars, one per tab: Dinero Colgado + Reinversión + Torneos = Balance Neto */}
      <div className="kpi-grid">
        <div className="kpi-card cobrado" style={{ cursor: 'pointer' }} onClick={() => onNavigate('receivables')}>
          <div className="kpi-label">💸 Dinero Colgado · Cobrado ({isAllTime ? 'Histórico' : 'En el Mes'})</div>
          <div className="kpi-value" style={{ color: '#10b981' }}>
            +{formatGs(activeCollected)}
          </div>
          <div className="kpi-subtitle">Falta cobrar: {formatGs(rec.outstanding)}</div>
        </div>

        <div className="kpi-card" style={{ borderColor: '#ef4444', cursor: 'pointer' }} onClick={() => onNavigate('reinvest')}>
          <div className="kpi-label">🔄 Reinversión ({isAllTime ? 'Histórico' : 'En el Mes'})</div>
          <div className="kpi-value" style={{ color: activeReinvest > 0 ? '#ef4444' : '#10b981' }}>
            -{formatGs(activeReinvest)}
          </div>
          <div className="kpi-subtitle">Stock por vender: {formatGs(inv.totalValue)}</div>
        </div>

        <div className="kpi-card torneos" style={{ cursor: 'pointer' }} onClick={() => onNavigate('tournaments')}>
          <div className="kpi-label">🏆 Torneos + Gastos ({isAllTime ? 'Histórico' : 'En el Mes'})</div>
          <div className="kpi-value" style={{ color: activeTorneos >= 0 ? '#10b981' : '#ef4444' }}>
            {activeTorneos >= 0 ? `+${formatGs(activeTorneos)}` : formatGs(activeTorneos)}
          </div>
          <div className="kpi-subtitle">
            Torneos: {formatGs(activeTournamentNet)} · Otros gastos: -{formatGs(activeExpenses)}
          </div>
        </div>
      </div>

      {/* Monthly Comparative Table: Month-by-Month Evolution */}
      <div className="card">
        <div className="card-title">
          <span>📅 Historial &amp; Desglose Mes a Mes (Ganancias y Pérdidas)</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '-0.5rem', marginBottom: '1rem' }}>
          Cada mes = lo cobrado (Dinero Colgado) − lo reinvertido (Reinversión) ± Torneos y sus gastos.
        </p>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                <th style={{ textAlign: 'right' }}>💸 Cobrado</th>
                <th style={{ textAlign: 'right' }}>🔄 Reinversión</th>
                <th style={{ textAlign: 'right' }}>🏆 Torneos + Gastos</th>
                <th style={{ textAlign: 'right' }}>Resultado Neto</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {monthlyBreakdown.map((mb) => {
                const isCurrent = mb.month === selectedMonth;
                const isProfitable = mb.net >= 0;
                return (
                  <tr
                    key={mb.month}
                    style={{
                      background: isCurrent ? 'rgba(56, 189, 248, 0.08)' : undefined,
                    }}
                  >
                    <td>
                      <div style={{ fontWeight: 700, color: isCurrent ? '#38bdf8' : '#fff' }}>
                        {mb.monthLabel}
                        {mb.month === currentMonthKey && (
                          <span
                            style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.7rem',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              borderRadius: '4px',
                              padding: '0.1rem 0.3rem',
                            }}
                          >
                            Actual
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                      +{formatGs(mb.salesCollected)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#f87171' }}>
                      -{formatGs(mb.reinvestment)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: mb.tournamentNet - mb.expenses >= 0 ? '#10b981' : '#f87171',
                      }}
                    >
                      {mb.tournamentNet - mb.expenses >= 0
                        ? `+${formatGs(mb.tournamentNet - mb.expenses)}`
                        : formatGs(mb.tournamentNet - mb.expenses)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 900,
                        fontSize: '1rem',
                        color: isProfitable ? '#10b981' : '#ef4444',
                      }}
                    >
                      {isProfitable ? `+${formatGs(mb.net)}` : formatGs(mb.net)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="badge"
                        style={{
                          background: isProfitable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isProfitable ? '#10b981' : '#f87171',
                        }}
                      >
                        {isProfitable ? 'Ganancia' : 'Pérdida'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className={`btn ${isCurrent ? 'btn-primary' : 'btn-outline'}`}
                        style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                        onClick={() => setSelectedMonth(mb.month)}
                      >
                        {isCurrent ? 'Viendo' : 'Ver'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Breakdown & Cashflow Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Left: Summary Breakdown Table */}
        <div className="card">
          <div className="card-title">
            <span>📋 Flujo de Fondos • {activeLabel}</span>
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
                      💸 Dinero Colgado
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                    +{formatGs(activeCollected)}
                  </td>
                </tr>
                <tr>
                  <td>Premios Torneos (Efectivo)</td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                      🏆 Torneos
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                    +{formatGs(activeTournamentCash)}
                  </td>
                </tr>
                <tr>
                  <td>Premios Torneos (Sobres / Cartas)</td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                      🏆 Torneos
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                    +{formatGs(activeTournamentProduct)}
                  </td>
                </tr>
                <tr>
                  <td>Inscripciones a Torneos</td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                      🏆 Torneos
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f87171' }}>
                    -{formatGs(activeTournamentCosts)}
                  </td>
                </tr>
                <tr>
                  <td>Otros Gastos (fundas, accesorios…)</td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                      🏆 Torneos
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f87171' }}>
                    -{formatGs(activeExpenses)}
                  </td>
                </tr>
                <tr>
                  <td>Reinversión en Lotes / Stock</td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                      🔄 Reinversión
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f87171' }}>
                    -{formatGs(activeReinvest)}
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
                      color: activeNet >= 0 ? '#10b981' : '#ef4444',
                    }}
                  >
                    {activeNet >= 0 ? `+${formatGs(activeNet)}` : formatGs(activeNet)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Right: Quick Action Navigation Buttons */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-title">
              <span>⚡ Acceso Rápido &amp; Operaciones</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '0.6rem',
                  padding: '0.9rem',
                }}
              >
                <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.85rem' }}>
                  🔄 Stock por Vender (Reinversión)
                </div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                  Tienes <strong>{inv.availableCount}</strong> artículos/carpetas valorados en{' '}
                  <strong style={{ color: '#38bdf8' }}>{formatGs(inv.totalValue)}</strong> esperando ser vendidos.
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '0.6rem',
                  padding: '0.9rem',
                }}
              >
                <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.85rem' }}>
                  💳 Cuentas por Cobrar a Clientes
                </div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                  Tienes <strong>{rec.outstanding > 0 ? formatGs(rec.outstanding) : '0 Gs'}</strong> pendientes de pago de ventas ya entregadas.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline"
              style={{ flex: 1, minWidth: '130px', fontSize: '0.8rem' }}
              onClick={() => onNavigate('receivables')}
            >
              💸 Dinero Colgado
            </button>
            <button
              className="btn btn-outline"
              style={{ flex: 1, minWidth: '130px', fontSize: '0.8rem' }}
              onClick={() => onNavigate('tournaments')}
            >
              🏆 Ver Torneos
            </button>
            <button
              className="btn btn-outline"
              style={{ flex: 1, minWidth: '130px', fontSize: '0.8rem' }}
              onClick={() => onNavigate('reinvest')}
            >
              🔄 Reinversión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
