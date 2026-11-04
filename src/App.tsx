import React, { useState, useEffect } from 'react';
import { loadState, saveState } from './storage/store';
import {
  emptyState,
  type AppState,
  type Sale,
  type Tournament,
  type ExpenseItem,
  type InventoryItem,
  type Purchase,
} from './domain/schemas';
import { saleBalance, todayIso, newId } from './domain/ledger';
import { Header, type TabType } from './components/Header';
import { IntakeParserView } from './components/IntakeParserView';
import { ReceivablesView } from './components/ReceivablesView';
import { TournamentsView } from './components/TournamentsView';
import { BalanceTotalView } from './components/BalanceTotalView';
import { BackupView } from './components/BackupView';
import { ReinvestmentView } from './components/ReinvestmentView';

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

  const handleAddInventory = (item: InventoryItem) => {
    setState((prev) => ({
      ...prev,
      inventory: [item, ...(prev.inventory ?? [])],
    }));
  };

  const handleUpdateInventory = (updated: InventoryItem) => {
    setState((prev) => ({
      ...prev,
      inventory: (prev.inventory ?? []).map((i) => (i.id === updated.id ? updated : i)),
    }));
  };

  const handleDeleteInventory = (id: string) => {
    setState((prev) => ({
      ...prev,
      inventory: (prev.inventory ?? []).filter((i) => i.id !== id),
    }));
  };

  const handleAddPurchase = (p: Purchase) => {
    setState((prev) => ({
      ...prev,
      purchases: [p, ...(prev.purchases ?? [])],
    }));
  };

  const handleDeletePurchase = (id: string) => {
    setState((prev) => ({
      ...prev,
      purchases: (prev.purchases ?? []).filter((p) => p.id !== id),
    }));
  };

  const handleConvertInventoryToSale = (
    item: InventoryItem,
    buyer: string,
    paidAmount: number,
    phone?: string,
    dueDate?: string,
  ) => {
    const today = todayIso();
    const payments =
      paidAmount > 0
        ? [
            {
              id: newId(),
              amount: paidAmount,
              date: today,
              note: 'Cobro inicial al pasar de stock a venta',
            },
          ]
        : [];

    const newSale: Sale = {
      id: newId(),
      buyer,
      item: item.description,
      total: item.price,
      payments,
      createdAt: today,
      dueDate,
      phone,
      notes: item.notes ? `Vendido desde stock: ${item.notes}` : undefined,
    };

    setState((prev) => ({
      ...prev,
      sales: [newSale, ...prev.sales],
      inventory: (prev.inventory ?? []).map((i) =>
        i.id === item.id ? { ...i, status: 'vendido' } : i,
      ),
    }));
  };

  const handleRestoreState = (newState: AppState) => {
    setState(newState);
  };

  const debtCount = state.sales.filter((s) => saleBalance(s) > 0).length;
  const stockCount = (state.inventory ?? []).filter((i) => i.status !== 'vendido').length;
  const colgadoCount = debtCount + stockCount;

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
            inventory={state.inventory ?? []}
            onUpdateSale={handleUpdateSale}
            onDeleteSale={handleDeleteSale}
            onAddInventory={handleAddInventory}
            onUpdateInventory={handleUpdateInventory}
            onDeleteInventory={handleDeleteInventory}
            onConvertInventoryToSale={handleConvertInventoryToSale}
          />
        )}

        {activeTab === 'reinvest' && (
          <ReinvestmentView
            purchases={state.purchases ?? []}
            inventory={state.inventory ?? []}
            onAddPurchase={handleAddPurchase}
            onDeletePurchase={handleDeletePurchase}
            onAddInventory={handleAddInventory}
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
            inventory={state.inventory ?? []}
            purchases={state.purchases ?? []}
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
