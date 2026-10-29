import React, { useState } from 'react';
import {
  seasonSummary,
  tournamentPnL,
  formatRoi,
} from '../domain/tournaments';
import { formatGs } from '../domain/money';
import { todayIso, newId } from '../domain/ledger';
import type { Tournament, PrizeItem, ExpenseItem } from '../domain/schemas';

interface TournamentsViewProps {
  tournaments: Tournament[];
  expenses: ExpenseItem[];
  onAddTournament: (tournament: Tournament) => void;
  onDeleteTournament: (id: string) => void;
  onAddExpense: (expense: ExpenseItem) => void;
  onDeleteExpense: (id: string) => void;
}

export const TournamentsView: React.FC<TournamentsViewProps> = ({
  tournaments,
  expenses = [],
  onAddTournament,
  onDeleteTournament,
  onAddExpense,
  onDeleteExpense,
}) => {
  const summary = seasonSummary(tournaments);
  const [showTournamentForm, setShowTournamentForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  // Tournament Form states
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayIso());
  const [game, setGame] = useState('Pokémon TCG');
  const [entryFee, setEntryFee] = useState('50000');
  const [cashPrize, setCashPrize] = useState('0');
  const [standing, setStanding] = useState('');
  const [players, setPlayers] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productQty, setProductQty] = useState('1');
  const [productUnitValue, setProductUnitValue] = useState('35000');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Extra Expense Form states
  const [expDesc, setExpDesc] = useState('');
  const [expCategory, setExpCategory] = useState('Fundas');
  const [expAmount, setExpAmount] = useState('65000');
  const [expDate, setExpDate] = useState(todayIso());
  const [expError, setExpError] = useState<string | null>(null);

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

  const handleSaveTournament = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!name.trim()) {
      setErrorMsg('Ingresa el nombre del torneo.');
      return;
    }

    const productPrizes: PrizeItem[] = [];
    if (productDesc.trim()) {
      const q = parseInt(productQty, 10) || 1;
      const val = parseInt(productUnitValue, 10) || 0;
      productPrizes.push({
        description: productDesc.trim(),
        quantity: q,
        unitValue: val,
      });
    }

    const entryNum = parseInt(entryFee, 10) || 0;
    const cashNum = parseInt(cashPrize, 10) || 0;
    const standingNum = standing ? parseInt(standing, 10) : undefined;
    const playersNum = players ? parseInt(players, 10) : undefined;

    if (standingNum && playersNum && standingNum > playersNum) {
      setErrorMsg('La posición no puede ser mayor al número de jugadores.');
      return;
    }

    const newTournament: Tournament = {
      id: newId(),
      name: name.trim(),
      date,
      game: game.trim() || undefined,
      entryFee: entryNum,
      cashPrize: cashNum,
      productPrizes,
      ...(standingNum ? { standing: standingNum } : {}),
      ...(playersNum ? { players: playersNum } : {}),
    };

    onAddTournament(newTournament);
    setShowTournamentForm(false);
    setName('');
    setCashPrize('0');
    setProductDesc('');
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setExpError(null);
    if (!expDesc.trim()) {
      setExpError('Ingresa la descripción del accesorio/gasto.');
      return;
    }
    const amountNum = parseInt(expAmount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setExpError('El monto debe ser mayor a 0.');
      return;
    }

    const newExp: ExpenseItem = {
      id: newId(),
      description: expDesc.trim(),
      category: expCategory,
      amount: amountNum,
      date: expDate,
    };

    onAddExpense(newExp);
    setShowExpenseForm(false);
    setExpDesc('');
    setExpAmount('65000');
  };

  return (
    <div>
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card torneos">
          <div className="kpi-label">Balance Neto Torneos (P&amp;L)</div>
          <div
            className="kpi-value"
            style={{ color: summary.net >= 0 ? '#10b981' : '#ef4444' }}
          >
            {summary.net >= 0 ? `+${formatGs(summary.net)}` : formatGs(summary.net)}
          </div>
          <div className="kpi-subtitle">
            ROI Global: <strong style={{ color: '#fff' }}>{formatRoi(summary.roi)}</strong>
          </div>
        </div>

        <div className="kpi-card roi">
          <div className="kpi-label">Premios Generados</div>
          <div className="kpi-value" style={{ color: '#8b5cf6' }}>
            {formatGs(summary.revenue)}
          </div>
          <div className="kpi-subtitle">
            Efectivo: {formatGs(summary.cashRevenue)} | Cartas: {formatGs(summary.productRevenue)}
          </div>
        </div>

        <div className="kpi-card" style={{ borderColor: '#f87171' }}>
          <div className="kpi-label">Inscripciones a Torneos</div>
          <div className="kpi-value" style={{ color: '#f87171' }}>
            {formatGs(summary.costs)}
          </div>
          <div className="kpi-subtitle">Costo directo de entradas</div>
        </div>

        <div className="kpi-card cobrado">
          <div className="kpi-label">Rentabilidad Competitiva</div>
          <div className="kpi-value" style={{ color: '#38bdf8' }}>
            {summary.count > 0 ? Math.round((summary.profitable / summary.count) * 100) : 0}%
          </div>
          <div className="kpi-subtitle">
            {summary.profitable} de {summary.count} torneos con ganancia
          </div>
        </div>
      </div>

      {/* Action Bar with Separate Tournament and Extra Expenses Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          className="btn btn-outline"
          onClick={() => {
            setShowExpenseForm(!showExpenseForm);
            if (showTournamentForm) setShowTournamentForm(false);
          }}
        >
          {showExpenseForm ? 'Cerrar Gastos Extras' : '📦 Otros Gastos / Accesorios'}
          {totalExpenses > 0 && (
            <span style={{ fontSize: '0.75rem', background: '#334155', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.3rem' }}>
              {formatGs(totalExpenses)}
            </span>
          )}
        </button>

        <button
          className="btn btn-primary"
          onClick={() => {
            setShowTournamentForm(!showTournamentForm);
            if (showExpenseForm) setShowExpenseForm(false);
          }}
        >
          {showTournamentForm ? 'Cerrar Formulario' : '➕ Registrar Torneo / Cup'}
        </button>
      </div>

      {/* Extra Expenses Section/Modal */}
      {showExpenseForm && (
        <div className="card" style={{ borderColor: '#8b5cf6' }}>
          <div className="card-title">
            <span>📦 Registro de Otros Gastos &amp; Accesorios (Fuera de Torneos)</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
            Aquí puedes registrar compras de insumos para tu juego (fundas, playmats, dados, carpetas o cajas) sin alterar los costos individuales de inscripción de cada torneo.
          </p>

          {expError && (
            <div style={{ background: 'var(--danger-bg)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', color: '#f87171', fontSize: '0.85rem' }}>
              {expError}
            </div>
          )}

          <form onSubmit={handleSaveExpense} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Concepto / Descripción *</label>
              <input
                type="text"
                placeholder="Ej: Fundas Dragon Shield Japanese"
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Categoría</label>
              <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                <option value="Fundas">Fundas / Sleeves</option>
                <option value="Playmat">Playmat</option>
                <option value="Carpetas">Carpetas / Binders</option>
                <option value="Deckbox">Deckbox / Cajas</option>
                <option value="Dados">Dados / Contadores</option>
                <option value="Otros">Otros Insumos</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Monto en Guaraníes (Gs) *</label>
              <input
                type="number"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fecha</label>
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-success" style={{ width: '100%' }}>
                💾 Agregar Gasto
              </button>
            </div>
          </form>

          {/* Expenses list */}
          {expenses.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#fff' }}>
                Gastos Registrados ({expenses.length}) — Total: <span style={{ color: '#f87171' }}>{formatGs(totalExpenses)}</span>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Concepto</th>
                      <th>Categoría</th>
                      <th>Monto</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td style={{ color: '#94a3b8' }}>{exp.date}</td>
                        <td style={{ fontWeight: 600, color: '#fff' }}>{exp.description}</td>
                        <td>
                          <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                            {exp.category}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: '#f87171' }}>{formatGs(exp.amount)}</td>
                        <td>
                          <button
                            className="btn btn-outline"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: '#ef4444' }}
                            onClick={() => onDeleteExpense(exp.id)}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Tournament Form (Cleaned: No Viáticos, No Formato, Game kept) */}
      {showTournamentForm && (
        <form className="card" onSubmit={handleSaveTournament}>
          <div className="card-title">Registrar Participación en Torneo</div>

          {errorMsg && (
            <div style={{ background: 'var(--danger-bg)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', color: '#f87171', fontSize: '0.85rem' }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Nombre del Torneo / Tienda *</label>
              <input
                type="text"
                placeholder="Ej: One Piece Top 8 / League Cup"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Juego / TCG</label>
              <input
                type="text"
                placeholder="Ej: One Piece TCG / Pokémon TCG"
                value={game}
                onChange={(e) => setGame(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Costo Inscripción (Gs)</label>
              <input
                type="number"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Premio en Efectivo (Gs)</label>
              <input
                type="number"
                placeholder="0"
                value={cashPrize}
                onChange={(e) => setCashPrize(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Premios en Sobres / Cartas (Descripción)</label>
              <input
                type="text"
                placeholder="Ej: 1x Promos y bulk / 4 Sobres OP-08"
                value={productDesc}
                onChange={(e) => setProductDesc(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Cantidad x Valor Estimado (Gs)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  placeholder="Cant"
                  style={{ width: '70px' }}
                  value={productQty}
                  onChange={(e) => setProductQty(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Precio estimado c/u"
                  value={productUnitValue}
                  onChange={(e) => setProductUnitValue(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Standing / Posición vs Jugadores</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  placeholder="Puesto (ej: 8)"
                  value={standing}
                  onChange={(e) => setStanding(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Total (ej: 32)"
                  value={players}
                  onChange={(e) => setPlayers(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowTournamentForm(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-success">
              💾 Guardar Torneo
            </button>
          </div>
        </form>
      )}

      {/* Tournaments List */}
      <div className="card">
        <div className="card-title">
          <span>Historial de Torneos ({tournaments.length})</span>
        </div>

        {tournaments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
            No tienes torneos registrados aún. ¡Registra tu primer evento arriba!
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Torneo &amp; Fecha</th>
                  <th>Juego</th>
                  <th>Standing</th>
                  <th>Inscripción</th>
                  <th>Premios Obtenidos</th>
                  <th>P&amp;L Neto / ROI</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map((t) => {
                  const pnl = tournamentPnL(t);
                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#fff' }}>{t.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          📅 {t.date}
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                          {t.game ?? 'TCG'}
                        </span>
                      </td>
                      <td>
                        {t.standing ? (
                          <span
                            className="badge"
                            style={{
                              background: t.standing <= 8 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              color: t.standing <= 8 ? '#facc15' : '#cbd5e1',
                              border: t.standing <= 8 ? '1px solid #facc15' : '1px solid #475569',
                            }}
                          >
                            Top {t.standing} {t.players ? `de ${t.players}` : ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div style={{ color: '#f87171' }}>{formatGs(pnl.costs)}</div>
                      </td>
                      <td>
                        <div style={{ color: '#10b981', fontWeight: 600 }}>
                          {formatGs(pnl.revenue)}
                        </div>
                        {t.productPrizes.length > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                            {t.productPrizes.map((p) => `${p.quantity}x ${p.description}`).join(', ')}
                          </div>
                        )}
                      </td>
                      <td>
                        <div
                          style={{
                            fontWeight: 800,
                            color: pnl.net >= 0 ? '#10b981' : '#ef4444',
                          }}
                        >
                          {pnl.net >= 0 ? `+${formatGs(pnl.net)}` : formatGs(pnl.net)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          ROI: {formatRoi(pnl.roi)}
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-outline"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', color: '#ef4444' }}
                          onClick={() => {
                            if (confirm(`¿Eliminar torneo "${t.name}"?`)) {
                              onDeleteTournament(t.id);
                            }
                          }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
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
