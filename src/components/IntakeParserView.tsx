import React, { useState, useMemo } from 'react';
import { parseSaleIntake } from '../domain/parser';
import { createSaleFromDraft, todayIso } from '../domain/ledger';
import { formatGs } from '../domain/money';
import type { Sale } from '../domain/schemas';

interface IntakeParserViewProps {
  onAddSale: (sale: Sale) => void;
  onNavigateToReceivables: () => void;
}

const EXAMPLES = [
  'Le vendí un playset de Charizard a Lucas por 250mil, me dio 100mil y los 150mil me paga el viernes',
  'Martín Benítez me compró una Pikachu ex SIR por Gs. 1.200.000, adelantó 400.000 y el resto el 15/11. Tel 0981 123 456',
  'Le vendí un Umbreon VMAX alt art a Diego por 900mil al contado',
  'Le vendí 4 sobres de 151 a Ana, me dio 50mil y faltan 30mil el lunes',
];

export const IntakeParserView: React.FC<IntakeParserViewProps> = ({
  onAddSale,
  onNavigateToReceivables,
}) => {
  const [input, setInput] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const parsed = useMemo(() => {
    if (!input.trim()) return null;
    return parseSaleIntake(input);
  }, [input]);

  const handleSave = () => {
    if (!parsed || !parsed.ok) return;
    const today = todayIso();
    const result = createSaleFromDraft(parsed.draft, today);
    if (result.ok) {
      onAddSale(result.value);
      setInput('');
      setSuccessMsg(`¡Venta de "${result.value.item}" a ${result.value.buyer} registrada con éxito!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card">
        <div className="card-title">
          <span>🧠 Ingesta Inteligente en Lenguaje Natural</span>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'normal' }}>
            Determinístico + Esquema Zod
          </span>
        </div>

        <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1rem' }}>
          Escribe o pega como si le contaras a un amigo lo que vendiste en la tienda. El sistema extraerá automáticamente el comprador, las cartas, los pagos y el dinero colgado.
        </p>

        <textarea
          rows={3}
          placeholder="Ej: Le vendí 2 Lugia VSTAR a Rodrigo por 180mil, me transfirió 80mil y el saldo de 100mil me paga el 10/11..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Probar ejemplo:</span>
          {EXAMPLES.map((ex, idx) => (
            <button
              key={idx}
              className="btn btn-outline"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
              onClick={() => setInput(ex)}
            >
              Ejemplo {idx + 1}
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div
          style={{
            background: 'var(--success-bg)',
            border: '1px solid var(--success)',
            borderRadius: '0.5rem',
            padding: '1rem',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{successMsg}</span>
          <button className="btn btn-primary" style={{ padding: '0.35rem 0.75rem' }} onClick={onNavigateToReceivables}>
            Ver Dinero Colgado →
          </button>
        </div>
      )}

      {parsed && (
        <div className="card" style={{ borderColor: parsed.ok ? 'var(--primary)' : 'var(--danger)' }}>
          <div className="card-title">
            <span>{parsed.ok ? '✅ Datos Extraídos' : '⚠️ Información Incompleta'}</span>
            {parsed.ok && (
              <span className="badge badge-pendiente">Listo para Guardar</span>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>COMPRADOR</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                {parsed.fields.buyer ?? '—'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ÍTEM / CARTAS</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                {parsed.fields.item ?? '—'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>TOTAL</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>
                {parsed.fields.total ? formatGs(parsed.fields.total) : '—'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ENTREGADO</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>
                {parsed.fields.paid !== undefined ? formatGs(parsed.fields.paid) : '—'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>DINERO COLGADO (DEUDA)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ef4444' }}>
                {parsed.fields.pending !== undefined ? formatGs(parsed.fields.pending) : '—'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>VENCIMIENTO</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b' }}>
                {parsed.fields.dueDate ?? (parsed.fields.pending === 0 ? 'Saldado' : 'Sin fecha')}
              </div>
            </div>
          </div>

          {parsed.warnings.length > 0 && (
            <div style={{ background: 'var(--warning-bg)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700 }}>Avisos automáticos:</div>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#fbbf24', marginTop: '0.25rem' }}>
                {parsed.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {!parsed.ok && (
            <div style={{ background: 'var(--danger-bg)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 700 }}>Campos requeridos pendientes:</div>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#f87171', marginTop: '0.25rem' }}>
                {parsed.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {parsed.ok && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn btn-success" onClick={handleSave} style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}>
                💾 Confirmar y Registrar en Ledger
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
