import React, { useState, useEffect } from 'react';
import { loadState, saveState } from './storage/store';
import { emptyState, type AppState, type Sale, type Tournament, type ExpenseItem } from './domain/schemas';
import { saleBalance } from './domain/ledger';
import { Header, type TabType } from './components/Header';
import { IntakeParserView } from './components/IntakeParserView';
import { ReceivablesView } from './components/ReceivablesView';
import { TournamentsView } from './components/TournamentsView';
import { BalanceTotalView } from './components/BalanceTotalView';
import { BackupView } from './components/BackupView';

export const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    if (typeof window === 'undefined') return emptyState();
    return loadState(window.localStorage).state;
  });

  const [activeTab, setActiveTab] = useState<TabType>('intake');

  // Auto-persist whenever state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        saveState(window.localStorage, state);
      } catch (err) {
        console.error('Failed to auto-save state', err);
      }
    }
  }, [state]);

  const handleAddSale = (newSale: Sale) => {
    setState((prev) => ({
      ...prev,
      sales: [newSale, ...prev.sales],
    }));
  };

  const handleUpdateSale = (updated: Sale) => {
    setState((prev) => ({
      ...prev,
      sales: prev.sales.map((s) => (s.id === updated.id ? updated : s)),
    }));
  };

  const handleDeleteSale = (id: string) => {
    setState((prev) => ({
      ...prev,
      sales: prev.sales.filter((s) => s.id !== id),
    }));
  };

  const handleAddTournament = (newT: Tournament) => {
    setState((prev) => ({
      ...prev,
      tournaments: [newT, ...prev.tournaments],
    }));
  };

  const handleDeleteTournament = (id: string) => {
    setState((prev) => ({
      ...prev,
      tournaments: prev.tournaments.filter((t) => t.id !== id),
    }));
  };

  const handleAddExpense = (newExp: ExpenseItem) => {
    setState((prev) => ({
      ...prev,
      expenses: [newExp, ...(prev.expenses ?? [])],
    }));
  };

  const handleDeleteExpense = (id: string) => {
    setState((prev) => ({
      ...prev,
      expenses: (prev.expenses ?? []).filter((e) => e.id !== id),
    }));
  };

  const handleRestoreState = (newState: AppState) => {
    setState(newState);
  };

  const colgadoCount = state.sales.filter((s) => saleBalance(s) > 0).length;

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        colgadoCount={colgadoCount}
      />

      <main>
        {activeTab === 'intake' && (
          <IntakeParserView
            onAddSale={handleAddSale}
            onNavigateToReceivables={() => setActiveTab('receivables')}
          />
        )}

        {activeTab === 'receivables' && (
          <ReceivablesView
            sales={state.sales}
            onUpdateSale={handleUpdateSale}
            onDeleteSale={handleDeleteSale}
          />
        )}

        {activeTab === 'tournaments' && (
          <TournamentsView
            tournaments={state.tournaments}
            expenses={state.expenses ?? []}
            onAddTournament={handleAddTournament}
            onDeleteTournament={handleDeleteTournament}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        )}

        {activeTab === 'balance' && (
          <BalanceTotalView
            sales={state.sales}
            tournaments={state.tournaments}
            expenses={state.expenses ?? []}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'backup' && (
          <BackupView
            state={state}
            onRestoreState={handleRestoreState}
          />
        )}
      </main>
    </div>
  );
};
