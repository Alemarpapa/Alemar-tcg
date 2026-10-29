import React, { useState } from 'react';
import {
  seasonSummary,
  tournamentPnL,
  formatRoi,
} from '../domain/tournaments';
import { formatGs } from '../domain/money';
import { todayIso, newId } from '../domain/ledger';
import type { Tournament, PrizeItem } from '../domain/schemas';

interface TournamentsViewProps {
  tournaments: Tournament[];
  onAddTournament: (tournament: Tournament) => void;
  onDeleteTournament: (id: string) => void;
}

export const TournamentsView: React.FC<TournamentsViewProps> = ({
  tournaments,
  onAddTournament,
  onDeleteTournament,
}) => {
  const summary = seasonSummary(tournaments);
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayIso());
  const [game, setGame] = useState('Pokémon TCG');
  const [format, setFormat] = useState('Standard');
  const [entryFee, setEntryFee] = useState('50000');
  const [travelCost, setTravelCost] = useState('20000');
  const [otherCosts, setOtherCosts] = useState('0');
  const [cashPrize, setCashPrize] = useState('0');
  const [standing, setStanding] = useState('');
  const [players, setPlayers] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productQty, setProductQty] = useState('1');
  const [productUnitValue, setProductUnitValue] = useState('35000');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    const travelNum = parseInt(travelCost, 10) || 0;
    const otherNum = parseInt(otherCosts, 10) || 0;
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
      game,
      format,
      entryFee: entryNum,
      travelCost: travelNum,
      otherCosts: otherNum,
      cashPrize: cashNum,
      productPrizes,
      ...(standingNum ? { standing: standingNum } : {}),
      ...(playersNum ? { players: playersNum } : {}),
    };

    onAddTournament(newTournament);
    setShowForm(false);
    setName('');
    setCashPrize('0');
    setProductDesc('');
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
          <div className="kpi-label">Costos &amp; Viáticos Invertidos</div>
          <div className="kpi-value" style={{ color: '#f87171' }}>
            {formatGs(summary.costs)}
          </div>
          <div className="kpi-subtitle">Inscripciones y transporte</div>
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

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cerrar Formulario' : '➕ Registrar Torneo / Cup'}
        </button>
      </div>

      {/* New Tournament Form */}
      {showForm && (
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
                placeholder="Ej: League Cup San Lorenzo"
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
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>TCG &amp; Formato</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Juego"
                  value={game}
                  onChange={(e) => setGame(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Formato"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                />
              </div>
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
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Viáticos / Transporte (Gs)</label>
              <input
                type="number"
                value={travelCost}
                onChange={(e) => setTravelCost(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Otros Gastos (Fundas, etc.)</label>
              <input
                type="number"
                value={otherCosts}
                onChange={(e) => setOtherCosts(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Premio en Efectivo (Gs)</label>
              <input
                type="number"
                placeholder="0"
                value={cashPrize}
                onChange={(e) => setCashPrize(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Standing / Posición vs Jugadores</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  placeholder="Puesto (ej: 3)"
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Premios en Sobres / Cartas (Descripción)</label>
              <input
                type="text"
                placeholder="Ej: 4 Sobres Stellar Crown"
                value={productDesc}
                onChange={(e) => setProductDesc(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Cantidad x Valor Unitario (Gs)</label>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowForm(false)}
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
                  <th>Standing</th>
                  <th>Costos</th>
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
                          📅 {t.date} {t.format ? `• ${t.format}` : ''}
                        </div>
                      </td>
                      <td>
                        {t.standing ? (
                          <span
                            className="badge"
                            style={{
                              background: t.standing <= 4 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              color: t.standing <= 4 ? '#facc15' : '#cbd5e1',
                              border: t.standing <= 4 ? '1px solid #facc15' : '1px solid #475569',
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
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Entr: {formatGs(t.entryFee)}
                        </div>
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
