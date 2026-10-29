import React, { useState } from 'react';
import { importState } from '../storage/store';
import { emptyState, type AppState } from '../domain/schemas';

interface BackupViewProps {
  state: AppState;
  onRestoreState: (state: AppState) => void;
}

const SAMPLE_DATA: AppState = {
  version: 1,
  sales: [
    {
      id: 'demo-1',
      buyer: 'Lucas Maidana',
      item: 'Playset Charizard ex Teracristal',
      total: 250000,
      createdAt: '2026-10-24',
      dueDate: '2026-10-28',
      phone: '595981123456',
      payments: [{ id: 'p-1', amount: 100000, date: '2026-10-24', note: 'Entrega en mano' }],
    },
    {
      id: 'demo-2',
      buyer: 'Martín Benítez',
      item: 'Pikachu ex SIR Surging Sparks',
      total: 1200000,
      createdAt: '2026-10-25',
      dueDate: '2026-10-31',
      phone: '595971987654',
      payments: [{ id: 'p-2', amount: 400000, date: '2026-10-25', note: 'Transferencia Bancaria' }],
    },
    {
      id: 'demo-3',
      buyer: 'Diego Cáceres',
      item: 'Umbreon VMAX Alt Art Moonbreon',
      total: 900000,
      createdAt: '2026-10-22',
      payments: [{ id: 'p-3', amount: 900000, date: '2026-10-22', note: 'Al contado' }],
    },
  ],
  expenses: [],
  tournaments: [
    {
      id: 'tour-1',
      name: 'Regional Qualifier Asunción',
      date: '2026-10-18',
      game: 'Pokémon TCG',
      format: 'Standard',
      entryFee: 70000,
      travelCost: 30000,
      otherCosts: 20000,
      cashPrize: 350000,
      productPrizes: [
        { description: 'Sobres Stellar Crown', quantity: 6, unitValue: 35000 },
      ],
      standing: 2,
      players: 36,
    },
    {
      id: 'tour-2',
      name: 'League Challenge San Lorenzo',
      date: '2026-10-25',
      game: 'Pokémon TCG',
      format: 'Standard',
      entryFee: 50000,
      travelCost: 15000,
      otherCosts: 0,
      cashPrize: 0,
      productPrizes: [
        { description: 'Sobres Shrouded Fable', quantity: 2, unitValue: 35000 },
      ],
      standing: 7,
      players: 24,
    },
  ],
};

export const BackupView: React.FC<BackupViewProps> = ({ state, onRestoreState }) => {
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `tcg-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImport = () => {
    setMsg(null);
    if (!importText.trim()) {
      setMsg({ text: 'Pega un JSON válido para importar.', error: true });
      return;
    }
    const res = importState(importText);
    if (!res.ok) {
      setMsg({ text: `Error de validación: ${res.errors.join('; ')}`, error: true });
      return;
    }
    onRestoreState(res.state);
    setImportText('');
    setMsg({ text: '¡Datos restaurados con éxito!' });
  };

  const handleLoadSample = () => {
    if (confirm('¿Cargar datos de ejemplo de prueba? Reemplazará los datos actuales.')) {
      onRestoreState(SAMPLE_DATA);
      setMsg({ text: '¡Datos de ejemplo cargados correctamente!' });
    }
  };

  const handleReset = () => {
    if (confirm('¿Estás seguro de resetear todo a cero? Esta acción no se puede deshacer.')) {
      onRestoreState(emptyState());
      setMsg({ text: 'Datos reseteados.' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card">
        <div className="card-title">Respaldo y Portabilidad de Datos</div>
        <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
          Tus datos se guardan de forma 100% privada y segura en tu navegador local (LocalStorage). Puedes descargar un archivo JSON de respaldo para abrirlo en cualquier otra máquina o tu teléfono móvil.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleExport}>
            📥 Descargar Backup JSON
          </button>
          <button className="btn btn-outline" onClick={handleLoadSample}>
            ⚡ Cargar Datos de Demostración
          </button>
          <button className="btn btn-outline" style={{ color: '#ef4444' }} onClick={handleReset}>
            🗑️ Limpiar Todo
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Restaurar Copia de Seguridad</div>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
          Pega el contenido de tu archivo JSON de respaldo para importar tus ventas y torneos:
        </p>

        <textarea
          rows={5}
          placeholder='{"version": 1, "sales": [...], "tournaments": [...]}'
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />

        {msg && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              background: msg.error ? 'var(--danger-bg)' : 'var(--success-bg)',
              color: msg.error ? '#f87171' : '#10b981',
            }}
          >
            {msg.text}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn btn-success" onClick={handleImport}>
            📤 Importar y Reemplazar Datos
          </button>
        </div>
      </div>
    </div>
  );
};
