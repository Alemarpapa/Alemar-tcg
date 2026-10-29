import React from 'react';

export type TabType = 'intake' | 'receivables' | 'tournaments' | 'balance' | 'backup';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  colgadoCount: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, colgadoCount }) => {
  return (
    <header>
      <div className="brand">
        <div className="brand-icon">⚡</div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="brand-title">Alemar - TCG</span>
            <span className="brand-badge">Vault PY</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Control Financiero, Cobranzas &amp; P&amp;L Competitivo
          </p>
        </div>
      </div>

      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'intake' ? 'active' : ''}`}
          onClick={() => setActiveTab('intake')}
        >
          <span>✨</span> Ingesta Rápida
        </button>
        <button
          className={`tab-btn ${activeTab === 'receivables' ? 'active' : ''}`}
          onClick={() => setActiveTab('receivables')}
        >
          <span>💸</span> Dinero Colgado
          {colgadoCount > 0 && (
            <span
              style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.7rem',
                borderRadius: '999px',
                padding: '0.1rem 0.4rem',
                fontWeight: 700,
              }}
            >
              {colgadoCount}
            </span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'tournaments' ? 'active' : ''}`}
          onClick={() => setActiveTab('tournaments')}
        >
          <span>🏆</span> Torneos P&amp;L
        </button>
        <button
          className={`tab-btn ${activeTab === 'balance' ? 'active' : ''}`}
          onClick={() => setActiveTab('balance')}
        >
          <span>📊</span> Balance Total
        </button>
        <button
          className={`tab-btn ${activeTab === 'backup' ? 'active' : ''}`}
          onClick={() => setActiveTab('backup')}
        >
          <span>⚙️</span> Datos
        </button>
      </nav>
    </header>
  );
};
