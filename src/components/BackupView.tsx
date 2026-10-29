import React, { useState, useRef } from 'react';
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
      buyer: 'Lucas M.',
      item: 'Playset Charizard ex + Pidgeot ex',
      total: 250000,
      createdAt: '2026-10-20',
      dueDate: '2026-10-30',
      phone: '595981123456',
      payments: [{ id: 'p-1', amount: 100000, date: '2026-10-20', note: 'Seña inicial' }],
    },
    {
      id: 'demo-2',
      buyer: 'Rodrigo Benítez',
      item: 'Pikachu VMAX Rainbow Rare',
      total: 180000,
      createdAt: '2026-10-15',
      dueDate: '2026-10-25',
      phone: '595971987654',
      payments: [{ id: 'p-2', amount: 50000, date: '2026-10-15', note: 'Efectivo entrega' }],
    },
    {
      id: 'demo-3',
      buyer: 'Marcos Duarte',
      item: 'Deckbox Ultra Pro + Sleeves Dragon Shield',
      total: 120000,
      createdAt: '2026-10-26',
      dueDate: '2026-11-05',
      payments: [],
    },
  ],
  expenses: [],
  tournaments: [
    {
      id: 'tour-1',
      name: 'Regional Qualifier Asunción',
      date: '2026-10-18',
      game: 'Pokémon TCG',
      entryFee: 70000,
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
      entryFee: 50000,
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
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `alemar-tcg-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setMsg({ text: '✅ Archivo de respaldo descargado correctamente en tu carpeta de Descargas.' });
  };

  const processJson = (rawJson: string) => {
    setMsg(null);
    const res = importState(rawJson);
    if (!res.ok) {
      setMsg({ text: `❌ Error de validación: ${res.errors.join('; ')}`, error: true });
      return;
    }
    onRestoreState(res.state);
    setImportText('');
    setMsg({
      text: `🎉 ¡Copia de seguridad restaurada con éxito! Se cargaron ${res.state.sales.length} ventas y ${res.state.tournaments.length} torneos.`,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        processJson(content);
      }
    };
    reader.onerror = () => {
      setMsg({ text: '❌ No se pudo leer el archivo seleccionado.', error: true });
    };
    reader.readAsText(file);
    // Reset so the user can pick the same file again if desired
    e.target.value = '';
  };

  const handleManualImport = () => {
    if (!importText.trim()) {
      setMsg({ text: 'Pega un JSON válido para importar.', error: true });
      return;
    }
    processJson(importText);
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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {msg && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            background: msg.error ? 'var(--danger-bg)' : 'var(--success-bg)',
            color: msg.error ? '#f87171' : '#10b981',
            border: `1px solid ${msg.error ? '#ef4444' : '#10b981'}`,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Main Backup and Restore Card */}
      <div className="card">
        <div className="card-title">Respaldo y Restauración de Datos</div>
        <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
          Tus datos se guardan de forma privada en el almacenamiento local de tu navegador. Usa estos botones para exportar tu copia de seguridad o para <strong>restaurarla en otro navegador (Chrome, Firefox, celular)</strong> con un solo clic:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Step 1: Export */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '0.75rem',
              background: 'rgba(56, 189, 248, 0.05)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '0.5rem', fontSize: '1rem' }}>
                1. Descargar Respaldo
              </div>
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '1rem' }}>
                Guarda un archivo <code>.json</code> en tu computadora con todo tu historial de ventas, deudas y torneos.
              </p>
            </div>
            <button className="btn btn-primary" onClick={handleExport} style={{ width: '100%' }}>
              📥 Descargar Backup JSON
            </button>
          </div>

          {/* Step 2: Direct File Restore */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '0.75rem',
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: '#10b981', marginBottom: '0.5rem', fontSize: '1rem' }}>
                2. Restaurar Copia de Seguridad
              </div>
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '1rem' }}>
                Selecciona el archivo descargado para sincronizar tus datos al instante sin tener que copiar texto.
              </p>
            </div>
            <button
              className="btn btn-success"
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', fontSize: '0.95rem' }}
            >
              📂 Seleccionar Archivo y Restaurar
            </button>
          </div>
        </div>

        {/* Extra Utilities */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <button className="btn btn-outline" onClick={handleLoadSample}>
            ⚡ Cargar Datos Demo
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setShowManualPaste(!showManualPaste)}
          >
            {showManualPaste ? 'Ocultar Cuadro de Texto' : '📝 Pegar Código JSON Manualmente'}
          </button>
          <button className="btn btn-outline" style={{ color: '#ef4444', marginLeft: 'auto' }} onClick={handleReset}>
            🗑️ Limpiar Todo
          </button>
        </div>
      </div>

      {/* Manual Paste Section (Optional) */}
      {showManualPaste && (
        <div className="card" style={{ borderColor: '#64748b' }}>
          <div className="card-title">Pegar Código JSON Manualmente</div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
            Si abriste el archivo en el bloc de notas, puedes copiar y pegar el texto aquí:
          </p>

          <textarea
            rows={5}
            placeholder='{"version": 1, "sales": [...], "tournaments": [...]}'
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn btn-success" onClick={handleManualImport}>
              📥 Importar desde Texto
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
